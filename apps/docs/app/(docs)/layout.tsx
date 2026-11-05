import type { ReactNode } from "react";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { docsOptions } from "@/lib/layout.shared";
import { source } from "@/lib/source";

export default function SharedDocsLayout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout tree={source.getPageTree()} {...docsOptions()}>
      {children}
    </DocsLayout>
  );
}
