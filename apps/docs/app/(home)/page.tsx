import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CommandDemo } from "@/components/command-demo";
import { CueMark } from "@/components/cue-mark";
import { InstallCommand } from "@/components/install-command";

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
            Autocomplete,
            <br />
            back where it
            <br />
            <span className="headline-mark">belongs.</span>
          </h1>
          <p className="hero-description">
            Fig-inspired suggestions for Apple Terminal. See commands, options, and paths as you
            type.
          </p>
          <div className="hero-actions">
            <InstallCommand />
            <Link href="/docs" className="quiet-link">
              Read the docs <ArrowUpRight aria-hidden="true" />
            </Link>
          </div>
          <ul className="hero-features" aria-label="Cue features">
            <li>Git completions</li>
            <li>Files and folders</li>
            <li>Fig autocomplete specs</li>
            <li>Apple Terminal · zsh</li>
          </ul>
        </div>
        <div className="hero-art" aria-label="Cue command suggestion preview">
          <CommandDemo />
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
              <p>Autocomplete for Apple Terminal.</p>
            </div>

            <nav className="footer-links" aria-label="Footer links">
              <Link href="/docs">Docs</Link>
              <Link href="/changelogs">Changelog</Link>
              <a href="https://github.com/8starlabs/cue">GitHub</a>
              <a href="https://github.com/8starlabs/cue/blob/main/CONTRIBUTION.md">Contributing</a>
            </nav>
          </div>

          <div className="home-footer-bottom">
            <span>© 2026 8StarLabs. All rights reserved.</span>
            <nav className="footer-meta-links" aria-label="Machine-readable resources">
              <Link href="/sitemap.xml">XML sitemap</Link>
              <Link href="/llms.txt">llms.txt</Link>
              <Link href="/llms-full.txt">llms-full.txt</Link>
            </nav>
          </div>
        </div>
      </footer>
    </main>
  );
}
