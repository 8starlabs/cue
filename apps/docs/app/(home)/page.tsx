import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CommandDemo } from "@/components/command-demo";
import { InstallCommand } from "@/components/install-command";
import { AskAiFooter } from "@/components/ask-ai-footer";

export default function HomePage() {
  return (
    <main className="cue-home flex-1">
      <section className="hero-shell">
        <div className="hero-copy">
          <h1>
            IDE-style
            <br />
            autocomplete
            <br />
            for <span className="headline-mark">Terminal.</span>
          </h1>
          <p className="hero-description">
            Free and open source. Commands, options, and file paths appear as you type in Apple
            Terminal—no Tab required.
          </p>
          <div className="hero-actions">
            <InstallCommand />
            <Link href="/docs" className="quiet-link">
              Read the docs <ArrowUpRight aria-hidden="true" />
            </Link>
          </div>
          <ul className="hero-features" aria-label="Cue features">
            <li>Git commands and branch names</li>
            <li>Command, option, and argument suggestions</li>
            <li>Files and folders as you type</li>
            <li>Open-source Fig command specs</li>
            <li>File-type icons and contextual descriptions</li>
            <li>Arrow-key navigation</li>
            <li>Enter or Tab to insert · Esc to dismiss</li>
            <li>Apple Terminal · VS Code · zsh</li>
          </ul>
        </div>
        <div className="hero-art" aria-label="Cue command suggestion preview">
          <CommandDemo />
        </div>
      </section>

      <footer className="home-footer">
        <div className="home-footer-inner">
          <p className="footer-copy">
            Engineered by <a href="https://8starlabs.com">8StarLabs</a>. The source code is
            available on <a href="https://github.com/8starlabs/cue">GitHub</a>. For AI models and
            bots, see <Link href="/llms.txt">llms.txt</Link>.
          </p>
          <AskAiFooter />
        </div>
      </footer>
    </main>
  );
}
