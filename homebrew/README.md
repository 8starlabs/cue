# Homebrew release checklist

Homebrew distribution is prepared but not published yet. The formula source is in `Formula/cue.rb`.

1. Set the package version in `packages/cue/package.json` and the workspace version together.
2. Run `pnpm release:cue`. It builds a self-contained macOS app and creates `release-assets/cue-<version>-macos-<architecture>.tar.gz`; the command prints the SHA-256 checksum.
3. Publish that exact archive as a GitHub release asset under the matching `v<version>` tag.
4. Update the formula URL, version, and checksum to match the published asset.
5. Copy `Formula/cue.rb` into the 8StarLabs Homebrew tap (for example, `8starlabs/homebrew-cue`) and verify `brew install 8starlabs/cue/cue` on a clean Apple Silicon Mac.

The current formula targets Apple Silicon macOS. The formula links the bundled app into Cue's shared runtime directory so the zsh hook can find the native UI. Node.js remains a Homebrew dependency for Cue's JavaScript completion worker.
