export function resolveReleaseSigningMode(environment = process.env) {
  if (environment.CUE_CODESIGN_IDENTITY?.trim()) return "developer-id";
  if (environment.CUE_ALLOW_ADHOC_RELEASE === "1") return "ad-hoc";

  throw new Error(
    "Set CUE_CODESIGN_IDENTITY to a Developer ID Application identity, or explicitly opt in to an ad hoc release with CUE_ALLOW_ADHOC_RELEASE=1.",
  );
}

if (process.argv[2] === "mode") {
  try {
    process.stdout.write(resolveReleaseSigningMode() + "\n");
  } catch (error) {
    process.stderr.write(error.message + "\n");
    process.exitCode = 1;
  }
}
