# Cue documentation site

The public-facing Cue site is a Next.js app with Fumadocs for its guides, Tailwind CSS v4 for styling, and shadcn/ui for reusable interface components.

From the repository root:

```sh
pnpm dev:docs
pnpm check:docs
pnpm build:docs
```

Edit the landing page in `app/(home)/page.tsx`, shared visual styles in `app/global.css`, and guide content in `content/docs/`. `lib/source.ts` connects the MDX files to Fumadocs; `lib/layout.shared.tsx` contains shared navigation and layout settings.
