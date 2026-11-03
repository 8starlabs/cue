import type { MetadataRoute } from "next";
import { changelogSource, source } from "@/lib/source";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://8starlabs.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const entries = new Map<string, MetadataRoute.Sitemap[number]>();
  const staticPages: MetadataRoute.Sitemap = [
    { url: new URL("/", siteUrl).toString(), priority: 1, changeFrequency: "weekly" },
    { url: new URL("/docs", siteUrl).toString(), priority: 0.9, changeFrequency: "weekly" },
    { url: new URL("/changelogs", siteUrl).toString(), priority: 0.7, changeFrequency: "monthly" },
  ];

  for (const page of staticPages) entries.set(page.url, page);

  for (const page of source.getPages()) {
    const url = new URL(page.url, siteUrl).toString();
    if (!entries.has(url)) {
      entries.set(url, { url, priority: 0.7, changeFrequency: "monthly" });
    }
  }

  for (const page of changelogSource.getPages()) {
    const url = new URL(page.url, siteUrl).toString();
    entries.set(url, {
      url,
      lastModified: new Date(`${page.data.date}T00:00:00Z`),
      priority: 0.5,
      changeFrequency: "yearly",
    });
  }

  return [...entries.values()];
}
