#!/bin/bash
set -euo pipefail
export LC_ALL=C
export LANG=C

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PACKAGE="$ROOT/packages/cue"
VERSION="$(node -p "require('$PACKAGE/package.json').version")"
ARCH="$(uname -m)"
if [[ "$ARCH" != "arm64" ]]; then
  printf 'Cue release packaging currently supports Apple Silicon (arm64); found %s.\n' "$ARCH" >&2
  exit 1
fi
ARTIFACT_NAME="cue-${VERSION}-macos-${ARCH}.tar.gz"
OUTPUT="$ROOT/release-assets/$ARTIFACT_NAME"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

cd "$ROOT"
pnpm changelog:check
node scripts/check-release-version.mjs --allow-pending-sha
pnpm build:app

cp -R "$PACKAGE/build/Cue.app" "$STAGE/Cue.app"
cp -R "$PACKAGE/dist" "$STAGE/dist"
mkdir -p "$STAGE/zsh"
cp "$PACKAGE/zsh/cue.zsh" "$STAGE/zsh/cue.zsh"

mkdir -p "$ROOT/release-assets"
tar -czf "$OUTPUT" -C "$STAGE" Cue.app dist zsh
SHA="$(shasum -a 256 "$OUTPUT" | awk '{print $1}')"
node scripts/set-formula-sha.mjs "$SHA"
pnpm version:check
printf 'SHA-256: %s\n' "$SHA"
printf 'Release asset: %s\n' "$OUTPUT"
