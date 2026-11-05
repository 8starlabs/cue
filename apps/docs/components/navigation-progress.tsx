"use client";

import { AppProgressProvider } from "@bprogress/next";
import type { ReactNode } from "react";

export function NavigationProgress({ children }: { children: ReactNode }) {
  return (
    <AppProgressProvider color="var(--cue-blue)" height="2px" options={{ showSpinner: false }}>
      {children}
    </AppProgressProvider>
  );
}
