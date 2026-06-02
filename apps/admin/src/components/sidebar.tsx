"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import type { AdminPermissionsMap, AdminRoleString } from "@/lib/page-guard";
import { ChevronDown, Search, LogOut, Settings } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { ThemeToggle } from "./theme-toggle";
import { LanguageSelector } from "./language-selector";
import { filterNavGroups, type NavGroup, type NavItem } from "@/lib/admin-nav";

/**
 * Role → display label + tone. Surfaced as a badge in the sidebar identity
 * footer so an operator always sees their privilege level (an enterprise
 * console expectation). Display only — the server role gate is authoritative.
 */
const ROLE_META: Record<AdminRoleString, { label: string; tone: string }> = {
  SUPER_ADMIN: { label: "Super Admin", tone: "bg-tone-orange-bg text-tone-orange-fg" },
  ADMIN: { label: "Admin", tone: "bg-tone-sky-bg text-tone-sky-fg" },
  MODERATOR: { label: "Moderator", tone: "bg-tone-sage-bg text-tone-sage-fg" },
  VIEWER: { label: "Viewer", tone: "bg-tone-slate-bg text-muted-foreground" },
};

function getInitialCollapsed(pathname: string, groups: NavGroup[]): Record<string, boolean> {
  const collapsed: Record<string, boolean> = {};
  groups.forEach((group) => {
    const hasActive = group.items.some(
      (item) => pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
    );
    collapsed[group.label] = !hasActive;
  });
  // Core always open
  collapsed["Core"] = false;
  return collapsed;
}

interface SidebarProps {
  /**
   * Server-resolved permission context. When omitted (e.g. during the
   * brief client mount before context is wired) the sidebar shows all
   * links, since this is purely a display affordance — page-guard and
   * API guards are authoritative.
   */
  ctx?: { role: AdminRoleString; permissions: AdminPermissionsMap; email?: string };
}

export function Sidebar({ ctx }: SidebarProps = {}) {
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const filteredGroups = filterNavGroups(ctx ?? null);
  const allItems = filteredGroups.flatMap((g) => g.items);
  // Settings is pinned in the account footer (always reachable without
  // scrolling the nav), so drop it from the scrolling group list to avoid a
  // duplicate. It stays in search + the ⌘K palette via allItems.
  const displayGroups = filteredGroups
    .map((g) => ({ ...g, items: g.items.filter((it) => it.href !== "/settings") }))
    .filter((g) => g.items.length > 0);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => getInitialCollapsed(pathname, filteredGroups));
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");

  // Identity footer: who is signed in + at what privilege level.
  const email = ctx?.email ?? "";
  const roleMeta = ctx ? ROLE_META[ctx.role] : null;
  const initial = (email.trim()[0] || "A").toUpperCase();
  const settingsActive = pathname === "/settings" || pathname.startsWith("/settings");

  // Platform-correct command-palette hint (⌘K on Apple, Ctrl K elsewhere).
  // Defaults to the non-Apple form for SSR; corrected on mount — the <kbd>
  // carries suppressHydrationWarning so the swap is silent.
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    setIsMac(typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent));
  }, []);

  // Auto-expand group when navigating
  useEffect(() => {
    filteredGroups.forEach((group) => {
      const hasActive = group.items.some(
        (item) => pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
      );
      if (hasActive) {
        setCollapsed((prev) => ({ ...prev, [group.label]: false }));
      }
    });
  }, [pathname, filteredGroups]);

  const toggleGroup = (label: string) => {
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }));
  };

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

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card">
      {/* Logo — mirrors public/logo-mark.svg from the design system.
          Animations driven by .sb-sweep / .sb-ripple / .sb-pin-float in
          globals.css. All respect prefers-reduced-motion. */}
      <div className="flex h-16 items-center gap-3 border-b border-border px-5">
        <svg className="h-10 w-10 shrink-0 drop-shadow-[0_0_12px_rgba(127,182,232,0.22)]" viewBox="0 0 100 100" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="admin-mk-foil" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#5C9DDC" />
              <stop offset="45%" stopColor="#7FB6E8" />
              <stop offset="100%" stopColor="#DDE7F5" />
            </linearGradient>
            <linearGradient id="admin-mk-rose" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#A5C9F0" />
              <stop offset="100%" stopColor="#5C9DDC" />
            </linearGradient>
          </defs>
          <path
            className="sb-sweep"
            d="M20 65 Q 30 32, 50 48 T 80 40"
            stroke="url(#admin-mk-foil)"
            strokeWidth="3.25"
            fill="none"
            strokeLinecap="round"
          />
          <circle cx="20" cy="65" r="4.5" fill="url(#admin-mk-foil)" />
          <circle cx="20" cy="65" r="1.5" fill="#0A0F18" />
          {/* Ripple ring under the cool pin */}
          <circle
            className="sb-ripple"
            cx="80"
            cy="40"
            r="7.25"
            fill="none"
            stroke="url(#admin-mk-rose)"
            strokeWidth="1.25"
            opacity="0.6"
            style={{ transformOrigin: "80px 40px", transformBox: "fill-box" }}
          />
          <g className="sb-pin-float" style={{ transformOrigin: "80px 40px", transformBox: "fill-box" }}>
            <circle cx="80" cy="40" r="7.25" fill="url(#admin-mk-rose)" />
            <circle cx="80" cy="40" r="2.5" fill="#ECF1F8" />
          </g>
        </svg>
        <div className="flex flex-col leading-none">
          <span
            className="text-[1.1rem] tracking-[-0.025em] text-foreground"
            style={{ fontFamily: "var(--font-display), Didot, Georgia, serif", fontWeight: 400 }}
          >
            Locate<span className="foil-text">flow</span>
          </span>
          <span className="mt-1 text-[9px] font-mono uppercase tracking-[0.22em] text-muted-foreground/70">
            Admin
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 pt-3 pb-1">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder={tCommon("search")}
            aria-label={tCommon("search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-background pl-8 pr-14 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          {/* Discoverability cue for the global ⌘K command palette. */}
          <kbd
            suppressHydrationWarning
            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
          >
            {isMac ? "⌘K" : "Ctrl K"}
          </kbd>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {isSearching ? (
          // Flat filtered list
          <div className="space-y-0.5">
            {filteredItems && filteredItems.length > 0 ? (
              filteredItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <a
                    key={item.name}
                    href={item.href}
                    onClick={() => setSearch("")}
                    className={cn(
                      "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-primary/10 font-semibold text-primary before:absolute before:left-0 before:top-1/2 before:h-6 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-primary before:content-['']"
                        : "font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <item.icon className={cn("h-4 w-4 flex-shrink-0", isActive ? "text-primary" : "text-muted-foreground/70")} />
                    {tNav(item.nameKey)}
                  </a>
                );
              })
            ) : (
              <p className="px-3 py-4 text-xs text-muted-foreground text-center">{tCommon("no")}</p>
            )}
          </div>
        ) : (
          // Grouped navigation
          <div className="space-y-1">
            {displayGroups.map((group) => {
              const isCollapsed = collapsed[group.label];
              const hasActive = group.items.some(
                (item) => pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
              );
              return (
                <div key={group.label}>
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors",
                      hasActive
                        ? "text-primary/70"
                        : "text-muted-foreground/60 hover:text-muted-foreground"
                    )}
                  >
                    {tNav(group.labelKey)}
                    <ChevronDown
                      className={cn(
                        "h-3 w-3 transition-transform duration-200",
                        isCollapsed && "-rotate-90"
                      )}
                    />
                  </button>
                  {!isCollapsed && (
                    <div className="space-y-0.5 mt-0.5 mb-2">
                      {group.items.map((item) => {
                        const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                        return (
                          <a
                            key={item.name}
                            href={item.href}
                            className={cn(
                              "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                              isActive
                                ? "bg-primary/10 font-semibold text-primary before:absolute before:left-0 before:top-1/2 before:h-6 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-primary before:content-['']"
                                : "font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                            )}
                          >
                            <item.icon className={cn("h-4 w-4 flex-shrink-0", isActive ? "text-primary" : "text-muted-foreground/70")} />
                            {tNav(item.nameKey)}
                          </a>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </nav>

      {/* Pinned account bar — identity, Settings and Sign out are always
          reachable here without scrolling the nav; theme + language are
          compact icon buttons so the footer stays short. */}
      <div className="border-t border-border bg-card/60 p-3">
        {/* Who is signed in + privilege level — display only; the server role
            gate remains authoritative. */}
        {ctx && (
          <div className="mb-2 flex items-center gap-2.5 rounded-lg border border-border/50 bg-background/40 px-2.5 py-2">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary ring-1 ring-primary/20"
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
                    "mt-0.5 inline-flex items-center rounded px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide",
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
              "relative flex flex-1 items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
              settingsActive
                ? "bg-primary/10 font-semibold text-primary before:absolute before:left-0 before:top-1/2 before:h-6 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-primary before:content-['']"
                : "font-medium text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Settings className={cn("h-4 w-4 shrink-0", settingsActive ? "text-primary" : "text-muted-foreground/70")} />
            {tNav("settings")}
          </a>
          <ThemeToggle compact />
          <LanguageSelector compact />
        </div>
        <button
          onClick={handleLogout}
          className="mt-1.5 flex w-full items-center justify-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          {tCommon("signOut")}
        </button>
      </div>
    </aside>
  );
}
