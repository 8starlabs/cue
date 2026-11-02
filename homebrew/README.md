# Homebrew release checklist

Homebrew distribution is prepared but not installable until the first release archive is published. The tap formula stays in `Formula/cue.rb` in this same repository; do not create or copy it to a separate tap repository.

1. Set the same version in `packages/cue/package.json`, the workspace `package.json`, and `Formula/cue.rb`. Set the formula URL to the matching `v<version>` release archive URL.
2. Run `pnpm release:cue`. It builds a self-contained macOS app and creates `release-assets/cue-<version>-macos-<architecture>.tar.gz`; the command prints its SHA-256 checksum.
3. Put that exact checksum in `Formula/cue.rb`, then run `pnpm version:check`.
4. Commit and push the version and formula changes to this repository. Tag that commit `v<version>`, create the GitHub Release, and attach the generated archive.
5. Verify the install on a clean Apple Silicon Mac with `brew tap 8starlabs/cue https://github.com/8starlabs/cue.git` followed by `brew install 8starlabs/cue/cue`.

The current formula targets Apple Silicon macOS. The release archive keeps the Fig catalog once inside `Cue.app`; the formula symlinks `share/cue/node_modules` to that embedded copy so the zsh CLI and app worker share it. Node.js remains a Homebrew dependency for Cue's JavaScript completion worker.
