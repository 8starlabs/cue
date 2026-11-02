# Contributing to Cue

Thanks for helping improve Cue. Bug reports, focused fixes, and thoughtful feature proposals are welcome.

## Get started

Cue is a pnpm monorepo. It currently targets macOS, Apple Terminal, and zsh.

```bash
git clone https://github.com/8starlabs/cue.git
cd cue
pnpm install
```

The app and zsh integration are in `packages/cue/`. The documentation site is in `apps/docs/`.

## Develop alongside the Homebrew install

You can keep the Homebrew version installed while developing. `pnpm build:app` writes the development app to `packages/cue/build/Cue.app`; it does not replace Homebrew's installed files. Cue currently supports one running instance at a time because both builds use the same process name and socket. When run from Apple Terminal, the build script stops the running Cue process and opens the local build.

In a Terminal session, point Cue at the local package, load its zsh integration, and build the app:

```bash
cd ~/Code/cue
export CUE_HOME="$PWD/packages/cue"
source "$CUE_HOME/zsh/cue.zsh"
pnpm build:app
```

To return to the Homebrew version, quit the local app and open a new Terminal window whose zsh configuration sources the Homebrew-installed integration. Running the development and Homebrew apps simultaneously requires a separate development app identity and socket; Cue does not support that yet.

## Check your changes

Run the checks that match the area you changed:

```bash
pnpm test
pnpm lint
pnpm format:check
pnpm check:docs
pnpm build:docs
pnpm build:cue
pnpm build:app
zsh -n packages/cue/zsh/cue.zsh
```

Building the native app requires macOS and Xcode Command Line Tools.

The Husky pre-commit hook formats staged files with Prettier, runs ESLint on staged JavaScript and TypeScript, and runs the unit tests. `pnpm install` enables the hook in a fresh checkout. To format the whole repository manually, run `pnpm format`.

## Open a pull request

- For larger changes, open an issue first to discuss the approach.
- Keep changes focused and explain what changed and why.
- Include the checks you ran; add screenshots for documentation site changes.
- Preserve Terminal focus and the existing keyboard behavior when changing autocomplete.
- Do not commit credentials, personal machine paths, or generated build output.
