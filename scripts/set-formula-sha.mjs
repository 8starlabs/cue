import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sha = process.argv[2];

if (!/^[a-f0-9]{64}$/.test(sha ?? "")) {
  console.error("Usage: node scripts/set-formula-sha.mjs <64-character-sha256>");
  process.exit(1);
}

const formulaPath = path.join(root, "Formula/cue.rb");
const formula = await readFile(formulaPath, "utf8");
if (!/^\s+sha256 "[^"]+"$/m.test(formula)) {
  throw new Error("Could not find the SHA-256 field in Formula/cue.rb");
}

await writeFile(formulaPath, formula.replace(/^\s+sha256 "[^"]+"$/m, '  sha256 "' + sha + '"'));
console.log("Updated Formula/cue.rb with the archive SHA-256.");
