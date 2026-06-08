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
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={query.state.search}
            onChange={(e) => query.setSearch(e.target.value)}
            className="w-full rounded-lg border border-input bg-background pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        {filters.length > 0 ? (
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
              showFilters
                ? "border-primary bg-primary/5 text-primary"
                : "border-border text-muted-foreground hover:bg-accent",
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
        {query.activeFilterCount > 0 ? (
          <button
            onClick={() => query.clearFilters()}
            className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-accent"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        ) : null}
      </div>

      {/* Filter Panel */}
      {showFilters && filters.length > 0 ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
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

      {/* Bulk Actions */}
      {selectable && bulk.count > 0 && bulkActions ? (
        <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5">
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

      {/* Table — admin-panel chrome (foil hairline + warm hover) */}
      <div className="admin-panel overflow-hidden">
        <table className="w-full">
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
                  Loading...
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
                    className={cn(
                      "bg-card transition-colors",
                      selected ? "bg-primary/5" : "hover:bg-accent/50",
                      rowClassName?.(row, Boolean(selected)),
                    )}
                  >
                    {selectable ? (
                      <td className="px-3 py-3">
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
                      <td className="px-3 py-3 text-right">
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

      {afterTable ? afterTable(ctx) : null}

      {/* Pagination */}
      {totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
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
