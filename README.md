# Cue

A personal prototype for Fig-style command suggestions in Apple Terminal. It uses the open Fig completion specs as its command knowledge and is currently a completion-engine scaffold; the native popup is the next piece.

## Current prototype

The Node completion engine loads published Fig specs and returns matching subcommands, options, and argument suggestions as JSON. It includes basic command/argument generator support. A first zsh widget is also included: when sourced, it uses the engine on Tab and offers matching results through zsh's completion menu.

## Try the engine

Requires Node.js 20 or later and pnpm.

```sh
pnpm install
pnpm complete -- "git ch"
pnpm complete -- "git checkout "
```

The command accepts a line of shell input and prints suggestion objects. The current prototype handles one simple command at a time; shell pipelines, complex quoting, environment substitutions, and full Fig generator semantics are not implemented yet.

To try the Tab widget in the current Terminal session without editing your shell configuration:

```sh
export CUE_HOME="$PWD"
source "$CUE_HOME/zsh/cue.zsh"
```

Then type a command such as `git ch` and press Tab. For a permanent setup, add those two lines to `~/.zshrc` after reviewing them.

## Planned pieces

1. Improve parsing and Fig spec evaluation, including options that take arguments and dynamic generators.
2. Add a native macOS popup positioned over Apple Terminal, with keyboard navigation.
3. Package it as a local Mac app; consider signing and distribution if it proves useful to share.

Fig's autocomplete specs and tooling are MIT-licensed upstream. This project uses the published `@withfig/autocomplete` package; see its package license and preserve notices when redistributing bundled upstream assets.
