#!/bin/bash
set -euo pipefail
export LC_ALL=C
export LANG=C

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PACKAGE="$ROOT/packages/cue"
VERSION="$(node -p "require('$PACKAGE/package.json').version")"
if [[ -z "${CUE_CODESIGN_IDENTITY:-}" ]]; then
  printf 'Release packaging requires a stable Developer ID Application signing identity.\n' >&2
  printf 'Set CUE_CODESIGN_IDENTITY before running pnpm release:cue.\n' >&2
  exit 1
fi

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
CUE_RELEASE_BUILD=1 pnpm build:app

APP="$PACKAGE/build/Cue.app"
codesign --verify --deep --strict "$APP"
SIGNATURE_INFO="$(codesign --display --verbose=4 "$APP" 2>&1)"
DESIGNATED_REQUIREMENT="$(codesign --display -r- "$APP" 2>&1)"
if ! printf '%s\n' "$SIGNATURE_INFO" | grep -q '^Authority=Developer ID Application:' || \
  ! printf '%s\n' "$SIGNATURE_INFO" | grep -Eq '^TeamIdentifier=[A-Z0-9]{10}$' || \
  printf '%s\n' "$DESIGNATED_REQUIREMENT" | grep -q 'cdhash'; then
  printf 'Release app must have a stable Apple Developer ID signature.\n' >&2
  exit 1
fi

cp -R "$APP" "$STAGE/Cue.app"
cp -R "$PACKAGE/dist" "$STAGE/dist"
mkdir -p "$STAGE/zsh"
cp "$PACKAGE/zsh/cue.zsh" "$STAGE/zsh/cue.zsh"

mkdir -p "$ROOT/release-assets"
tar -cf - -C "$STAGE" Cue.app dist zsh | gzip -9 > "$OUTPUT"
SHA="$(shasum -a 256 "$OUTPUT" | awk '{print $1}')"
node scripts/set-formula-sha.mjs "$SHA"
pnpm version:check
printf 'SHA-256: %s\n' "$SHA"
printf 'Release asset: %s\n' "$OUTPUT"
