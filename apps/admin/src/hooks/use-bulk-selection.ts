"use client";

import { useCallback, useMemo, useState } from "react";

/**
 * Standard bulk-selection state for admin list pages.
 *
 * Used by Users, Providers, Subscriptions, and any future list that needs
 * multi-select + bulk actions. Centralizing here prevents each page from
 * reinventing the "selected / toggle / all / clear" logic and ensures
 * consistent behavior (e.g. "select all" only selects *visible* rows,
 * never the entire paginated set — that would be a foot-gun for bulk
 * delete).
 */
export function useBulkSelection<T extends { id: string }>(rows: T[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      // Toggling "all" when every visible row is already selected clears the
      // set; otherwise we select every visible id. Non-visible (paginated)
      // selections are preserved across page switches.
      const visibleIds = rows.map((r) => r.id);
      const everyVisibleSelected = visibleIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (everyVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [rows]);

  const clear = useCallback(() => setSelected(new Set()), []);

  const isSelected = useCallback(
    (id: string) => selected.has(id),
    [selected],
  );

  const allVisibleSelected = useMemo(
    () => rows.length > 0 && rows.every((r) => selected.has(r.id)),
    [rows, selected],
  );

  const someVisibleSelected = useMemo(
    () => rows.some((r) => selected.has(r.id)),
    [rows, selected],
  );

  return {
    selected,
    selectedIds: useMemo(() => Array.from(selected), [selected]),
    count: selected.size,
    toggle,
    toggleAll,
    clear,
    isSelected,
    allVisibleSelected,
    someVisibleSelected,
  };
}
