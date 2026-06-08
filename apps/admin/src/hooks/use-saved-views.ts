"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Per-table SAVED / NAMED VIEWS — the capability layer on top of the shared
 * DataTablePage.
 *
 * A "view" is a named snapshot of the table's query state (search, sort,
 * filters, perPage) that an operator can save and re-apply with one click.
 * Stored in localStorage keyed per table, so each list page (users, logs,
 * …) keeps an independent set. The query snapshot is intentionally a plain
 * `Record<string, string>` — the exact same shape DataTablePage syncs to the
 * URL — so applying a view just means pushing those params back into the URL.
 *
 *   const views = useSavedViews("admin.users.views");
 *   views.save("Blocked accounts", currentQuery);
 *   views.list            // [{ id, name, query }, ...]
 *   views.apply(view)     // caller pushes view.query into the URL
 *   views.remove(id)
 *
 * Page number is deliberately NOT persisted in a saved view — applying a
 * view always lands the operator on page 1 of that filtered set, which is
 * what "show me my Blocked-accounts view" means. The caller strips `page`
 * before saving (see DataTablePage).
 */

export interface SavedView {
  id: string;
  name: string;
  /** Snapshot of URL-synced query params (search/sort/filters/perPage). */
  query: Record<string, string>;
}

interface StoredPayload {
  version: number;
  views: SavedView[];
}

const VERSION = 1;

function readStored(storageKey: string): SavedView[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredPayload;
    if (parsed?.version !== VERSION || !Array.isArray(parsed.views)) return [];
    return parsed.views.filter(
      (v): v is SavedView =>
        Boolean(v) &&
        typeof v.id === "string" &&
        typeof v.name === "string" &&
        Boolean(v.query) &&
        typeof v.query === "object",
    );
  } catch {
    return [];
  }
}

function writeStored(storageKey: string, views: SavedView[]) {
  if (typeof window === "undefined") return;
  try {
    const payload: StoredPayload = { version: VERSION, views };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch {
    // Quota / SSR — saved views are a convenience, never load-bearing.
  }
}

function makeId(): string {
  return `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useSavedViews(storageKey: string) {
  // Hydrate from storage in an effect (not the initializer) so server and
  // client first-render markup match — same pattern as useColumnVisibility.
  const [views, setViews] = useState<SavedView[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setViews(readStored(storageKey));
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (hydrated) writeStored(storageKey, views);
  }, [hydrated, views, storageKey]);

  const save = useCallback((name: string, query: Record<string, string>) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setViews((prev) => {
      // Re-saving an existing name overwrites it (operators expect "save"
      // on the same name to update, not create a duplicate).
      const existing = prev.find(
        (v) => v.name.toLowerCase() === trimmed.toLowerCase(),
      );
      if (existing) {
        return prev.map((v) =>
          v.id === existing.id ? { ...v, query } : v,
        );
      }
      return [...prev, { id: makeId(), name: trimmed, query }];
    });
  }, []);

  const remove = useCallback((id: string) => {
    setViews((prev) => prev.filter((v) => v.id !== id));
  }, []);

  const rename = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setViews((prev) =>
      prev.map((v) => (v.id === id ? { ...v, name: trimmed } : v)),
    );
  }, []);

  return {
    views: useMemo(() => views, [views]),
    hydrated,
    save,
    remove,
    rename,
  };
}
