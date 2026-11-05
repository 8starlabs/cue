import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { DocsPage } from "fumadocs-ui/layouts/docs/page";
import { changelogSource } from "@/lib/source";

export const metadata: Metadata = {
  title: "Changelog",
  description: "Release notes and changes for Cue.",
};

const dateFormat = new Intl.DateTimeFormat("en", {
  dateStyle: "long",
  timeZone: "UTC",
});

function compareVersionsDescending(a: string, b: string) {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);

  for (let index = 0; index < 3; index += 1) {
    const difference = (right[index] ?? 0) - (left[index] ?? 0);
    if (difference !== 0) return difference;
  }

  return 0;
}

export default function ChangelogPage() {
  const pages = changelogSource
    .getPages()
    .sort(
      (a, b) =>
        b.data.date.localeCompare(a.data.date) ||
        compareVersionsDescending(a.data.version, b.data.version),
    );

  return (
    <DocsPage
      className="changelog-page"
      breadcrumb={{ enabled: false }}
      tableOfContent={{ enabled: false }}
      tableOfContentPopover={{ enabled: false }}
      footer={{ enabled: false }}
    >
      <p className="changelog-kicker">Release notes</p>
      <h1>Changelog</h1>
      <p className="changelog-intro">
        What changed in Cue, version by version. Each entry is published with its matching GitHub
        release.
      </p>

      {pages.length > 0 ? (
        <ol className="changelog-list">
          {pages.map((page) => (
            <li className="changelog-list-item" key={page.url}>
              <Link className="changelog-list-link" href={page.url}>
                <div className="changelog-list-meta">
                  <span className="changelog-version">v{page.data.version}</span>
                  <time dateTime={page.data.date}>
                    {dateFormat.format(new Date(`${page.data.date}T00:00:00Z`))}
                  </time>
                </div>
                <h2 className="changelog-list-title">{page.data.title}</h2>
                <p className="changelog-list-description">{page.data.description}</p>
                <ArrowRight className="changelog-list-arrow" size={18} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <section className="changelog-empty" aria-live="polite">
          <h2>The first release notes are on their way.</h2>
          <p>Published Cue releases will appear here with their version, date, and changes.</p>
        </section>
      )}
    </DocsPage>
  );
}
