import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const version = process.argv[2];
const pendingSha = "0".repeat(64);

if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) {
  console.error("Usage: pnpm version:cue <major.minor.patch>");
  process.exit(1);
}

const cuePath = path.join(root, "packages/cue/package.json");
const rootPath = path.join(root, "package.json");
const formulaPath = path.join(root, "Formula/cue.rb");
const cueManifest = JSON.parse(await readFile(cuePath, "utf8"));
const rootManifest = JSON.parse(await readFile(rootPath, "utf8"));

function compareVersions(a, b) {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

if (compareVersions(version, cueManifest.version) < 0) {
  console.error("Cannot move Cue backwards from " + cueManifest.version + " to " + version + ".");
  process.exit(1);
}

cueManifest.version = version;
rootManifest.version = version;

const formula = await readFile(formulaPath, "utf8");
if (!/^\s+version "[^"]+"$/m.test(formula)) {
  throw new Error("Could not find the version field in Formula/cue.rb");
}
if (!/^\s+url "[^"]+"$/m.test(formula)) {
  throw new Error("Could not find the release URL in Formula/cue.rb");
}
if (!/^\s+sha256 "[^"]+"$/m.test(formula)) {
  throw new Error("Could not find the SHA-256 field in Formula/cue.rb");
}

const updatedFormula = formula
  .replace(
    /^\s+url "[^"]+"$/m,
    '  url "https://github.com/8starlabs/cue/releases/download/v' +
      version +
      "/cue-" +
      version +
      '-macos-arm64.tar.gz"',
  )
  .replace(/^\s+version "[^"]+"$/m, '  version "' + version + '"')
  .replace(/^\s+sha256 "[^"]+"$/m, '  sha256 "' + pendingSha + '"');

await Promise.all([
  writeFile(cuePath, JSON.stringify(cueManifest, null, 2) + "\n"),
  writeFile(rootPath, JSON.stringify(rootManifest, null, 2) + "\n"),
  writeFile(formulaPath, updatedFormula),
]);

console.log(
  "Synchronized Cue to v" +
    version +
    ". The formula SHA-256 is pending until the release archive is built.",
);
console.log("Next: run pnpm changelog:new, write the release notes, then run pnpm release:cue.");
