import { RootProvider } from "fumadocs-ui/provider/next";
import { CueSearchDialog } from "@/components/search-dialog";
import { NavigationProgress } from "@/components/navigation-progress";
import { GoogleTagManager } from "@/components/google-tag-manager";
import "./global.css";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/hanken-grotesk";
import "@fontsource-variable/jetbrains-mono";
import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://cue.8starlabs.com"),
  title: {
    default: "Cue — terminal autocomplete by 8StarLabs",
    template: "%s — Cue",
  },
  description: "IDE-style command suggestions for Apple Terminal and VS Code.",
  openGraph: {
    type: "website",
    siteName: "Cue",
    title: "Cue — terminal autocomplete by 8StarLabs",
    description: "Free, open-source IDE-style autocomplete for Apple Terminal and VS Code.",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Cue — terminal autocomplete by 8StarLabs",
    description: "Free, open-source IDE-style autocomplete for Apple Terminal and VS Code.",
    images: ["/twitter-image"],
  },
};

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <GoogleTagManager />
        <RootProvider search={{ SearchDialog: CueSearchDialog }}>
          <NavigationProgress>{children}</NavigationProgress>
        </RootProvider>
      </body>
    </html>
  );
}
