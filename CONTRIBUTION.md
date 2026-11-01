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

## Check your changes

Run the checks that match the area you changed:

```bash
pnpm check:docs
pnpm build:docs
pnpm build:cue
pnpm build:app
zsh -n packages/cue/zsh/cue.zsh
```

Building the native app requires macOS and Xcode Command Line Tools.

## Open a pull request

- For larger changes, open an issue first to discuss the approach.
- Keep changes focused and explain what changed and why.
- Include the checks you ran; add screenshots for documentation site changes.
- Preserve Terminal focus and the existing keyboard behavior when changing autocomplete.
- Do not commit credentials, personal machine paths, or generated build output.
