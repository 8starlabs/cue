# Cue workspace notes

Cue is a macOS terminal autocomplete project from 8StarLabs. It supports zsh in Apple Terminal and the VS Code integrated terminal. The repo is organized as a pnpm workspace:

```text
apps/docs       Next.js + Fumadocs docs site
packages/cue    TypeScript completion engine + macOS popup + zsh integration
Formula         Homebrew tap formula (same repository)
```

## Working on the package

The app bundle is built by `packages/cue/scripts/build-app.sh`. Its embedded Swift app starts the Node worker from the package’s generated `dist/` files. The zsh integration sends the live prompt buffer, cwd, and terminal cursor metadata to a local Unix socket; keep its packet layout aligned with `RequestMetadata.parse` in `packages/cue/native/Sources/Cue/main.swift`.

Use `pnpm build:cue` after TypeScript changes and `pnpm build:app` after native-app or packaging changes. Shell changes can be checked with `zsh -n packages/cue/zsh/cue.zsh`.

## Working on the docs

Run `pnpm dev:docs` from the repo root. Write guides in `apps/docs/content/docs/`; navigation comes from Fumadocs’ `meta.json`. The marketing page is `apps/docs/app/(home)/page.tsx`.

The docs site uses Next.js App Router, Fumadocs MDX/UI, Tailwind CSS v4, and shadcn/ui. Keep site interactions keyboard-accessible and honor reduced motion. Use the 8StarLabs visual language without copying Canopy’s tree mark or presenting Cue as a Canopy product.

## Release truth

Homebrew distribution uses this repository as its tap; no second tap repo is needed. A formula must point to a real GitHub release archive and include its matching SHA-256 before it is described as ready to install. Because the repository is not named `homebrew-cue`, users add it with the explicit Git URL shown in the Homebrew guide.
