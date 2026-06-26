"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import type { AdminPermissionsMap, AdminRoleString } from "@/lib/page-guard";
import { Search, LogOut, Settings, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { ThemeToggle } from "./theme-toggle";
import { LanguageSelector } from "./language-selector";
import { PulseDot } from "./aurora";
import { filterNavGroups, type NavGroup, type NavItem } from "@/lib/admin-nav";
import { RaccoonMark } from "@/components/brand/RaccoonMark";

/**
 * Role display label + tone. Surfaced as a badge in the sidebar identity
 * footer so an operator always sees their privilege level (an enterprise
 * console expectation). Display only - the server role gate is authoritative.
 */
const ROLE_META: Record<AdminRoleString, { label: string; tone: string }> = {
  SUPER_ADMIN: { label: "Super Admin", tone: "bg-tone-orange-bg text-tone-orange-fg" },
  ADMIN: { label: "Admin", tone: "bg-tone-sky-bg text-tone-sky-fg" },
  MODERATOR: { label: "Moderator", tone: "bg-tone-sage-bg text-tone-sage-fg" },
  VIEWER: { label: "Viewer", tone: "bg-tone-slate-bg text-muted-foreground" },
};

function isItemActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/" && pathname.startsWith(href));
}

/**
 * Translate a nav key, falling back to the English `name` when the key is
 * missing from the message catalog (same contract as the command palette safeT -
 * next-intl either throws or returns the "nav.key" path depending on env).
 */
function navLabel(t: ReturnType<typeof useTranslations>, key: string, fallback: string): string {
  let value: string;
  try {
    value = t(key);
  } catch {
    return fallback;
  }
  return value === `nav.${key}` ? fallback : value;
}

/** Compact raccoon brand mark for the 76px rail — parametric RaccoonMark
 *  (accent-tracking eye, Gold dark / Sapphire light) in a fixed brand-navy tile,
 *  replacing the static /logo-mark.svg raster. */
function RailMark() {
  return (
    <span
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px]"
      style={{ background: "#0A0F1C" }}
      aria-hidden="true"
    >
      <RaccoonMark size={26} />
    </span>
  );
}

interface SidebarProps {
  /**
   * Server-resolved permission context. When omitted (e.g. during the
   * brief client mount before context is wired) the sidebar shows all
   * links, since this is purely a display affordance - page-guard and
   * API guards are authoritative.
   */
  ctx?: { role: AdminRoleString; permissions: AdminPermissionsMap; email?: string };
  /**
   * Optional cheap counts keyed by item href (e.g. { "/support": 12 }).
   * Rendered as a badge next to the panel item when present. Display only -
   * the sidebar never fetches; callers pass counts they already have.
   */
  counts?: Partial<Record<string, number | string>>;
}

export function Sidebar({ ctx, counts }: SidebarProps = {}) {
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  // Mobile section sheet — which dock group's sub-pages are expanded (null =
  // closed). Lets phone users browse a section's pages without the desktop rail
  // panel (previously only reachable via ⌘K).
  const [openSheet, setOpenSheet] = useState<number | null>(null);
  const filteredGroups = filterNavGroups(ctx ?? null);
  const allItems = filteredGroups.flatMap((g) => g.items);
  // Settings is pinned in the account footer (always reachable without
  // scrolling the nav), so drop it from the scrolling group list to avoid a
  // duplicate. It stays in search + the command palette via allItems.
  const displayGroups = filteredGroups
    .map((g) => ({ ...g, items: g.items.filter((it) => it.href !== "/settings") }))
    .filter((g) => g.items.length > 0);
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");

  // Identity footer: who is signed in + at what privilege level.
  const email = ctx?.email ?? "";
  const roleMeta = ctx ? ROLE_META[ctx.role] : null;
  const initial = (email.trim()[0] || "A").toUpperCase();
  const settingsActive = pathname === "/settings" || pathname.startsWith("/settings");

  // Active group for the rail: derived from the pathname. Match against
  // filteredGroups (which still contains /settings) so the System icon
  // lights up on the Settings page, then map back into displayGroups.
  const activeGroupLabel = filteredGroups.find((g) => g.items.some((it) => isItemActive(pathname, it.href)))?.label;
  const activeGroupIdx = Math.max(
    0,
    displayGroups.findIndex((g) => g.label === activeGroupLabel),
  );
  const panelGroup: NavGroup | undefined = displayGroups[activeGroupIdx];

  // Build-time environment badge - corporate consoles surface which
  // environment an operator is touching. NODE_ENV is statically inlined.
  const isProd = process.env.NODE_ENV === "production";

  // Platform-correct command-palette hint (Cmd K on Apple, Ctrl K elsewhere).
  // Defaults to the non-Apple form for SSR; corrected on mount - the <kbd>
  // carries suppressHydrationWarning so the swap is silent.
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    setIsMac(typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent));
  }, []);

  // Close the mobile section sheet on Escape.
  useEffect(() => {
    if (openSheet === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenSheet(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openSheet]);

  async function handleLogout() {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Requested-With": "locateflow" },
      body: "{}",
      cache: "no-store",
    });
    toast.success(tCommon("signOut"));
    window.location.assign("/login");
  }

  const isSearching = search.trim().length > 0;
  // Match against BOTH the English name AND the translated label so a
  // Spanish-speaking operator can type "provider" OR "proveedor" and
  // still find the Providers route.
  const matchesSearch = (item: NavItem, q: string) => {
    const lower = q.toLowerCase();
    if (item.name.toLowerCase().includes(lower)) return true;
    try {
      return tNav(item.nameKey).toLowerCase().includes(lower);
    } catch {
      return false;
    }
  };
  const filteredItems = isSearching
    ? allItems.filter((item) => matchesSearch(item, search))
    : null;

  /** One nav row (icon + label + active state + optional count badge). */
  const renderItem = (item: NavItem, opts?: { onNavigate?: () => void }) => {
    const isActive = isItemActive(pathname, item.href);
    const count = counts?.[item.href];
    return (
      <a
        key={item.name}
        href={item.href}
        onClick={opts?.onNavigate}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "adp-item relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] transition-colors",
          isActive
            ? "on bg-primary/10 font-bold text-primary before:absolute before:left-0 before:top-1/2 before:h-6 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-primary before:content-['']"
            : "font-medium text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        <item.icon className={cn("h-[17px] w-[17px] flex-shrink-0", isActive ? "text-primary" : "text-muted-foreground/70")} />
        <span className="min-w-0 flex-1 truncate">{navLabel(tNav, item.nameKey, item.name)}</span>
        {count != null && (
          <span className="ct shrink-0 rounded-full bg-primary/10 px-1.5 py-px font-mono text-[10px] font-bold leading-4 text-primary">
            {count}
          </span>
        )}
      </a>
    );
  };

  /** Search input shared by the rail panel and the flat sidebar. */
  const renderSearch = (idSuffix: string) => (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
      <input
        type="text"
        placeholder={tCommon("search")}
        aria-label={tCommon("search")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        data-sidebar-search={idSuffix}
        className="w-full rounded-lg border border-border bg-background pl-8 pr-14 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
      />
      {/* Discoverability cue for the global command palette. */}
      <kbd
        suppressHydrationWarning
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
      >
        {isMac ? "Cmd K" : "Ctrl K"}
      </kbd>
    </div>
  );

  /** Identity + pinned Settings/theme/language/sign-out account footer. */
  const renderAccountFooter = (variant: "rail" | "flat") => (
    <div className={cn("adp-user border-t border-border bg-card/60 p-3", variant === "rail" && "px-2.5")}>
      {/* Who is signed in + privilege level - display only; the server role
          gate remains authoritative. */}
      {ctx && (
        <div className="mb-2 flex items-center gap-2.5 rounded-lg border border-border/50 bg-background/40 px-2.5 py-2">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-primary text-xs font-bold text-primary-foreground ring-1 ring-primary/20"
            aria-hidden="true"
          >
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            {email && (
              <p className="truncate text-xs font-medium text-foreground" title={email}>
                {email}
              </p>
            )}
            {roleMeta && (
              <span
                className={cn(
                  "mt-0.5 inline-flex items-center rounded px-1.5 py-px text-[9px] font-semibold uppercase",
                  roleMeta.tone,
                )}
              >
                {roleMeta.label}
              </span>
            )}
          </div>
        </div>
      )}
      {/* Settings (pinned) + theme + language on one row. */}
      <div className="flex items-center gap-1.5">
        <a
          href="/settings"
          className={cn(
            "relative flex min-w-0 flex-1 items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors",
            settingsActive
              ? "bg-primary/10 font-semibold text-primary before:absolute before:left-0 before:top-1/2 before:h-6 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-primary before:content-['']"
              : "font-medium text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          <Settings className={cn("h-4 w-4 shrink-0", settingsActive ? "text-primary" : "text-muted-foreground/70")} />
          <span className="truncate">{navLabel(tNav, "settings", "Settings")}</span>
        </a>
        <ThemeToggle compact />
        <LanguageSelector compact />
      </div>
      <button
        onClick={handleLogout}
        className="mt-1.5 flex w-full items-center justify-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
      >
        <LogOut className="h-4 w-4" />
        <span className="truncate">{tCommon("signOut")}</span>
      </button>
    </div>
  );

  /* --------------------------------------------------------------------
     Rail desktop (lg+): slim 76px icon rail (one icon per group) +
     180px contextual panel listing only the active group's items. The two
     columns total 256px (w-64) so the shell's pl-64 stays correct. Class
     hooks (.adp-rail / .adp-panel / .rail-btn / .panel-items) match the
     Slate enterprise sheet in aurora.css; Tailwind semantic tokens provide
     the baseline so the nav renders correctly standalone.
     -------------------------------------------------------------------- */
  const railSidebar = (
    <aside className="adp-side rail fixed inset-y-0 left-0 z-50 hidden w-64 grid-cols-[76px_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] border-r border-border bg-card lg:grid">
      {/* Icon rail - brand mark, one button per group, identity chip. */}
      <div className="adp-rail flex min-h-0 flex-col items-center border-r border-border/60 px-2 py-4">
        <a
          href="/"
          title="LocateFlow Admin"
          aria-label="LocateFlow Admin - Dashboard"
          className="mark mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20 transition-colors hover:bg-accent"
        >
          <RailMark />
        </a>
        <nav className="rail-nav flex w-full flex-col gap-1" aria-label="Admin sections">
          {displayGroups.map((group, i) => {
            const GroupIcon = group.icon;
            const isOn = i === activeGroupIdx;
            const groupTitle = navLabel(tNav, group.labelKey, group.label);
            const firstHref = group.items[0]?.href ?? "/";
            return (
              <a
                key={group.label}
                href={firstHref}
                title={groupTitle}
                aria-current={isOn ? "true" : undefined}
                className={cn(
                  "rail-btn relative flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2.5 transition-colors",
                  isOn
                    ? "on bg-primary/10 text-primary before:absolute before:left-0 before:top-1/2 before:h-7 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-primary before:content-['']"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <GroupIcon className={cn("h-[18px] w-[18px]", isOn ? "text-primary" : "text-muted-foreground/70")} />
                <span className="font-mono text-[9px] font-medium uppercase">{group.railLabel}</span>
              </a>
            );
          })}
        </nav>
        <span className="rail-grow min-h-4 flex-1" aria-hidden="true" />
        {/* Identity chip - full identity card lives in the panel footer. */}
        {ctx && (
          <span
            className="rail-av flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary/80 to-primary font-mono text-xs font-semibold text-primary-foreground ring-1 ring-primary/20"
            title={email ? `${email}${roleMeta ? ` - ${roleMeta.label}` : ""}` : roleMeta?.label}
            aria-hidden="true"
          >
            {initial}
          </span>
        )}
      </div>

      {/* Contextual panel - brand block, search, active group's items. */}
      <div className="adp-panel flex min-h-0 min-w-0 flex-col">
        <div className="panel-hd flex h-16 items-center gap-2.5 border-b border-border px-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20"
            aria-hidden="true"
          >
            <RailMark />
          </span>
          <div className="flex min-w-0 flex-col leading-none">
            <span className="truncate font-display text-[19px] font-black text-foreground">
              LocateFlow
            </span>
            <span className="mt-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.22em] text-primary">
              Operations
            </span>
          </div>
          <span className="flex-1" />
          {/* Environment pill - pulsing-ok dot in production. */}
          <span
            className="env inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/60 bg-background px-2 py-0.5 font-mono text-[9px] font-semibold uppercase text-muted-foreground"
            title={isProd ? "Production environment" : "Development environment"}
          >
            <PulseDot tone={isProd ? "mint" : "amber"} />
            {isProd ? "Prod" : "Dev"}
          </span>
        </div>

        <div className="px-3 pt-3 pb-1">{renderSearch("rail")}</div>

        <nav className="panel-items min-h-0 flex-1 overflow-y-auto px-2 py-2" aria-label="Section pages">
          {isSearching ? (
            // Flat filtered list across ALL groups, mirroring the command palette.
            <div className="space-y-0.5">
              {filteredItems && filteredItems.length > 0 ? (
                filteredItems.map((item) => renderItem(item, { onNavigate: () => setSearch("") }))
              ) : (
                <p className="px-3 py-4 text-center text-xs text-muted-foreground">{tCommon("no")}</p>
              )}
            </div>
          ) : (
            panelGroup && (
              <>
                <div className="adp-grp px-3 pb-2 pt-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  {navLabel(tNav, panelGroup.labelKey, panelGroup.label)}
                </div>
                <div className="space-y-1">{panelGroup.items.map((item) => renderItem(item))}</div>
              </>
            )
          )}
        </nav>

        {renderAccountFooter("rail")}
      </div>
    </aside>
  );

  /* --------------------------------------------------------------------
     Mobile PWA dock. Below lg the old fixed left sidebar made the admin feel
     like a squeezed desktop app. The dock uses section entry points instead,
     while Topbar keeps search, help, notifications, and identity reachable.
     -------------------------------------------------------------------- */
  const mobileDock = (
    <nav className="adp-mobile-dock lg:hidden" aria-label="Admin mobile sections">
      <div className="adp-mobile-dock-scroll">
        {displayGroups.map((group, i) => {
          const GroupIcon = group.icon;
          const isOn = i === activeGroupIdx;
          const groupTitle = navLabel(tNav, group.labelKey, group.label);
          const firstHref = group.items[0]?.href ?? "/";
          // Multi-page groups open a bottom sheet so every sub-page is
          // reachable on a phone; single-page groups link straight through.
          if (group.items.length > 1) {
            return (
              <button
                key={group.label}
                type="button"
                onClick={() => setOpenSheet(i)}
                aria-haspopup="dialog"
                aria-expanded={openSheet === i}
                aria-current={isOn ? "page" : undefined}
                className={cn("adp-mobile-dock-item", isOn && "on")}
              >
                <GroupIcon aria-hidden="true" />
                <span>{group.railLabel || groupTitle}</span>
              </button>
            );
          }
          return (
            <a
              key={group.label}
              href={firstHref}
              aria-current={isOn ? "page" : undefined}
              className={cn("adp-mobile-dock-item", isOn && "on")}
            >
              <GroupIcon aria-hidden="true" />
              <span>{group.railLabel || groupTitle}</span>
            </a>
          );
        })}
        <a
          href="/settings"
          aria-current={settingsActive ? "page" : undefined}
          className={cn("adp-mobile-dock-item", settingsActive && "on")}
        >
          <Settings aria-hidden="true" />
          <span>{navLabel(tNav, "settings", "Settings")}</span>
        </a>
      </div>
    </nav>
  );

  // Bottom sheet listing the tapped group's sub-pages. Sibling of the dock
  // (which is overflow:hidden) so it can sit above it; lg:hidden so it never
  // shows on desktop. Closes on navigate / scrim tap / Escape.
  const sheetGroup = openSheet !== null ? displayGroups[openSheet] : null;
  const mobileSheet = sheetGroup ? (
    <div className="adp-mobile-sheet lg:hidden" role="dialog" aria-modal="true" aria-label={navLabel(tNav, sheetGroup.labelKey, sheetGroup.label)}>
      <button
        type="button"
        className="adp-mobile-sheet-scrim"
        aria-label={tCommon("close")}
        onClick={() => setOpenSheet(null)}
      />
      <div className="adp-mobile-sheet-panel">
        <div className="adp-mobile-sheet-head">
          <span className="adp-mobile-sheet-title">
            {navLabel(tNav, sheetGroup.labelKey, sheetGroup.label)}
          </span>
          <button
            type="button"
            onClick={() => setOpenSheet(null)}
            aria-label={tCommon("close")}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="adp-mobile-sheet-items">
          {sheetGroup.items.map((item) => renderItem(item, { onNavigate: () => setOpenSheet(null) }))}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      {railSidebar}
      {mobileDock}
      {mobileSheet}
    </>
  );
}
