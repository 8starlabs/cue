import { llms, loader } from "fumadocs-core/source";
import { lucideIconsPlugin } from "fumadocs-core/source/lucide-icons";
import { docsRoute } from "./shared";
import { defineCollections, defineDocs } from "fumadocs-mdx/macro";
import { metaSchema, pageSchema } from "fumadocs-core/source/schema";

const docs = defineDocs({
  dir: "content/docs",
  docs: {
    schema: pageSchema,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

const changelogs = defineCollections({
  type: "doc",
  dir: "../../changelogs",
  files: ["v*.mdx"],
  schema: pageSchema.extend({
    description: pageSchema.shape.title,
    version: pageSchema.shape.title,
    date: pageSchema.shape.title,
  }),
  postprocess: {
    includeProcessedMarkdown: true,
  },
});

// See https://fumadocs.dev/docs/headless/source-api for more info
export const source = loader({
  baseUrl: docsRoute,
  source: docs.toFumadocsSource(),
  plugins: [lucideIconsPlugin()],
});

export const changelogSource = loader({
  baseUrl: "/changelogs",
  source: changelogs.toFumadocsSource(),
});

export const docsLlms = llms(source, {
  renderPage: async (page) => `# ${page.data.title} (${page.url})

${await page.data.getText("processed")}`,
});
