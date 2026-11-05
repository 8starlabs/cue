# Contributing to Cue

Thanks for helping improve Cue. Bug reports, focused fixes, and thoughtful feature proposals are welcome.

## Get started

Cue is a pnpm monorepo. It targets macOS, Apple Terminal, the VS Code integrated terminal, and zsh.

```bash
git clone https://github.com/8starlabs/cue.git
cd cue
pnpm install
```

The app and zsh integration are in `packages/cue/`. The documentation site is in `apps/docs/`.

Run the documentation site locally from the repository root:

```bash
pnpm dev:docs
```

The docs site loads Google Tag Manager when `NEXT_PUBLIC_GTM_ID` is set. Copy `apps/docs/.env.example` to `apps/docs/.env.local` for local development. This is a public container ID, not a secret. For production builds, set the same variable in the hosting provider's build environment; `.env.local` is ignored by Git.

## Develop alongside the Homebrew install

You can keep the Homebrew version installed while developing. `pnpm build:app` writes the development app to `packages/cue/build/Cue.app`; it does not replace Homebrew's installed files. Cue currently supports one running instance at a time because both builds use the same process name and socket. When run from Apple Terminal, the build script stops the running Cue process and opens the local build. When run from VS Code, it builds the app but does not relaunch it; quit the running Cue app and start a new integrated zsh terminal to use the rebuilt version.

From the repository root in Terminal, point Cue at the local package, load its zsh integration, and build the app:

```bash
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

Local builds are ad hoc signed unless `CUE_CODESIGN_IDENTITY` is set. Ad hoc signatures identify a specific build, so macOS may ask for Accessibility approval again after rebuilding. For a stable signing identity, obtain an Apple [Developer ID Application certificate](https://developer.apple.com/help/account/certificates/create-developer-id-certificates/) and install it in your login keychain. Then build with:

```bash
CUE_CODESIGN_IDENTITY="Developer ID Application: Your Name (TEAMID)" pnpm build:app
```

The certificate identity stays the same across app versions, which lets macOS recognize updates as the same Cue app. Moving from an existing ad hoc build to the Developer ID-signed app can require Accessibility approval once more.

The Husky pre-commit hook formats staged files with Prettier, runs ESLint on staged JavaScript and TypeScript, and runs the unit tests. `pnpm install` enables the hook in a fresh checkout. To format the whole repository manually, run `pnpm format`.

## Open a pull request

- For larger changes, open an issue first to discuss the approach.
- Keep changes focused and explain what changed and why.
- Include the checks you ran; add screenshots for documentation site changes.
- Preserve Terminal focus and the existing keyboard behavior when changing autocomplete.
- Do not commit credentials, personal machine paths, or generated build output.

## Prepare and publish a release

Regular commits and pushes do not create versions or releases. When a release is ready, choose the next semantic version and create its notes. The source of truth is `packages/cue/package.json`; the workspace manifest and Homebrew formula version and archive URL must match it. `pnpm version:check` checks those values.

```bash
pnpm version:cue 0.2.0
pnpm changelog:new
```

Replace `0.2.0` with the version being released. The first release can use the version already in the package manifest. `version:cue` synchronizes the root and app manifests, updates the Homebrew formula version and `vX.Y.Z` archive URL, and marks the formula checksum as pending. `changelog:new` creates `changelogs/v0.2.0.mdx`; edit it with the user-visible changes. The same Markdown body appears on the site at `/changelogs` and in the GitHub Release.

Build the release archive and let the script update the formula checksum. A Developer ID signature is recommended for public distribution. If you do not have one yet, the first archive can be built with Cue's stable ad hoc signature by explicitly opting in:

```bash
CUE_ALLOW_ADHOC_RELEASE=1 pnpm release:cue
pnpm version:check
```

An ad hoc release has no verified Apple publisher identity and is not notarized. macOS may ask users to approve it before launch. To build a Developer ID-signed release instead, set `CUE_CODESIGN_IDENTITY` to your Developer ID Application identity and run `pnpm release:cue`.

The release packager verifies either the Developer ID signature or the explicitly requested ad hoc signature before creating the archive. Apple recommends notarizing Developer ID-signed apps distributed outside the Mac App Store; notarization is separate from Cue's Homebrew archive step.

This package currently supports Apple Silicon only. Commit and push the version, formula, and changelog changes. Install and authenticate [GitHub CLI](https://cli.github.com/) with `gh auth login`, then run:

```bash
pnpm release:publish
```

The command requires a clean worktree and an upstream-synced commit. It creates and pushes the `vX.Y.Z` tag, then creates the GitHub Release in this repository, attaches the archive from `release-assets/`, and takes its release notes from `changelogs/vX.Y.Z.mdx`. It can complete the GitHub Release step again if a previous run already pushed the matching tag. No release is created just because code is pushed.

See the [release guide](/docs/releasing) for the same process in the documentation site.
