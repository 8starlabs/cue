import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parse } from "shell-quote";
import type { FigArgument, FigGenerator, FigOption, FigSpec, FigSuggestion } from "./specs.js";
import { loadSpec } from "./specs.js";

const execFileAsync = promisify(execFile);

export type Completion = {
  name: string;
  description?: string;
  argumentHint?: string;
  typedPrefix: string;
  insertValue: string;
  icon?: string;
  kind: "command" | "option" | "argument";
};

type ParsedLine = {
  command: string;
  words: string[];
  partial: string;
};

function parseLine(line: string): ParsedLine | undefined {
  const parts = parse(line).filter((part): part is string => typeof part === "string");
  const endsInWhitespace = /\s$/.test(line);
  if (parts.length === 0) return undefined;
  const command = parts[0];
  const words = parts.slice(1);
  const partial = endsInWhitespace ? "" : words.pop() ?? "";
  return { command, words, partial };
}

function list(value: FigArgument["suggestions"]): FigSuggestion[] {
  return (value ?? []).flatMap((item) => {
    if (typeof item === "string") return [{ name: item }];
    return Array.isArray(item.name)
      ? item.name.map((name) => ({ ...item, name }))
      : [item];
  });
}

function optionMatches(option: FigOption, word: string): boolean {
  const names = Array.isArray(option.name) ? option.name : option.name.split(", ");
  return names.includes(word);
}

function findActiveSpec(root: FigSpec, words: string[]): { spec: FigSpec; remaining: string[] } {
  let spec = root;
  const remaining = [...words];
  while (remaining.length > 0) {
    const token = remaining[0];
    const child = spec.subcommands?.find((candidate) =>
      Array.isArray(candidate.name) ? candidate.name.includes(token) : candidate.name === token
    );
    if (child) {
      spec = child;
      remaining.shift();
      continue;
    }
    break;
  }
  return { spec, remaining };
}

function activeArgument(spec: FigSpec, words: string[]): FigArgument | undefined {
  let positionalIndex = 0;
  let awaiting: FigArgument | undefined;
  const options = spec.options ?? [];
  const args = Array.isArray(spec.args) ? spec.args : spec.args ? [spec.args] : [];

  for (const word of words) {
    if (awaiting) {
      awaiting = undefined;
      continue;
    }
    if (word.startsWith("-")) {
      const option = options.find((item) => optionMatches(item, word));
      const optionArgs = Array.isArray(option?.args) ? option.args : option?.args ? [option.args] : [];
      if (optionArgs.length) awaiting = optionArgs[0];
      continue;
    }
    positionalIndex += 1;
  }
  return args[Math.min(positionalIndex, Math.max(0, args.length - 1))];
}

async function runGenerator(generator: FigGenerator, cwd: string, context: string[]): Promise<FigSuggestion[]> {
  if (generator.suggestions?.length) return list(generator.suggestions);
  if (!generator.script) return [];

  const command = Array.isArray(generator.script) ? generator.script[0] : generator.script;
  const args = Array.isArray(generator.script) ? generator.script.slice(1) : [];
  try {
    const { stdout } = await execFileAsync(command, args, { cwd, timeout: 300, maxBuffer: 256_000 });
    return generator.postProcess ? generator.postProcess(stdout, context) : stdout.split(/\r?\n/).filter(Boolean).map((name) => ({ name }));
  } catch {
    return [];
  }
}

function visible(suggestions: FigSuggestion[], partial: string, kind: Completion["kind"]): Completion[] {
  const normalized: Array<FigSuggestion & { name: string }> = suggestions.flatMap((item) => {
    const names = typeof item.name === "string" ? [item.name] : item.name;
    return names.map((name) => ({ ...item, name }));
  });
  return normalized
    .filter((item) => item.name.trim().length > 0 && item.name.toLowerCase().startsWith(partial.toLowerCase()))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.name.localeCompare(b.name))
    .slice(0, 12)
    .map((item) => {
      const args = Array.isArray(item.args) ? item.args : item.args ? [item.args] : [];
      const argument = args[0];
      const argumentHint = argument?.name
        ? argument.isOptional ? `[${argument.name}]` : `<${argument.name}>`
        : undefined;
      return {
        name: item.name,
        description: item.description,
        argumentHint,
        typedPrefix: partial,
        insertValue: Array.isArray(item.insertValue) ? item.insertValue[0] ?? item.name : item.insertValue ?? item.name,
        icon: item.icon,
        kind,
      };
    });
}

export async function complete(line: string, cwd = process.cwd()): Promise<Completion[]> {
  const parsed = parseLine(line);
  if (!parsed) return [];

  const root = await loadSpec(parsed.command);
  if (!root) return [];

  const { spec, remaining } = findActiveSpec(root, parsed.words);
  const options = list(spec.options ?? []).filter((option) => !remaining.includes(option.name as string));
  const children = spec.subcommands ?? [];
  const isRootCommand = spec === root;
  const argument = isRootCommand && remaining.length === 0
    ? undefined
    : activeArgument(spec, remaining);
  const staticArgs = list(argument?.suggestions);
  const generators = argument?.generators ? (Array.isArray(argument.generators) ? argument.generators : [argument.generators]) : [];
  const generated = (await Promise.all(generators.map((generator) => runGenerator(generator, cwd, remaining)))).flat();
  const additional = spec.additionalSuggestions ?? [];

  return [
    ...visible(children, parsed.partial, "command"),
    ...visible([...staticArgs, ...generated], parsed.partial, "argument"),
    ...visible(options, parsed.partial, "option"),
    ...visible(additional, parsed.partial, "argument"),
  ].slice(0, 12);
}
