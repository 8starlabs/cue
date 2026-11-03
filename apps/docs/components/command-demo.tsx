"use client";

import { useEffect, useState } from "react";
import { CueMark } from "@/components/cue-mark";

const scenes = [
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
        icon: "/fig-icons/default-file-icon.png",
        kind: "file",
      },
      {
        name: "main-dev",
        hint: "Branch",
        description: "Local branch",
        icon: "/fig-icons/default-file-icon.png",
        kind: "file",
      },
      {
        name: "marketing-site",
        hint: "Branch",
        description: "Local branch",
        icon: "/fig-icons/default-file-icon.png",
        kind: "file",
      },
    ],
  },
  {
    path: "~/work",
    command: "cd D",
    match: "D",
    category: "Folders",
    suggestions: [
      {
        name: "Desktop/",
        hint: "Folder",
        description: "Folder",
        icon: "/fig-icons/default-folder-icon.png",
        kind: "folder",
      },
      {
        name: "Documents/",
        hint: "Folder",
        description: "Folder",
        icon: "/fig-icons/default-folder-icon.png",
        kind: "folder",
      },
      {
        name: "Downloads/",
        hint: "Folder",
        description: "Folder",
        icon: "/fig-icons/default-folder-icon.png",
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
        icon: "/fig-icons/default-file-icon.png",
        kind: "file",
      },
      {
        name: "package.json",
        hint: "File",
        description: "Project manifest",
        icon: "/fig-icons/default-file-icon.png",
        kind: "file",
      },
      {
        name: "pnpm-lock.yaml",
        hint: "File",
        description: "Package lockfile",
        icon: "/fig-icons/default-file-icon.png",
        kind: "file",
      },
    ],
  },
];

const characterDelay = 74;
const popupDelay = 360;
const popupDuration = 1650;
const closeDuration = 160;

export function CommandDemo() {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [typedLength, setTypedLength] = useState(0);
  const [popupOpen, setPopupOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  const scene = scenes[sceneIndex];
  const typedCommand = scene.command.slice(0, typedLength);
  const selected = scene.suggestions[0];

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    function schedule(callback: () => void, delay: number) {
      timer = setTimeout(() => {
        if (active) callback();
      }, delay);
    }

    function playScene(index: number) {
      const nextScene = scenes[index];
      setSceneIndex(index);
      setTypedLength(0);
      setPopupOpen(false);
      setClosing(false);

      let position = 0;

      function typeNextCharacter() {
        position += 1;
        setTypedLength(position);

        if (position < nextScene.command.length) {
          schedule(typeNextCharacter, characterDelay);
          return;
        }

        schedule(() => {
          setPopupOpen(true);
          schedule(() => {
            setPopupOpen(false);
            setClosing(true);
            schedule(() => playScene((index + 1) % scenes.length), closeDuration);
          }, popupDuration);
        }, popupDelay);
      }

      schedule(typeNextCharacter, 120);
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTypedLength(scenes[0].command.length);
      setPopupOpen(true);
      return () => {
        active = false;
      };
    }

    schedule(() => playScene(0), 180);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="terminal-demo" aria-label="Cue terminal autocomplete preview">
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
          <span className="terminal-host">macbook</span>
          <span className="terminal-path-inline"> {scene.path}</span>
          <span className="terminal-prompt"> % </span>
          <span>{typedCommand}</span>
          <span className="caret-anchor">
            <span className="terminal-caret" aria-hidden="true" />
            <div className="suggestion-anchor">
              <div
                id="cue-demo-suggestions"
                className={`t-dropdown suggestion-menu ${popupOpen ? "is-open" : ""} ${closing ? "is-closing" : ""}`}
                data-origin="top-left"
                role="listbox"
                aria-label={`${scene.category} suggestions`}
                aria-hidden={!popupOpen}
              >
                {scene.suggestions.map(({ name, hint, icon, kind }, index) => {
                  const matchedCharacters = name.toLowerCase().startsWith(scene.match.toLowerCase())
                    ? scene.match.length
                    : 0;

                  return (
                    <div
                      className={`suggestion-row ${index === 0 ? "is-selected" : ""}`}
                      key={name}
                      role="option"
                      aria-selected={index === 0}
                    >
                      <img
                        className={`suggestion-icon is-${kind}`}
                        src={icon}
                        width="16"
                        height="16"
                        alt=""
                        aria-hidden="true"
                      />
                      <span className="suggestion-name">
                        {matchedCharacters > 0 && <b>{name.slice(0, matchedCharacters)}</b>}
                        {name.slice(matchedCharacters)}
                      </span>
                      <span className="suggestion-hint">{hint}</span>
                    </div>
                  );
                })}
              </div>
              <div
                className={`suggestion-description ${popupOpen ? "is-visible" : ""}`}
                aria-hidden={!popupOpen}
              >
                <p>{selected.description}</p>
              </div>
            </div>
          </span>
        </div>
      </div>
    </div>
  );
}
