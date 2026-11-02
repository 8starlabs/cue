/// <reference types="@withfig/autocomplete-types" />

import path from "node:path";
import { homedir } from "node:os";
import { pathToFileURL } from "node:url";
import { realpath } from "node:fs/promises";

type DynamicModule = {
  default: Fig.Spec;
  getVersionCommand?: (executeCommand: Fig.ExecuteCommandFunction) => Promise<string>;
};
type DynamicIndex = Record<string, () => Promise<DynamicModule>>;

const dynamicModule = import("@withfig/autocomplete/dynamic");
const loadedSpecs = new Map<string, Promise<Fig.Subcommand | undefined>>();
const MAX_LOADED_SPECS = 256;

function resolveSpecFile(root: string, name: string, relativeTo = root): string | undefined {
  if (typeof name !== "string" || !name || name.includes("\0") || path.isAbsolute(name))
    return undefined;

  const resolvedRoot = path.resolve(root);
  const file = path.resolve(relativeTo, `${name}.js`);
  const relativePath = path.relative(resolvedRoot, file);
  if (
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    return undefined;
  }
  return file;
}

async function resolveContainedSpecFile(
  root: string,
  name: string,
  relativeTo = root,
): Promise<string | undefined> {
  try {
    const resolvedRoot = await realpath(root);
    const resolvedBase = relativeTo === root ? resolvedRoot : await realpath(relativeTo);
    const file = resolveSpecFile(resolvedRoot, name, resolvedBase);
    if (!file) return undefined;

    const resolvedFile = await realpath(file);
    const relativePath = path.relative(resolvedRoot, resolvedFile);
    if (
      relativePath === ".." ||
      relativePath.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relativePath)
    ) {
      return undefined;
    }
    return resolvedFile;
  } catch {
    return undefined;
  }
}

async function normalizeSpec(
  spec: Fig.Spec,
  loaders: DynamicIndex,
  cwd: string,
  environmentVariables: Record<string, string | undefined>,
  getVersionCommand?: DynamicModule["getVersionCommand"],
): Promise<Fig.Subcommand | undefined> {
  let result: Fig.Spec | { versionedSpecPath: string; version?: string } = spec;
  if (typeof spec === "function") {
    let version: string | undefined;
    if (getVersionCommand) {
      try {
        const { execFile } = await import("node:child_process");
        const { promisify } = await import("node:util");
        const execFileAsync = promisify(execFile);
        version = await getVersionCommand(async (input) => {
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
        });
      } catch {
        // If a CLI is not installed or has no version output, use the
        // version resolver's default catalog entry.
      }
    }
    result = await (
      spec as (version?: string) => Fig.Subcommand | { versionedSpecPath: string; version?: string }
    )(version);
  }
  if (result && typeof result === "object" && "versionedSpecPath" in result) {
    const versionLoader = loaders[result.versionedSpecPath];
    if (!versionLoader) return undefined;
    const versionModule = await versionLoader();
    return normalizeSpec(
      versionModule.default,
      loaders,
      cwd,
      environmentVariables,
      versionModule.getVersionCommand,
    );
  }
  return result as Fig.Subcommand;
}

export async function loadSpec(
  command: string,
  cwd = process.cwd(),
  environmentVariables: Record<string, string | undefined> = process.env,
): Promise<Fig.Subcommand | undefined> {
  const cacheKey = `${cwd}\0${command}\0${environmentVariables.PATH ?? ""}`;
  const cached = loadedSpecs.get(cacheKey);
  if (cached) {
    loadedSpecs.delete(cacheKey);
    loadedSpecs.set(cacheKey, cached);
    return cached;
  }
  if (loadedSpecs.size >= MAX_LOADED_SPECS) {
    const oldestKey = loadedSpecs.keys().next().value;
    if (oldestKey) loadedSpecs.delete(oldestKey);
  }
  const pending = load();
  loadedSpecs.set(cacheKey, pending);
  try {
    const result = await pending;
    if (!result) loadedSpecs.delete(cacheKey);
    return result;
  } catch {
    loadedSpecs.delete(cacheKey);
    return undefined;
  }

  async function load(): Promise<Fig.Subcommand | undefined> {
    const module = await dynamicModule;
    const loaders = module.default as DynamicIndex;
    const loader =
      loaders[command] ?? loaders[command.endsWith("/index") ? command : `${command}/index`];
    if (!loader) return undefined;
    const loaded = await loader();
    return normalizeSpec(
      loaded.default,
      loaders,
      cwd,
      environmentVariables,
      loaded.getVersionCommand,
    );
  }
}

export async function loadLocalSpec(
  name: string,
  cwd: string,
  directory = cwd,
): Promise<Fig.Subcommand | undefined> {
  const expandedDirectory =
    directory === "~"
      ? (process.env.HOME ?? directory)
      : directory.startsWith("~/")
        ? path.join(process.env.HOME ?? directory, directory.slice(2))
        : directory;
  const specRoot = path.resolve(expandedDirectory, ".fig", "autocomplete", "build");
  const file = await resolveContainedSpecFile(specRoot, name);
  if (!file) return undefined;
  try {
    const module = (await import(pathToFileURL(file).href)) as { default: Fig.Spec };
    let result: Fig.Spec | { versionedSpecPath: string; version?: string } = module.default;
    if (typeof module.default === "function") result = await module.default();
    if (result && typeof result === "object" && "versionedSpecPath" in result) {
      const versionFile = await resolveContainedSpecFile(
        specRoot,
        result.versionedSpecPath,
        path.dirname(file),
      );
      if (!versionFile) return undefined;
      const versionModule = (await import(pathToFileURL(versionFile).href)) as {
        default: Fig.Spec;
      };
      result =
        typeof versionModule.default === "function"
          ? await versionModule.default()
          : versionModule.default;
    }
    return result && typeof result === "object" && !("versionedSpecPath" in result)
      ? (result as Fig.Subcommand)
      : undefined;
  } catch {
    return undefined;
  }
}

export async function loadModuleSpec(
  name: string,
  cwd: string,
  environmentVariables: Record<string, string | undefined> = process.env,
): Promise<Fig.Subcommand | undefined> {
  const globalSpec = await loadSpec(name, cwd, environmentVariables);
  if (globalSpec) return globalSpec;
  const specRoot = path.resolve(homedir(), ".fig", "autocomplete");
  const file = await resolveContainedSpecFile(specRoot, name);
  if (!file) return undefined;
  try {
    const module = (await import(pathToFileURL(file).href)) as { default: Fig.Spec };
    let result: Fig.Spec | { versionedSpecPath: string; version?: string } = module.default;
    if (typeof module.default === "function") result = await module.default();
    if (result && typeof result === "object" && "versionedSpecPath" in result) {
      const versionFile = await resolveContainedSpecFile(
        specRoot,
        result.versionedSpecPath,
        path.dirname(file),
      );
      if (!versionFile) return undefined;
      const versionModule = (await import(pathToFileURL(versionFile).href)) as {
        default: Fig.Spec;
      };
      result =
        typeof versionModule.default === "function"
          ? await versionModule.default()
          : versionModule.default;
    }
    return result && typeof result === "object" && !("versionedSpecPath" in result)
      ? (result as Fig.Subcommand)
      : undefined;
  } catch {
    return undefined;
  }
}

export async function loadSpecLocation(
  location: Fig.SpecLocation,
  cwd: string,
  environmentVariables: Record<string, string | undefined> = process.env,
): Promise<Fig.Subcommand | undefined> {
  if (location.type === "global") return loadSpec(location.name, cwd, environmentVariables);
  return loadLocalSpec(location.name, cwd, location.path ?? cwd);
}

export type FigSpec = Fig.Subcommand;
export type FigArgument = Fig.Arg;
export type FigGenerator = Fig.Generator;
export type FigOption = Fig.Option;
export type FigSuggestion = Fig.Suggestion & {
  args?: Fig.Arg | Fig.Arg[];
};
