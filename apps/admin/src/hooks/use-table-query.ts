"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * URL-synced query state for the shared DataTablePage.
 *
 * Owns search / sort / filters / pagination and mirrors them into the page
 * URL (?search=…&sortBy=…&page=…&<filter>=…) so admin list views are
 * shareable, bookmarkable, and survive back/forward navigation. Filter keys
 * are declared per table; only declared keys are read from / written to the
 * URL so stray params can't leak into a server fetch.
 *
 * Search is debounced before it lands in `debouncedSearch` (what the fetch
 * should use) and in the URL, so typing doesn't fire a request + history
 * entry per keystroke. Any filter or sort change resets to page 1.
 */

export interface TableQueryConfig {
  /** Declared filter keys (everything besides search/sort/page/perPage). */
  filterKeys: string[];
  defaultSortBy: string;
  defaultSortDir: "asc" | "desc";
  defaultPerPage: number;
  /** Debounce for search input → fetch + URL, in ms. */
  searchDebounceMs?: number;
}

export interface TableQueryState {
  search: string;
  /** Debounced search — the value the fetch should send. */
  debouncedSearch: string;
  sortBy: string;
  sortDir: "asc" | "desc";
  page: number;
  perPage: number;
  filters: Record<string, string>;
}

function readInitial(
  params: URLSearchParams,
  config: TableQueryConfig,
): TableQueryState {
  const filters: Record<string, string> = {};
  for (const key of config.filterKeys) {
    filters[key] = params.get(key) ?? "";
  }
  const pageRaw = Number.parseInt(params.get("page") || "1", 10);
  const perPageRaw = Number.parseInt(
    params.get("perPage") || String(config.defaultPerPage),
    10,
  );
  const dirRaw = params.get("sortDir");
  return {
    search: params.get("search") ?? "",
    debouncedSearch: params.get("search") ?? "",
    sortBy: params.get("sortBy") || config.defaultSortBy,
    sortDir: dirRaw === "asc" || dirRaw === "desc" ? dirRaw : config.defaultSortDir,
    page: Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1,
    perPage: Number.isFinite(perPageRaw) && perPageRaw > 0 ? perPageRaw : config.defaultPerPage,
    filters,
  };
}

export function useTableQuery(config: TableQueryConfig) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const debounceMs = config.searchDebounceMs ?? 300;

  // Snapshot config in a ref so the URL-writer effect doesn't churn when a
  // caller passes a freshly-built config object each render.
  const configRef = useRef(config);
  configRef.current = config;

  const [state, setState] = useState<TableQueryState>(() =>
    readInitial(new URLSearchParams(searchParams.toString()), config),
  );

  // Debounce the raw search box value into debouncedSearch (which drives the
  // fetch + URL). A search edit always resets to page 1.
  useEffect(() => {
    if (state.search === state.debouncedSearch) return;
    const t = setTimeout(() => {
      setState((prev) =>
        prev.search === prev.debouncedSearch
          ? prev
          : { ...prev, debouncedSearch: prev.search, page: 1 },
      );
    }, debounceMs);
    return () => clearTimeout(t);
  }, [state.search, state.debouncedSearch, debounceMs]);

  // Build the canonical query object (URL param map) from committed state.
  const queryParams = useMemo(() => {
    const cfg = configRef.current;
    const map: Record<string, string> = {};
    if (state.debouncedSearch) map.search = state.debouncedSearch;
    if (state.sortBy !== cfg.defaultSortBy) map.sortBy = state.sortBy;
    if (state.sortDir !== cfg.defaultSortDir) map.sortDir = state.sortDir;
    if (state.page !== 1) map.page = String(state.page);
    if (state.perPage !== cfg.defaultPerPage) map.perPage = String(state.perPage);
    for (const key of cfg.filterKeys) {
      const v = state.filters[key];
      if (v) map[key] = v;
    }
    return map;
  }, [state]);

  // Mirror committed state into the URL (replace, not push, so the back
  // button steps through real navigations rather than every keystroke).
  useEffect(() => {
    const next = new URLSearchParams(queryParams).toString();
    const current = searchParams.toString();
    if (next === current) return;
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [queryParams, pathname, router, searchParams]);

  const setSearch = useCallback((value: string) => {
    setState((prev) => ({ ...prev, search: value }));
  }, []);

  const setPage = useCallback((page: number) => {
    setState((prev) => ({ ...prev, page: Math.max(1, page) }));
  }, []);

  const setPerPage = useCallback((perPage: number) => {
    setState((prev) => ({ ...prev, perPage: Math.max(1, perPage), page: 1 }));
  }, []);

  const toggleSort = useCallback((col: string) => {
    setState((prev) => {
      const cfg = configRef.current;
      if (prev.sortBy === col) {
        return { ...prev, sortDir: prev.sortDir === "asc" ? "desc" : "asc", page: 1 };
      }
      return { ...prev, sortBy: col, sortDir: cfg.defaultSortDir, page: 1 };
    });
  }, []);

  const setSort = useCallback((col: string, dir: "asc" | "desc") => {
    setState((prev) => ({ ...prev, sortBy: col, sortDir: dir, page: 1 }));
  }, []);

  const setFilter = useCallback((key: string, value: string) => {
    setState((prev) => {
      if (!configRef.current.filterKeys.includes(key)) return prev;
      if (prev.filters[key] === value) return prev;
      return { ...prev, filters: { ...prev.filters, [key]: value }, page: 1 };
    });
  }, []);

  const clearFilters = useCallback(() => {
    setState((prev) => {
      const cleared: Record<string, string> = {};
      for (const key of configRef.current.filterKeys) cleared[key] = "";
      return { ...prev, filters: cleared, page: 1 };
    });
  }, []);

  // Replace the entire query state from a saved view's snapshot. Always
  // lands on page 1 of the snapshot's filtered set.
  const applyQuery = useCallback((query: Record<string, string>) => {
    const cfg = configRef.current;
    setState((prev) => {
      const filters: Record<string, string> = {};
      for (const key of cfg.filterKeys) filters[key] = query[key] ?? "";
      const dir = query.sortDir;
      return {
        ...prev,
        search: query.search ?? "",
        debouncedSearch: query.search ?? "",
        sortBy: query.sortBy || cfg.defaultSortBy,
        sortDir: dir === "asc" || dir === "desc" ? dir : cfg.defaultSortDir,
        perPage: query.perPage ? Number.parseInt(query.perPage, 10) || cfg.defaultPerPage : cfg.defaultPerPage,
        page: 1,
        filters,
      };
    });
  }, []);

  const activeFilterCount = useMemo(
    () => Object.values(state.filters).filter(Boolean).length,
    [state.filters],
  );

  // Canonical snapshot a saved view should store — query params minus page,
  // since views always land on page 1.
  const snapshot = useMemo(() => {
    const { page: _page, ...rest } = queryParams;
    return rest;
  }, [queryParams]);

  return {
    state,
    queryParams,
    snapshot,
    activeFilterCount,
    setSearch,
    setPage,
    setPerPage,
    toggleSort,
    setSort,
    setFilter,
    clearFilters,
    applyQuery,
  };
}
