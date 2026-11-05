# Repository guide

Cue is an 8StarLabs project for IDE-style autocomplete in Apple Terminal and the VS Code integrated terminal. This repository is a pnpm monorepo.

## Workspace map

- `packages/cue/` is the macOS autocomplete package: TypeScript completion engine, SwiftUI/AppKit popup, zsh integration, app builder, and its package manifest.
- `apps/docs/` is the Next.js documentation site. Fumadocs MDX owns the guide content; shadcn/ui components and Tailwind CSS provide the site’s UI and styling.
- `Formula/` contains this repository's Homebrew tap formula. Keep it in this repo; do not create a separate tap repository. Do not claim installation is available until a matching tagged GitHub release archive and SHA-256 are published.

## Commands

Run commands from the repository root with pnpm:

- `pnpm install` — install the workspace.
- `pnpm dev:docs` — run the documentation site.
- `pnpm build:docs` — build the docs site.
- `pnpm check:docs` — type-check the docs app.
- `pnpm build:cue` — compile the completion engine.
- `pnpm build:app` — build `packages/cue/build/Cue.app`.

## Product constraints

- Cue currently targets Apple Silicon Macs running macOS 13 or later, using zsh in Apple Terminal or the VS Code integrated terminal.
- Keep the native popup non-activating so the terminal retains keyboard focus.
- The shell bridge and native socket packet fields must stay in sync.
- Directory completion for `cd` must stay directory-only. Do not show stale popup rows when the current query has no results.
- Enter, Tab, Escape, and arrow-key behavior is implemented in `packages/cue/zsh/cue.zsh`; preserve the documented flow when changing it.
- Keep Fig attribution and its MIT license with redistributed specs and icons.
- Do not check in generated output such as `dist/`, `.next/`, `.source/`, `build/`, or Swift `.build/`.

## Documentation and design

- Put user-facing guides in `apps/docs/content/docs/` as MDX and update `meta.json` when adding or reordering sections.
- Keep the documentation true to the current prototype; distinguish shipped behavior from planned Homebrew distribution.
- Use the 8StarLabs identity: precise, developer-focused, restrained, and legible. Do not reuse Canopy’s logo or imply that Cue is Canopy.
- Respect `prefers-reduced-motion` for any animated site UI.
