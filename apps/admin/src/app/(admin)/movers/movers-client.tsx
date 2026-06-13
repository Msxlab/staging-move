"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Boxes,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminPanel } from "@/components/admin-panel";
import { EmptyState } from "@/components/empty-state";
import { PasswordConfirmModal, type StepUpValues } from "@/components/password-confirm-modal";

type Mover = {
  id: string;
  usdotNumber: number;
  legalName: string;
  dbaName: string | null;
  state: string;
  city: string | null;
  phone: string | null;
  hhgAuthorization: boolean;
  fleetSize: number | null;
  complaintCount2y: number;
  safetyRating: string | null;
  dataAsOf: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type Freshness = {
  totalRows: number;
  activeCount: number;
  newestDataAsOf: string | null;
  statesCovered: number;
  stateCounts: Array<{ state: string; count: number }>;
};

type StatusFilter = "" | "active" | "inactive";
type HhgFilter = "" | "authorized" | "none";

const PAGE_SIZE = 50;

/** Snapshots older than this read as stale — FMCSA census refreshes monthly. */
const STALE_AFTER_MS = 90 * 24 * 60 * 60 * 1000;

const inputCls =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

// Closed FMCSA enum, mirrored by the PATCH route. Stored raw in the DB;
// the lowercase form keys the localized labels.
const SAFETY_RATINGS = ["Satisfactory", "Conditional", "Unsatisfactory"] as const;
type SafetyRating = (typeof SAFETY_RATINGS)[number];

function safetyKey(value: string): string | null {
  const lower = value.toLowerCase();
  return SAFETY_RATINGS.some((rating) => rating.toLowerCase() === lower) ? lower : null;
}

// The only mutation this module performs is the corrections PATCH —
// identity fields belong to the ETL, and rows are never created or deleted
// here. `PendingMutation` captures everything the step-up confirm handler
// needs to replay the request with the credentials merged in.
type PendingMutation = {
  method: "PATCH";
  url: string;
  payload: Record<string, unknown>;
  title: string;
  description: string;
  confirmLabel: string;
  successMessage: string;
};

type CorrectionsForm = {
  active: boolean;
  complaintCount2y: string;
  safetyRating: "" | SafetyRating;
};

function moverToForm(mover: Mover): CorrectionsForm {
  const rating = mover.safetyRating && safetyKey(mover.safetyRating)
    ? (SAFETY_RATINGS.find((value) => value.toLowerCase() === mover.safetyRating!.toLowerCase()) as SafetyRating)
    : "";
  return {
    active: mover.active,
    complaintCount2y: String(mover.complaintCount2y),
    safetyRating: rating || "",
  };
}

function buildCorrectionsPayload(form: CorrectionsForm) {
  return {
    active: form.active,
    complaintCount2y: Number(form.complaintCount2y),
    safetyRating: form.safetyRating || null,
  };
}

function moverDisplayName(mover: Mover) {
  return mover.dbaName || mover.legalName;
}

export default function MoversClient() {
  const t = useTranslations("movers");

  const [movers, setMovers] = useState<Mover[]>([]);
  const [freshness, setFreshness] = useState<Freshness | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters — search is debounced into `search` to avoid a request per key.
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filterState, setFilterState] = useState("");
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("");
  const [filterHhg, setFilterHhg] = useState<HhgFilter>("");

  // Corrections drawer state.
  const [editing, setEditing] = useState<Mover | null>(null);
  const [form, setForm] = useState<CorrectionsForm>({ active: true, complaintCount2y: "0", safetyRating: "" });

  // Step-up confirm modal state — `pendingMutation` drives the
  // PasswordConfirmModal; null means closed.
  const [pendingMutation, setPendingMutation] = useState<PendingMutation | null>(null);
  const [mutationBusy, setMutationBusy] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [mutationRequiresMfa, setMutationRequiresMfa] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterState) params.set("state", filterState);
      if (filterStatus) params.set("status", filterStatus);
      if (filterHhg) params.set("hhg", filterHhg);
      params.set("page", String(page));
      params.set("perPage", String(PAGE_SIZE));
      const response = await fetch(`/api/movers?${params.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t("toast.loadFailed"));
      setMovers(data.movers || []);
      setTotal(data.total ?? (data.movers?.length || 0));
      // Freshness degrades gracefully — the API returns null if the
      // aggregates fail, and the strip simply doesn't render.
      setFreshness(data.freshness ?? null);
    } catch (error: any) {
      toast.error(error?.message || t("toast.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [search, filterState, filterStatus, filterHhg, page, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, filterState, filterStatus, filterHhg]);

  function update<K extends keyof CorrectionsForm>(key: K, value: CorrectionsForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function startEdit(mover: Mover) {
    setEditing(mover);
    setForm(moverToForm(mover));
  }

  function closeDrawer() {
    setEditing(null);
  }

  function openMutation(mutation: PendingMutation) {
    setMutationError(null);
    setMutationRequiresMfa(false);
    setPendingMutation(mutation);
  }

  function closeMutation() {
    if (mutationBusy) return;
    setPendingMutation(null);
    setMutationError(null);
    setMutationRequiresMfa(false);
  }

  function submitForm() {
    if (!editing) return;
    const count = Number(form.complaintCount2y);
    if (!Number.isInteger(count) || count < 0) {
      toast.error(t("drawer.invalidComplaints"));
      return;
    }
    openMutation({
      method: "PATCH",
      url: `/api/movers/${editing.id}`,
      payload: buildCorrectionsPayload(form),
      title: t("stepUp.saveTitle"),
      description: t("stepUp.saveDescription", { name: moverDisplayName(editing) }),
      confirmLabel: t("stepUp.saveConfirm"),
      successMessage: t("toast.updated"),
    });
  }

  function toggleActive(mover: Mover) {
    const next = !mover.active;
    openMutation({
      method: "PATCH",
      url: `/api/movers/${mover.id}`,
      payload: { active: next },
      title: next ? t("stepUp.activateTitle") : t("stepUp.deactivateTitle"),
      description: next
        ? t("stepUp.activateDescription", { name: moverDisplayName(mover) })
        : t("stepUp.deactivateDescription", { name: moverDisplayName(mover) }),
      confirmLabel: next ? t("stepUp.activateConfirm") : t("stepUp.deactivateConfirm"),
      successMessage: t("toast.updated"),
    });
  }

  // Replay the captured mutation with the step-up credentials merged into
  // the body. A 403 with `requiresPassword` keeps the modal open for the
  // operator to fix the password/MFA; other failures close it.
  async function confirmMutation(_password: string, stepUp: StepUpValues) {
    if (!pendingMutation) return;
    const mutation = pendingMutation;
    setMutationBusy(true);
    setMutationError(null);
    try {
      const response = await fetch(mutation.url, {
        method: mutation.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...mutation.payload, ...stepUp }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const requiresMfa = Boolean(data?.requiresMfa);
        const message = data.error || t("toast.actionFailed");
        setMutationError(message);
        setMutationRequiresMfa(requiresMfa);
        if (response.status !== 403 || !data?.requiresPassword) {
          toast.error(message);
          setPendingMutation(null);
        }
        return;
      }
      toast.success(mutation.successMessage);
      setPendingMutation(null);
      setMutationRequiresMfa(false);
      closeDrawer();
      await load();
    } catch (error: any) {
      setMutationError(error?.message || t("toast.actionFailed"));
      toast.error(error?.message || t("toast.actionFailed"));
    } finally {
      setMutationBusy(false);
    }
  }

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setFilterState("");
    setFilterStatus("");
    setFilterHhg("");
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(search || filterState || filterStatus || filterHhg);
  // The honest empty split: an empty CATALOG means "run the ETL"; an empty
  // FILTERED view means "loosen the filters". When freshness is degraded
  // we can only distinguish via the active filters.
  const catalogEmpty = freshness ? freshness.totalRows === 0 : !hasFilters && total === 0;

  const newestDataAsOf = freshness?.newestDataAsOf ? new Date(freshness.newestDataAsOf) : null;
  const snapshotStale = Boolean(
    newestDataAsOf && Date.now() - newestDataAsOf.getTime() > STALE_AFTER_MS,
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow={t("eyebrow")}
        title={`<em>${t("title")}</em>`}
        subtitle={t("subtitle")}
      />

      {/* ── Catalog freshness strip — honest last-import metadata derived
            from the rows themselves (max(dataAsOf) + counts). There is no
            ETL trigger here on purpose: the FMCSA census download is
            form-gated, so the script needs a locally-downloaded CSV. ── */}
      {freshness ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("freshness.totalRows")}
            </p>
            <p className="mt-1 font-mono text-xl tabular-nums text-foreground">
              {freshness.totalRows.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("freshness.activeRows")}
            </p>
            <p className="mt-1 font-mono text-xl tabular-nums text-foreground">
              {freshness.activeCount.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("freshness.newestDataAsOf")}
            </p>
            <p className="mt-1 flex items-center gap-2 text-sm text-foreground">
              <span className="font-mono tabular-nums">
                {newestDataAsOf ? newestDataAsOf.toLocaleDateString() : t("freshness.never")}
              </span>
              {snapshotStale ? (
                <span
                  className="inline-flex rounded-full bg-tone-honey-bg px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-tone-honey-fg"
                  title={t("freshness.staleHint")}
                >
                  {t("freshness.stale")}
                </span>
              ) : null}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("freshness.statesCovered")}
            </p>
            <p className="mt-1 font-mono text-xl tabular-nums text-foreground">
              {freshness.statesCovered.toLocaleString()}
            </p>
          </div>
        </div>
      ) : null}

      {/* ETL provenance note — how rows get here and why complaint counts
          start at 0. Always visible so the limits of the data are never
          a surprise. */}
      <div
        role="note"
        className="flex items-start gap-3 rounded-xl border border-tone-sky-br bg-tone-sky-bg px-4 py-3 text-sm text-foreground"
      >
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>{t("etlNote")}</p>
      </div>

      <AdminPanel
        title={t("table.title")}
        caption={t("table.caption")}
        dense
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t("filters.searchPlaceholder")}
                aria-label={t("filters.searchLabel")}
                className="rounded-lg border border-border bg-background py-1.5 pl-8 pr-2.5 text-xs text-foreground"
                autoComplete="off"
              />
            </div>
            <select
              value={filterState}
              onChange={(e) => setFilterState(e.target.value)}
              className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
              aria-label={t("filters.stateLabel")}
            >
              <option value="">{t("filters.allStates")}</option>
              {(freshness?.stateCounts || []).map((entry) => (
                <option key={entry.state} value={entry.state}>
                  {entry.state} ({entry.count})
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as StatusFilter)}
              className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
              aria-label={t("filters.statusLabel")}
            >
              <option value="">{t("filters.allStatuses")}</option>
              <option value="active">{t("status.active")}</option>
              <option value="inactive">{t("status.inactive")}</option>
            </select>
            <select
              value={filterHhg}
              onChange={(e) => setFilterHhg(e.target.value as HhgFilter)}
              className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
              aria-label={t("filters.hhgLabel")}
            >
              <option value="">{t("filters.allHhg")}</option>
              <option value="authorized">{t("filters.hhgAuthorized")}</option>
              <option value="none">{t("filters.hhgNotAuthorized")}</option>
            </select>
          </div>
        }
      >
        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("table.loading")}</p>
        ) : movers.length === 0 ? (
          catalogEmpty ? (
            <EmptyState
              icon={Boxes}
              title={t("empty.title")}
              description={t("empty.description")}
            />
          ) : (
            <EmptyState
              icon={Search}
              title={t("empty.filteredTitle")}
              description={t("empty.filteredDescription")}
              action={
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("empty.clearFilters")}
                </button>
              }
            />
          )
        ) : (
          <div className="overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="py-2 pr-4">{t("table.name")}</th>
                  <th scope="col" className="py-2 pr-4">{t("table.usdot")}</th>
                  <th scope="col" className="py-2 pr-4">{t("table.location")}</th>
                  <th scope="col" className="py-2 pr-4">{t("table.hhg")}</th>
                  <th scope="col" className="py-2 pr-4 text-right">{t("table.fleet")}</th>
                  <th scope="col" className="py-2 pr-4 text-right">{t("table.complaints")}</th>
                  <th scope="col" className="py-2 pr-4">{t("table.safety")}</th>
                  <th scope="col" className="py-2 pr-4">{t("table.dataAsOf")}</th>
                  <th scope="col" className="py-2 pr-4">{t("table.status")}</th>
                  <th scope="col" className="py-2 text-right">{t("table.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {movers.map((mover) => {
                  const ratingKey = mover.safetyRating ? safetyKey(mover.safetyRating) : null;
                  return (
                    <tr key={mover.id} className="border-b border-border/50">
                      <td className="py-2.5 pr-4">
                        <div className="font-medium text-foreground">{moverDisplayName(mover)}</div>
                        {mover.dbaName ? (
                          <div className="text-xs text-muted-foreground">{mover.legalName}</div>
                        ) : null}
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-xs tabular-nums text-muted-foreground">
                        {mover.usdotNumber}
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {mover.city ? `${mover.city}, ` : ""}
                        {mover.state}
                      </td>
                      <td className="py-2.5 pr-4">
                        {mover.hhgAuthorization ? (
                          <span className="inline-flex rounded-full bg-tone-sage-bg px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-tone-sage-fg">
                            {t("table.hhgYes")}
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            {t("table.hhgNo")}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-muted-foreground">
                        {mover.fleetSize ?? "—"}
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-foreground">
                        {mover.complaintCount2y.toLocaleString()}
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {mover.safetyRating
                          ? ratingKey
                            ? t(`safety.${ratingKey}`)
                            : mover.safetyRating
                          : "—"}
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-xs tabular-nums text-muted-foreground">
                        {new Date(mover.dataAsOf).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 pr-4">
                        <button
                          type="button"
                          onClick={() => toggleActive(mover)}
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                            mover.active
                              ? "bg-tone-sage-bg text-tone-sage-fg"
                              : "bg-muted text-muted-foreground"
                          }`}
                          title={mover.active ? t("table.deactivateHint") : t("table.activateHint")}
                        >
                          {mover.active ? t("status.active") : t("status.inactive")}
                        </button>
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => startEdit(mover)}
                          aria-label={t("table.edit")}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {total > PAGE_SIZE ? (
          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>{t("table.pageOf", { page, totalPages })}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label={t("table.previousPage")}
                className="rounded-lg border border-border p-1.5 hover:bg-accent disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label={t("table.nextPage")}
                className="rounded-lg border border-border p-1.5 hover:bg-accent disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : null}
      </AdminPanel>

      {/* ── Corrections drawer — registry snapshot read-only on top,
            the three correctable fields below. ─────────────────────── */}
      {editing ? (
        <div
          className="fixed inset-0 z-40 flex justify-end bg-foreground/30 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDrawer();
          }}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={t("drawer.title")}
            className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-border bg-card p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">{t("drawer.title")}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{t("drawer.subtitle")}</p>
              </div>
              <button
                type="button"
                aria-label={t("drawer.close")}
                onClick={closeDrawer}
                className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-5 rounded-xl border border-border bg-background/60 p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("drawer.registry")}
              </p>
              <dl className="mt-2 space-y-1.5 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{t("drawer.legalName")}</dt>
                  <dd className="text-right font-medium text-foreground">{editing.legalName}</dd>
                </div>
                {editing.dbaName ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{t("drawer.dbaName")}</dt>
                    <dd className="text-right text-foreground">{editing.dbaName}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{t("drawer.usdot")}</dt>
                  <dd className="text-right font-mono tabular-nums text-foreground">{editing.usdotNumber}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{t("drawer.location")}</dt>
                  <dd className="text-right text-foreground">
                    {editing.city ? `${editing.city}, ` : ""}
                    {editing.state}
                  </dd>
                </div>
                {editing.phone ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{t("drawer.phone")}</dt>
                    <dd className="text-right font-mono text-foreground">{editing.phone}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{t("drawer.fleetSize")}</dt>
                  <dd className="text-right font-mono tabular-nums text-foreground">{editing.fleetSize ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{t("drawer.hhgAuthorization")}</dt>
                  <dd className="text-right text-foreground">
                    {editing.hhgAuthorization ? t("table.hhgYes") : t("table.hhgNo")}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{t("drawer.dataAsOf")}</dt>
                  <dd className="text-right font-mono tabular-nums text-foreground">
                    {new Date(editing.dataAsOf).toLocaleDateString()}
                  </dd>
                </div>
              </dl>
            </div>

            <form
              className="mt-5 flex flex-1 flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                submitForm();
              }}
            >
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("drawer.corrections")}
              </p>

              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => update("active", e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                {t("drawer.active")}
              </label>
              <p className="-mt-2 text-[11px] text-muted-foreground">{t("drawer.activeHint")}</p>

              <div>
                <label htmlFor="mover-complaints" className="mb-1 block text-xs font-medium text-muted-foreground">
                  {t("drawer.complaintCount2y")}
                </label>
                <input
                  id="mover-complaints"
                  type="number"
                  min={0}
                  step={1}
                  value={form.complaintCount2y}
                  onChange={(e) => update("complaintCount2y", e.target.value)}
                  className={inputCls}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">{t("drawer.complaintHint")}</p>
              </div>

              <div>
                <label htmlFor="mover-safety" className="mb-1 block text-xs font-medium text-muted-foreground">
                  {t("drawer.safetyRating")}
                </label>
                <select
                  id="mover-safety"
                  value={form.safetyRating}
                  onChange={(e) => update("safetyRating", e.target.value as CorrectionsForm["safetyRating"])}
                  className={inputCls}
                >
                  <option value="">{t("drawer.safetyNone")}</option>
                  <option value="Satisfactory">{t("safety.satisfactory")}</option>
                  <option value="Conditional">{t("safety.conditional")}</option>
                  <option value="Unsatisfactory">{t("safety.unsatisfactory")}</option>
                </select>
              </div>

              <div className="mt-auto flex justify-end gap-2 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent"
                >
                  {t("drawer.cancel")}
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  {t("drawer.save")}
                </button>
              </div>
            </form>
          </aside>
        </div>
      ) : null}

      <PasswordConfirmModal
        open={Boolean(pendingMutation)}
        title={pendingMutation?.title || ""}
        description={pendingMutation?.description || ""}
        confirmLabel={pendingMutation?.confirmLabel}
        busy={mutationBusy}
        error={mutationError}
        requiresMfa={mutationRequiresMfa}
        onClose={closeMutation}
        onConfirm={confirmMutation}
      />
    </div>
  );
}
