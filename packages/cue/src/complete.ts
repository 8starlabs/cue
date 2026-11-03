import { execFile } from "node:child_process";
import type { Dirent } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { parse, quote } from "shell-quote";
import type { FigArgument, FigGenerator, FigOption, FigSpec, FigSuggestion } from "./specs.js";
import { loadLocalSpec, loadModuleSpec, loadSpec, loadSpecLocation } from "./specs.js";

const execFileAsync = promisify(execFile);
const MAX_SUGGESTIONS = 50;
const DIRECTORY_CACHE_TTL_MS = 300;
const currentDirectoryDefaults: Record<string, string> = {
  ls: "List the current directory",
  find: "Search from the current directory",
  du: "Show disk usage for the current directory",
  tree: "List the current directory as a tree",
};
const directoryEntriesCache = new Map<string, { entries: Dirent[]; expiresAt: number }>();
const generatorCache = new WeakMap<
  FigGenerator,
  Map<string, { suggestions: FigSuggestion[]; token: string; updatedAt: number }>
>();
const generatorInFlight = new WeakMap<FigGenerator, Map<string, Promise<FigSuggestion[]>>>();
const specCache = new WeakMap<FigSpec, Map<string, FigSpec | undefined>>();

export type Completion = {
  name: string;
  displayName?: string;
  description?: string;
  argumentHint?: string;
  typedPrefix: string;
  insertValue: string;
  replaceValue?: string;
  icon?: string;
  type?: Fig.SuggestionType;
  isDangerous?: boolean;
  deprecated?: boolean;
  priority?: number;
  kind: "command" | "option" | "argument" | "enter";
};

type ParsedLine = {
  command: string;
  words: string[];
  partial: string;
  tokens: string[];
  redirect: boolean;
};

async function readDirectoryEntries(directory: string): Promise<Dirent[]> {
  const now = Date.now();
  const cached = directoryEntriesCache.get(directory);
  if (cached && cached.expiresAt > now) return cached.entries;

  const entries = await readdir(directory, { withFileTypes: true });
  if (directoryEntriesCache.size >= 128) {
    const oldestKey = directoryEntriesCache.keys().next().value;
    if (oldestKey) directoryEntriesCache.delete(oldestKey);
  }
  directoryEntriesCache.set(directory, { entries, expiresAt: now + DIRECTORY_CACHE_TTL_MS });
  return entries;
}

function parseLine(line: string): ParsedLine | undefined {
  const parsed = parse(line);
  const lastCommandSeparator = parsed.reduce(
    (last, part, index) =>
      typeof part === "object" && "op" in part && ["|", "||", "&&", ";", "&"].includes(part.op)
        ? index
        : last,
    -1,
  );
  const lastRedirect = parsed.reduce(
    (last, part, index) =>
      typeof part === "object" && "op" in part && [">", ">>", "<", "<<<"].includes(part.op)
        ? index
        : last,
    -1,
  );
  if (lastRedirect > lastCommandSeparator) {
    const redirectParts = parsed
      .slice(lastRedirect + 1)
      .filter((part): part is string => typeof part === "string");
    const partial = /\s$/.test(line) ? "" : (redirectParts.pop() ?? "");
    return {
      command: "__cue_filepath__",
      words: redirectParts,
      partial,
      tokens: redirectParts,
      redirect: true,
    };
  }
  const parts = parsed
    .slice(lastCommandSeparator + 1)
    .filter((part): part is string => typeof part === "string");
  const endsInWhitespace = /\s$/.test(line);
  if (parts.length === 0) return undefined;
  const commandIndex = parts.findIndex((part) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(part));
  if (commandIndex < 0 || commandIndex >= parts.length) return undefined;
  const command = parts[commandIndex];
  const words = parts.slice(commandIndex + 1);
  const partial = endsInWhitespace ? "" : (words.pop() ?? "");
  return {
    command,
    words,
    partial,
    tokens: [command, ...words, ...(partial ? [partial] : [])],
    redirect: false,
  };
}

function list(value: Array<string | FigSuggestion> | undefined): FigSuggestion[] {
  return (value ?? []).flatMap((item) => {
    if (typeof item === "string") return [{ name: item }];
    if (!item.name) return [];
    return Array.isArray(item.name) ? item.name.map((name) => ({ ...item, name })) : [item];
  });
}

function optionMatches(option: FigOption, word: string): boolean {
  const names = Array.isArray(option.name) ? option.name : [option.name];
  return names.includes(word);
}

function optionNames(option: FigOption): string[] {
  return Array.isArray(option.name) ? option.name : [option.name];
}

function optionSeparators(spec: FigSpec): string[] {
  const parserSeparators = spec.parserDirectives?.optionArgSeparators
    ? Array.isArray(spec.parserDirectives.optionArgSeparators)
      ? spec.parserDirectives.optionArgSeparators
      : [spec.parserDirectives.optionArgSeparators]
    : [];
  const optionSeparators = (spec.options ?? []).flatMap((option) =>
    typeof option.requiresSeparator === "string" ? [option.requiresSeparator] : [],
  );
  return [...new Set(["=", ...parserSeparators, ...optionSeparators])];
}

function expandShortOptionChain(
  token: string,
  options: FigOption[],
  flagsArePosixNoncompliant = false,
): Array<{ option: FigOption; hasAttachedValue: boolean }> | undefined {
  if (
    flagsArePosixNoncompliant ||
    !token.startsWith("-") ||
    token.startsWith("--") ||
    token.length < 3
  )
    return undefined;
  const chain: Array<{ option: FigOption; hasAttachedValue: boolean }> = [];
  for (let index = 1; index < token.length; index += 1) {
    const name = `-${token[index]}`;
    const option = options.find((candidate) => optionNames(candidate).includes(name));
    if (!option) return undefined;
    const optionArgs = Array.isArray(option.args) ? option.args : option.args ? [option.args] : [];
    const hasAttachedValue = index + 1 < token.length && optionArgs.length > 0;
    chain.push({ option, hasAttachedValue });
    if (optionArgs.length > 0) {
      if (hasAttachedValue) return chain;
      if (index + 1 !== token.length) return undefined;
      return chain;
    }
  }
  return chain;
}

type ActiveArgument = {
  argument?: FigArgument;
  partial: string;
  insertPrefix: string;
  positionalEntries: Array<{ argumentIndex: number; wordIndex: number; value: string }>;
  isOptionArgument?: boolean;
};

function optionValue(
  option: FigOption,
  token: string,
  separators: string[],
): { separator: string; prefix: string; value: string } | undefined {
  const optionArgs = Array.isArray(option.args) ? option.args : option.args ? [option.args] : [];
  if (optionArgs.length === 0) return undefined;
  for (const name of optionNames(option).sort((a, b) => b.length - a.length)) {
    for (const separator of separators) {
      const prefix = `${name}${separator}`;
      if (token.startsWith(prefix)) return { separator, prefix, value: token.slice(prefix.length) };
    }
    if (
      name.startsWith("-") &&
      name.length === 2 &&
      token.startsWith(name) &&
      token.length > name.length &&
      !token.startsWith("--")
    ) {
      return { separator: "", prefix: name, value: token.slice(name.length) };
    }
  }
  return undefined;
}

function activeArgument(spec: FigSpec, words: string[], partial: string): ActiveArgument {
  const args = Array.isArray(spec.args) ? spec.args : spec.args ? [spec.args] : [];
  const options = spec.options ?? [];
  const separators = optionSeparators(spec);
  let positionalIndex = 0;
  let awaiting: FigArgument[] = [];
  let optionsEnded = false;
  let requiresInlineValue = false;
  let variadicOptionArgument: FigArgument | undefined;
  const positionalEntries: ActiveArgument["positionalEntries"] = [];

  const consumeOption = (token: string): boolean => {
    const option = options.find(
      (candidate) =>
        optionMatches(candidate, token) || optionValue(candidate, token, separators) !== undefined,
    );
    if (!option) {
      const chain = expandShortOptionChain(
        token,
        options,
        spec.parserDirectives?.flagsArePosixNoncompliant,
      );
      if (!chain?.length) return false;
      const last = chain.at(-1)!;
      const optionArgs = Array.isArray(last.option.args)
        ? last.option.args
        : last.option.args
          ? [last.option.args]
          : [];
      if (optionArgs.length > 0) {
        awaiting = last.hasAttachedValue ? optionArgs.slice(1) : [...optionArgs];
        variadicOptionArgument =
          !last.hasAttachedValue && optionArgs[0]?.isVariadic ? optionArgs[0] : undefined;
      }
      return true;
    }
    const optionArgs = Array.isArray(option.args) ? option.args : option.args ? [option.args] : [];
    const inline = optionValue(option, token, separators);
    if (inline) {
      awaiting = optionArgs.slice(1);
      variadicOptionArgument = optionArgs[0]?.isVariadic ? optionArgs[0] : undefined;
    } else if (option.requiresSeparator || option.requiresEquals) {
      awaiting = [];
      requiresInlineValue = optionArgs.length > 0;
      variadicOptionArgument = undefined;
    } else {
      awaiting = [...optionArgs];
      requiresInlineValue = false;
      variadicOptionArgument = optionArgs[0]?.isVariadic ? optionArgs[0] : undefined;
    }
    return true;
  };

  for (const [wordIndex, word] of words.entries()) {
    if (awaiting.length > 0) {
      const expected = awaiting[0];
      if (
        expected.isVariadic &&
        expected.optionsCanBreakVariadicArg !== false &&
        !optionsEnded &&
        word.startsWith("-")
      ) {
        const previousAwaiting = [...awaiting];
        if (consumeOption(word)) {
          if (variadicOptionArgument?.optionsCanBreakVariadicArg !== false) {
            // consumeOption has prepared any arguments belonging to the
            // breaking option. The variadic option argument itself is done.
            variadicOptionArgument = undefined;
          } else {
            awaiting = previousAwaiting;
          }
          continue;
        }
      }
      if (expected.isVariadic) continue;
      awaiting.shift();
      continue;
    }
    if (variadicOptionArgument) {
      if (
        variadicOptionArgument.optionsCanBreakVariadicArg !== false &&
        !optionsEnded &&
        word.startsWith("-") &&
        consumeOption(word)
      ) {
        // A variadic option argument ends after a breaking option. The
        // subcommand's positional arguments, if any, follow it.
        variadicOptionArgument = undefined;
        continue;
      }
      continue;
    }
    if (!optionsEnded && word === "--") {
      optionsEnded = true;
      continue;
    }
    if (
      !optionsEnded &&
      word.startsWith("-") &&
      !(spec.parserDirectives?.optionsMustPrecedeArguments && positionalIndex > 0)
    ) {
      if (consumeOption(word)) continue;
      if (!spec.parserDirectives?.flagsArePosixNoncompliant) continue;
    }
    const current = args[positionalIndex];
    if (current?.isVariadic) {
      if (
        current.optionsCanBreakVariadicArg !== false &&
        !optionsEnded &&
        word.startsWith("-") &&
        consumeOption(word)
      ) {
        continue;
      } else {
        positionalEntries.push({ argumentIndex: positionalIndex, wordIndex, value: word });
        continue;
      }
    } else {
      positionalEntries.push({ argumentIndex: positionalIndex, wordIndex, value: word });
      positionalIndex += 1;
    }
  }

  if (partial && !optionsEnded && partial.startsWith("-")) {
    for (const option of options) {
      const inline = optionValue(option, partial, separators);
      if (inline) {
        const optionArgs = Array.isArray(option.args)
          ? option.args
          : option.args
            ? [option.args]
            : [];
        return {
          argument: optionArgs[0],
          partial: inline.value,
          insertPrefix: inline.prefix,
          positionalEntries,
          isOptionArgument: true,
        };
      }
    }
  }

  if (awaiting.length > 0 && !requiresInlineValue)
    return {
      argument: awaiting[0],
      partial,
      insertPrefix: "",
      positionalEntries,
      isOptionArgument: true,
    };
  if (requiresInlineValue)
    return { partial: "", insertPrefix: "", positionalEntries, isOptionArgument: true };
  const argument = args[positionalIndex] ?? (args.at(-1)?.isVariadic ? args.at(-1) : undefined);
  return { argument, partial, insertPrefix: "", positionalEntries };
}

async function normalizeRuntimeSpec(
  spec: Fig.Spec | undefined,
  cwd: string,
): Promise<FigSpec | undefined> {
  if (!spec) return undefined;
  const result = typeof spec === "function" ? await spec() : spec;
  if (result && typeof result === "object" && "versionedSpecPath" in result) {
    return loadSpec(result.versionedSpecPath, cwd);
  }
  return result as FigSpec;
}

async function findActiveSpec(
  root: FigSpec,
  words: string[],
  tokens: string[],
  cwd: string,
  environmentVariables: Record<string, string | undefined>,
): Promise<{ spec: FigSpec; remaining: string[]; ancestors: FigSpec[] }> {
  let spec = root;
  const remaining = [...words];
  const ancestors = [root];
  while (remaining.length > 0) {
    if (!spec.subcommands?.length) break;
    const token = remaining[0];
    if (token === "--") break;
    const separators = optionSeparators(spec);
    const inheritedOptions = ancestors
      .slice(0, -1)
      .flatMap((ancestor) => ancestor.options?.filter((option) => option.isPersistent) ?? []);
    const availableOptions = [...(spec.options ?? []), ...inheritedOptions];
    const matchedOption = availableOptions.find(
      (option) =>
        optionMatches(option, token) || optionValue(option, token, separators) !== undefined,
    );
    if (matchedOption) {
      const inline = optionValue(matchedOption, token, separators);
      const optionArgs = Array.isArray(matchedOption.args)
        ? matchedOption.args
        : matchedOption.args
          ? [matchedOption.args]
          : [];
      // Keep an option in the active parse when its value is the token being
      // completed. Otherwise this traversal consumes the flag and loses the
      // argument spec before suggestions such as `--format json` are built.
      if (!inline && optionArgs.length > Math.max(0, remaining.length - 1)) break;
      remaining.shift();
      if (!inline && !(matchedOption.requiresSeparator || matchedOption.requiresEquals)) {
        remaining.splice(0, optionArgs.length);
      }
      continue;
    }
    const optionChain = expandShortOptionChain(
      token,
      availableOptions,
      spec.parserDirectives?.flagsArePosixNoncompliant,
    );
    if (optionChain?.length) {
      remaining.shift();
      const last = optionChain.at(-1)!;
      const optionArgs = Array.isArray(last.option.args)
        ? last.option.args
        : last.option.args
          ? [last.option.args]
          : [];
      if (!last.hasAttachedValue) remaining.splice(0, optionArgs.length);
      continue;
    }
    const child = spec.subcommands?.find((candidate) =>
      Array.isArray(candidate.name) ? candidate.name.includes(token) : candidate.name === token,
    );
    if (child) {
      spec = await enrichSpec(child, tokens, cwd, environmentVariables);
      ancestors.push(spec);
      remaining.shift();
      continue;
    }
    break;
  }
  return { spec, remaining, ancestors };
}

function createExecutor(
  cwd: string,
  environmentVariables: Record<string, string | undefined> = process.env,
): Fig.ExecuteCommandFunction {
  return async (input) => {
    try {
      const { stdout, stderr } = await execFileAsync(input.command, input.args, {
        cwd: input.cwd ?? cwd,
        env: { ...process.env, ...environmentVariables, ...(input.env ?? {}) },
        timeout: input.timeout ?? 5_000,
        maxBuffer: 256_000,
        encoding: "utf8",
      });
      return { stdout, stderr, status: 0 };
    } catch (error) {
      const commandError = error as NodeJS.ErrnoException & {
        stdout?: string;
        stderr?: string;
        code?: number | string;
      };
      return {
        stdout: commandError.stdout ?? "",
        stderr: commandError.stderr ?? "",
        status: typeof commandError.code === "number" ? commandError.code : 1,
      };
    }
  };
}

async function resolveLoadSpec(
  spec: FigSpec,
  token: string,
  cwd: string,
  environmentVariables: Record<string, string | undefined>,
  executeCommand: Fig.ExecuteCommandFunction,
): Promise<FigSpec | undefined> {
  if (!spec.loadSpec) return undefined;
  const loaded =
    typeof spec.loadSpec === "function"
      ? await spec.loadSpec(token, executeCommand)
      : spec.loadSpec;
  const locations = Array.isArray(loaded) ? loaded : [loaded];
  const resolved = await Promise.all(
    locations.map(async (location) => {
      if (typeof location === "string") return loadSpec(location, cwd, environmentVariables);
      if ("type" in location) return loadSpecLocation(location, cwd, environmentVariables);
      return location;
    }),
  );
  const available = resolved.filter((value): value is FigSpec => !!value);
  if (available.length === 0) return undefined;
  return available.reduce(
    (combined, next) => ({
      ...combined,
      ...next,
      name: spec.name,
      description: spec.description ?? next.description,
      options: [...(combined.options ?? []), ...(next.options ?? [])],
      subcommands: [...(combined.subcommands ?? []), ...(next.subcommands ?? [])],
    }),
    spec,
  );
}

async function enrichSpec(
  spec: FigSpec,
  tokens: string[],
  cwd: string,
  environmentVariables: Record<string, string | undefined>,
): Promise<FigSpec> {
  const cacheEnabled = spec.cache !== false;
  const cacheKey = spec.generateSpecCacheKey
    ? typeof spec.generateSpecCacheKey === "string"
      ? spec.generateSpecCacheKey
      : spec.generateSpecCacheKey({ tokens })
    : undefined;
  const cache = specCache.get(spec) ?? new Map<string, FigSpec | undefined>();
  specCache.set(spec, cache);
  if (cacheEnabled && cacheKey !== undefined && cache.has(cacheKey))
    return cache.get(cacheKey) ?? spec;
  const generated = spec.generateSpec
    ? await spec.generateSpec(tokens, createExecutor(cwd, environmentVariables))
    : undefined;
  const loaded = await resolveLoadSpec(
    spec,
    tokens.at(-1) ?? "",
    cwd,
    environmentVariables,
    createExecutor(cwd, environmentVariables),
  );
  const generatedSpec = await normalizeRuntimeSpec(generated, cwd);
  const result: FigSpec = {
    ...spec,
    ...(generatedSpec ?? {}),
    ...(loaded ?? {}),
    name: spec.name,
    options: [
      ...(spec.options ?? []),
      ...(generatedSpec?.options ?? []),
      ...(loaded?.options ?? []),
    ],
    subcommands: [
      ...(spec.subcommands ?? []),
      ...(generatedSpec?.subcommands ?? []),
      ...(loaded?.subcommands ?? []),
    ],
  };
  if (cacheEnabled && cacheKey !== undefined) cache.set(cacheKey, result);
  return result;
}

async function runGenerator(
  generator: FigGenerator,
  cwd: string,
  environmentVariables: Record<string, string | undefined>,
  tokens: string[],
  currentToken: string,
  shellContext: Fig.GeneratorContext,
  contextKey: string,
): Promise<FigSuggestion[]> {
  const cache = generatorCache.get(generator) ?? new Map();
  const pending = generatorInFlight.get(generator) ?? new Map();
  generatorCache.set(generator, cache);
  generatorInFlight.set(generator, pending);
  const cached = cache.get(contextKey);

  const triggerFired =
    cached && generator.trigger
      ? triggerMatches(generator.trigger, currentToken, cached.token)
      : false;
  const isStale =
    !!cached &&
    generator.cache?.ttl !== undefined &&
    Date.now() - cached.updatedAt >= generator.cache.ttl;
  if (cached && !triggerFired && !isStale) return cached.suggestions;
  if (cached && isStale && generator.cache?.strategy !== "max-age" && !triggerFired) {
    if (!pending.has(contextKey)) {
      const refresh = generate()
        .then((suggestions) => {
          cache.set(contextKey, { suggestions, token: currentToken, updatedAt: Date.now() });
          return suggestions;
        })
        .finally(() => pending.delete(contextKey));
      pending.set(contextKey, refresh);
    }
    return cached.suggestions;
  }
  const existing = pending.get(contextKey);
  if (existing) return existing;
  const generation = generate()
    .then((suggestions) => {
      cache.set(contextKey, { suggestions, token: currentToken, updatedAt: Date.now() });
      return suggestions;
    })
    .finally(() => pending.delete(contextKey));
  pending.set(contextKey, generation);
  return generation;

  async function generate(): Promise<FigSuggestion[]> {
    const executeCommand: Fig.ExecuteCommandFunction = async (input) => {
      try {
        const { stdout, stderr } = await execFileAsync(input.command, input.args, {
          cwd: input.cwd ?? cwd,
          env: { ...process.env, ...environmentVariables, ...(input.env ?? {}) },
          timeout: input.timeout ?? 5_000,
          maxBuffer: 256_000,
          encoding: "utf8",
        });
        return { stdout, stderr, status: 0 };
      } catch (error) {
        const commandError = error as NodeJS.ErrnoException & {
          stdout?: string;
          stderr?: string;
          code?: number | string;
        };
        return {
          stdout: commandError.stdout ?? "",
          stderr: commandError.stderr ?? "",
          status: typeof commandError.code === "number" ? commandError.code : 1,
        };
      }
    };

    try {
      if (generator.custom) {
        return await generator.custom(tokens, executeCommand, shellContext);
      }

      if (!generator.script) return [];
      const script =
        typeof generator.script === "function" ? await generator.script(tokens) : generator.script;
      const input: Fig.ExecuteCommandInput = Array.isArray(script)
        ? { command: script[0], args: script.slice(1) }
        : typeof script === "string"
          ? { command: script, args: [] }
          : script;
      const result = await executeCommand({
        ...input,
        timeout: input.timeout ?? generator.scriptTimeout,
      });
      if (result.status !== 0 && !result.stdout) return [];
      if (generator.postProcess) return generator.postProcess(result.stdout, tokens);
      return result.stdout
        .split(generator.splitOn ?? "\n")
        .filter(Boolean)
        .map((name) => ({ name }));
    } catch {
      return [];
    }
  }
}

function triggerMatches(
  trigger: NonNullable<FigGenerator["trigger"]>,
  next: string,
  previous: string,
): boolean {
  if (typeof trigger === "function") return trigger(next, previous);
  if (typeof trigger === "string") {
    const nextIndex = next.lastIndexOf(trigger);
    const previousIndex = previous.lastIndexOf(trigger);
    return nextIndex !== previousIndex;
  }
  switch (trigger.on) {
    case "change":
      return next !== previous;
    case "threshold":
      return previous.length < trigger.length !== next.length < trigger.length;
    case "match": {
      const matches = Array.isArray(trigger.string) ? trigger.string : [trigger.string];
      return matches.some((match) => next.lastIndexOf(match) !== previous.lastIndexOf(match));
    }
  }
}

function generatorQueryTerm(generator: FigGenerator, token: string): string {
  const query = generator.getQueryTerm;
  if (typeof query === "function") return query(token);
  if (typeof query === "string") {
    const index = token.lastIndexOf(query);
    return index < 0 ? token : token.slice(index + query.length);
  }
  return token;
}

function asTemplateTypes(
  value: Fig.Arg["template"] | Fig.Generator["template"],
): Fig.TemplateStrings[] {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function expandHome(value: string): string {
  const home = homedir();
  if (value === "~") return home;
  if (value.startsWith("~/")) return path.join(home, value.slice(2));
  if (value === "$HOME") return home;
  if (value.startsWith("$HOME/")) return path.join(home, value.slice(6));
  return value;
}

function quotePath(value: string): string {
  if (value.startsWith("~/")) return `~/${quote([value.slice(2)])}`;
  if (value.startsWith("$HOME/")) return `$HOME/${quote([value.slice(6)])}`;
  return quote([value]);
}

async function completeDirectories(partial: string, cwd: string): Promise<Completion[]> {
  const slash = partial.lastIndexOf("/");
  const directoryPrefix = slash >= 0 ? partial.slice(0, slash + 1) : "";
  const namePrefix = slash >= 0 ? partial.slice(slash + 1) : partial;
  const target = path.resolve(cwd, expandHome(directoryPrefix || "."));
  let entries;
  try {
    entries = await readDirectoryEntries(target);
  } catch {
    return [];
  }

  const suggestions: Completion[] = [];
  // Offer parent navigation at the initial `cd ` prompt, and keep it available
  // while the user is following a path that began with `../`. After entering a
  // normal suggested folder, don't inject a parent row into the next list.
  const parentWasRequested = partial.length === 0 || partial === ".." || partial.startsWith("../");
  if (
    parentWasRequested &&
    target !== path.parse(target).root &&
    "..".startsWith(namePrefix) &&
    suggestions.length < MAX_SUGGESTIONS
  ) {
    const name = "../";
    suggestions.push({
      name,
      description: "Parent folder",
      typedPrefix: namePrefix,
      insertValue: quotePath(`${directoryPrefix}../`),
      icon: "fig://icon?type=folder",
      kind: "argument",
    });
  }

  for (const entry of entries) {
    if (suggestions.length >= MAX_SUGGESTIONS) break;
    if (entry.name.startsWith(".") && !namePrefix.startsWith(".")) continue;
    if (!entry.name.toLowerCase().startsWith(namePrefix.toLowerCase())) continue;
    let isDirectory = entry.isDirectory();
    if (!isDirectory && entry.isSymbolicLink()) {
      try {
        isDirectory = (await stat(path.join(target, entry.name))).isDirectory();
      } catch {
        continue;
      }
    }
    if (!isDirectory) continue;

    const name = `${entry.name}/`;
    suggestions.push({
      name,
      description: "Folder",
      typedPrefix: namePrefix,
      insertValue: quotePath(`${directoryPrefix}${name}`),
      icon: "fig://icon?type=folder",
      kind: "argument",
    });
  }
  return suggestions;
}

async function completeCodePaths(partial: string, cwd: string): Promise<Completion[]> {
  const slash = partial.lastIndexOf("/");
  const directoryPrefix = slash >= 0 ? partial.slice(0, slash + 1) : "";
  const namePrefix = slash >= 0 ? partial.slice(slash + 1) : partial;
  const target = path.resolve(cwd, expandHome(directoryPrefix || "."));
  let entries;
  try {
    entries = await readDirectoryEntries(target);
  } catch {
    return [];
  }

  const suggestions: Completion[] = [];
  if (partial === "" || partial === ".") {
    suggestions.push({
      name: ".",
      description: "Current directory",
      typedPrefix: partial,
      insertValue: ".",
      icon: "fig://icon?type=folder",
      kind: "argument",
    });
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".") && !namePrefix.startsWith(".")) continue;
    if (!entry.name.toLowerCase().startsWith(namePrefix.toLowerCase())) continue;

    let isDirectory = entry.isDirectory();
    if (!isDirectory && entry.isSymbolicLink()) {
      try {
        isDirectory = (await stat(path.join(target, entry.name))).isDirectory();
      } catch {
        // Keep broken symlinks available as file paths for tools that handle them.
      }
    }
    const name = `${entry.name}${isDirectory ? "/" : ""}`;
    suggestions.push({
      name,
      description: isDirectory ? "Folder" : "File",
      typedPrefix: namePrefix,
      insertValue: quotePath(`${directoryPrefix}${name}`),
      icon: isDirectory ? "fig://icon?type=folder" : undefined,
      kind: "argument",
    });
  }
  return suggestions
    .sort(
      (a, b) =>
        (a.name === "." ? -1 : a.kind === "argument" && a.name.endsWith("/") ? 0 : 1) -
          (b.name === "." ? -1 : b.kind === "argument" && b.name.endsWith("/") ? 0 : 1) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, MAX_SUGGESTIONS);
}

function fuzzyMatches(candidate: string, query: string): boolean {
  let index = 0;
  const normalizedCandidate = candidate.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  for (const character of normalizedQuery) {
    index = normalizedCandidate.indexOf(character, index);
    if (index < 0) return false;
    index += 1;
  }
  return true;
}

function matches(
  candidate: string,
  query: string,
  strategy: Fig.Arg["filterStrategy"] | Fig.Subcommand["filterStrategy"] = "default",
): boolean {
  if (!query) return true;
  if (candidate.toLowerCase().startsWith(query.toLowerCase())) return true;
  return strategy === "fuzzy" && fuzzyMatches(candidate, query);
}

function visible(
  suggestions: FigSuggestion[],
  partial: string,
  kind: Completion["kind"],
  strategy: Fig.Arg["filterStrategy"] | Fig.Subcommand["filterStrategy"] = "default",
): Completion[] {
  const normalized: Array<FigSuggestion & { name: string }> = suggestions.flatMap((item) => {
    const names = typeof item.name === "string" ? [item.name] : (item.name ?? []);
    return names.map((name) => ({ ...item, name }));
  });
  return normalized
    .filter(
      (item) =>
        item.name.trim().length > 0 &&
        (!(item.deprecated && typeof item.deprecated === "object"
          ? item.deprecated.hidden
          : item.hidden) ||
          item.name.toLowerCase() === partial.toLowerCase()) &&
        matches(item.name, partial, strategy),
    )
    .map((item, index) => ({ item, index }))
    .sort((a, b) => (b.item.priority ?? 50) - (a.item.priority ?? 50) || a.index - b.index)
    .slice(0, MAX_SUGGESTIONS)
    .map(({ item }) => {
      const args = Array.isArray(item.args) ? item.args : item.args ? [item.args] : [];
      const argument = args[0];
      const argumentHint = argument?.name
        ? argument.isOptional
          ? `[${argument.name}]`
          : `<${argument.name}>`
        : undefined;
      const option = item as FigOption;
      const deprecated = item.deprecated;
      const deprecatedDetails =
        deprecated && typeof deprecated === "object" ? deprecated : undefined;
      const separator =
        typeof option.requiresSeparator === "string"
          ? option.requiresSeparator
          : option.requiresSeparator || option.requiresEquals
            ? "="
            : "";
      const defaultInsertValue =
        kind === "option"
          ? `${item.name}${separator || (args.length > 0 ? " " : "")}`
          : kind === "command" &&
              ((item as FigSpec).requiresSubcommand ||
                args.some((argument) => !argument.isOptional))
            ? `${item.name} `
            : item.name;
      const insertValue = Array.isArray(item.insertValue)
        ? (item.insertValue[0] ?? defaultInsertValue)
        : (deprecatedDetails?.insertValue ?? item.insertValue ?? defaultInsertValue);
      return {
        name: item.name,
        displayName: deprecatedDetails?.displayName ?? item.displayName,
        description: deprecatedDetails?.description ?? item.description,
        argumentHint,
        typedPrefix: partial,
        insertValue,
        replaceValue: deprecatedDetails?.replaceValue ?? item.replaceValue,
        icon: deprecatedDetails?.icon ?? item.icon,
        type: item.type,
        isDangerous: deprecatedDetails?.isDangerous ?? item.isDangerous,
        deprecated: !!deprecated,
        priority: deprecatedDetails?.priority ?? item.priority ?? 50,
        kind,
      };
    });
}

export async function complete(
  line: string,
  cwd = process.cwd(),
  rootOverride?: FigSpec,
  environmentOverride?: Record<string, string>,
): Promise<Completion[]> {
  const parsed = parseLine(line);
  if (!parsed) return [];
  const shellEnvironment: Record<string, string | undefined> = {
    ...process.env,
    ...(environmentOverride ?? {}),
  };
  if (parsed.redirect || parsed.command === "__cue_filepath__")
    return completeCodePaths(parsed.partial, cwd);
  const commandName = path.basename(parsed.command);
  if (parsed.words.length === 0 && parsed.partial.length === 0 && !/\s$/.test(line)) {
    // The command token is complete, but the user has not started its next
    // argument. This also covers special path commands such as `cd`/`code`.
    return [];
  }
  if (commandName === "cd") {
    // `cd` takes one path. Once a path has been completed and the user types
    // a space, there is no next argument to suggest (especially after `..`).
    if (/\s$/.test(line) && parsed.words.length > 0) return [];
    return completeDirectories(parsed.partial, cwd);
  }

  // `code` accepts file and folder paths as its ordinary arguments. Handle
  // those before loading its Fig spec so path completion stays immediate.
  if (commandName === "code" && !parsed.partial.startsWith("-")) {
    return completeCodePaths(parsed.partial, cwd);
  }

  const loadedRoot = rootOverride ?? (await loadSpec(commandName, cwd, shellEnvironment));
  if (!loadedRoot) return [];

  const root = await enrichSpec(loadedRoot, parsed.tokens, cwd, shellEnvironment);
  const { spec, remaining, ancestors } = await findActiveSpec(
    root,
    parsed.words,
    parsed.tokens,
    cwd,
    shellEnvironment,
  );
  const inheritedOptions = ancestors
    .slice(0, -1)
    .flatMap((ancestor) => ancestor.options?.filter((option) => option.isPersistent) ?? []);
  const effectiveSpec: FigSpec = {
    ...spec,
    options: [...inheritedOptions, ...(spec.options ?? [])],
  };
  const separators = optionSeparators(effectiveSpec);
  const options = list(effectiveSpec.options ?? []).filter((option) =>
    isOptionAvailable(
      option as FigOption,
      parsed.words,
      effectiveSpec.options ?? [],
      effectiveSpec.parserDirectives?.flagsArePosixNoncompliant,
      separators,
    ),
  );
  const children = spec.subcommands ?? [];
  if (!/\s$/.test(line) && list(children).some(({ name }) => name === parsed.partial)) {
    // The current token exactly names a subcommand. Wait for its trailing
    // space before replacing it with the next token's suggestions.
    return [];
  }
  const isBareCommand = remaining.length === 0 && parsed.partial.length === 0 && !/\s$/.test(line);
  // A completed command with no trailing space is still the command itself.
  // Wait until the user types a space before offering its next token, so
  // accepting a suggestion cannot replace the command (for example, `clear`
  // or `ls`).
  if (isBareCommand) return [];
  const argumentContext = activeArgument(effectiveSpec, remaining, parsed.partial);
  const argument = argumentContext.argument;
  const argumentPartial = argumentContext.partial;

  // Fig lets an argument hand completion off to another command, script, or
  // module (for example `time git` or `python main.py`). Reuse that command's
  // normal spec interpreter once the argument contains a command token.
  const args = Array.isArray(effectiveSpec.args)
    ? effectiveSpec.args
    : effectiveSpec.args
      ? [effectiveSpec.args]
      : [];
  const commandEntry = argumentContext.positionalEntries.find((entry) => {
    const candidate = args[entry.argumentIndex];
    return (
      candidate?.isCommand || candidate?.isScript || candidate?.isModule || candidate?.loadSpec
    );
  });
  if (commandEntry) {
    const commandArgument = args[commandEntry.argumentIndex];
    const commandName = commandEntry.value;
    const delegatedSpec = await loadDelegatedSpec(
      commandArgument,
      commandName,
      cwd,
      shellEnvironment,
    );
    if (delegatedSpec) {
      const tail = remaining.slice(commandEntry.wordIndex + 1);
      const delegatedWords = [commandName, ...tail, ...(parsed.partial ? [parsed.partial] : [])];
      const delegatedLine =
        delegatedWords.map((word) => quote([word])).join(" ") + (/\s$/.test(line) ? " " : "");
      return complete(delegatedLine, cwd, delegatedSpec, environmentOverride);
    }
  }

  const aliasEntry = argumentContext.positionalEntries.find(
    (entry) => !!args[entry.argumentIndex]?.parserDirectives?.alias,
  );
  if (aliasEntry) {
    const aliasArgument = args[aliasEntry.argumentIndex];
    const aliasDefinition = aliasArgument.parserDirectives?.alias;
    const expanded =
      typeof aliasDefinition === "function"
        ? await aliasDefinition(aliasEntry.value, createExecutor(cwd, shellEnvironment))
        : aliasDefinition;
    if (expanded && expanded !== aliasEntry.value) {
      const expandedTokens = parse(expanded).filter(
        (part): part is string => typeof part === "string",
      );
      if (expandedTokens.length > 0) {
        const globalWordIndex = parsed.words.length - remaining.length + aliasEntry.wordIndex;
        const tokenIndex = globalWordIndex + 1; // Include the command at tokens[0].
        const rewritten = [
          ...parsed.tokens.slice(0, tokenIndex),
          ...expandedTokens,
          ...parsed.tokens.slice(tokenIndex + 1),
        ];
        const rewrittenLine =
          rewritten.map((word) => quote([word])).join(" ") + (/\s$/.test(line) ? " " : "");
        return complete(rewrittenLine, cwd, undefined, environmentOverride);
      }
    }
  }

  // `isCommand` arguments can suggest commands found on PATH before one is
  // selected. This gives the user a useful first step without a Fig daemon.
  if (
    argument &&
    (argument.isCommand || argument.loadSpec) &&
    !argumentContext.positionalEntries.some(
      (entry) => entry.argumentIndex === args.indexOf(argument),
    )
  ) {
    return completeExecutableNames(argumentPartial, shellEnvironment.PATH ?? "");
  }
  if (
    argument?.isScript &&
    !argumentContext.positionalEntries.some(
      (entry) => entry.argumentIndex === args.indexOf(argument),
    )
  ) {
    return completeCodePaths(argumentPartial, cwd);
  }

  const staticArgs = list(argument?.suggestions);
  const generators = argument?.generators
    ? Array.isArray(argument.generators)
      ? argument.generators
      : [argument.generators]
    : [];
  const environmentVariables = Object.fromEntries(
    Object.entries(shellEnvironment).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  const shellContext: Fig.GeneratorContext = {
    currentWorkingDirectory: cwd,
    environmentVariables,
    currentProcess: shellEnvironment.SHELL ?? "zsh",
    sshPrefix: "",
    searchTerm: argumentPartial,
  };
  const contextKey = JSON.stringify([commandName, ...parsed.words, spec.name, argument?.name]);
  const argumentFilter = argument?.filterStrategy ?? spec.filterStrategy ?? "default";
  const generatedGroups = await Promise.all(
    generators.map(async (generator) => {
      const generatorKey = generator.cache?.cacheKey
        ? JSON.stringify([generator.cache.cacheKey, generator.cache.cacheByDirectory ? cwd : ""])
        : JSON.stringify([contextKey, generator.cache?.cacheByDirectory ? cwd : ""]);
      const queryTerm = generatorQueryTerm(generator, argumentPartial);
      const suggestions = await runGenerator(
        generator,
        cwd,
        shellEnvironment,
        parsed.tokens,
        argumentPartial,
        { ...shellContext, searchTerm: queryTerm },
        generatorKey,
      );
      return { suggestions, queryTerm };
    }),
  );
  const argumentTemplateSuggestions = await completeTemplates(
    asTemplateTypes(argument?.template),
    argumentPartial,
    cwd,
    spec,
    parsed.words.length,
  );
  const generatedTemplateGroups = await Promise.all(
    generators.map(async (generator, index) => {
      const suggestions = await completeTemplates(
        asTemplateTypes(generator.template),
        argumentPartial,
        cwd,
        spec,
        parsed.words.length,
      );
      if (!generator.filterTemplateSuggestions)
        return { suggestions, queryTerm: generatedGroups[index]?.queryTerm ?? argumentPartial };
      try {
        return {
          suggestions: generator.filterTemplateSuggestions(suggestions as Fig.TemplateSuggestion[]),
          queryTerm: generatedGroups[index]?.queryTerm ?? argumentPartial,
        };
      } catch {
        return { suggestions: [], queryTerm: generatedGroups[index]?.queryTerm ?? argumentPartial };
      }
    }),
  );
  const additional = list(spec.additionalSuggestions);
  const currentToken =
    argument?.suggestCurrentToken && argumentPartial
      ? [
          {
            name: argumentPartial,
            insertValue: argumentPartial,
            description: argument.description,
            priority: 101,
          },
        ]
      : [];
  const argumentIsDangerous = !!argument?.isDangerous;
  const allArgumentSuggestions = [
    ...visible([...currentToken, ...staticArgs], argumentPartial, "argument", argumentFilter),
    ...generatedGroups.flatMap((group) =>
      visible(group.suggestions, group.queryTerm, "argument", argumentFilter),
    ),
    ...visible(argumentTemplateSuggestions, argumentPartial, "argument", argumentFilter),
    ...generatedTemplateGroups.flatMap((group) =>
      visible(group.suggestions, group.queryTerm, "argument", argumentFilter),
    ),
  ]
    .map((suggestion, index) => ({ suggestion, index }))
    .sort(
      (a, b) => (b.suggestion.priority ?? 50) - (a.suggestion.priority ?? 50) || a.index - b.index,
    )
    .map(({ suggestion }) => suggestion);
  const seenArgumentSuggestions = new Set<string>();
  const argumentSuggestions = allArgumentSuggestions
    .filter((completion) => {
      const key = `${completion.name}\0${completion.insertValue}`;
      if (seenArgumentSuggestions.has(key)) return false;
      seenArgumentSuggestions.add(key);
      return true;
    })
    .map((completion) => ({
      ...completion,
      typedPrefix: argumentPartial,
      insertValue: `${argumentContext.insertPrefix}${completion.insertValue}`,
      isDangerous: completion.isDangerous || argumentIsDangerous,
    }));

  const suggestsCurrentDirectoryForGitAdd =
    commandName === "git" &&
    spec.name === "add" &&
    !!argument?.isVariadic &&
    argumentContext.positionalEntries.length === 0 &&
    (argumentPartial === "" || argumentPartial === ".");
  if (suggestsCurrentDirectoryForGitAdd) {
    argumentSuggestions.unshift({
      name: ".",
      description: "Stage changes in the current directory",
      typedPrefix: argumentPartial,
      insertValue: ".",
      isDangerous: false,
      kind: "enter",
      priority: 101,
    });
  }

  const currentDirectoryDescription = currentDirectoryDefaults[commandName];
  const suggestsCurrentDirectoryByDefault =
    currentDirectoryDescription !== undefined &&
    spec.name === commandName &&
    argumentContext.positionalEntries.length === 0 &&
    (argumentPartial === "" || argumentPartial === ".");
  if (suggestsCurrentDirectoryByDefault) {
    // Filepath templates can produce their own `.` completion. Keep the
    // explicit current-directory row as the single, descriptive option.
    for (let index = argumentSuggestions.length - 1; index >= 0; index -= 1) {
      const suggestion = argumentSuggestions[index];
      if (suggestion?.name === "." && suggestion.insertValue === ".") {
        argumentSuggestions.splice(index, 1);
      }
    }
    argumentSuggestions.unshift({
      name: ".",
      description: currentDirectoryDescription,
      typedPrefix: argumentPartial,
      insertValue: ".",
      isDangerous: false,
      kind: "enter",
      priority: 101,
    });
  }

  if (spec.requiresSubcommand && children.length > 0) {
    return visible(list(children), parsed.partial, "command", spec.filterStrategy).slice(
      0,
      MAX_SUGGESTIONS,
    );
  }
  const hasPositionalArgument =
    argumentContext.positionalEntries.length > 0 ||
    (!!argument &&
      !argumentContext.isOptionArgument &&
      !!argumentPartial &&
      !argumentPartial.startsWith("-"));
  const visibleOptions =
    effectiveSpec.parserDirectives?.optionsMustPrecedeArguments && hasPositionalArgument
      ? []
      : visible(options, parsed.partial, "option", spec.filterStrategy);
  return [
    ...visible(list(children), parsed.partial, "command", spec.filterStrategy),
    ...argumentSuggestions,
    ...visibleOptions,
    ...visible(additional, parsed.partial, "argument", spec.filterStrategy),
  ].slice(0, MAX_SUGGESTIONS);
}

async function loadDelegatedSpec(
  argument: FigArgument,
  token: string,
  cwd: string,
  environmentVariables: Record<string, string | undefined>,
): Promise<FigSpec | undefined> {
  if (argument.loadSpec) {
    return resolveLoadSpec(
      { name: token, loadSpec: argument.loadSpec },
      token,
      cwd,
      environmentVariables,
      createExecutor(cwd, environmentVariables),
    );
  }
  if (argument.isScript) return loadLocalSpec(path.basename(token), cwd);
  if (argument.isModule)
    return loadModuleSpec(`${argument.isModule}${token}`, cwd, environmentVariables);
  if (argument.isCommand) return loadSpec(path.basename(token), cwd, environmentVariables);
  return undefined;
}

async function completeExecutableNames(partial: string, searchPath: string): Promise<Completion[]> {
  if (!partial || partial.startsWith("/") || partial.startsWith("~")) return [];
  const seen = new Set<string>();
  for (const directory of searchPath.split(path.delimiter)) {
    try {
      const entries = await readDirectoryEntries(directory);
      for (const entry of entries) {
        if (
          (!entry.isFile() && !entry.isSymbolicLink()) ||
          !entry.name.startsWith(partial) ||
          seen.has(entry.name)
        )
          continue;
        try {
          const details = await stat(path.join(directory, entry.name));
          if (!(details.mode & 0o111)) continue;
        } catch {
          continue;
        }
        seen.add(entry.name);
        if (seen.size >= MAX_SUGGESTIONS) break;
      }
    } catch {
      // A PATH entry can disappear or be unreadable; skip it.
    }
    if (seen.size >= MAX_SUGGESTIONS) break;
  }
  return [...seen].sort().map((name) => ({
    name,
    description: "Command",
    typedPrefix: partial,
    insertValue: name,
    kind: "command" as const,
  }));
}

function isOptionAvailable(
  option: FigOption,
  usedTokens: string[],
  allOptions: FigOption[],
  flagsArePosixNoncompliant = false,
  separators: string[] = ["=", ":"],
): boolean {
  const names = typeof option.name === "string" ? [option.name] : (option.name ?? []);
  const usedNames = new Set(
    usedTokens.flatMap((token) => {
      const direct = allOptions.find(
        (candidate) =>
          optionMatches(candidate, token) ||
          optionValue(candidate, token, separators) !== undefined,
      );
      if (direct) return optionNames(direct);
      return (
        expandShortOptionChain(token, allOptions, flagsArePosixNoncompliant)?.flatMap(
          ({ option: usedOption }) => optionNames(usedOption),
        ) ?? []
      );
    }),
  );
  const hasUsedName = (optionName: string) => usedNames.has(optionName);
  const used = usedTokens.filter((token) => {
    const direct = allOptions.find(
      (candidate) =>
        optionMatches(candidate, token) || optionValue(candidate, token, separators) !== undefined,
    );
    const tokenNames = direct
      ? optionNames(direct)
      : (expandShortOptionChain(token, allOptions, flagsArePosixNoncompliant)?.flatMap(
          ({ option: usedOption }) => optionNames(usedOption),
        ) ?? []);
    return tokenNames.some((name) => names.includes(name));
  }).length;
  if (option.isRepeatable !== undefined && option.isRepeatable !== true) {
    const maximum = typeof option.isRepeatable === "number" ? option.isRepeatable : 1;
    if (used >= maximum) return false;
  }
  if (option.dependsOn?.some((dependency) => !hasUsedName(dependency))) return false;
  if (option.exclusiveOn?.some((exclusive) => hasUsedName(exclusive))) return false;
  return true;
}

type TemplateSuggestion = Omit<Fig.Suggestion, "name"> & {
  name?: string;
  context: Fig.TemplateSuggestionContext;
};

async function completeTemplates(
  templates: Fig.TemplateStrings[],
  partial: string,
  cwd: string,
  spec: FigSpec,
  argumentIndex: number,
): Promise<TemplateSuggestion[]> {
  const uniqueTemplates = [...new Set(templates)];
  const results: TemplateSuggestion[] = [];
  for (const templateType of uniqueTemplates) {
    if (templateType === "filepaths" || templateType === "folders") {
      const completions =
        templateType === "filepaths"
          ? await completeCodePaths(partial, cwd)
          : await completeDirectories(partial, cwd);
      results.push(
        ...completions.map((completion) => ({
          name: completion.name,
          displayName: completion.displayName,
          description: completion.description,
          insertValue: completion.insertValue,
          icon: completion.icon,
          type: completion.name.endsWith("/") ? ("folder" as const) : ("file" as const),
          context: { templateType },
        })),
      );
    } else if (templateType === "help") {
      results.push(
        ...(spec.subcommands ?? []).flatMap((subcommand) => {
          const names = Array.isArray(subcommand.name) ? subcommand.name : [subcommand.name];
          return names.map((name) => ({
            name,
            displayName: subcommand.displayName,
            description: subcommand.description,
            insertValue: subcommand.insertValue,
            icon: subcommand.icon,
            context: { templateType },
          }));
        }),
      );
    } else if (templateType === "history") {
      const historyPath = process.env.HISTFILE || path.join(homedir(), ".zsh_history");
      try {
        const contents = await readFile(historyPath, "utf8");
        const seen = new Set<string>();
        const entries = contents.split(/\r?\n/).reverse();
        for (const entry of entries) {
          const command = entry.replace(/^: \d+:\d+;/, "").trim();
          const parsed = parse(command).filter((part): part is string => typeof part === "string");
          const name = parsed[Math.max(0, argumentIndex)];
          if (!name || seen.has(name) || !matches(name, partial)) continue;
          seen.add(name);
          results.push({
            name,
            description: "Command history",
            context: {
              templateType,
              currentWorkingDirectory: cwd,
              shell: "zsh",
              time: Date.now(),
              exitCode: 0,
            },
          });
          if (results.length >= MAX_SUGGESTIONS) break;
        }
      } catch {
        // History is optional; a missing or unreadable file produces no rows.
      }
    }
  }
  return results.slice(0, MAX_SUGGESTIONS);
}
