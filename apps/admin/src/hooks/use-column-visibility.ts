"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Column visibility state backed by localStorage.
 *
 * Each table page declares its columns (stable keys + labels) and a
 * unique `storageKey`. User preferences persist across reloads, but we
 * also version the stored payload — bumping `version` (usually because a
 * column was renamed/removed) forces a reset so we never show a column
 * the page can no longer render.
 *
 *   const cols = useColumnVisibility({
 *     storageKey: "admin.users.cols",
 *     version: 1,
 *     columns: [
 *       { key: "name", label: "User", alwaysOn: true },
 *       { key: "plan", label: "Plan" },
 *       { key: "moves", label: "Moves" },
 *     ],
 *   });
 *   cols.isVisible("plan")       // true/false
 *   cols.toggle("plan")
 *   cols.reset()
 *   cols.columns                 // [{ key, label, alwaysOn, visible }, ...]
 */

export interface ColumnDescriptor {
  key: string;
  label: string;
  /** Columns that must always render regardless of user preference. */
  alwaysOn?: boolean;
  /** Default visibility if the user hasn't made a choice. */
  defaultVisible?: boolean;
}

export interface ResolvedColumn extends ColumnDescriptor {
  visible: boolean;
}

interface StoredPayload {
  version: number;
  hidden: string[];
}

interface Options {
  storageKey: string;
  version: number;
  columns: ColumnDescriptor[];
}

function readStored(storageKey: string, version: number): Set<string> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPayload;
    if (parsed?.version !== version || !Array.isArray(parsed.hidden)) return null;
    return new Set(parsed.hidden.filter((k): k is string => typeof k === "string"));
  } catch {
    return null;
  }
}

function writeStored(storageKey: string, version: number, hidden: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    const payload: StoredPayload = { version, hidden: Array.from(hidden) };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch {
    // Quota exceeded / SSR — preference is a nice-to-have, not critical.
  }
}

function defaultHidden(columns: ColumnDescriptor[]): Set<string> {
  const hidden = new Set<string>();
  for (const col of columns) {
    if (col.alwaysOn) continue;
    if (col.defaultVisible === false) hidden.add(col.key);
  }
  return hidden;
}

export function useColumnVisibility({ storageKey, version, columns }: Options) {
  // Start from defaults; hydrate from storage in an effect to avoid
  // React hydration mismatches in server-rendered tables.
  const [hidden, setHidden] = useState<Set<string>>(() => defaultHidden(columns));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readStored(storageKey, version);
    if (stored) setHidden(stored);
    setHydrated(true);
  }, [storageKey, version]);

  useEffect(() => {
    if (hydrated) writeStored(storageKey, version, hidden);
  }, [hydrated, hidden, storageKey, version]);

  const toggle = useCallback((key: string) => {
    setHidden((prev) => {
      const col = columns.find((c) => c.key === key);
      if (col?.alwaysOn) return prev; // alwaysOn columns can't be toggled
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, [columns]);

  const setVisible = useCallback((key: string, visible: boolean) => {
    setHidden((prev) => {
      const col = columns.find((c) => c.key === key);
      if (col?.alwaysOn) return prev;
      const next = new Set(prev);
      if (visible) next.delete(key);
      else next.add(key);
      return next;
    });
  }, [columns]);

  const reset = useCallback(() => {
    setHidden(defaultHidden(columns));
  }, [columns]);

  const isVisible = useCallback(
    (key: string) => {
      const col = columns.find((c) => c.key === key);
      if (col?.alwaysOn) return true;
      return !hidden.has(key);
    },
    [columns, hidden],
  );

  const resolved: ResolvedColumn[] = useMemo(
    () =>
      columns.map((col) => ({
        ...col,
        visible: col.alwaysOn ? true : !hidden.has(col.key),
      })),
    [columns, hidden],
  );

  return {
    columns: resolved,
    isVisible,
    toggle,
    setVisible,
    reset,
    hiddenCount: hidden.size,
  };
}
