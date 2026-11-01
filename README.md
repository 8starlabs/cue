# Cue

Autocomplete for the terminal you already use.

Cue brings Fig-style command and path suggestions to Apple Terminal, with helpful descriptions beside the selected suggestion.

I started using Fig before Amazon acquired it and loved its autocomplete. After the CLI became Kiro and announced that v3 would retire inline autocomplete, I was sad to lose it. Cue is my attempt to bring that experience back.

## Installation

Homebrew is the planned installation method:

```bash
brew install 8starlabs/cue/cue
```

The tap and release are not published yet. Until then, see the [getting started guide](apps/docs/content/docs/getting-started.mdx) to build Cue from source.

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
