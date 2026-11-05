# Cue package

This workspace package contains Cue's completion runtime, macOS popup app, and zsh bridge. The native app reads command specs from Fig's open `@withfig/autocomplete` catalog. Cue supports Apple Terminal and the VS Code integrated terminal on macOS when they run zsh.

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

The Homebrew release archive is assembled with `pnpm release:cue`. The matching formula lives at the repository root in `Formula/cue.rb`; publish it and the archive together in this repository's GitHub release flow.
