"use client";

import { ClaudeIcon, GrokIcon, OpenAIIcon, PerplexityIcon, V0Icon } from "@/components/ai-icons";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://8starlabs.com";
const prompt = `Explain Cue, an IDE-style autocomplete for Apple Terminal and the VS Code integrated terminal on macOS, using zsh. Use ${siteUrl} and ${siteUrl}/llms.txt as context if you can browse. Cover how suggestions work, supported commands and paths, and how to install Cue.`;

const providers = [
  { label: "ChatGPT", url: "https://chatgpt.com/", icon: OpenAIIcon },
  { label: "Claude", url: "https://claude.ai/new", icon: ClaudeIcon },
  {
    label: "Perplexity",
    url: "https://www.perplexity.ai/search/new",
    icon: PerplexityIcon,
  },
  { label: "Grok", url: "https://grok.com/", icon: GrokIcon },
  { label: "v0", url: "https://v0.app/chat", icon: V0Icon },
] as const;

function getPromptUrl(baseUrl: string) {
  const url = new URL(baseUrl);
  url.searchParams.set("q", prompt);
  return url.toString();
}

export function AskAiFooter() {
  return (
    <div className="ask-ai-footer" role="group" aria-label="Ask AI about Cue">
      <span className="ask-ai-label">Ask AI:</span>
      {providers.map(({ label, url, icon: Icon }) => (
        <a
          key={label}
          href={getPromptUrl(url)}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open in ${label}`}
          title={`Open in ${label}`}
          className="ask-ai-provider"
        >
          <Icon className="ask-ai-provider-icon" aria-hidden="true" />
        </a>
      ))}
    </div>
  );
}
