"use client";

import { ChevronDown, ExternalLink, FileText, MoreHorizontal, MousePointer2 } from "lucide-react";
import type { ReactNode } from "react";
import { siGithub } from "simple-icons/icons";
import { usePathname } from "fumadocs-core/framework";
import { Popover, PopoverContent, PopoverTrigger } from "fumadocs-ui/components/ui/popover";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { ClaudeIcon, OpenAIIcon } from "@/components/ai-icons";
import { cn } from "@/lib/utils";

interface PageActionsProps {
  markdownUrl: string;
  githubUrl: string;
}

interface MenuOption {
  title: string;
  href: string;
  icon: ReactNode;
}

function ActionLink({ title, href, icon }: MenuOption) {
  return (
    <a
      href={href}
      rel="noreferrer noopener"
      target="_blank"
      className="inline-flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-fd-accent hover:text-fd-accent-foreground [&_svg]:size-4"
    >
      {icon}
      {title}
      <ExternalLink aria-hidden="true" className="ms-auto size-3.5 text-fd-muted-foreground" />
    </a>
  );
}

export function PageActions({ markdownUrl, githubUrl }: PageActionsProps) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label="More page actions"
        title="More page actions"
        className={cn(
          buttonVariants({ variant: "secondary", size: "icon-sm" }),
          "data-[popup-open]:bg-fd-accent data-[popup-open]:text-fd-accent-foreground",
        )}
      >
        <MoreHorizontal aria-hidden="true" className="size-4" />
      </PopoverTrigger>
      <PopoverContent className="flex flex-col">
        <ActionLink
          title="Open in GitHub"
          href={githubUrl}
          icon={
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
              <path d={siGithub.path} />
            </svg>
          }
        />
        <ActionLink
          title="View as Markdown"
          href={markdownUrl}
          icon={<FileText aria-hidden="true" />}
        />
      </PopoverContent>
    </Popover>
  );
}

export function AskAiOptions() {
  const pathname = usePathname();
  const prompt = `Read ${pathname}, I want to ask questions about it.`;
  const encodedPrompt = encodeURIComponent(prompt);

  const options: MenuOption[] = [
    {
      title: "Open in ChatGPT",
      href: `https://chatgpt.com/?prompt=${encodedPrompt}&hints=search`,
      icon: <OpenAIIcon aria-hidden="true" />,
    },
    {
      title: "Open in Claude",
      href: `https://claude.ai/new?q=${encodedPrompt}`,
      icon: <ClaudeIcon aria-hidden="true" />,
    },
    {
      title: "Open in Cursor",
      href: `https://cursor.com/link/prompt?text=${encodedPrompt}`,
      icon: <MousePointer2 aria-hidden="true" />,
    },
  ];

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          buttonVariants({ variant: "secondary", size: "sm" }),
          "gap-2 data-[popup-open]:bg-fd-accent data-[popup-open]:text-fd-accent-foreground",
        )}
      >
        Ask AI
        <ChevronDown aria-hidden="true" className="size-3.5 text-fd-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="flex flex-col">
        {options.map((option) => (
          <ActionLink key={option.href} {...option} />
        ))}
      </PopoverContent>
    </Popover>
  );
}
