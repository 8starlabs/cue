# Cue release notes

Create one `vMAJOR.MINOR.PATCH.mdx` file for each release. Ordinary commits and pushes do not
create a version or a changelog entry.

From the repository root, synchronize the version first, then create its draft:

```sh
pnpm version:cue 0.2.0
pnpm changelog:new
```

Replace the template text with user-visible changes. Use standard Markdown so the same body can be
rendered on the documentation site and published as the GitHub Release notes. Keep the frontmatter
fields `title`, `description`, `version`, and `date` (`YYYY-MM-DD`) intact.

Run `pnpm changelog:check` before packaging. The site reads these files directly and lists releases
newest first at `/changelogs`.
