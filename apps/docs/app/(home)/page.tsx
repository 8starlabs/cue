import Link from "next/link";
import { ArrowUpRight, Check, Command, Folder, Sparkles } from "lucide-react";
import { CommandDemo } from "@/components/command-demo";
import { CueMark } from "@/components/cue-mark";
import { InstallCommand } from "@/components/install-command";

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

export default function HomePage() {
  return (
    <main className="cue-home flex-1">
      <section className="hero-shell">
        <div className="hero-copy">
          <div className="hero-brand">
            <CueMark className="h-8 w-8" />
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
            <InstallCommand />
            <Link href="/docs" className="quiet-link">
              Read the docs <ArrowUpRight aria-hidden="true" />
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
        <div className="home-footer-inner">
          <div className="home-footer-main">
            <div className="home-footer-about">
              <Link href="/" className="footer-brand" aria-label="Cue home">
                <CueMark className="h-7 w-7" />
                <span>Cue</span>
              </Link>
              <p>Autocomplete that brings a little more flow to Apple Terminal.</p>
              <div className="footer-contact">
                <span>Kei Lok</span>
                <a href="https://www.x.com/keiloktql/" aria-label="Kei Lok on X">
                  X
                </a>
                <a href="https://www.linkedin.com/in/keiloktql/" aria-label="Kei Lok on LinkedIn">
                  in
                </a>
              </div>
            </div>

            <nav className="footer-link-groups" aria-label="Footer">
              <div className="footer-link-group">
                <h2>Explore</h2>
                <Link href="/docs">Documentation</Link>
                <Link href="/docs/getting-started">Getting started</Link>
                <Link href="/docs/keyboard-controls">Keyboard controls</Link>
              </div>
              <div className="footer-link-group">
                <h2>Project</h2>
                <a href="https://github.com/8starlabs/cue">GitHub</a>
                <a href="https://github.com/8starlabs/cue/blob/main/CONTRIBUTION.md">
                  Contributing
                </a>
                <a href="https://8starlabs.com">8StarLabs</a>
              </div>
            </nav>
          </div>

          <div className="home-footer-bottom">
            <span>© 2026 8StarLabs · Engineered by 8StarLabs</span>
            <a href="https://github.com/8starlabs/cue" className="footer-source-link">
              Open source on GitHub <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
