import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMDXComponents } from "@/components/mdx";
import { changelogSource } from "@/lib/source";
import { DocsPage } from "fumadocs-ui/layouts/docs/page";

const dateFormat = new Intl.DateTimeFormat("en", {
  dateStyle: "long",
  timeZone: "UTC",
});

export default async function ChangelogEntryPage(props: PageProps<"/changelogs/[slug]">) {
  const { slug } = await props.params;
  const page = changelogSource.getPage([slug]);
  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <DocsPage
      className="changelog-entry-page"
      breadcrumb={{ enabled: false }}
      tableOfContent={{ enabled: false }}
      tableOfContentPopover={{ enabled: false }}
      footer={{ enabled: false }}
    >
      <Link className="changelog-back" href="/changelogs">
        <ArrowLeft size={15} aria-hidden="true" />
        All releases
      </Link>
      <article>
        <header className="changelog-entry-header">
          <div className="changelog-list-meta">
            <span className="changelog-version">v{page.data.version}</span>
            <time dateTime={page.data.date}>
              {dateFormat.format(new Date(`${page.data.date}T00:00:00Z`))}
            </time>
          </div>
          <h1>{page.data.title}</h1>
          <p className="changelog-entry-description">{page.data.description}</p>
        </header>
        <div className="changelog-entry-body">
          <MDX components={getMDXComponents()} />
        </div>
      </article>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return changelogSource.getPages().map((page) => ({ slug: page.slugs[0] }));
}

export async function generateMetadata(props: PageProps<"/changelogs/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const page = changelogSource.getPage([slug]);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
  };
}
