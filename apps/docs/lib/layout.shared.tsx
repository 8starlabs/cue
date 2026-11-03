import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { appName, gitConfig } from "./shared";
import { CueMark } from "@/components/cue-mark";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="cue-nav-brand">
          <CueMark className="cue-nav-mark" />
          <span>{appName}</span>
        </span>
      ),
    },
    links: [
      { text: "Docs", url: "/docs" },
      { text: "Changelog", url: "/changelogs" },
    ],
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
