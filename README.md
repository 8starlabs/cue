# Cue

A personal prototype for IDE-style command suggestions in Apple Terminal. It uses the open Fig completion specs, with a persistent Node worker and a native macOS popup. Fig icon URIs are mapped to bundled Fig icon assets, and their descriptions are shown in the popup.

## Current prototype

The Node completion worker stays loaded while Cue is running, avoiding a cold Node startup on every keystroke. The zsh hook sends line updates asynchronously over a local Unix socket. Use Up/Down to highlight suggestions, Enter to insert the highlighted suggestion, or Tab to open zsh's selection menu.

## Try the engine

Requires Node.js 20 or later and pnpm.

```sh
pnpm install
pnpm build:app
pnpm complete -- "git ch"
```

The command accepts a line of shell input and prints suggestion objects. The current prototype handles one simple command at a time; shell pipelines, complex quoting, environment substitutions, and full Fig generator semantics are not implemented yet.

To try Cue in the current Terminal session without editing your shell configuration:

```sh
cd /path/to/cue
pnpm install
pnpm build:app
source "$PWD/zsh/cue.zsh"
```

The helper launches Cue and prompts for macOS Accessibility access so it can place the popup over Terminal. Then type `git ch`; suggestions should appear while typing. Use Up/Down and press Enter to insert the highlighted suggestion, or use Tab to select through zsh's menu.

## Planned pieces

1. Improve parsing and Fig spec evaluation, including options that take arguments and dynamic generators.
2. Add synchronized arrow-key selection, richer icon rendering, and polish popup positioning.
3. Package and sign the app for distribution if it proves useful to share.

Fig's autocomplete specs and tooling are MIT-licensed upstream. This project uses the published `@withfig/autocomplete` package; see its package license and preserve notices when redistributing bundled upstream assets.
