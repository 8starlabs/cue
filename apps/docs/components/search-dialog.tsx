"use client";

import { useRouter } from "next/navigation";
import {
  BookOpen,
  Braces,
  Check,
  FileText,
  House,
  Keyboard,
  LifeBuoy,
  LoaderCircle,
  Moon,
  Package,
  RefreshCw,
  Sparkles,
  Sun,
  SunMoon,
  Trash2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";
import { useFetchSearch, useHighlightQuery } from "fumadocs-core/search/client";
import type { SearchResultRecord } from "fumadocs-core/search/client";
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogFooter,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogListItem,
  SearchDialogOverlay,
  useSearch,
  type SearchItemType,
} from "fumadocs-ui/components/dialog/search";
import type { DefaultSearchDialogProps } from "fumadocs-ui/components/dialog/search-default";
import { useI18n } from "fumadocs-ui/contexts/i18n";
import { useTheme } from "fumadocs-ui/provider/base";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

type Icon = typeof House;

type Action = {
  id: string;
  group: string;
  label: string;
  keywords: string;
  icon: Icon;
  href?: string;
  theme?: "light" | "dark" | "system";
};

type ActionItem = Extract<SearchItemType, { type: "action" }> & {
  group: string;
  label: string;
  href?: string;
};

const searchingVerbs = [
  "Accomplishing",
  "Actioning",
  "Actualizing",
  "Architecting",
  "Baking",
  "Beaming",
  "Beboppin'",
  "Befuddling",
  "Billowing",
  "Blanching",
  "Bloviating",
  "Boogieing",
  "Boondoggling",
  "Booping",
  "Bootstrapping",
  "Brewing",
  "Burrowing",
  "Calculating",
  "Canoodling",
  "Caramelizing",
  "Cascading",
  "Catapulting",
  "Cerebrating",
  "Channelling",
  "Choreographing",
  "Churning",
  "Clauding",
  "Coalescing",
  "Cogitating",
  "Combobulating",
  "Composing",
  "Computing",
  "Concocting",
  "Considering",
  "Contemplating",
  "Cooking",
  "Crafting",
  "Creating",
  "Crystallizing",
  "Cultivating",
  "Crunching",
  "Deciphering",
  "Deliberating",
  "Determining",
  "Dilly-dallying",
  "Discombobulating",
  "Doing",
  "Doodling",
  "Drizzling",
  "Ebbing",
  "Effecting",
  "Elucidating",
  "Embellishing",
  "Enchanting",
  "Envisioning",
  "Evaporating",
  "Fermenting",
  "Fiddle-faddling",
  "Finagling",
  "Flambéing",
  "Flibbertigibbeting",
  "Flowing",
  "Flummoxing",
  "Fluttering",
  "Forging",
  "Forming",
  "Frosting",
  "Frolicking",
  "Gallivanting",
  "Galloping",
  "Garnishing",
  "Generating",
  "Germinating",
  "Gitifying",
  "Grooving",
  "Gusting",
  "Harmonizing",
  "Hashing",
  "Hatching",
  "Herding",
  "Hibernating",
  "Honking",
  "Hullaballooing",
  "Hyperspacing",
  "Ideating",
  "Imagining",
  "Improvising",
  "Incubating",
  "Inferring",
  "Infusing",
  "Ionizing",
  "Jitterbugging",
  "Julienning",
  "Kneading",
  "Leavening",
  "Levitating",
  "Lollygagging",
  "Manifesting",
  "Marinating",
  "Meandering",
  "Metamorphosing",
  "Misting",
  "Moonwalking",
  "Moseying",
  "Mulling",
  "Mustering",
  "Musing",
  "Nebulizing",
  "Nesting",
  "Noodling",
  "Nucleating",
  "Orbiting",
  "Orchestrating",
  "Osmosing",
  "Perambulating",
  "Percolating",
  "Perusing",
  "Philosophising",
  "Photosynthesizing",
  "Pollinating",
  "Pontificating",
  "Pondering",
  "Pouncing",
  "Precipitating",
  "Prestidigitating",
  "Processing",
  "Proofing",
  "Propagating",
  "Puttering",
  "Puzzling",
  "Quantumizing",
  "Razzle-dazzling",
  "Razzmatazzing",
  "Recombobulating",
  "Reticulating",
  "Roosting",
  "Ruminating",
  "Sautéing",
  "Scampering",
  "Scheming",
  "Schlepping",
  "Scurrying",
  "Seasoning",
  "Shenaniganing",
  "Shimmying",
  "Simmering",
  "Skedaddling",
  "Sketching",
  "Slithering",
  "Smooshing",
  "Sock-hopping",
  "Spelunking",
  "Spinning",
  "Sprouting",
  "Stewing",
  "Sublimating",
  "Sussing",
  "Swirling",
  "Swooping",
  "Symbioting",
  "Synthesizing",
  "Tempering",
  "Thinking",
  "Thundering",
  "Tinkering",
  "Tomfoolering",
  "Topsy-turvying",
  "Transfiguring",
  "Transmuting",
  "Twisting",
  "Undulating",
  "Unfurling",
  "Unravelling",
  "Vibing",
  "Waddling",
  "Wandering",
  "Warping",
  "Whatchamacalliting",
  "Whirlpooling",
  "Whirring",
  "Whisking",
  "Wibbling",
  "Working",
  "Wrangling",
  "Zesting",
  "Zigzagging",
];

const docLinks: Omit<Action, "icon" | "keywords">[] = [
  { id: "home", group: "Go to", label: "Home", href: "/" },
  { id: "docs-home", group: "Go to", label: "Documentation", href: "/docs" },
  { id: "install-cue", group: "Go to", label: "Install Cue", href: "/docs/install/install-cue" },
  { id: "update", group: "Go to", label: "Update Cue", href: "/docs/install/update" },
  { id: "uninstall", group: "Go to", label: "Uninstall Cue", href: "/docs/install/uninstall" },
  {
    id: "keyboard-controls",
    group: "Go to",
    label: "Keyboard controls",
    href: "/docs/keyboard-controls",
  },
  { id: "completions", group: "Go to", label: "Suggestions", href: "/docs/completions" },
  {
    id: "fig-spec-support",
    group: "Go to",
    label: "Fig autocomplete specs",
    href: "/docs/fig-spec-support",
  },
  {
    id: "troubleshooting",
    group: "Go to",
    label: "Troubleshooting",
    href: "/docs/troubleshooting",
  },
  { id: "releasing", group: "Go to", label: "Releasing Cue", href: "/docs/releasing" },
  { id: "changelogs", group: "Go to", label: "Changelogs", href: "/changelogs" },
];

const docIcons: Record<string, Icon> = {
  home: House,
  "docs-home": BookOpen,
  "install-cue": Package,
  update: RefreshCw,
  uninstall: Trash2,
  "keyboard-controls": Keyboard,
  completions: Sparkles,
  "fig-spec-support": Braces,
  troubleshooting: LifeBuoy,
  releasing: FileText,
  changelogs: FileText,
};

const docKeywords: Record<string, string> = {
  home: "landing start homepage",
  "docs-home": "guides help questions documentation reference",
  "install-cue": "homebrew brew install setup package macos",
  update: "homebrew brew upgrade update version refresh",
  uninstall: "homebrew brew remove uninstall delete tap accessibility",
  "keyboard-controls": "keys shortcuts enter tab escape arrows navigation",
  completions: "suggestions paths files folders commands arguments",
  "fig-spec-support": "fig specs catalog icons descriptions open source",
  troubleshooting: "problems errors popup accessibility permissions",
  releasing: "release version package maintain contributor",
  changelogs: "changes versions release notes what's new",
};

const themes: Action[] = [
  {
    id: "theme-light",
    group: "Appearance",
    label: "Light mode",
    keywords: "light theme appearance bright",
    icon: Sun,
    theme: "light",
  },
  {
    id: "theme-dark",
    group: "Appearance",
    label: "Dark mode",
    keywords: "dark theme appearance night",
    icon: Moon,
    theme: "dark",
  },
  {
    id: "theme-system",
    group: "Appearance",
    label: "System appearance",
    keywords: "system automatic device theme",
    icon: SunMoon,
    theme: "system",
  },
];

export function CueSearchDialog(props: DefaultSearchDialogProps) {
  const { open, onOpenChange, dialogHandle, api, delayMs } = props;
  const { locale } = useI18n();
  const searchState = useFetchSearch({ api, locale, delayMs });
  const [loadingVerb, setLoadingVerb] = useState("");
  const onSearchChange = useCallback(
    (value: string) => {
      setLoadingVerb(searchingVerbs[Math.floor(Math.random() * searchingVerbs.length)]);
      searchState.onSearchChange(value);
    },
    [searchState.onSearchChange],
  );

  return (
    <SearchDialog
      open={open}
      onOpenChange={onOpenChange}
      dialogHandle={dialogHandle}
      search={searchState.search}
      onSearchChange={onSearchChange}
      isLoading={searchState.isLoading}
      data={searchState.data}
      error={searchState.error}
    >
      <CueSearchPalette
        open={open}
        search={searchState.search}
        results={
          searchState.data?.query === searchState.search.trim() ? searchState.data.items : []
        }
        isLoading={searchState.isLoading}
        loadingVerb={loadingVerb}
      />
    </SearchDialog>
  );
}

function CueSearchPalette({
  open,
  search,
  results,
  isLoading,
  loadingVerb,
}: {
  open: boolean;
  search: string;
  results: NonNullable<ReturnType<typeof useFetchSearch>["data"]>["items"];
  isLoading: boolean;
  loadingVerb: string;
}) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { onSelect, getActive, setActive, subscribeActive } = useSearch();
  const activeId = useSyncExternalStore(subscribeActive, getActive, getActive);
  const wasOpen = useRef(false);
  const term = search.trim().toLocaleLowerCase();
  const actions = useMemo<ActionItem[]>(() => {
    const navigation = docLinks.map((link) => ({
      ...link,
      icon: docIcons[link.id] ?? FileText,
      keywords: docKeywords[link.id] ?? "",
    }));
    const available = [...navigation, ...themes].filter((action) => {
      if (!term) return true;
      return `${action.label} ${action.keywords}`.toLocaleLowerCase().includes(term);
    });

    return available.map((action) => {
      const IconComponent = action.icon;
      const current = action.theme === theme;
      const node = (
        <div className="cue-palette-action">
          <IconComponent aria-hidden="true" className="cue-palette-icon" />
          <span>{action.label}</span>
          {current && <Check aria-label="Current appearance" className="cue-palette-check" />}
        </div>
      );

      return {
        id: action.id,
        type: "action",
        group: action.group,
        label: action.label,
        href: action.href,
        node,
        onSelect: () => {
          if (action.theme) setTheme(action.theme);
          else if (action.href) router.push(action.href);
        },
      };
    });
  }, [router, setTheme, term, theme]);

  const searchRecords = useMemo(() => {
    const linkedPages = new Set(
      actions.flatMap((action) => (action.href ? [withoutHash(action.href)] : [])),
    );
    return results
      .flatMap((result) => (result.type === "table" ? result.rows : [result]))
      .filter((result) => {
        if (linkedPages.has(withoutHash(result.url))) return false;
        const { title, body } = extractSearchContent(result.hastContent);
        return Boolean(title || body);
      });
  }, [actions, results]);

  const entries = useMemo<SearchItemType[]>(
    () => [...actions, ...searchRecords],
    [actions, searchRecords],
  );
  const active = entries.find((item) => item.id === activeId);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setActive(entries[0]?.id ?? null);
    }
    wasOpen.current = open;
  }, [entries, open, setActive]);

  useEffect(() => {
    if (!entries.some((item) => item.id === activeId)) {
      setActive(entries[0]?.id ?? null);
    }
  }, [activeId, entries, setActive]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.nativeEvent.isComposing) return;

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (entries.length === 0) return;
        event.preventDefault();
        const currentIndex = entries.findIndex((item) => item.id === activeId);
        const offset = event.key === "ArrowDown" ? 1 : -1;
        const nextIndex = Math.max(0, Math.min(entries.length - 1, currentIndex + offset));
        setActive(entries[nextIndex]?.id ?? null);
      } else if (event.key === "Enter" && active) {
        event.preventDefault();
        onSelect(active);
      }
    },
    [active, activeId, entries, onSelect, setActive],
  );

  const groupedActions = useMemo(() => {
    const groups = new Map<string, ActionItem[]>();
    for (const action of actions) {
      const group = groups.get(action.group) ?? [];
      group.push(action);
      groups.set(action.group, group);
    }
    return [...groups.entries()];
  }, [actions]);

  return (
    <>
      <SearchDialogOverlay className="cue-command-backdrop" />
      <SearchDialogContent className="cue-command-dialog" onKeyDown={onKeyDown}>
        <SearchDialogHeader className="cue-command-header">
          <SearchDialogIcon className="cue-command-search-icon" />
          <SearchDialogInput
            className="cue-command-input"
            placeholder="Type a command or search…"
          />
          <SearchDialogClose className="cue-command-close">
            <Kbd className="cue-command-esc">esc</Kbd>
          </SearchDialogClose>
        </SearchDialogHeader>

        <div
          id="fd-search-list"
          className="cue-command-list"
          role="listbox"
          aria-label="Search and navigation"
        >
          {groupedActions.map(([group, items]) => (
            <div className="cue-command-group" role="group" aria-label={group} key={group}>
              <p className="cue-command-group-title">{group}</p>
              {items.map((item) => (
                <SearchDialogListItem
                  item={item}
                  key={item.id}
                  onClick={() => onSelect(item)}
                  className="cue-command-option"
                >
                  {item.node}
                </SearchDialogListItem>
              ))}
            </div>
          ))}

          {searchRecords.length > 0 && (
            <div className="cue-command-group" role="group" aria-label="Documentation results">
              <p className="cue-command-group-title">Documentation results</p>
              {searchRecords.map((item) => (
                <SearchDialogListItem
                  item={item}
                  key={item.id}
                  onClick={() => onSelect(item)}
                  className="cue-command-option cue-command-result"
                >
                  <SearchResultRow item={item} />
                </SearchDialogListItem>
              ))}
            </div>
          )}

          {term && !isLoading && actions.length === 0 && searchRecords.length === 0 && (
            <p className="cue-command-empty" role="status">
              No matching pages or actions.
            </p>
          )}
          {term && isLoading && (
            <div
              className="cue-command-loading-row"
              role="status"
              aria-label={`${loadingVerb} search results`}
            >
              <LoaderCircle aria-hidden="true" />
              <span>{loadingVerb}…</span>
            </div>
          )}
        </div>

        <SearchDialogFooter className="cue-command-footer">
          <span className="cue-command-hint">
            <KbdGroup>
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
            </KbdGroup>
            <span>navigate</span>
          </span>
          <span className="cue-command-hint">
            <Kbd>↵</Kbd>
            <span>open page</span>
          </span>
          <span className="cue-command-hint cue-command-shortcut">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </span>
        </SearchDialogFooter>
      </SearchDialogContent>
    </>
  );
}

function SearchResultRow({ item }: { item: SearchResultRecord }) {
  const { query } = useSearch();
  const highlightRef = useHighlightRef(query);
  const IconComponent = iconForSearchUrl(item.url);
  const { title, body } = extractSearchContent(item.hastContent);
  const excerpt = createSearchExcerpt(body, query);

  return (
    <div className="cue-palette-action cue-palette-search-result">
      <IconComponent aria-hidden="true" className="cue-palette-icon" />
      <div className="cue-palette-result-copy" ref={highlightRef}>
        {item.breadcrumbs?.length ? (
          <span className="cue-palette-breadcrumbs">{item.breadcrumbs.join(" / ")}</span>
        ) : null}
        {title ? <span className="cue-palette-result-title">{title}</span> : null}
        {excerpt ? <div className="cue-palette-result-content">{excerpt}</div> : null}
      </div>
    </div>
  );
}

type SearchHastNode = {
  type: string;
  value?: string;
  tagName?: string;
  children?: SearchHastNode[];
};

function extractSearchContent(root: SearchHastNode): { title: string; body: string } {
  let title = "";
  const body: string[] = [];

  function visit(node: SearchHastNode) {
    if (node.type === "text") {
      body.push(node.value ?? "");
      return;
    }
    if (node.tagName === "thead" || node.tagName === "th") return;

    if (!title && node.tagName && /^h[1-6]$/.test(node.tagName)) {
      title = flattenSearchText(node).replace(/\s+/g, " ").trim();
      return;
    }

    node.children?.forEach(visit);
  }

  visit(root);
  return { title, body: body.join(" ").replace(/\s+/g, " ").trim() };
}

function flattenSearchText(node: SearchHastNode): string {
  if (node.type === "text") return node.value ?? "";
  if (node.tagName === "thead" || node.tagName === "th") return "";
  return node.children?.map(flattenSearchText).join(" ") ?? "";
}

function createSearchExcerpt(content: string, query: string): string {
  const text = content.replace(/\s+/g, " ").trim();
  const maxLength = 150;
  if (text.length <= maxLength) return text;

  const normalized = text.toLocaleLowerCase();
  const searchTerms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const exactIndex = searchTerms.length > 1 ? normalized.indexOf(searchTerms.join(" ")) : -1;
  const termIndex = searchTerms
    .map((term) => normalized.indexOf(term))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];
  const matchIndex = exactIndex >= 0 ? exactIndex : (termIndex ?? -1);
  if (matchIndex < 0) return `${text.slice(0, maxLength).trimEnd()}…`;

  const start = Math.max(0, matchIndex - 24);
  const end = Math.min(text.length, start + maxLength);
  const excerpt = text.slice(start, end).trim();
  return `${start > 0 ? "…" : ""}${excerpt}${end < text.length ? "…" : ""}`;
}

function useHighlightRef(query: string) {
  return useHighlightQuery(query);
}

function iconForSearchUrl(url: string): Icon {
  const slug = url.split("?")[0]?.split("#")[0]?.split("/").at(-1) ?? "";
  return docIcons[slug] ?? BookOpen;
}

function withoutHash(url: string) {
  return url.split("?")[0]?.split("#")[0] ?? url;
}
