import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootManifest = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const cueManifest = JSON.parse(
  await readFile(path.join(root, "packages/cue/package.json"), "utf8"),
);
const formula = await readFile(path.join(root, "Formula/cue.rb"), "utf8");
const formulaVersion = formula.match(/^\s+version "([^"]+)"$/m)?.[1];
const formulaUrl = formula.match(/^\s+url "([^"]+)"$/m)?.[1] ?? "";
const formulaSha = formula.match(/^\s+sha256 "([^"]+)"$/m)?.[1] ?? "";
const version = cueManifest.version;

const mismatches = [];
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  mismatches.push(`Cue package version ${version} is not a stable semantic version`);
}
if (rootManifest.version !== version) {
  mismatches.push(`root package.json is ${rootManifest.version}; Cue package is ${version}`);
}
if (formulaVersion !== version) {
  mismatches.push(
    `Formula/cue.rb is ${formulaVersion ?? "missing a version"}; Cue package is ${version}`,
  );
}
if (!formulaUrl.includes(`/download/v${version}/cue-${version}-macos-`)) {
  mismatches.push(`Formula/cue.rb URL does not point to the v${version} release archive`);
}
if (!/^[a-f0-9]{64}$/.test(formulaSha)) {
  mismatches.push("Formula/cue.rb SHA-256 is missing or malformed");
}

if (mismatches.length > 0) {
  console.error(`Release version mismatch:\n- ${mismatches.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log(`Cue release versions are synchronized at ${version}.`);
}
