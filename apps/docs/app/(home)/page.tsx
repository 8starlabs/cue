import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, Command, Folder, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommandDemo } from "@/components/command-demo";

const capabilities = [
  {
    icon: Command,
    title: "Stay in your terminal",
    copy: "Cue sits beside Apple Terminal. Your prompt, shell, and working rhythm stay yours.",
  },
  {
    icon: Sparkles,
    title: "Context from open specs",
    copy: "Command suggestions come from the community-maintained Fig autocomplete catalog.",
  },
  {
    icon: Folder,
    title: "Paths as you type",
    copy: "Browse directories inline, with folder suggestions that follow the path you enter.",
  },
];

function StarMark({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" className={className} fill="none">
      <path
        d="M16 2v28M2 16h28M6.1 6.1l19.8 19.8m0-19.8L6.1 25.9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="16" cy="16" r="3" fill="currentColor" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <main className="cue-home flex-1">
      <section className="hero-shell">
        <div className="hero-copy">
          <div className="hero-brand">
            <StarMark className="h-8 w-8" />
            <span>Cue</span>
          </div>
          <h1>
            The terminal,
            <br />a little more <span className="headline-mark">helpful.</span>
          </h1>
          <p className="hero-description">
            IDE-style command suggestions for Apple Terminal. See the next step while your hands
            stay on the prompt.
          </p>
          <div className="hero-actions">
            <Button
              render={<Link href="/docs/getting-started" />}
              nativeButton={false}
              className="hero-primary"
            >
              Get started <ArrowRight aria-hidden="true" />
            </Button>
            <Link href="/docs" className="quiet-link">
              Read the guides <ArrowUpRight aria-hidden="true" />
            </Link>
          </div>
          <ul className="hero-features" aria-label="Cue features">
            <li>Git command suggestions</li>
            <li>Files and folders as you type</li>
            <li>Open autocomplete specs</li>
            <li>Apple Terminal · zsh</li>
          </ul>
        </div>
        <div className="hero-art" aria-label="Cue command suggestion preview">
          <CommandDemo />
        </div>
      </section>

      <section className="install-strip" aria-label="Quick start">
        <div className="install-label">
          <span className="install-dot">
            <Check size={13} />
          </span>
          <div>
            <strong>Try it from source</strong>
            <span>Build the native popup and load the zsh bridge</span>
          </div>
        </div>
        <code>
          <span className="prompt-sign">$</span> pnpm build:app{" "}
          <span className="command-separator">&amp;&amp;</span> source packages/cue/zsh/cue.zsh
        </code>
        <Link href="/docs/getting-started" aria-label="Open the getting started guide">
          <ArrowUpRight size={17} />
        </Link>
      </section>

      <section className="capabilities" aria-label="What Cue does">
        <div className="section-intro">
          <span>SMALL TOOL, CLOSE TO THE WORK</span>
          <h2>
            Suggestions that know
            <br />
            what you’re typing.
          </h2>
        </div>
        <div className="capability-list">
          {capabilities.map(({ icon: Icon, title, copy }) => (
            <article className="capability" key={title}>
              <span className="capability-icon">
                <Icon size={17} strokeWidth={1.8} />
              </span>
              <div>
                <h3>{title}</h3>
                <p>{copy}</p>
              </div>
              <span className="capability-check">
                <Check size={14} />
              </span>
            </article>
          ))}
        </div>
      </section>

      <footer className="home-footer">
        <span>Made for the place where work starts.</span>
        <Link href="/docs">
          Cue documentation <ArrowRight size={14} />
        </Link>
        <span>8StarLabs · 2026</span>
      </footer>
    </main>
  );
}
