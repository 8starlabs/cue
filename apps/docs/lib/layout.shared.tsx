import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { appName, gitConfig } from "./shared";
import { ArrowUpRight } from "lucide-react";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="cue-nav-brand">
          <span className="cue-nav-mark" aria-hidden="true">
            ✳
          </span>
          <span>{appName}</span>
        </span>
      ),
    },
    links: [
      { text: "Guides", url: "/docs" },
      {
        text: "GitHub",
        url: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
        external: true,
        icon: <ArrowUpRight size={13} />,
      },
    ],
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
