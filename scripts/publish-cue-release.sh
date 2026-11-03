#!/bin/bash
set -euo pipefail
export LC_ALL=C
export LANG=C

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PACKAGE="$ROOT/packages/cue"
VERSION="$(node -p "require('$PACKAGE/package.json').version")"
TAG="v$VERSION"
ASSET="$ROOT/release-assets/cue-$VERSION-macos-arm64.tar.gz"
NOTES="$(mktemp)"
trap 'rm -f "$NOTES"' EXIT

cd "$ROOT"

if [[ "$(uname -m)" != "arm64" ]]; then
  printf 'Cue releases currently support Apple Silicon (arm64) only.\n' >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  printf 'GitHub CLI (gh) is required. Install it with Homebrew, then run gh auth login.\n' >&2
  exit 1
fi

gh auth status
pnpm changelog:check
pnpm version:check

if [[ ! -f "$ASSET" ]]; then
  printf 'Release archive not found: %s\nRun pnpm release:cue first.\n' "$ASSET" >&2
  exit 1
fi

FORMULA_SHA="$(sed -nE 's/^[[:space:]]*sha256 "([a-f0-9]{64})"$/\1/p' Formula/cue.rb)"
ASSET_SHA="$(shasum -a 256 "$ASSET" | awk '{print $1}')"
if [[ "$FORMULA_SHA" != "$ASSET_SHA" ]]; then
  printf 'The archive hash does not match Formula/cue.rb. Run pnpm release:cue again.\n' >&2
  exit 1
fi

node scripts/changelog.mjs notes "$VERSION" > "$NOTES"

if [[ -n "$(git status --porcelain)" ]]; then
  printf 'Commit all release changes before publishing. The working tree must be clean.\n' >&2
  exit 1
fi

BRANCH="$(git symbolic-ref --short HEAD 2>/dev/null || true)"
if [[ -z "$BRANCH" ]]; then
  printf 'Publish from a branch, not a detached HEAD.\n' >&2
  exit 1
fi

UPSTREAM="$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)"
if [[ -z "$UPSTREAM" ]]; then
  printf 'The current branch needs an upstream before publishing.\n' >&2
  exit 1
fi

git fetch --quiet origin
read -r AHEAD BEHIND <<< "$(git rev-list --left-right --count HEAD...$UPSTREAM)"
if [[ "$AHEAD" != "0" || "$BEHIND" != "0" ]]; then
  printf 'Push and sync the release commit with %s before publishing.\n' "$UPSTREAM" >&2
  exit 1
fi

HEAD_COMMIT="$(git rev-parse HEAD)"
LOCAL_TAG_COMMIT="$(git rev-parse -q --verify "$TAG^{commit}" 2>/dev/null || true)"
if [[ -n "$LOCAL_TAG_COMMIT" && "$LOCAL_TAG_COMMIT" != "$HEAD_COMMIT" ]]; then
  printf 'Local tag %s already points to a different commit.\n' "$TAG" >&2
  exit 1
fi

REMOTE_TAG="$(git ls-remote --tags origin "refs/tags/$TAG" | awk 'NR == 1 {print $1}')"
if [[ -n "$REMOTE_TAG" ]]; then
  if [[ -z "$LOCAL_TAG_COMMIT" ]]; then
    git fetch --quiet origin "refs/tags/$TAG:refs/tags/$TAG"
    LOCAL_TAG_COMMIT="$(git rev-parse "$TAG^{commit}")"
  fi
  if [[ "$LOCAL_TAG_COMMIT" != "$HEAD_COMMIT" ]]; then
    printf 'Remote tag %s already points to a different commit.\n' "$TAG" >&2
    exit 1
  fi
else
  if [[ -z "$LOCAL_TAG_COMMIT" ]]; then
    git tag -a "$TAG" -m "Cue $TAG"
  fi
  git push origin "$TAG"
fi

TITLE="Cue $TAG"
if gh release view "$TAG" >/dev/null 2>&1; then
  IS_DRAFT="$(gh release view "$TAG" --json isDraft --jq '.isDraft')"
  HAS_ASSET="$(gh release view "$TAG" --json assets --jq '[.assets[].name] | index("cue-'$VERSION'-macos-arm64.tar.gz") != null')"
  if [[ "$HAS_ASSET" != "true" ]]; then
    gh release upload "$TAG" "$ASSET"
  fi
  if [[ "$IS_DRAFT" == "true" ]]; then
    gh release edit "$TAG" --title "$TITLE" --notes-file "$NOTES" --draft=false
  fi
else
  gh release create "$TAG" "$ASSET" --verify-tag --title "$TITLE" --notes-file "$NOTES"
fi

printf 'Published https://github.com/8starlabs/cue/releases/tag/%s\n' "$TAG"
