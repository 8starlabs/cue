#!/bin/bash
set -euo pipefail
export LC_ALL=C
export LANG=C

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PACKAGE="$ROOT/packages/cue"
VERSION="$(node -p "require('$PACKAGE/package.json').version")"
ARCH="$(uname -m)"
ARTIFACT_NAME="cue-${VERSION}-macos-${ARCH}.tar.gz"
OUTPUT="$ROOT/release-assets/$ARTIFACT_NAME"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

cd "$ROOT"
pnpm build:app

cp -R "$PACKAGE/build/Cue.app" "$STAGE/Cue.app"
cp -R "$PACKAGE/dist" "$STAGE/dist"
mkdir -p "$STAGE/node_modules/@withfig" "$STAGE/zsh"
cp -RL "$PACKAGE/node_modules/@withfig/autocomplete" "$STAGE/node_modules/@withfig/autocomplete"
cp -RL "$PACKAGE/node_modules/shell-quote" "$STAGE/node_modules/shell-quote"
cp "$PACKAGE/zsh/cue.zsh" "$STAGE/zsh/cue.zsh"

mkdir -p "$ROOT/release-assets"
tar -czf "$OUTPUT" -C "$STAGE" Cue.app dist node_modules zsh
shasum -a 256 "$OUTPUT"
printf 'Release asset: %s\n' "$OUTPUT"
