# Cue

**Autocomplete for the terminal you already use.**

Cue brings IDE-style command suggestions to Apple Terminal: type a command, see relevant completions beside the caret, and keep working in your shell. It combines a small native macOS popup with Fig’s open autocomplete specs and a zsh bridge.

Built by **8StarLabs**.

> Cue is an early, macOS-only project. A public Homebrew release is planned; it is not published yet.

## Try it from this repository

Requirements: macOS 13+, Node.js 20+, pnpm 10+, and Xcode Command Line Tools for the native app build.

```sh
pnpm install
pnpm build:app
source "$PWD/packages/cue/zsh/cue.zsh"
```

In Apple Terminal, type `git ch` or `cd ` to see suggestions. Use the arrow keys to move through the list. Enter inserts the highlighted suggestion; for directories, continue selecting into the folder, or type a space to finish the path. Escape closes the popup for the current input.

The Cue app asks for macOS Accessibility access so it can position its popup against Terminal’s cursor. Shell integration currently targets zsh in Apple Terminal.

## Workspace

```text
apps/
  docs/                 Next.js documentation site (Fumadocs, Tailwind, shadcn/ui)
packages/
  cue/                  Completion engine, native app, and zsh integration
Formula/                Homebrew formula source for a future release
```

## Common commands

```sh
pnpm install
pnpm dev:docs           # documentation site at http://localhost:3000
pnpm build:docs         # production docs build
pnpm check:docs         # docs TypeScript check
pnpm build:cue          # completion engine
pnpm build:app          # complete native app bundle
```

See the [Getting started guide](apps/docs/content/docs/getting-started.mdx) for setup details, keyboard behavior, and troubleshooting. Contributor and agent guidance lives in [AGENTS.md](AGENTS.md) and [CLAUDE.md](CLAUDE.md).

## How it works

- The **zsh bridge** observes the current command line and sends it to Cue over a local Unix socket.
- The **completion engine** loads command specs from `@withfig/autocomplete` and adds filesystem completions such as `cd` paths.
- The **native macOS app** draws and positions the suggestion popup without taking focus from Terminal.
- The **docs site** explains installation, controls, supported commands, and known limitations.

## Project status

Cue is an early-stage prototype being prepared for a public 8StarLabs release. Homebrew distribution needs a published release archive and checksum before users can install it from a tap. Until then, build it from this checkout using the steps above.

## Credits

Cue uses the MIT-licensed [`@withfig/autocomplete`](https://github.com/withfig/autocomplete) specs and icons. See the package’s bundled license before redistributing the runtime.
