"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { ChevronDown } from "lucide-react";
import { usePathname } from "fumadocs-core/framework";
import {
  SidebarFolder,
  SidebarFolderContent,
  SidebarFolderLink,
  SidebarFolderTrigger,
  useFolder,
  useFolderDepth,
} from "fumadocs-ui/components/sidebar/base";
import { Sidebar, type SidebarProps } from "fumadocs-ui/layouts/docs/slots/sidebar";
import type { SidebarPageTreeComponents } from "fumadocs-ui/components/sidebar/page-tree";

type FolderProps = Parameters<SidebarPageTreeComponents["Folder"]>[0];

type SetFolderOpen = (open: boolean) => void;

interface FolderAccordion {
  register: (id: string, setOpen: SetFolderOpen) => () => void;
  openOnly: (id: string) => void;
}

const FolderAccordionContext = createContext<FolderAccordion | null>(null);

const triggerClassName =
  "relative flex w-full flex-row items-center gap-2 rounded-lg p-2 text-start text-fd-muted-foreground wrap-anywhere transition-colors hover:bg-fd-accent/50 hover:text-fd-accent-foreground/80 hover:transition-none [&_svg]:size-4 [&_svg]:shrink-0";

export function ExclusiveSidebar(props: SidebarProps) {
  const openFolders = useRef(new Map<string, SetFolderOpen>());
  const register = useCallback((id: string, setOpen: SetFolderOpen) => {
    openFolders.current.set(id, setOpen);
    return () => openFolders.current.delete(id);
  }, []);
  const openOnly = useCallback((id: string) => {
    for (const [folderId, setOpen] of openFolders.current) {
      if (folderId !== id) setOpen(false);
    }
  }, []);
  const accordion = useMemo(() => ({ register, openOnly }), [register, openOnly]);
  const components = useMemo<Partial<SidebarPageTreeComponents>>(
    () => ({ ...props.components, Folder: ExclusiveFolder }),
    [props.components],
  );

  return (
    <FolderAccordionContext.Provider value={accordion}>
      <Sidebar {...props} components={components} />
    </FolderAccordionContext.Provider>
  );
}

function ExclusiveFolder({ item, children }: FolderProps) {
  const id = item.index?.url ?? String(item.name);

  return (
    <SidebarFolder collapsible={item.collapsible ?? true} active={false} defaultOpen={false}>
      <ExclusiveFolderContents id={id} item={item}>
        {children}
      </ExclusiveFolderContents>
    </SidebarFolder>
  );
}

function ExclusiveFolderContents({
  id,
  item,
  children,
}: {
  id: string;
  item: FolderProps["item"];
  children: ReactNode;
}) {
  const folder = useFolder();
  const depth = useFolderDepth();
  const pathname = usePathname();
  const accordion = useContext(FolderAccordionContext);

  if (!folder || !accordion) {
    throw new Error("Docs sidebar folders must be rendered inside the Cue sidebar.");
  }

  useEffect(() => accordion.register(id, folder.setOpen), [accordion, folder.setOpen, id]);
  useEffect(() => {
    if (folder.open) accordion.openOnly(id);
  }, [accordion, folder.open, id]);
  useEffect(() => {
    if (depth !== 1) return;

    if (folderContainsPath(item, pathname)) {
      folder.setOpen(true);
      accordion.openOnly(id);
    } else {
      folder.setOpen(false);
    }
  }, [accordion, depth, folder.setOpen, id, item, pathname]);

  const paddingInlineStart = `calc(${2 + 3 * Math.max(depth - 1, 0)} * var(--spacing))`;
  const activeIndex = item.index?.url === pathname;

  return (
    <>
      {item.index ? (
        <SidebarFolderLink
          href={item.index.url}
          external={item.index.external}
          active={activeIndex}
          className={triggerClassName}
          style={{ paddingInlineStart }}
        >
          {item.icon}
          {item.name}
          <ChevronDown
            data-icon
            className={`ms-auto transition-transform ${folder.open ? "" : "-rotate-90 rtl:rotate-90"}`}
          />
        </SidebarFolderLink>
      ) : (
        <SidebarFolderTrigger className={triggerClassName} style={{ paddingInlineStart }}>
          {item.icon}
          {item.name}
        </SidebarFolderTrigger>
      )}
      <SidebarFolderContent
        className={`relative flex flex-col gap-0.5 pt-0.5 ${depth === 1 ? "before:absolute before:inset-y-1 before:inset-s-2.5 before:w-px before:bg-fd-border before:content-['']" : ""}`}
      >
        {children}
      </SidebarFolderContent>
    </>
  );
}

function folderContainsPath(item: FolderProps["item"], pathname: string): boolean {
  if (item.index?.url === pathname) return true;

  return item.children.some((child) => {
    if (child.type === "folder") return folderContainsPath(child, pathname);
    return child.type === "page" && child.url === pathname;
  });
}
