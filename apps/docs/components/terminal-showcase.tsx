"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Pause, Play } from "lucide-react";
import { CommandDemo } from "@/components/command-demo";
import { CueMark } from "@/components/cue-mark";

type DemoSuggestion = {
  name: string;
  hint?: string;
  icon: string;
  match?: string;
  star?: boolean;
};

type KeyboardDemoMode = "selection" | "accept" | "space" | "dismiss" | "description";

type KeyboardDemoProps = {
  isPlaying: boolean;
  onToggle: () => void;
  keyLabel: string;
  title: string;
  description: string;
  command: string;
  acceptedCommand?: string;
  suggestions?: DemoSuggestion[];
  selected?: number;
  descriptionText?: string;
  descriptionPlacement?: "bottom" | "side";
  mode: KeyboardDemoMode;
};

function useDemoPhase(initialPhase: number, isPlaying: boolean, mode: KeyboardDemoMode) {
  const [phase, setPhase] = useState(initialPhase);
  const [isVisible, setIsVisible] = useState(false);
  const [isDocumentVisible, setIsDocumentVisible] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const targetRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    const updateDocumentVisibility = () => {
      setIsDocumentVisible(!document.hidden);
    };

    const observer =
      typeof IntersectionObserver === "undefined"
        ? undefined
        : new IntersectionObserver(
            ([entry]) => {
              setIsVisible(entry.isIntersecting);
            },
            { rootMargin: "80px 0px" },
          );

    if (observer) {
      observer.observe(target);
    } else {
      setIsVisible(true);
    }
    updateDocumentVisibility();
    document.addEventListener("visibilitychange", updateDocumentVisibility);

    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", updateDocumentVisibility);
    };
  }, []);

  useEffect(() => {
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setPrefersReducedMotion(motionPreference.matches);

    updateMotionPreference();
    motionPreference.addEventListener("change", updateMotionPreference);
    return () => motionPreference.removeEventListener("change", updateMotionPreference);
  }, []);

  useEffect(() => {
    if (!isPlaying || !isVisible || !isDocumentVisible || prefersReducedMotion) return;

    // Let each beat read clearly: a brief pause, typing, time to inspect the
    // suggestions, the key press, then a longer hold on the result.
    const phaseDurations =
      mode === "selection"
        ? [550, 1000, 1650, 800, 800, 1900]
        : mode === "space"
          ? [550, 950, 1250, 900, 1750, 1900]
          : [550, 1000, 1550, 800, 1550, 1900];
    const timer = window.setTimeout(() => {
      setPhase((current) => (current >= phaseDurations.length - 1 ? 0 : current + 1));
    }, phaseDurations[phase] ?? phaseDurations[0]);
    return () => window.clearTimeout(timer);
  }, [isDocumentVisible, isPlaying, isVisible, mode, phase, prefersReducedMotion]);

  return { phase, setPhase, targetRef, isVisible, prefersReducedMotion };
}

function highlightedName(name: string, match = "") {
  const matched = match && name.toLowerCase().startsWith(match.toLowerCase()) ? match.length : 0;

  return (
    <span className="key-demo-name">
      {matched > 0 && <b>{name.slice(0, matched)}</b>}
      {name.slice(matched)}
    </span>
  );
}

function KeyboardDemo({
  isPlaying,
  onToggle,
  keyLabel,
  title,
  description,
  command,
  acceptedCommand,
  suggestions = [],
  selected = 0,
  descriptionText,
  descriptionPlacement = "bottom",
  mode,
}: KeyboardDemoProps) {
  // Keep a useful still preview until Play is pressed. Space previews the
  // suggestions that appear after the key starts the next argument.
  const initialPhase = mode === "space" ? 3 : 2;
  const { phase, setPhase, targetRef, isVisible, prefersReducedMotion } = useDemoPhase(
    initialPhase,
    isPlaying,
    mode,
  );
  const showingAccepted = mode === "accept" && phase >= 4;
  const showingNextArgument = mode === "space" && phase >= 3;
  const showingDismissed = mode === "dismiss" && phase >= 4;
  const isKeyPressed =
    isPlaying && (mode === "selection" ? phase === 3 || phase === 4 : phase === 3);
  const selectedIndex =
    mode === "selection" && phase === 3 ? Math.min(selected + 1, suggestions.length - 1) : selected;
  const showMenu =
    (mode === "selection" && phase >= 2) ||
    (mode === "description" && phase >= 2) ||
    (mode === "accept" && phase >= 2 && !showingAccepted) ||
    showingNextArgument ||
    (mode === "dismiss" && phase >= 2 && !showingDismissed);
  const showSideDescription =
    mode === "description" && phase >= 4 && descriptionPlacement === "side";
  const lineCommand =
    showingAccepted && acceptedCommand
      ? acceptedCommand
      : mode === "space" && showingNextArgument
        ? `${command} `
        : command;
  const typingCommand =
    isPlaying && phase === 0 ? "" : mode === "space" || mode === "accept" ? command : lineCommand;
  const acceptedSuffix =
    showingAccepted && acceptedCommand?.startsWith(command)
      ? acceptedCommand.slice(command.length)
      : "";
  const keycastKeys =
    isPlaying && (phase === 3 || (mode === "selection" && phase === 4))
      ? mode === "selection"
        ? [phase === 3 ? "↓" : "↑"]
        : mode === "accept" || mode === "space" || mode === "dismiss"
          ? [mode === "space" ? "Space" : mode === "dismiss" ? "Esc" : keyLabel]
          : mode === "description"
            ? ["⌘", "I"]
            : []
      : [];
  const typingDuration = Math.max(520, Math.min(950, typingCommand.length * 34));
  const phaseName = ["start", "typing", "suggestions", "key", "result", "hold"][phase] ?? "hold";
  const demoStyle = {
    "--demo-typing-duration": `${typingDuration}ms`,
  } as CSSProperties;
  const commandStyle = {
    "--demo-typing-end": `${typingCommand.length}ch`,
    "--demo-typing-steps": typingCommand.length,
  } as CSSProperties;

  return (
    <article
      data-demo-playing={isPlaying ? "true" : "false"}
      ref={targetRef}
      data-demo-visible={isVisible ? "true" : "false"}
      data-demo-mode={mode}
      data-demo-phase={phaseName}
      className="key-demo-card"
    >
      <div className="key-demo-heading">
        <kbd className={isKeyPressed && mode !== "selection" ? "is-pressed" : undefined}>
          {keyLabel}
        </kbd>
        <div className="key-demo-heading-copy">
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        {isPlaying && (
          <button
            type="button"
            className="key-demo-play"
            onClick={onToggle}
            aria-label={`Pause ${title.toLowerCase()} demo`}
            aria-pressed="true"
          >
            <Pause aria-hidden="true" />
            <span>Pause</span>
          </button>
        )}
      </div>

      <div className="key-demo-terminal">
        <div className="key-demo-visual" aria-hidden="true">
          <div className="terminal-titlebar key-demo-titlebar">
            <div className="window-dots">
              <i />
              <i />
              <i />
            </div>
            <div className="terminal-title">
              <CueMark className="terminal-brand-mark" />
              Cue
            </div>
            <span className="key-demo-size">80 × 24</span>
          </div>
          <div className="key-demo-screen" style={demoStyle}>
            <div className="key-demo-prompt">
              <span className="terminal-user">dev</span>
              <span className="terminal-at">@</span>
              <span className="terminal-host">cue</span>
              <span className="terminal-prompt"> % </span>
              <span
                className="demo-typed-command"
                key={`${mode}-${phaseName}-${mode === "space" || mode === "accept" ? command : lineCommand}`}
                style={commandStyle}
              >
                {typingCommand}
              </span>
              {acceptedSuffix && <span className="key-demo-accepted-suffix">{acceptedSuffix}</span>}
              {mode === "space" && (
                <span className={`key-demo-space${showingNextArgument ? " is-entered" : ""}`}>
                  {showingNextArgument ? " " : ""}
                </span>
              )}
              <span className="key-demo-caret-anchor">
                <span className="terminal-caret key-demo-caret" />
                {showMenu && (
                  <span className="key-demo-popup">
                    <span className="key-demo-menu">
                      {suggestions.map((suggestion, index) => (
                        <span
                          className={`key-demo-row${index === selectedIndex ? " is-selected" : ""}`}
                          key={suggestion.name}
                        >
                          {suggestion.star ? (
                            <span className="key-demo-star">★</span>
                          ) : (
                            <img src={suggestion.icon} width="14" height="14" alt="" />
                          )}
                          {highlightedName(suggestion.name, suggestion.match)}
                          {suggestion.hint && (
                            <span className="key-demo-hint">{suggestion.hint}</span>
                          )}
                        </span>
                      ))}
                      {descriptionText && !showSideDescription && (
                        <span className="key-demo-description">{descriptionText}</span>
                      )}
                    </span>
                    {showSideDescription && (
                      <span className="key-demo-side-description">
                        <span>{descriptionText}</span>
                        <span className="key-demo-side-description-shortcut" aria-hidden="true">
                          (⌘I)
                        </span>
                      </span>
                    )}
                  </span>
                )}
              </span>
            </div>
            {keycastKeys.length > 0 && (
              <div className="key-demo-keycast" key={`${mode}-${phase}`}>
                {keycastKeys.map((key) => (
                  <kbd key={key}>{key}</kbd>
                ))}
              </div>
            )}
            {(showingAccepted || showingDismissed) && (
              <span className="key-demo-state">
                {showingAccepted
                  ? keyLabel === "Enter"
                    ? "Suggestion inserted · press Enter again to run"
                    : "Suggestion inserted · prompt ready to edit"
                  : "Suggestions dismissed"}
              </span>
            )}
          </div>
        </div>
        {!isPlaying && (
          <button
            type="button"
            className="key-demo-play key-demo-play-overlay"
            onClick={() => {
              setPhase(0);
              onToggle();
            }}
            disabled={prefersReducedMotion}
            aria-label={`Play ${title.toLowerCase()} demo`}
            aria-pressed="false"
          >
            <Play aria-hidden="true" />
            <span>Play</span>
          </button>
        )}
      </div>
    </article>
  );
}

export function KeyboardActionShowcase() {
  const [activeDemoId, setActiveDemoId] = useState<string | null>(null);
  const toggleDemo = (id: string) => {
    setActiveDemoId((current) => (current === id ? null : id));
  };

  return (
    <section
      className="key-demo-grid"
      aria-label="Keyboard control examples. Play one demo at a time."
    >
      <KeyboardDemo
        isPlaying={activeDemoId === "arrows"}
        onToggle={() => toggleDemo("arrows")}
        keyLabel="↑  ↓"
        title="Move through suggestions"
        description="The selected row moves while the command stays in the prompt."
        command="git c"
        mode="selection"
        selected={0}
        suggestions={[
          {
            name: "checkout",
            hint: "[branch, file, tag or commit]",
            icon: "/fig-icons/command.png",
            match: "c",
          },
          { name: "cherry-pick", hint: "<commit>", icon: "/fig-icons/command.png", match: "c" },
          { name: "commit", hint: '-m "message"', icon: "/fig-icons/command.png", match: "c" },
        ]}
      />
      <KeyboardDemo
        isPlaying={activeDemoId === "enter"}
        onToggle={() => toggleDemo("enter")}
        keyLabel="Enter"
        title="Insert the selected suggestion"
        description="Enter inserts it into your prompt. Press Enter again to run it."
        command="git checkout ma"
        acceptedCommand="git checkout main"
        mode="accept"
        suggestions={[{ name: "main", icon: "/fig-icons/git.png", match: "ma", star: true }]}
      />
      <KeyboardDemo
        isPlaying={activeDemoId === "space"}
        onToggle={() => toggleDemo("space")}
        keyLabel="Space"
        title="Start the next argument"
        description="A space after a command opens suggestions for its next argument."
        command="git checkout"
        mode="space"
        suggestions={[
          { name: "main", hint: "Current branch", icon: "/fig-icons/git.png", star: true },
          { name: "main-dev", hint: "Branch", icon: "/fig-icons/git.png" },
        ]}
      />
      <KeyboardDemo
        isPlaying={activeDemoId === "tab"}
        onToggle={() => toggleDemo("tab")}
        keyLabel="Tab"
        title="Insert without running"
        description="Tab inserts the highlighted path and leaves the prompt ready to edit."
        command="rm package"
        acceptedCommand="rm package.json"
        mode="accept"
        suggestions={[
          {
            name: "package.json",
            hint: "File",
            icon: "/material-icons/nodejs.svg",
            match: "package",
          },
        ]}
      />
      <KeyboardDemo
        isPlaying={activeDemoId === "escape"}
        onToggle={() => toggleDemo("escape")}
        keyLabel="Esc"
        title="Dismiss the popup"
        description="Escape hides suggestions until the input changes."
        command="git c"
        mode="dismiss"
        suggestions={[
          {
            name: "checkout",
            hint: "[branch, file, tag or commit]",
            icon: "/fig-icons/command.png",
            match: "c",
          },
        ]}
      />
      <KeyboardDemo
        isPlaying={activeDemoId === "description"}
        onToggle={() => toggleDemo("description")}
        keyLabel="⌘I"
        title="Move the description"
        description="Toggle the selected suggestion’s description between the bottom and the right side."
        command="git checkout ma"
        mode="description"
        descriptionPlacement="side"
        descriptionText="Switch branches or restore working tree files"
        suggestions={[
          { name: "main", hint: "[branch]", icon: "/fig-icons/git.png", match: "ma", star: true },
        ]}
      />
    </section>
  );
}

export function TerminalShowcase() {
  return (
    <figure className="terminal-showcase">
      <CommandDemo variant="docs" />
      <figcaption>
        Examples use a sample workspace and branch names. Cue shows suggestions as you type.
      </figcaption>
    </figure>
  );
}
