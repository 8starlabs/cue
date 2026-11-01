# Cue package

This workspace package contains Cue's completion runtime, macOS popup app, and zsh bridge. The native app reads command specs from Fig's open `@withfig/autocomplete` catalog. It is currently designed for Apple Terminal on macOS.

Build from the repository root:

```sh
pnpm install
pnpm build:cue
pnpm build:app
```

To load the shell integration for the current zsh session:

```sh
source "$PWD/packages/cue/zsh/cue.zsh"
```

The Homebrew release archive is assembled with `pnpm release:cue`. That archive and the matching formula are intended for a 8StarLabs Homebrew tap once a public GitHub release is published.
