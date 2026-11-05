"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Search } from "lucide-react";
import { useSearchContext } from "fumadocs-ui/contexts/search";
import type {
  FullSearchTriggerProps,
  SearchTriggerProps,
} from "fumadocs-ui/layouts/shared/slots/search-trigger";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

export function CueSearchTrigger({ hideIfDisabled, className, ...props }: FullSearchTriggerProps) {
  const { enabled, hotKey, dialogHandle } = useSearchContext();

  if (hideIfDisabled && !enabled) return null;

  return (
    <Dialog.Trigger
      handle={dialogHandle}
      type="button"
      data-search-full=""
      aria-label="Search documentation"
      {...props}
      className={cn("cue-search-trigger", className)}
    >
      <SearchTriggerContent hotKey={hotKey} />
    </Dialog.Trigger>
  );
}

export function CueSearchTriggerSm({
  hideIfDisabled,
  className,
}: Pick<SearchTriggerProps, "hideIfDisabled" | "className">) {
  const { enabled, hotKey, dialogHandle } = useSearchContext();

  if (hideIfDisabled && !enabled) return null;

  return (
    <Dialog.Trigger
      handle={dialogHandle}
      type="button"
      data-search=""
      aria-label="Search documentation"
      className={cn("cue-search-trigger cue-search-trigger-sm", className)}
    >
      <SearchTriggerContent hotKey={hotKey} />
    </Dialog.Trigger>
  );
}

function SearchTriggerContent({
  hotKey,
}: {
  hotKey: ReturnType<typeof useSearchContext>["hotKey"];
}) {
  return (
    <>
      <Search className="cue-search-icon" aria-hidden="true" />
      <span className="cue-search-placeholder">Search documentation...</span>
      <KbdGroup className="cue-search-shortcuts" aria-hidden="true">
        {hotKey.map((key, index) => (
          <Kbd key={index} className="cue-search-kbd">
            {key.display}
          </Kbd>
        ))}
      </KbdGroup>
    </>
  );
}

export const cueSearchTriggerSlots = {
  sm: CueSearchTriggerSm,
  full: CueSearchTrigger,
};
