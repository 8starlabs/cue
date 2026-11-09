# Repository guide

Cue is an 8StarLabs project for IDE-style autocomplete in Apple Terminal and the VS Code integrated terminal. This repository is a pnpm monorepo.

Keep `AGENTS.md` and `CLAUDE.md` synchronized when changing shared project guidance.

## Workspace map

- `packages/cue/` is the macOS autocomplete package: TypeScript completion engine, native SwiftUI/AppKit popup, zsh integration, app builder, and package manifest.
- `apps/docs/` is the Next.js documentation site. Fumadocs MDX owns guide content; shadcn/ui and Tailwind CSS provide the UI and styling.
- `Formula/` contains this repository's Homebrew tap formula. Keep the formula in this repository; do not create a separate tap repository.

## Architecture and commands

- The app bundle is built by `packages/cue/scripts/build-app.sh`. Its embedded Swift app starts the Node worker from generated package `dist/` files.
- The zsh integration sends the prompt buffer, working directory, and terminal cursor metadata over a local Unix socket. Keep the packet fields aligned with `RequestMetadata.parse` in `packages/cue/native/Sources/Cue/main.swift`.
- Run workspace commands from the repository root with pnpm:
  - `pnpm install` — install workspace dependencies.
  - `pnpm dev:docs` — run the documentation site.
  - `pnpm build:docs` — build the docs site.
  - `pnpm check:docs` — type-check the docs app.
  - `pnpm build:cue` — compile the completion engine.
  - `pnpm build:app` — build `packages/cue/build/Cue.app`.
- After TypeScript changes, use `pnpm build:cue`; after native-app or packaging changes, use `pnpm build:app`; after zsh changes, `zsh -n packages/cue/zsh/cue.zsh` checks syntax.

## Product constraints

- Cue targets Apple Silicon Macs running macOS 13 or later, using zsh in Apple Terminal or the VS Code integrated terminal.
- Keep the native popup non-activating so the terminal retains keyboard focus.
- Keep app and worker cleanup scoped to the current macOS user. Never remove the instance lock file while a Cue process may hold it.
- Directory completion for `cd` must remain directory-only. Do not show stale popup rows when the current query has no results.
- Enter, Tab, Escape, and arrow-key behavior is implemented in `packages/cue/zsh/cue.zsh`; preserve the documented flow when changing it.
- Keep Fig attribution and its MIT license with redistributed specs and icons.
- Do not check in generated output such as `dist/`, `.next/`, `.source/`, `build/`, or Swift `.build/`.

## Homebrew and releases

- The Homebrew formula must point to a tagged GitHub release archive and include that archive's matching SHA-256.
- Keep installation and update instructions aligned with the published formula and release process. Clearly distinguish shipped behavior from planned features.
- Users add this repository as the tap with the explicit Git URL shown in the install guide; the repository is not named `homebrew-cue`.

## Documentation and design

- Put user-facing guides in `apps/docs/content/docs/` as MDX and update `meta.json` when adding or reordering sections.
- The docs marketing page is `apps/docs/app/(home)/page.tsx`.
- Keep the docs accurate to the current product and clearly label planned features.
- Use the 8StarLabs identity: precise, developer-focused, restrained, and legible. Do not reuse Canopy's logo or imply Cue is a Canopy product.
- Keep site interactions keyboard-accessible and respect `prefers-reduced-motion` for animated UI.
