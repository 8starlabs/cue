# Cue

![Cue terminal autocomplete](assets/social/cue-readme.png)

IDE-style command and path suggestions for Apple Terminal and the VS Code integrated terminal.

Cue is for people who miss Fig's autocomplete. I loved Fig before [Amazon acquired its technology](https://techcrunch.com/2023/08/29/amazon-fig-command-line-terminal-generative-ai/), and built Cue after Kiro [announced the retirement of inline shell autocomplete](https://kiro.dev/blog/cli-3/).

**Available on:** Apple Silicon Macs running macOS 13 or later, in Apple Terminal or the VS Code integrated terminal with zsh!

## Install

1. **Install with [Homebrew](https://brew.sh)**

   Add Cue's tap, then install it:

   ```sh
   brew tap 8starlabs/cue https://github.com/8starlabs/cue.git
   brew install 8starlabs/cue/cue
   ```

   Enable Cue in zsh by adding its startup command to `~/.zshrc`:

   ```sh
   echo 'source "$(brew --prefix)/opt/cue/share/cue/zsh/cue.zsh"' >> ~/.zshrc
   ```

   Open a new Apple Terminal window or create a new VS Code integrated terminal. In VS Code, make sure the terminal profile is zsh: open the Command Palette, choose **Terminal: Select Default Profile**, select **zsh**, then create a new terminal.

2. **Build from source**

   Requires Node.js 22+, pnpm 10+, and Xcode Command Line Tools.

   ```sh
   git clone https://github.com/8starlabs/cue.git
   cd cue
   pnpm install
   pnpm build:app
   source "$PWD/packages/cue/zsh/cue.zsh"
   ```

For either installation method, macOS may ask you to allow Cue under **System Settings → Privacy & Security → Accessibility** so the popup can follow the terminal caret. See the [installation guide](https://cue.8starlabs.com/docs/install/install-cue) for setup details, updates, and removal.

## Contributing

See [CONTRIBUTION.md](CONTRIBUTION.md) for development setup, checks, and release instructions.

## Credits

- [Fig Autocomplete](https://github.com/withfig/autocomplete) for command specs and Fig icons.
- [Material Icon Theme](https://github.com/material-extensions/vscode-material-icon-theme) for selected file icons.
- [`shell-quote`](https://github.com/ljharb/shell-quote) for shell command parsing.
- [Next.js](https://github.com/vercel/next.js), [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss), [shadcn/ui](https://github.com/shadcn-ui/ui), and [Fumadocs](https://github.com/fuma-nama/fumadocs) for the documentation site.

## Contact

- Tham Kei Lok (Lead Engineer & Developer Relations) — [X](https://www.x.com/keiloktql/), [LinkedIn](https://www.linkedin.com/in/keiloktql/)

Engineered by [8StarLabs](https://8starlabs.com).

## License

[MIT](LICENSE)
