import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import type { DocsLayoutProps } from "fumadocs-ui/layouts/docs";
import {
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "fumadocs-ui/layouts/docs/slots/sidebar";
import { appName, gitConfig } from "./shared";
import { CueMark } from "@/components/cue-mark";
import { cueSearchTriggerSlots } from "@/components/search-trigger";
import { ExclusiveSidebar } from "@/components/docs-sidebar";
import cuePackage from "../../../packages/cue/package.json";

function cueNavTitle(showVersion = false) {
  return (
    <span className="cue-nav-brand">
      <CueMark className="cue-nav-mark" />
      <span>{appName}</span>
      {showVersion && (
        <span className="cue-nav-version" title="Current Cue version">
          v{cuePackage.version}
        </span>
      )}
    </span>
  );
}

export function baseOptions(): BaseLayoutProps {
  return {
    nav: { title: cueNavTitle() },
    links: [
      { text: "Docs", url: "/docs" },
      { text: "Changelog", url: "/changelogs" },
    ],
    slots: { searchTrigger: cueSearchTriggerSlots },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}

export function docsOptions(): BaseLayoutProps & {
  slots: NonNullable<DocsLayoutProps["slots"]>;
} {
  const base = baseOptions();

  return {
    ...base,
    nav: { ...base.nav, title: cueNavTitle(true) },
    slots: {
      ...base.slots,
      sidebar: {
        provider: SidebarProvider,
        root: ExclusiveSidebar,
        trigger: SidebarTrigger,
        useSidebar,
      },
    },
  };
}
