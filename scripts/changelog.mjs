import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const changelogDir = path.join(root, "changelogs");
const cueManifest = JSON.parse(
  await readFile(path.join(root, "packages/cue/package.json"), "utf8"),
);
const [command, requestedVersion] = process.argv.slice(2);
const pendingText = /\b(?:TODO|TBD|REPLACE ME|PLACEHOLDER)\b/i;
const emptyLines = /^\s*[-*+]\s*(?:none|n\/a)\.?\s*$/i;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function validVersion(value) {
  return /^\d+\.\d+\.\d+$/.test(value);
}

function releasePath(version) {
  return path.join(changelogDir, "v" + version + ".mdx");
}

function readFrontmatter(content, file) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) fail(path.relative(root, file) + " must start with YAML frontmatter.");

  const metadata = {};
  for (const key of ["title", "description", "version", "date"]) {
    const value = match[1].match(new RegExp("^" + key + ":\\s*(.*)$", "m"))?.[1]?.trim();
    if (value) metadata[key] = value.replace(/^["']|["']$/g, "");
  }

  return { metadata, body: match[2].trim() };
}

function validateEntry(version, content, file) {
  const { metadata, body } = readFrontmatter(content, file);
  if (metadata.version !== version) {
    fail(path.relative(root, file) + " frontmatter version must be " + version + ".");
  }
  if (!metadata.title?.trim() || !metadata.description?.trim()) {
    fail(path.relative(root, file) + " needs a title and description in frontmatter.");
  }
  if (pendingText.test(metadata.title) || pendingText.test(metadata.description)) {
    fail(path.relative(root, file) + " still has placeholder text in its frontmatter.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(metadata.date ?? "")) {
    fail(path.relative(root, file) + " date must use YYYY-MM-DD.");
  }
  const date = new Date(metadata.date + "T00:00:00Z");
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== metadata.date) {
    fail(path.relative(root, file) + " has an invalid calendar date.");
  }
  if (!body || pendingText.test(body)) {
    fail(path.relative(root, file) + " needs finished release notes; replace all placeholders.");
  }
  if (/^\s*(?:import|export)\s/m.test(body) || /^\s*<[A-Z][\w.]*(?:\s|\/?>)/m.test(body)) {
    fail(
      path.relative(root, file) + " must use GitHub-compatible Markdown without MDX components.",
    );
  }
  const notes = body.split(/\r?\n/).filter((line) => line.trim());
  if (!notes.some((line) => !/^#{1,6}\s/.test(line) && !emptyLines.test(line))) {
    fail(path.relative(root, file) + " must include at least one actual change.");
  }

  return { metadata, body };
}

async function listVersions() {
  const entries = await readdir(changelogDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /^v\d+\.\d+\.\d+\.mdx$/.test(entry.name))
    .map((entry) => entry.name.match(/^v(\d+\.\d+\.\d+)\.mdx$/)[1]);
}

if (command === "new") {
  const version = requestedVersion ?? cueManifest.version;
  if (!validVersion(version)) fail("Usage: pnpm changelog:new [major.minor.patch]");
  if (version !== cueManifest.version) {
    fail(
      "Requested v" +
        version +
        ", but the Cue package is v" +
        cueManifest.version +
        ". Run pnpm version:cue " +
        version +
        " first.",
    );
  }

  const file = releasePath(version);
  try {
    await readFile(file, "utf8");
    fail("A changelog entry for v" + version + " already exists: " + path.relative(root, file));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const date = new Date().toISOString().slice(0, 10);
  const entry = [
    "---",
    "title: Cue " + version,
    "description: Summarize the most useful changes in this release.",
    'version: "' + version + '"',
    'date: "' + date + '"',
    "---",
    "",
    "## Added",
    "",
    "- TODO: Describe new features.",
    "",
    "## Changed",
    "",
    "- None.",
    "",
    "## Fixed",
    "",
    "- None.",
    "",
  ].join("\n");
  await writeFile(file, entry, { flag: "wx" });
  console.log(
    "Created " + path.relative(root, file) + ". Replace the TODO before packaging a release.",
  );
} else if (command === "notes") {
  const version = requestedVersion ?? cueManifest.version;
  if (!validVersion(version)) fail("Usage: node scripts/changelog.mjs notes [major.minor.patch]");
  const file = releasePath(version);
  const { body } = validateEntry(version, await readFile(file, "utf8"), file);
  process.stdout.write(body + "\n");
} else if (command === "check") {
  const versions = await listVersions();
  if (!versions.includes(cueManifest.version)) {
    fail(
      "Missing changelog entry for current Cue version " +
        cueManifest.version +
        ". Run pnpm changelog:new.",
    );
  }

  for (const version of versions) {
    const file = releasePath(version);
    validateEntry(version, await readFile(file, "utf8"), file);
  }

  console.log(
    "Validated " + versions.length + " changelog entr" + (versions.length === 1 ? "y." : "ies."),
  );
} else {
  fail("Usage: pnpm changelog:new [version] | pnpm changelog:check");
}
