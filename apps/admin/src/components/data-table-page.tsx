"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Filter,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin-page-header";
import { ColumnSettingsMenu } from "@/components/column-settings-menu";
import { SavedViewsMenu } from "@/components/saved-views-menu";
import { EmptyState } from "@/components/empty-state";
import {
  useColumnVisibility,
  type ColumnDescriptor,
} from "@/hooks/use-column-visibility";
import { useBulkSelection } from "@/hooks/use-bulk-selection";
import { useSavedViews } from "@/hooks/use-saved-views";
import { useTableQuery, type TableQueryState } from "@/hooks/use-table-query";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * <DataTablePage> — the shared admin list-page shell.
 * ============================================================================
 *
 * Standardizes the search / sort / filter / paginate / column-settings /
 * bulk-select / export / saved-views machinery that ~20 admin list pages
 * each re-wired by hand. A page supplies:
 *
 *   - a column set (drives column-settings menu + header rendering)
 *   - a filter definition (drives the standardized filter bar)
 *   - a server-driven `fetcher` (the fetch contract)
 *   - per-row render slots (cells + actions)
 *
 * …and gets URL-synced state, saved/named views, bulk selection, and the
 * aurora-themed chrome for free. Mutations (delete/export/etc.) stay in the
 * page so step-up + writeAdminAudit semantics are preserved exactly — the
 * shell only renders the trigger slots the page provides.
 */

/** One server-driven fetch result. */
export interface FetchResult<Row> {
  rows: Row[];
  total: number;
}

/** Arguments passed to a page's fetcher — the committed query state. */
export interface FetchArgs {
  state: TableQueryState;
  /** Pre-built URLSearchParams matching the committed query (search/sort/page/filters). */
  params: URLSearchParams;
  signal: AbortSignal;
}

/** A column definition for the table header + body. */
export interface DataTableColumn<Row> extends ColumnDescriptor {
  /** Header label override (defaults to descriptor `label`). */
  header?: ReactNode;
  /** When set, the header is a sort toggle posting this key as `sortBy`. */
  sortKey?: string;
  align?: "left" | "center" | "right";
  /** Cell renderer. Omit for columns rendered entirely inside another cell. */
  cell?: (row: Row) => ReactNode;
  /** Extra className on the <td>. */
  cellClassName?: string;
}

/** One control in the standardized filter bar. */
export type FilterControl =
  | {
      key: string;
      label: string;
      type: "select";
      options: { value: string; label: string }[];
    }
  | { key: string; label: string; type: "date" }
  | { key: string; label: string; type: "text"; placeholder?: string };

export interface DataTablePageProps<Row extends { id: string }> {
  // Header
  eyebrow?: string;
  title: string;
  subtitle?: (total: number) => string;
  headerActions?: (ctx: DataTableContext<Row>) => ReactNode;

  // Identity / persistence
  /** Stable key, e.g. "admin.users" — namespaces column + saved-view storage. */
  storageKey: string;
  /** Bump when the column set changes incompatibly (see useColumnVisibility). */
  columnsVersion: number;

  // Data
  columns: DataTableColumn<Row>[];
  filters?: FilterControl[];
  fetcher: (args: FetchArgs) => Promise<FetchResult<Row>>;
  defaultSortBy: string;
  defaultSortDir?: "asc" | "desc";
  perPage?: number;
  searchPlaceholder?: string;

  // Selection
  /** Enable the bulk-select checkbox column + selection plumbing. */
  selectable?: boolean;
  /** Rows that cannot be selected (e.g. already-deleted). */
  isRowSelectable?: (row: Row) => boolean;
  /** Rendered above the table when ≥1 row is selected. */
  bulkActions?: (ctx: BulkContext<Row>) => ReactNode;

  // Rows
  rowActions?: (row: Row) => ReactNode;
  rowClassName?: (row: Row, selected: boolean) => string;
  /**
   * Make the whole row tappable. Essential on mobile, where per-row controls
   * live in the trailing actions column that scrolls off-screen — without this
   * a phone user can't open a record. Taps inside the bulk-select checkbox or
   * the actions cell are ignored so they don't double-fire.
   */
  onRowActivate?: (row: Row) => void;

  // Empty state
  emptyIcon: React.ElementType;
  emptyTitle: string;
  emptyDescription?: (hasQuery: boolean) => string;

  // Slots
  /** Rendered between the header and the filter bar (e.g. KPI cards, tabs). */
  beforeTable?: (ctx: DataTableContext<Row>) => ReactNode;
  /** Rendered after the table (before pagination), e.g. an expanded detail panel. */
  afterTable?: (ctx: DataTableContext<Row>) => ReactNode;

  /** Bump to force a refetch from the page (e.g. after a mutation). */
  refreshToken?: number;
}

export interface DataTableContext<Row extends { id: string }> {
  rows: Row[];
  total: number;
  loading: boolean;
  refresh: () => void;
  query: ReturnType<typeof useTableQuery>;
}

export interface BulkContext<Row extends { id: string }> {
  selectedIds: string[];
  count: number;
  clear: () => void;
  refresh: () => void;
}

export function DataTablePage<Row extends { id: string }>(
  props: DataTablePageProps<Row>,
) {
  const {
    eyebrow,
    title,
    subtitle,
    headerActions,
    storageKey,
    columnsVersion,
    columns,
    filters = [],
    fetcher,
    defaultSortBy,
    defaultSortDir = "desc",
    perPage = 20,
    searchPlaceholder = "Search…",
    selectable = false,
    isRowSelectable,
    bulkActions,
    rowActions,
    rowClassName,
    onRowActivate,
    emptyIcon,
    emptyTitle,
    emptyDescription,
    beforeTable,
    afterTable,
    refreshToken,
  } = props;

  const filterKeys = useMemo(() => filters.map((f) => f.key), [filters]);

  const query = useTableQuery({
    filterKeys,
    defaultSortBy,
    defaultSortDir,
    defaultPerPage: perPage,
  });

  const cols = useColumnVisibility({
    storageKey: `${storageKey}.cols`,
    version: columnsVersion,
    columns,
  });

  const savedViews = useSavedViews(`${storageKey}.views`);

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const fetcherRef = useRef(fetcher);

  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  // Bulk selection over the currently-selectable visible rows.
  const selectableRows = useMemo(
    () =>
      selectable
        ? rows.filter((r) => (isRowSelectable ? isRowSelectable(r) : true))
        : [],
    [rows, selectable, isRowSelectable],
  );
  const bulk = useBulkSelection(selectableRows);

  const abortRef = useRef<AbortController | null>(null);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    params.set("page", String(query.state.page));
    params.set("perPage", String(query.state.perPage));
    if (query.state.debouncedSearch) params.set("search", query.state.debouncedSearch);
    params.set("sortBy", query.state.sortBy);
    params.set("sortDir", query.state.sortDir);
    for (const key of filterKeys) {
      const v = query.state.filters[key];
      if (v) params.set(key, v);
    }
    return params;
  }, [query.state, filterKeys]);

  const runFetch = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const result = await fetcherRef.current({
        state: query.state,
        params: buildParams(),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setRows(result.rows);
      setTotal(result.total);
    } catch (err) {
      if (controller.signal.aborted || (err as any)?.name === "AbortError") return;
      toast.error((err as any)?.message || "Failed to load data");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [query.state, buildParams]);

  useEffect(() => {
    runFetch();
    return () => abortRef.current?.abort();
  }, [runFetch, refreshToken]);

  const refresh = useCallback(() => {
    runFetch();
  }, [runFetch]);

  const ctx: DataTableContext<Row> = {
    rows,
    total,
    loading,
    refresh,
    query,
  };

  const totalPages = Math.max(1, Math.ceil(total / query.state.perPage));
  const hasQuery = Boolean(query.state.debouncedSearch) || query.activeFilterCount > 0;

  // Which saved view (if any) exactly matches the current query snapshot.
  const activeViewId = useMemo(() => {
    const current = JSON.stringify(
      Object.entries(query.snapshot).sort(([a], [b]) => a.localeCompare(b)),
    );
    const match = savedViews.views.find(
      (v) =>
        JSON.stringify(Object.entries(v.query).sort(([a], [b]) => a.localeCompare(b))) ===
        current,
    );
    return match?.id ?? null;
  }, [savedViews.views, query.snapshot]);

  const visibleColumns = cols.columns.filter((c) => c.visible);
  // +1 for the bulk-select checkbox column (outside the configurable set).
  const colSpan = visibleColumns.length + (selectable ? 1 : 0);
  const activeFilters = useMemo(
    () =>
      filters
        .map((filter) => {
          const value = query.state.filters[filter.key];
          if (!value) return null;
          const displayValue =
            filter.type === "select"
              ? filter.options.find((option) => option.value === value)?.label || value
              : value;
          return { key: filter.key, label: filter.label, value: displayValue };
        })
        .filter((item): item is { key: string; label: string; value: string } => Boolean(item)),
    [filters, query.state.filters],
  );

  function alignClass(align?: "left" | "center" | "right") {
    return align === "center"
      ? "text-center"
      : align === "right"
        ? "text-right"
        : "text-left";
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle ? subtitle(total) : undefined}
        actions={
          <>
            <SavedViewsMenu
              views={savedViews.views}
              currentQuery={query.snapshot}
              activeViewId={activeViewId}
              onApply={(view) => query.applyQuery(view.query)}
              onSave={savedViews.save}
              onRemove={savedViews.remove}
            />
            <ColumnSettingsMenu
              columns={cols.columns}
              onToggle={cols.toggle}
              onReset={cols.reset}
              hiddenCount={cols.hiddenCount}
            />
            {headerActions ? headerActions(ctx) : null}
          </>
        }
      />

      {beforeTable ? beforeTable(ctx) : null}

      {/* Search + Filters */}
      <div className="admin-panel p-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={query.state.search}
              onChange={(e) => query.setSearch(e.target.value)}
              className="h-10 w-full rounded-xl border border-border bg-background/80 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-10 items-center rounded-xl border border-border bg-background/60 px-3 text-xs font-medium text-muted-foreground">
              {loading ? (
                <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Refreshing</>
              ) : (
                <>{total.toLocaleString()} rows</>
              )}
            </span>
            {filters.length > 0 ? (
              <button
                onClick={() => setShowFilters((v) => !v)}
                className={cn(
                  "inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors",
                  showFilters
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background/60 text-muted-foreground hover:bg-accent",
                )}
              >
                <Filter className="h-3.5 w-3.5" /> Filters
                {query.activeFilterCount > 0 ? (
                  <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
                    {query.activeFilterCount}
                  </span>
                ) : null}
              </button>
            ) : null}
            {hasQuery ? (
              <button
                onClick={() => {
                  query.setSearch("");
                  query.clearFilters();
                }}
                className="inline-flex h-10 items-center gap-1 rounded-xl border border-border bg-background/60 px-3 text-xs font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                <X className="h-3 w-3" /> Clear query
              </button>
            ) : null}
          </div>
        </div>

        {hasQuery ? (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
            {query.state.debouncedSearch ? (
              <span className="rounded-full border border-border bg-background/70 px-2.5 py-1 text-[11px] text-muted-foreground">
                Search: <span className="font-medium text-foreground">{query.state.debouncedSearch}</span>
              </span>
            ) : null}
            {activeFilters.map((filter) => (
              <span key={filter.key} className="rounded-full border border-border bg-background/70 px-2.5 py-1 text-[11px] text-muted-foreground">
                {filter.label}: <span className="font-medium text-foreground">{filter.value}</span>
              </span>
            ))}
          </div>
        ) : null}

        {showFilters && filters.length > 0 ? (
          <div className="mt-3 border-t border-border pt-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
              {filters.map((f) => (
                <div key={f.key}>
                  <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                    {f.label}
                  </label>
                  {f.type === "select" ? (
                    <select
                      value={query.state.filters[f.key] || ""}
                      onChange={(e) => query.setFilter(f.key, e.target.value)}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      {f.options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : f.type === "date" ? (
                    <input
                      type="date"
                      value={query.state.filters[f.key] || ""}
                      onChange={(e) => query.setFilter(f.key, e.target.value)}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  ) : (
                    <input
                      type="text"
                      value={query.state.filters[f.key] || ""}
                      placeholder={f.placeholder}
                      onChange={(e) => query.setFilter(f.key, e.target.value)}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Bulk Actions */}
      {selectable && bulk.count > 0 && bulkActions ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5">
          <span className="text-sm font-medium text-primary">{bulk.count} selected</span>
          <div className="h-4 w-px bg-border" />
          {bulkActions({
            selectedIds: bulk.selectedIds,
            count: bulk.count,
            clear: bulk.clear,
            refresh,
          })}
          <button
            onClick={bulk.clear}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground"
          >
            Clear selection
          </button>
        </div>
      ) : null}

      {/* Table — admin-panel chrome (foil hairline + warm hover). The inner
          scroller keeps wide tables inside their own card on phones instead
          of panning the whole page; min-w keeps columns legible. */}
      <div className="admin-panel">
        <div className="overflow-x-auto overscroll-x-contain">
        <table className="w-full min-w-[640px]">
          <thead className="bg-muted/50">
            <tr>
              {selectable ? (
                <th className="px-3 py-3 text-left">
                  <button
                    onClick={bulk.toggleAll}
                    aria-label="Select all rows on this page"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {bulk.allVisibleSelected ? (
                      <CheckSquareIcon checked />
                    ) : (
                      <CheckSquareIcon />
                    )}
                  </button>
                </th>
              ) : null}
              {visibleColumns.map((col) => {
                const def = columns.find((c) => c.key === col.key)!;
                const sortable = Boolean(def.sortKey);
                const isSorted = def.sortKey === query.state.sortBy;
                return (
                  <th
                    key={col.key}
                    className={cn(
                      "px-3 py-3 text-xs font-medium uppercase text-muted-foreground",
                      alignClass(def.align),
                      sortable && "cursor-pointer select-none",
                    )}
                    aria-sort={
                      isSorted
                        ? query.state.sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : sortable
                          ? "none"
                          : undefined
                    }
                    onClick={sortable ? () => query.toggleSort(def.sortKey!) : undefined}
                  >
                    {def.header ?? def.label}
                    {sortable ? (
                      !isSorted ? (
                        <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-30" />
                      ) : query.state.sortDir === "asc" ? (
                        <ChevronUp className="ml-1 inline h-3 w-3" />
                      ) : (
                        <ChevronDown className="ml-1 inline h-3 w-3" />
                      )
                    ) : null}
                  </th>
                );
              })}
              {rowActions ? (
                <th className="px-3 py-3 text-right text-xs font-medium uppercase text-muted-foreground">
                  Actions
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td
                  colSpan={colSpan + (rowActions ? 1 : 0)}
                  className="px-4 py-12 text-center text-muted-foreground"
                >
                  <span className="inline-flex items-center gap-2 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading rows
                  </span>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={colSpan + (rowActions ? 1 : 0)} className="px-4">
                  <EmptyState
                    icon={emptyIcon}
                    title={emptyTitle}
                    description={
                      emptyDescription ? emptyDescription(hasQuery) : undefined
                    }
                  />
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const selected = selectable && bulk.isSelected(row.id);
                const canSelect = selectable
                  ? isRowSelectable
                    ? isRowSelectable(row)
                    : true
                  : false;
                return (
                  <tr
                    key={row.id}
                    {...(onRowActivate
                      ? {
                          role: "button" as const,
                          tabIndex: 0,
                          onClick: (e: React.MouseEvent) => {
                            if ((e.target as HTMLElement).closest("[data-row-interactive]")) return;
                            onRowActivate(row);
                          },
                          onKeyDown: (e: React.KeyboardEvent) => {
                            if (e.key !== "Enter" && e.key !== " ") return;
                            if ((e.target as HTMLElement).closest("[data-row-interactive]")) return;
                            e.preventDefault();
                            onRowActivate(row);
                          },
                        }
                      : {})}
                    className={cn(
                      "bg-card transition-colors",
                      selected ? "bg-primary/5" : "hover:bg-accent/50",
                      onRowActivate && "cursor-pointer",
                      rowClassName?.(row, Boolean(selected)),
                    )}
                  >
                    {selectable ? (
                      <td className="px-3 py-3" data-row-interactive>
                        <button
                          onClick={() => canSelect && bulk.toggle(row.id)}
                          disabled={!canSelect}
                          aria-pressed={Boolean(selected)}
                          aria-label={selected ? "Deselect row" : "Select row"}
                          className="text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <CheckSquareIcon checked={Boolean(selected)} primary={Boolean(selected)} />
                        </button>
                      </td>
                    ) : null}
                    {visibleColumns.map((col) => {
                      const def = columns.find((c) => c.key === col.key)!;
                      if (!def.cell) return <td key={col.key} className="px-3 py-3" />;
                      return (
                        <td
                          key={col.key}
                          className={cn("px-3 py-3", alignClass(def.align), def.cellClassName)}
                        >
                          {def.cell(row)}
                        </td>
                      );
                    })}
                    {rowActions ? (
                      <td className="px-3 py-3 text-right" data-row-interactive>
                        <div className="flex items-center justify-end gap-1">
                          {rowActions(row)}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>

      {afterTable ? afterTable(ctx) : null}

      {/* Pagination */}
      {totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 truncate text-xs text-muted-foreground">
            Showing {(query.state.page - 1) * query.state.perPage + 1}–
            {Math.min(query.state.page * query.state.perPage, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => query.setPage(query.state.page - 1)}
              disabled={query.state.page <= 1}
              aria-label="Previous page"
              className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-accent disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 text-sm text-muted-foreground">
              Page {query.state.page} / {totalPages}
            </span>
            <button
              onClick={() => query.setPage(query.state.page + 1)}
              disabled={query.state.page >= totalPages}
              aria-label="Next page"
              className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-accent disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Small inline checkbox glyph matching the existing list pages (lucide
 * CheckSquare / Square). Kept local so the shell has zero extra deps.
 */
function CheckSquareIcon({
  checked = false,
  primary = false,
}: {
  checked?: boolean;
  primary?: boolean;
}) {
  if (checked) {
    return (
      <svg
        className={cn("h-4 w-4", primary && "text-primary")}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    );
  }
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
    </svg>
  );
}
