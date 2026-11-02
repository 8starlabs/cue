"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

const installCommand = "brew install 8starlabs/cue/cue";

type CopyState = "idle" | "copied" | "error";

export function InstallCommand() {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    [],
  );

  async function copyCommand() {
    if (resetTimer.current) clearTimeout(resetTimer.current);

    try {
      await navigator.clipboard.writeText(installCommand);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }

    resetTimer.current = setTimeout(() => setCopyState("idle"), 1800);
  }

  const ActionIcon = copyState === "copied" ? Check : Copy;
  const actionLabel =
    copyState === "copied" ? "Copied" : copyState === "error" ? "Copy failed" : "Copy";

  return (
    <button
      type="button"
      className={`install-command ${copyState === "copied" ? "is-copied" : ""} ${copyState === "error" ? "is-error" : ""}`}
      onClick={copyCommand}
      aria-label={`${actionLabel}: ${installCommand}`}
    >
      <span className="install-command-code">
        <span className="install-command-prompt" aria-hidden="true">
          $
        </span>
        <code>{installCommand}</code>
      </span>
      <span className="install-command-action" aria-hidden="true">
        <ActionIcon size={14} />
        {actionLabel}
      </span>
      <span className="sr-only" role="status" aria-live="polite">
        {copyState === "copied"
          ? "Homebrew command copied"
          : copyState === "error"
            ? "Unable to copy command"
            : ""}
      </span>
    </button>
  );
}
