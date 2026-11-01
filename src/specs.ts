type FigSpec = {
  name: string;
  description?: string;
  subcommands?: FigSpec[];
  options?: FigOption[];
  args?: FigArgument | FigArgument[];
  additionalSuggestions?: FigSuggestion[];
};

type FigOption = FigSuggestion & {
  args?: FigArgument | FigArgument[];
};

type FigArgument = {
  name?: string;
  isOptional?: boolean;
  isVariadic?: boolean;
  suggestions?: Array<string | FigSuggestion>;
  generators?: FigGenerator | FigGenerator[];
};

type FigSuggestion = {
  name: string | string[];
  description?: string;
  icon?: string;
  insertValue?: string | string[];
  priority?: number;
};

type FigGenerator = {
  script?: string | string[];
  postProcess?: (output: string, context: string[]) => FigSuggestion[];
  suggestions?: Array<string | FigSuggestion>;
};

type DynamicIndex = Record<string, () => Promise<{ default: FigSpec }>>;

// Keep the import promise intact: the index includes a CLI named `then`, so
// returning its default export from Promise.then would make it look thenable.
const dynamicModule = import("@withfig/autocomplete/dynamic");

export async function loadSpec(command: string): Promise<FigSpec | undefined> {
  const module = await dynamicModule;
  const loaders = module.default as DynamicIndex;
  const loader = loaders[command];
  if (!loader) return undefined;
  const loaded = await loader();
  return loaded.default;
}

export type { FigArgument, FigGenerator, FigOption, FigSpec, FigSuggestion };
