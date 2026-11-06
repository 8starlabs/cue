import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { complete } from "../src/complete.js";
import { loadLocalSpec, type FigSpec } from "../src/specs.js";

let workspace: string;

beforeAll(async () => {
  workspace = await mkdtemp(path.join(tmpdir(), "cue-completion-tests-"));
  await mkdir(path.join(workspace, "src"));
  await writeFile(path.join(workspace, "README.md"), "Cue test fixture\n");
});

afterAll(async () => {
  await rm(workspace, { recursive: true, force: true });
});

describe("Fig-style completion specs", () => {
  it("does not load local specs outside the autocomplete directory", async () => {
    const specRoot = path.join(workspace, ".fig", "autocomplete", "build");
    const escapedSpec = path.join(workspace, ".fig", "escape.js");
    await mkdir(specRoot, { recursive: true });
    await writeFile(escapedSpec, 'export default { name: "escaped" };\n');

    await expect(loadLocalSpec("../../escape", workspace)).resolves.toBeUndefined();
  });

  it("does not follow local spec symlinks outside the autocomplete directory", async () => {
    const specRoot = path.join(workspace, ".fig", "autocomplete", "build");
    const escapedSpec = path.join(workspace, ".fig", "escape.js");
    await mkdir(specRoot, { recursive: true });
    await writeFile(escapedSpec, 'export default { name: "escaped" };\n');
    await symlink(escapedSpec, path.join(specRoot, "linked.js"));

    await expect(loadLocalSpec("linked", workspace)).resolves.toBeUndefined();
  });

  it("offers the current directory first for git add and only for its first path", async () => {
    const spec: FigSpec = {
      name: "git",
      subcommands: [
        {
          name: "add",
          args: { isVariadic: true, template: "filepaths" },
        },
      ],
    };

    const initial = await complete("git add ", workspace, spec);
    expect(initial[0]).toMatchObject({
      name: ".",
      description: "Stage changes in the current directory",
      insertValue: ".",
      kind: "enter",
    });

    const typedDot = await complete("git add .", workspace, spec);
    expect(typedDot[0]).toMatchObject({ name: ".", typedPrefix: ".", insertValue: "." });

    const nextPath = await complete("git add src ", workspace, spec);
    expect(nextPath.some(({ name, kind }) => name === "." && kind === "enter")).toBe(false);
  });

  it("waits for a space before suggesting command arguments and shows one current-directory row", async () => {
    const specs: FigSpec[] = [
      {
        name: "ls",
        args: { isVariadic: true, template: ["filepaths", "folders"] },
        options: [{ name: "-a" }],
      },
      {
        name: "find",
        args: { isOptional: true, isVariadic: true, template: "folders" },
      },
      {
        name: "du",
        args: { isOptional: true, isVariadic: true, template: ["filepaths", "folders"] },
      },
      { name: "tree", args: { template: "folders" } },
    ];

    for (const spec of specs) {
      await expect(complete(spec.name, workspace, spec)).resolves.toEqual([]);

      const suggestions = await complete(`${spec.name} `, workspace, spec);
      expect(suggestions[0]).toMatchObject({
        name: ".",
        description: expect.any(String),
        insertValue: ".",
        kind: "enter",
      });
      expect(suggestions.filter(({ name }) => name === ".")).toHaveLength(1);
    }

    const lsSuggestions = await complete("ls ", workspace, specs[0]);
    expect(lsSuggestions.some(({ name }) => name === "-a")).toBe(true);
  });

  it("waits for a space after exact commands such as clear", async () => {
    const spec: FigSpec = {
      name: "clear",
      args: { suggestions: ["screen"] },
    };

    await expect(complete("clear", workspace, spec)).resolves.toEqual([]);
    expect((await complete("clear ", workspace, spec)).map(({ name }) => name)).toContain("screen");
  });

  it("does not default the current directory for destructive or later path arguments", async () => {
    const rmSpec: FigSpec = {
      name: "rm",
      args: { isVariadic: true, template: ["filepaths", "folders"] },
      options: [{ name: "-r" }],
    };

    const rmSuggestions = await complete("rm", workspace, rmSpec);
    expect(rmSuggestions.some(({ kind }) => kind === "enter")).toBe(false);

    const lsSpec: FigSpec = {
      name: "ls",
      args: { isVariadic: true, template: ["filepaths", "folders"] },
    };
    const laterPath = await complete("ls src ", workspace, lsSpec);
    expect(laterPath.some(({ name, kind }) => name === "." && kind === "enter")).toBe(false);
  });

  it("completes files and folders inside a partially typed path for file-taking commands", async () => {
    await mkdir(path.join(workspace, "app", "src"), { recursive: true });
    await writeFile(path.join(workspace, "app", "package-lock.yaml"), "lockfile\n");
    await writeFile(path.join(workspace, "app", "src", "index.ts"), "export {}\n");

    const rmSpec: FigSpec = {
      name: "rm",
      args: { isVariadic: true, template: ["folders", "filepaths"] },
    };

    const contents = await complete("rm app/", workspace, rmSpec);
    expect(contents.map(({ name }) => name)).toEqual(["src/", "package-lock.yaml"]);
    expect(contents.find(({ name }) => name === "package-lock.yaml")).toMatchObject({
      typedPrefix: "",
      insertValue: "app/package-lock.yaml",
    });

    const matchingFiles = await complete("rm app/p", workspace, rmSpec);
    expect(matchingFiles.map(({ name }) => name)).toEqual(["package-lock.yaml"]);
    expect(matchingFiles[0]).toMatchObject({
      typedPrefix: "p",
      insertValue: "app/package-lock.yaml",
    });

    for (const command of ["rm", "cat", "cp", "mv", "open"]) {
      const commandSpec: FigSpec = { ...rmSpec, name: command };
      const commandSuggestions = await complete(`${command} app/`, workspace, commandSpec);
      expect(commandSuggestions.map(({ name }) => name)).toEqual(["src/", "package-lock.yaml"]);
    }
  });

  it("keeps parent navigation available after each ../ path segment", async () => {
    await expect(complete("cd", workspace)).resolves.toEqual([]);
    expect((await complete("cd ", workspace)).map(({ name }) => name)).toContain("../");

    const firstParent = await complete("cd ../", workspace);
    expect(firstParent[0]).toMatchObject({
      name: "../",
      description: "Parent folder",
      insertValue: "../../",
    });

    const secondParent = await complete("cd ../../", workspace);
    expect(secondParent[0]).toMatchObject({
      name: "../",
      description: "Parent folder",
      insertValue: "../../../",
    });

    await expect(complete("cd ../ ", workspace)).resolves.toEqual([]);
  });

  it("does not repeat parent navigation after entering a normal suggested folder", async () => {
    await mkdir(path.join(workspace, "src", "nested"), { recursive: true });

    const normalPath = await complete("cd src/", workspace);
    expect(normalPath.some(({ name }) => name === "../")).toBe(false);
    expect(normalPath.map(({ name }) => name)).toContain("nested/");

    const parentPath = await complete("cd ../", workspace);
    expect(parentPath[0]).toMatchObject({ name: "../", insertValue: "../../" });
  });

  it("suggests nested commands and their aliases with descriptions", async () => {
    const spec: FigSpec = {
      name: "tool",
      subcommands: [
        {
          name: ["checkout", "co"],
          description: "Switch branches",
          args: { suggestions: ["main"] },
        },
      ],
    };

    const suggestions = await complete("tool ch", workspace, spec);

    expect(suggestions[0]).toMatchObject({
      name: "checkout",
      description: "Switch branches",
      kind: "command",
    });
    expect((await complete("tool ", workspace, spec)).map(({ name }) => name)).toContain(
      "checkout",
    );
    await expect(complete("tool", workspace, spec)).resolves.toEqual([]);
    await expect(complete("tool checkout", workspace, spec)).resolves.toEqual([]);
    expect((await complete("tool checkout ", workspace, spec)).map(({ name }) => name)).toContain(
      "main",
    );
  });

  it("does not show suggestions inside an open quoted argument", async () => {
    const spec: FigSpec = {
      name: "git",
      subcommands: [
        {
          name: "checkout",
          options: [{ name: "-m" }],
          args: { suggestions: ["main", "main-dev"] },
        },
        {
          name: "commit",
          options: [{ name: "-m", args: { name: "message" } }],
          args: { template: "filepaths" },
        },
      ],
    };

    await expect(complete('git checkout -m "', workspace, spec)).resolves.toEqual([]);
    await expect(complete('git checkout -m "e', workspace, spec)).resolves.toEqual([]);
    await expect(complete('git commit -m "feat:', workspace, spec)).resolves.toEqual([]);
    await expect(complete("git commit -m 'feat:", workspace, spec)).resolves.toEqual([]);
    expect((await complete("git checkout ma", workspace, spec)).map(({ name }) => name)).toContain(
      "main",
    );
    expect((await complete('git commit -m "feat" ', workspace, spec)).length).toBeGreaterThan(0);
  });

  it("completes option values with spaces, equals, and declared separators", async () => {
    const spec: FigSpec = {
      name: "tool",
      subcommands: [{ name: "run" }],
      options: [
        {
          name: "--format",
          args: { name: "format", suggestions: ["json", "yaml"] },
        },
        {
          name: "--region",
          requiresSeparator: "=",
          args: { name: "region", suggestions: ["us-east-1", "eu-west-1"] },
        },
        {
          name: "--profile",
          args: { name: "profile", suggestions: ["work", "personal"] },
        },
      ],
    };

    expect((await complete("tool --format j", workspace, spec)).map(({ name }) => name)).toEqual([
      "json",
    ]);
    expect((await complete("tool --region=us", workspace, spec)).map(({ name }) => name)).toEqual([
      "us-east-1",
    ]);
    expect((await complete("tool --profile ", workspace, spec)).map(({ name }) => name)).toContain(
      "work",
    );
  });

  it("applies option dependency, exclusion, and repeat rules", async () => {
    const spec: FigSpec = {
      name: "tool",
      options: [
        { name: "--project" },
        { name: "--extension", dependsOn: ["--project"] },
        { name: "--json", exclusiveOn: ["--yaml"] },
        { name: "--yaml", exclusiveOn: ["--json"] },
        { name: "--once", isRepeatable: false },
      ],
    };

    const initial = (await complete("tool ", workspace, spec)).map(({ name }) => name);
    const afterProject = (await complete("tool --project demo ", workspace, spec)).map(
      ({ name }) => name,
    );
    const afterJson = (await complete("tool --json ", workspace, spec)).map(({ name }) => name);
    const afterOnce = (await complete("tool --once ", workspace, spec)).map(({ name }) => name);

    expect(initial).not.toContain("--extension");
    expect(afterProject).toContain("--extension");
    expect(afterJson).not.toContain("--yaml");
    expect(afterOnce).not.toContain("--once");
  });

  it("preserves suggestion metadata and deprecated replacements", async () => {
    const spec: FigSpec = {
      name: "tool",
      subcommands: [
        {
          name: "legacy",
          insertValue: "legacy",
          deprecated: {
            displayName: "legacy (use current)",
            insertValue: "current",
            description: "Use the current command",
            icon: "⚠️",
          },
        },
      ],
    };

    const [suggestion] = await complete("tool leg", workspace, spec);

    expect(suggestion).toMatchObject({
      name: "legacy",
      displayName: "legacy (use current)",
      insertValue: "current",
      description: "Use the current command",
      icon: "⚠️",
      deprecated: true,
    });
  });

  it("runs custom generators with the terminal environment", async () => {
    const spec: FigSpec = {
      name: "tool",
      subcommands: [
        {
          name: "run",
          args: {
            generators: [
              {
                custom: async (_tokens, _executeCommand, context) => [
                  { name: context.environmentVariables.CUE_TEST_VALUE ?? "missing" },
                ],
              },
            ],
          },
        },
      ],
    };

    const suggestions = await complete("tool run ", workspace, spec, {
      CUE_TEST_VALUE: "from-terminal",
    });

    expect(suggestions.map(({ name }) => name)).toContain("from-terminal");
  });

  it("offers filesystem templates and path completions after pipes and redirects", async () => {
    const spec: FigSpec = {
      name: "tool",
      args: { template: "filepaths" },
    };
    const files = (await complete("tool ", workspace, spec)).map(({ name }) => name);
    const folders = (await complete("cd s", workspace)).map(({ name }) => name);
    const redirectedFiles = (await complete("printf cue > ", workspace)).map(({ name }) => name);
    const piped = await complete("printf cue | grep cue", workspace, {
      name: "grep",
      args: { suggestions: ["cue", "other"] },
    });

    expect(files).toContain("README.md");
    expect(files).toContain("src/");
    expect(folders).toContain("src/");
    expect(folders).not.toContain("README.md");
    expect(redirectedFiles).toContain("README.md");
    expect(piped.map(({ name }) => name)).toEqual(["cue"]);
  });

  it("offers the current directory before code path completions", async () => {
    await expect(complete("code", workspace)).resolves.toEqual([]);

    for (const line of ["code ", "code ."]) {
      const suggestions = await complete(line, workspace);
      expect(suggestions[0]).toMatchObject({
        name: ".",
        description: "Current directory",
        insertValue: ".",
        icon: "fig://icon?type=folder",
      });
    }
  });
});
