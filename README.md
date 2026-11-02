# Cue

![Cue's Homebrew installation command and autocomplete popup in Apple Terminal](assets/social/cue-readme.png)

Autocomplete for the terminal you already use.

Cue brings Fig-style command and path suggestions to Apple Terminal, with helpful descriptions beside the selected suggestion.

**Platform:** Cue currently supports Apple Silicon Macs running macOS 13 or later, with Apple Terminal and zsh. It does not currently support Windows, Linux, or other terminal apps.

I started using Fig before [Amazon acquired Fig's technology](https://techcrunch.com/2023/08/29/amazon-fig-command-line-terminal-generative-ai/) and loved its autocomplete. When Kiro [announced that CLI v3 would retire inline shell autocomplete](https://kiro.dev/blog/cli-3/), I was sad to lose it. Cue is my attempt to bring that experience back.

## Installation

### Homebrew

Install Cue from its [Homebrew](https://brew.sh) tap:

```bash
brew tap 8starlabs/cue https://github.com/8starlabs/cue.git
brew install 8starlabs/cue/cue
```

After installing, add Cue's zsh integration to `~/.zshrc` and open a new Terminal window:

```bash
source "$(brew --prefix)/opt/cue/share/cue/zsh/cue.zsh"
```

### From source

Prefer to build Cue yourself? Installing from source is an alternative to Homebrew. This requires Node.js 22 or later, pnpm 10 or later, and Xcode Command Line Tools:

```bash
git clone https://github.com/8starlabs/cue.git
cd cue
pnpm install
pnpm build:app
source "$PWD/packages/cue/zsh/cue.zsh"
```

For persistent shell setup, updates, and removal, see the [getting started guide](apps/docs/content/docs/getting-started.mdx) and [Homebrew guide](apps/docs/content/docs/homebrew.mdx).

## Versioning and releases

Cue uses semantic versions. The app version in `packages/cue/package.json` is the source of truth; the workspace version and Homebrew formula version and release URL must match it. Run `pnpm version:check` to catch mismatches.

To prepare a release, synchronize the version in both package manifests and `Formula/cue.rb`, including the formula's `vX.Y.Z` archive URL. Run `pnpm release:cue`, copy its printed SHA-256 into the formula, then run `pnpm version:check`. Commit and push those changes, tag that commit as `vX.Y.Z`, and attach the generated archive from `release-assets/` to the GitHub Release in this same repository. The current packaging script builds for the Mac architecture it's run on (currently Apple Silicon only).

## Development

```bash
pnpm install
pnpm dev:docs
```

The workspace contains the Cue app and shell integration in `packages/cue/`, and the Next.js documentation site in `apps/docs/`.

## Contributing

See [CONTRIBUTION.md](CONTRIBUTION.md) for setup, checks, and pull request guidance.

## Credits

Cue uses the open-source [`@withfig/autocomplete`](https://github.com/withfig/autocomplete) specs.

## Contact

- Tham Kei Lok (Lead Engineer & Developer Relations) — [X](https://www.x.com/keiloktql/), [LinkedIn](https://www.linkedin.com/in/keiloktql/)

Engineered by [8StarLabs](https://8starlabs.com).

## License

[MIT](LICENSE)
