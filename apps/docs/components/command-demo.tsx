"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { CueMark } from "@/components/cue-mark";

type Suggestion = {
  name: string;
  hint: string;
  description: string;
  icon: string;
  kind: string;
  marker?: "star";
};

type Scene = {
  path: string;
  command: string;
  match: string;
  category: string;
  suggestions: Suggestion[];
};

const heroScenes: Scene[] = [
  {
    path: "~/work/project",
    command: "git c",
    match: "c",
    category: "Git commands",
    suggestions: [
      {
        name: "checkout",
        hint: "[branch, file, tag or commit]",
        description: "Switch branches or restore working tree files",
        icon: "/fig-icons/command.png",
        kind: "command",
      },
      {
        name: "cherry-pick",
        hint: "<commit>",
        description: "Apply changes from an existing commit",
        icon: "/fig-icons/command.png",
        kind: "command",
      },
      {
        name: "commit",
        hint: '-m "message"',
        description: "Record changes to the repository",
        icon: "/fig-icons/command.png",
        kind: "command",
      },
      {
        name: "clean",
        hint: "<path>",
        description: "Remove untracked files from the working tree",
        icon: "/fig-icons/command.png",
        kind: "command",
      },
    ],
  },
  {
    path: "~/work/project",
    command: "git checkout ma",
    match: "ma",
    category: "Branches",
    suggestions: [
      {
        name: "main",
        hint: "Current branch",
        description: "Current branch",
        icon: "/fig-icons/git.png",
        kind: "branch",
        marker: "star",
      },
      {
        name: "main-dev",
        hint: "Branch",
        description: "Local branch",
        icon: "/fig-icons/git.png",
        kind: "branch",
      },
      {
        name: "marketing-site",
        hint: "Branch",
        description: "Local branch",
        icon: "/fig-icons/git.png",
        kind: "branch",
      },
    ],
  },
  {
    path: "~/work",
    command: "cd cu",
    match: "cu",
    category: "Folders",
    suggestions: [
      {
        name: "cue/",
        hint: "Folder",
        description: "Folder",
        icon: "/fig-icons/folder.png",
        kind: "folder",
      },
      {
        name: "cue-docs/",
        hint: "Folder",
        description: "Folder",
        icon: "/fig-icons/folder.png",
        kind: "folder",
      },
      {
        name: "cue-playground/",
        hint: "Folder",
        description: "Folder",
        icon: "/fig-icons/folder.png",
        kind: "folder",
      },
    ],
  },
  {
    path: "~/work/project",
    command: "rm ",
    match: "",
    category: "Files",
    suggestions: [
      {
        name: "README.md",
        hint: "File",
        description: "Markdown file",
        icon: "/material-icons/document.svg",
        kind: "file",
      },
      {
        name: "package.json",
        hint: "File",
        description: "Project manifest",
        icon: "/material-icons/json.svg",
        kind: "file",
      },
      {
        name: "pnpm-lock.yaml",
        hint: "File",
        description: "Package lockfile",
        icon: "/material-icons/document.svg",
        kind: "file",
      },
    ],
  },
];

const docsScenes = heroScenes;

const figIconFiles = [
  ["Alert", "alert.png"],
  ["Android", "android.png"],
  ["Apple", "apple.png"],
  ["Asterisk", "asterisk.png"],
  ["AWS", "aws.png"],
  ["Azure", "azure.png"],
  ["Box", "box.png"],
  ["Carrot", "carrot.png"],
  ["Characters", "characters.png"],
  ["Command", "command.png"],
  ["Command key", "commandkey.png"],
  ["Commit", "commit.png"],
  ["CPU", "cpu.png"],
  ["Database", "database.png"],
  ["Default file", "default-file-icon.png"],
  ["Default folder", "default-folder-icon.png"],
  ["Discord", "discord.png"],
  ["Docker", "docker.png"],
  ["File", "file.png"],
  ["File (SVG)", "file.svg"],
  ["Firebase", "firebase.png"],
  ["Flag", "flag.png"],
  ["Folder", "folder.png"],
  ["Folder (SVG)", "folder.svg"],
  ["Google Cloud", "gcloud.png"],
  ["Gear", "gear.png"],
  ["Git", "git.png"],
  ["GitHub", "github.png"],
  ["GitLab", "gitlab.png"],
  ["Gradle", "gradle.png"],
  ["Heroku", "heroku.png"],
  ["Invite", "invite.png"],
  ["Kubernetes", "kubernetes.png"],
  ["Netlify", "netlify.png"],
  ["Node", "node.png"],
  ["npm", "npm.png"],
  ["Okteto", "okteto.png"],
  ["Option key", "option.png"],
  ["Package", "package.png"],
  ["Q", "q.png"],
  ["Red flag", "red-flag.png"],
  ["Slack", "slack.png"],
  ["Status bar", "statusbar.png"],
  ["String", "string.png"],
  ["Symlink", "symlink.png"],
  ["Template", "template.png"],
  ["Twitter", "twitter.png"],
  ["Vercel", "vercel.png"],
  ["Yarn", "yarn.png"],
] as const;

const materialIconFiles = [
  ["CSS", "css.svg"],
  ["Document", "document.svg"],
  ["Git file", "git.svg"],
  ["HTML", "html.svg"],
  ["JavaScript", "javascript.svg"],
  ["JSON", "json.svg"],
  ["Markdown", "markdown.svg"],
  ["npm file", "npm.svg"],
  ["Next.js", "next.svg"],
  ["Node.js", "nodejs.svg"],
  ["pnpm file", "pnpm.svg"],
  ["Python", "python.svg"],
  ["React", "react.svg"],
  ["Rust", "rust.svg"],
  ["TypeScript", "typescript.svg"],
  ["TypeScript declaration", "typescript-def.svg"],
  ["YAML", "yaml.svg"],
  ["ESLint", "eslint.svg"],
] as const;

type IconSample = {
  label: string;
  source?: string;
  detail: string;
  symbol?: string;
};

const materialIconDetails: Record<string, string> = {
  "document.svg": "Fallback for files without a recognized file-type icon.",
  "eslint.svg": "eslint.*, .eslintrc*, .eslintignore, and .eslintcache.",
  "javascript.svg": ".js, .jsx, .mjs, and .cjs files.",
  "json.svg": ".json, .jsonc, and .json5 files.",
  "next.svg": "Files named next.config.*.",
  "nodejs.svg": "package.json and package-lock.json.",
  "typescript-def.svg": ".d.ts, .d.cts, and .d.mts declaration files.",
  "typescript.svg": ".ts, .tsx, .mts, and .cts files.",
};

function describeFigIcon(label: string, file: string) {
  const descriptions: Record<string, string> = {
    "command.png": "Fig command icon for commands and subcommands.",
    "commandkey.png": "Fig Command key icon.",
    "commit.png": "Fig commit icon for Git commit suggestions.",
    "default-file-icon.png": "Fig's generic file suggestion icon.",
    "default-folder-icon.png": "Fig's generic folder suggestion icon.",
    "file.png": "Fig file suggestion icon.",
    "file.svg": "Fig file suggestion icon.",
    "folder.png": "Fig folder suggestion icon.",
    "folder.svg": "Fig folder suggestion icon.",
    "git.png": "Fig Git icon for branches, tags, and commits.",
    "option.png": "Fig option icon for flags and command options.",
  };

  return descriptions[file] ?? `Fig ${label} icon; shown when a Fig spec requests it.`;
}

const iconSamples = [
  ...figIconFiles.map(([label, file]): IconSample => ({
    label,
    source: `/fig-icons/${file}`,
    detail: describeFigIcon(label, file),
  })),
  ...materialIconFiles.map(([label, file]): IconSample => ({
    label,
    source: `/material-icons/${file}`,
    detail:
      materialIconDetails[file] ??
      "Material Icon Theme sample; Cue does not currently map this icon to a file type.",
  })),
  {
    label: "Current branch",
    symbol: "★",
    detail: "The gold star marks the checked-out branch, commonly main.",
  },
];

function positionIconTooltip(target: HTMLSpanElement) {
  const bounds = target.getBoundingClientRect();
  const terminal = target.closest(".terminal-icon-gallery")?.previousElementSibling;
  const panelBounds =
    terminal instanceof HTMLElement
      ? terminal.getBoundingClientRect()
      : target.closest(".hero-shell")?.getBoundingClientRect();
  const leftEdge = Math.max(panelBounds?.left ?? 0, 16);
  const rightEdge = Math.min(panelBounds?.right ?? window.innerWidth, window.innerWidth - 16);
  const rightSpace = rightEdge - bounds.left;
  const leftSpace = bounds.right - leftEdge;
  const side = rightSpace >= 250 || rightSpace >= leftSpace ? "right" : "left";
  const availableSpace = side === "right" ? rightSpace : leftSpace;

  target.dataset.tooltipSide = side;
  target.style.setProperty(
    "--terminal-tooltip-max-width",
    `${Math.max(0, Math.min(250, availableSpace))}px`,
  );
}

const popupDelay = 220;
const popupDuration = 1650;
const closeDuration = 160;

export function CommandDemo({ variant = "hero" }: { variant?: "hero" | "docs" }) {
  const activeScenes = variant === "docs" ? docsScenes : heroScenes;
  const [sceneIndex, setSceneIndex] = useState(0);
  const [typedLength, setTypedLength] = useState(0);
  const [popupOpen, setPopupOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ left: 0, width: 400 });
  const terminalRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);

  const scene = activeScenes[sceneIndex];
  const selected = scene.suggestions[0];
  const typedCommand = scene.command.slice(0, typedLength);
  const commandStyle = {
    "--demo-typing-end": `${typedCommand.length}ch`,
  } as CSSProperties;
  const popupStyle = {
    width: `${popupPosition.width}px`,
    transform: `translateX(${popupPosition.left}px)`,
  } as CSSProperties;

  const updatePopupPosition = useCallback(() => {
    const terminal = terminalRef.current;
    const caret = caretRef.current;
    if (!terminal || !caret) return;

    const terminalBounds = terminal.getBoundingClientRect();
    const caretBounds = caret.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportLeft = viewport?.offsetLeft ?? 0;
    const viewportRight = viewportLeft + (viewport?.width ?? window.innerWidth);
    const leftBoundary = Math.max(terminalBounds.left + 8, viewportLeft + 8);
    const rightBoundary = Math.min(terminalBounds.right - 8, viewportRight - 8);
    const availableWidth = Math.max(0, rightBoundary - leftBoundary);
    const width = Math.min(400, availableWidth);
    const left = Math.min(Math.max(caretBounds.left, leftBoundary), rightBoundary - width);

    setPopupPosition((current) => {
      if (
        Math.abs(current.left - (left - caretBounds.left)) < 0.5 &&
        Math.abs(current.width - width) < 0.5
      ) {
        return current;
      }
      return { left: left - caretBounds.left, width };
    });
  }, []);

  useLayoutEffect(() => {
    updatePopupPosition();

    const terminal = terminalRef.current;
    if (!terminal) return;

    const observer = new ResizeObserver(updatePopupPosition);
    observer.observe(terminal);
    window.addEventListener("resize", updatePopupPosition);
    window.addEventListener("scroll", updatePopupPosition, true);
    window.visualViewport?.addEventListener("resize", updatePopupPosition);
    window.visualViewport?.addEventListener("scroll", updatePopupPosition);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updatePopupPosition);
      window.removeEventListener("scroll", updatePopupPosition, true);
      window.visualViewport?.removeEventListener("resize", updatePopupPosition);
      window.visualViewport?.removeEventListener("scroll", updatePopupPosition);
    };
  }, [popupOpen, sceneIndex, updatePopupPosition]);

  useEffect(() => {
    let active = true;
    const timers = new Set<ReturnType<typeof setTimeout>>();

    function schedule(callback: () => void, delay: number) {
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (active) callback();
      }, delay);
      timers.add(timer);
    }

    function playScene(index: number) {
      const nextScene = activeScenes[index];
      setSceneIndex(index);
      setTypedLength(0);
      setPopupOpen(false);
      setClosing(false);

      let length = 0;
      const typeNextCharacter = () => {
        length += 1;
        setTypedLength(length);

        if (length < nextScene.command.length) {
          schedule(typeNextCharacter, 24);
          return;
        }

        schedule(() => {
          setPopupOpen(true);
          schedule(() => {
            setPopupOpen(false);
            setClosing(true);
            schedule(() => playScene((index + 1) % activeScenes.length), closeDuration);
          }, popupDuration);
        }, popupDelay);
      };

      schedule(typeNextCharacter, 24);
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTypedLength(activeScenes[0].command.length);
      setPopupOpen(true);
      return () => {
        active = false;
      };
    }

    schedule(() => playScene(0), 180);

    return () => {
      active = false;
      for (const timer of timers) clearTimeout(timer);
    };
  }, [activeScenes]);

  return (
    <>
      <div
        className="terminal-demo"
        aria-label="Cue terminal autocomplete preview"
        ref={terminalRef}
      >
        <div className="terminal-titlebar">
          <div className="window-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <div className="terminal-title">
            <CueMark className="terminal-brand-mark" />
            Cue
          </div>
        </div>
        <div className="terminal-screen">
          <div className="terminal-line">
            <span className="terminal-user">dev</span>
            <span className="terminal-at">@</span>
            <span className="terminal-host">cue</span>
            <span className="terminal-path-inline"> {scene.path}</span>
            <span className="terminal-prompt"> % </span>
            <span className="demo-typed-command" key={sceneIndex} style={commandStyle}>
              {typedCommand}
            </span>
            <span className="caret-anchor" ref={caretRef}>
              <span className="terminal-caret" aria-hidden="true" />
              <div className="suggestion-anchor" style={popupStyle}>
                <div
                  id="cue-demo-suggestions"
                  className={`t-dropdown suggestion-menu ${popupOpen ? "is-open" : ""} ${closing ? "is-closing" : ""}`}
                  data-origin="top-left"
                  role="listbox"
                  aria-label={`${scene.category} suggestions`}
                  aria-hidden={!popupOpen}
                >
                  {scene.suggestions.map(({ name, hint, icon, kind, marker }, index) => {
                    const matchedCharacters = name
                      .toLowerCase()
                      .startsWith(scene.match.toLowerCase())
                      ? scene.match.length
                      : 0;

                    return (
                      <div
                        className={`suggestion-row ${index === 0 ? "is-selected" : ""}`}
                        key={name}
                        role="option"
                        aria-selected={index === 0}
                      >
                        {marker === "star" ? (
                          <span className="suggestion-icon suggestion-icon-star" aria-hidden="true">
                            ★
                          </span>
                        ) : (
                          <img
                            className={`suggestion-icon is-${kind}`}
                            src={icon}
                            width="16"
                            height="16"
                            alt=""
                            aria-hidden="true"
                          />
                        )}
                        <span className="suggestion-name">
                          {matchedCharacters > 0 && <b>{name.slice(0, matchedCharacters)}</b>}
                          {name.slice(matchedCharacters)}
                        </span>
                        <span className="suggestion-hint">{hint}</span>
                      </div>
                    );
                  })}
                  <div className="suggestion-compact-footer">
                    <p>{selected.description}</p>
                    <span aria-hidden="true">(⌘I)</span>
                  </div>
                </div>
              </div>
            </span>
          </div>
        </div>
      </div>
      {variant === "hero" && (
        <div
          className="terminal-icon-gallery"
          role="list"
          aria-label="Fig icons, Material Icon Theme samples, and the current-branch star"
        >
          {iconSamples.map(({ label, source, detail, symbol }, index) => (
            <span
              className="terminal-icon-tile"
              key={label}
              role="listitem"
              tabIndex={0}
              aria-label={`${label}: ${detail}`}
              aria-describedby={`terminal-icon-tooltip-${index}`}
              onPointerEnter={(event) => positionIconTooltip(event.currentTarget)}
              onFocus={(event) => positionIconTooltip(event.currentTarget)}
            >
              {symbol ? (
                <span className="suggestion-icon-star terminal-gallery-star" aria-hidden="true">
                  {symbol}
                </span>
              ) : (
                <img src={source} alt="" aria-hidden="true" />
              )}
              <span
                className="terminal-icon-tooltip"
                id={`terminal-icon-tooltip-${index}`}
                role="tooltip"
              >
                <strong>{label}</strong>
                <span>{detail}</span>
              </span>
            </span>
          ))}
        </div>
      )}
    </>
  );
}
