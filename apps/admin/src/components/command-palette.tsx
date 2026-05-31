"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search, CornerDownLeft, Building2, User as UserIcon, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminPermissionsMap, AdminRoleString } from "@/lib/page-guard";
import { filterNavGroups, filterQuickActions } from "@/lib/admin-nav";

type Ctx = { role: AdminRoleString; permissions: AdminPermissionsMap };

interface Row {
  id: string;
  group: "nav" | "action" | "user" | "provider";
  label: string;
  sublabel?: string;
  href: string;
  icon?: React.ElementType;
}

const GROUP_ORDER: Row["group"][] = ["action", "nav", "user", "provider"];

interface EntityState {
  users: Row[];
  providers: Row[];
}

export function CommandPalette({ ctx }: { ctx?: Ctx }) {
  const router = useRouter();
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [entities, setEntities] = useState<EntityState>({ users: [], providers: [] });
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<Element | null>(null);

  const canSearchUsers = ctx?.permissions.users.canRead ?? false;
  const canSearchProviders = ctx?.permissions.providers.canRead ?? false;

  // ── ⌘K / Ctrl+K global toggle ───────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Focus management: focus the input on open, restore focus on close.
  useEffect(() => {
    if (open) {
      previouslyFocused.current = document.activeElement;
      // next tick so the input is mounted
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setQuery("");
      setActiveIndex(0);
      setEntities({ users: [], providers: [] });
      (previouslyFocused.current as HTMLElement | null)?.focus?.();
    }
  }, [open]);

  // ── Static rows: navigation + quick actions (instant, no API) ──
  const localMatches = useMemo<{ nav: Row[]; action: Row[] }>(() => {
    const q = query.trim().toLowerCase();
    const matches = (name: string, nameKey: string) => {
      if (!q) return true;
      if (name.toLowerCase().includes(q)) return true;
      try {
        return tNav(nameKey).toLowerCase().includes(q);
      } catch {
        return false;
      }
    };
    const nav: Row[] = filterNavGroups(ctx ?? null)
      .flatMap((g) => g.items)
      .filter((item) => matches(item.name, item.nameKey))
      .map((item) => ({ id: `nav:${item.href}`, group: "nav" as const, label: safeT(tNav, item.nameKey, item.name), href: item.href, icon: item.icon }));
    const action: Row[] = filterQuickActions(ctx ?? null)
      .filter((a) => matches(a.name, a.nameKey))
      .map((a) => ({ id: `action:${a.href}`, group: "action" as const, label: safeT(tNav, a.nameKey, a.name), href: a.href, icon: a.icon }));
    return { nav, action };
  }, [query, ctx, tNav]);

  // ── Debounced entity search (users + providers) ──────────────
  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < 2 || (!canSearchUsers && !canSearchProviders)) {
      setEntities({ users: [], providers: [] });
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const next: EntityState = { users: [], providers: [] };
      try {
        const reqs: Promise<void>[] = [];
        if (canSearchUsers) {
          reqs.push(
            fetch(`/api/users?search=${encodeURIComponent(q)}&perPage=5`, { signal: controller.signal })
              .then((r) => (r.ok ? r.json() : null))
              .then((d) => {
                next.users = (d?.users ?? []).slice(0, 5).map((u: any) => ({
                  id: `user:${u.id}`,
                  group: "user" as const,
                  label: u.email || [u.firstName, u.lastName].filter(Boolean).join(" ") || u.id,
                  sublabel: u.email ? [u.firstName, u.lastName].filter(Boolean).join(" ") || undefined : undefined,
                  href: `/users/${u.id}`,
                }));
              })
              .catch(() => {}),
          );
        }
        if (canSearchProviders) {
          reqs.push(
            fetch(`/api/providers?search=${encodeURIComponent(q)}&perPage=5`, { signal: controller.signal })
              .then((r) => (r.ok ? r.json() : null))
              .then((d) => {
                next.providers = (d?.providers ?? []).slice(0, 5).map((p: any) => ({
                  id: `provider:${p.id}`,
                  group: "provider" as const,
                  label: p.name || p.slug || p.id,
                  sublabel: p.category || undefined,
                  href: `/providers/${p.id}`,
                }));
              })
              .catch(() => {}),
          );
        }
        await Promise.all(reqs);
        if (!controller.signal.aborted) setEntities(next);
      } catch {
        /* ignore */
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open, canSearchUsers, canSearchProviders]);

  // ── Flatten into one keyboard-navigable list (group order) ───
  const rows = useMemo<Row[]>(() => {
    const byGroup: Record<Row["group"], Row[]> = {
      action: localMatches.action,
      nav: localMatches.nav,
      user: entities.users,
      provider: entities.providers,
    };
    return GROUP_ORDER.flatMap((g) => byGroup[g]);
  }, [localMatches, entities]);

  useEffect(() => {
    setActiveIndex((i) => (rows.length === 0 ? 0 : Math.min(i, rows.length - 1)));
  }, [rows.length]);

  const go = useCallback(
    (row: Row | undefined) => {
      if (!row) return;
      setOpen(false);
      router.push(row.href);
    },
    [router],
  );

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (rows.length ? (i + 1) % rows.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (rows.length ? (i - 1 + rows.length) % rows.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(rows[activeIndex]);
    }
  }

  // Keep the active row scrolled into view.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-row-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  if (!open) return null;

  const groupLabels: Record<Row["group"], string> = {
    action: safeT(tCommon, "actions", "Actions"),
    nav: safeT(tCommon, "navigation", "Navigation"),
    user: safeT(tNav, "users", "Users"),
    provider: safeT(tNav, "providers", "Providers"),
  };

  let flatIndex = -1;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 backdrop-blur-sm pt-[12vh] px-4"
      onClick={() => setOpen(false)}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={tCommon("search")}
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder={`${tCommon("search")}…`}
            aria-label={tCommon("search")}
            className="w-full bg-transparent py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <kbd className="hidden sm:inline rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">ESC</kbd>
        </div>

        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-2">
          {rows.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">{tCommon("no")}</p>
          ) : (
            GROUP_ORDER.map((group) => {
              const groupRows = rows.filter((r) => r.group === group);
              if (groupRows.length === 0) return null;
              return (
                <div key={group} className="mb-1">
                  <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    {groupLabels[group]}
                  </p>
                  {groupRows.map((row) => {
                    flatIndex += 1;
                    const idx = flatIndex;
                    const isActive = idx === activeIndex;
                    const Icon = row.icon ?? (row.group === "user" ? UserIcon : row.group === "provider" ? Building2 : ArrowRight);
                    return (
                      <button
                        key={row.id}
                        type="button"
                        data-row-index={idx}
                        onClick={() => go(row)}
                        onMouseMove={() => setActiveIndex(idx)}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors",
                          isActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="flex-1 truncate">{row.label}</span>
                        {row.sublabel && <span className="truncate text-xs text-muted-foreground">{row.sublabel}</span>}
                        {isActive && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

/** useTranslations throws on a missing key; fall back to the English name. */
function safeT(t: ReturnType<typeof useTranslations>, key: string, fallback: string): string {
  try {
    return t(key);
  } catch {
    return fallback;
  }
}
