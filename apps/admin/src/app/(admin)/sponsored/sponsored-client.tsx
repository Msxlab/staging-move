"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  BadgeDollarSign,
  ChevronLeft,
  ChevronRight,
  Megaphone,
  MousePointerClick,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminPanel } from "@/components/admin-panel";
import { EmptyState } from "@/components/empty-state";
import { PasswordConfirmModal, type StepUpValues } from "@/components/password-confirm-modal";

type Placement = {
  id: string;
  kind: "mover" | "provider";
  targetId: string;
  label: string;
  categoryScope: string | null;
  stateScope: string | null;
  startsAt: string;
  endsAt: string;
  active: boolean;
  impressions: number;
  clicks: number;
  createdAt?: string;
  updatedAt?: string;
  /** Hydrated display summary of the loose target ref; null when orphaned. */
  target: { name: string; detail: string; active: boolean } | null;
};

type TargetOption = {
  id: string;
  name: string;
  detail: string;
  eligible: boolean;
};

type StatusFilter = "" | "active" | "scheduled" | "expired" | "inactive";
type KindFilter = "" | "mover" | "provider";

const PAGE_SIZE = 50;

const inputCls =
  "w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

// Every placement mutation publishes/rewrites/retires paid public ad
// inventory, so each one is gated behind admin password + MFA step-up.
// `PendingMutation` captures everything the confirm handler needs to replay
// the request with the step-up credentials merged in.
type PendingMutation = {
  method: "POST" | "PATCH" | "DELETE";
  url: string;
  payload: Record<string, unknown>;
  title: string;
  description: string;
  confirmLabel: string;
  successMessage: string;
};

const emptyForm = {
  kind: "mover" as "mover" | "provider",
  targetId: "",
  targetName: "",
  label: "Sponsored",
  stateScope: "",
  categoryScope: "",
  startsAt: "",
  endsAt: "",
  active: false,
};

type PlacementForm = typeof emptyForm;

function formatDateTimeInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

function placementToForm(placement: Placement): PlacementForm {
  return {
    kind: placement.kind,
    targetId: placement.targetId,
    targetName: placement.target?.name || placement.targetId,
    label: placement.label || "Sponsored",
    stateScope: placement.stateScope || "",
    categoryScope: placement.categoryScope || "",
    startsAt: formatDateTimeInput(placement.startsAt),
    endsAt: formatDateTimeInput(placement.endsAt),
    active: placement.active,
  };
}

function buildPlacementPayload(form: PlacementForm) {
  return {
    kind: form.kind,
    targetId: form.targetId,
    label: form.label.trim(),
    stateScope: form.stateScope.trim() ? form.stateScope.trim().toUpperCase() : null,
    categoryScope: form.kind === "provider" && form.categoryScope.trim() ? form.categoryScope.trim() : null,
    startsAt: form.startsAt || null,
    endsAt: form.endsAt || null,
    active: form.active,
  };
}

type PlacementStatus = "live" | "scheduled" | "expired" | "inactive";

function placementStatus(placement: Placement, now: Date): PlacementStatus {
  if (!placement.active) return "inactive";
  if (new Date(placement.endsAt) < now) return "expired";
  if (new Date(placement.startsAt) > now) return "scheduled";
  return "live";
}

const STATUS_PILL_CLASS: Record<PlacementStatus, string> = {
  live: "bg-tone-sage-bg text-tone-sage-fg",
  scheduled: "bg-tone-honey-bg text-tone-honey-fg",
  expired: "bg-muted text-muted-foreground",
  inactive: "bg-muted text-muted-foreground",
};

// Dot colour for the status pill — mirrors the Move admin convention of a
// small filled dot ahead of the label (live=sage, scheduled=honey, the rest
// muted). Presentation only; status itself is computed from the placement.
const STATUS_DOT_CLASS: Record<PlacementStatus, string> = {
  live: "bg-tone-sage-fg",
  scheduled: "bg-tone-honey-fg",
  expired: "bg-muted-foreground",
  inactive: "bg-muted-foreground",
};

export default function SponsoredClient({
  sponsoredEnabled = null,
}: {
  /**
   * SPONSORED_ENABLED resolved server-side by page.tsx via the admin
   * runtime-config read path; null = the read failed (unknown), in which
   * case the banner omits the status line instead of guessing.
   */
  sponsoredEnabled?: boolean | null;
}) {
  const t = useTranslations("sponsored");

  const [placements, setPlacements] = useState<Placement[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("");
  const [filterKind, setFilterKind] = useState<KindFilter>("");

  // Create/edit drawer state.
  const [drawerMode, setDrawerMode] = useState<"hidden" | "create" | "edit">("hidden");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PlacementForm>(emptyForm);

  // Target picker state — debounced server search.
  const [targetQuery, setTargetQuery] = useState("");
  const [targetOptions, setTargetOptions] = useState<TargetOption[]>([]);
  const [targetSearching, setTargetSearching] = useState(false);
  const targetSearchSeq = useRef(0);

  // Step-up confirm modal state — `pendingMutation` drives the
  // PasswordConfirmModal; null means closed.
  const [pendingMutation, setPendingMutation] = useState<PendingMutation | null>(null);
  const [mutationBusy, setMutationBusy] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [mutationRequiresMfa, setMutationRequiresMfa] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (filterKind) params.set("kind", filterKind);
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      const response = await fetch(`/api/sponsored?${params.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t("toast.loadFailed"));
      setPlacements(data.placements || []);
      setTotal(data.total ?? (data.placements?.length || 0));
    } catch (error: any) {
      toast.error(error?.message || t("toast.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterKind, page, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [filterStatus, filterKind]);

  // Debounced target search against the admin API. A stale-response guard
  // (sequence counter) keeps fast typing from clobbering newer results.
  useEffect(() => {
    if (drawerMode === "hidden" || !targetQuery.trim()) {
      setTargetOptions([]);
      return;
    }
    const seq = ++targetSearchSeq.current;
    setTargetSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ targetSearch: targetQuery.trim(), kind: form.kind });
        const response = await fetch(`/api/sponsored?${params.toString()}`, { cache: "no-store" });
        const data = await response.json();
        if (seq !== targetSearchSeq.current) return;
        setTargetOptions(response.ok ? data.targets || [] : []);
      } catch {
        if (seq === targetSearchSeq.current) setTargetOptions([]);
      } finally {
        if (seq === targetSearchSeq.current) setTargetSearching(false);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [targetQuery, form.kind, drawerMode]);

  function update<K extends keyof PlacementForm>(key: K, value: PlacementForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setTargetQuery("");
    setTargetOptions([]);
    setDrawerMode("create");
  }

  function startEdit(placement: Placement) {
    setEditingId(placement.id);
    setForm(placementToForm(placement));
    setTargetQuery("");
    setTargetOptions([]);
    setDrawerMode("edit");
  }

  function closeDrawer() {
    setDrawerMode("hidden");
    setEditingId(null);
    setForm(emptyForm);
    setTargetQuery("");
    setTargetOptions([]);
  }

  function selectTarget(option: TargetOption) {
    if (!option.eligible) {
      toast.error(t("drawer.notEligible"));
      return;
    }
    setForm((current) => ({ ...current, targetId: option.id, targetName: option.name }));
    setTargetQuery("");
    setTargetOptions([]);
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
    if (!form.targetId) {
      toast.error(t("drawer.targetRequired"));
      return;
    }
    if (!form.startsAt || !form.endsAt) {
      toast.error(t("drawer.windowRequired"));
      return;
    }
    const isEditing = Boolean(editingId);
    openMutation({
      method: isEditing ? "PATCH" : "POST",
      url: isEditing ? `/api/sponsored/${editingId}` : "/api/sponsored",
      payload: buildPlacementPayload(form),
      title: isEditing ? t("stepUp.saveTitle") : t("stepUp.createTitle"),
      description: isEditing ? t("stepUp.saveDescription") : t("stepUp.createDescription"),
      confirmLabel: isEditing ? t("stepUp.saveConfirm") : t("stepUp.createConfirm"),
      successMessage: isEditing ? t("toast.updated") : t("toast.created"),
    });
  }

  function requestDelete(placement: Placement) {
    if (placement.impressions > 0 || placement.clicks > 0) {
      toast.error(t("toast.hasTraffic"));
      return;
    }
    openMutation({
      method: "DELETE",
      url: `/api/sponsored/${placement.id}`,
      payload: {},
      title: t("stepUp.deleteTitle"),
      description: t("stepUp.deleteDescription", {
        name: placement.target?.name || placement.targetId,
      }),
      confirmLabel: t("stepUp.deleteConfirm"),
      successMessage: t("toast.deleted"),
    });
  }

  function toggleActive(placement: Placement) {
    const next = !placement.active;
    openMutation({
      method: "PATCH",
      url: `/api/sponsored/${placement.id}`,
      payload: { active: next },
      title: next ? t("stepUp.activateTitle") : t("stepUp.deactivateTitle"),
      description: next
        ? t("stepUp.activateDescription", { name: placement.target?.name || placement.targetId })
        : t("stepUp.deactivateDescription", { name: placement.target?.name || placement.targetId }),
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
      if (mutation.method !== "DELETE") closeDrawer();
      await load();
    } catch (error: any) {
      setMutationError(error?.message || t("toast.actionFailed"));
      toast.error(error?.message || t("toast.actionFailed"));
    } finally {
      setMutationBusy(false);
    }
  }

  const now = useMemo(() => new Date(), [placements]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow={t("eyebrow")}
        title={`<em>${t("title")}</em>`}
        subtitle={t("subtitle")}
        actions={
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("newPlacement")}
          </button>
        }
      />

      {/* Policy banner — the non-negotiables every operator must see before
          touching ad inventory, plus the honest SPONSORED_ENABLED status so
          nobody publishes a placement believing it is live while the flag is
          off. The status line is omitted when the flag read failed. */}
      <div
        role="note"
        className="flex items-start gap-3 rounded-2xl border border-tone-honey-br bg-tone-honey-bg px-5 py-4 text-sm text-foreground"
      >
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="space-y-1.5">
          <p>{t("policyBanner")}</p>
          {sponsoredEnabled === null ? null : sponsoredEnabled ? (
            <p className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex rounded-full border border-tone-sage-br bg-tone-sage-bg px-2 py-0.5 font-medium text-tone-sage-fg">
                {t("flag.on")}
              </span>
              <span className="text-muted-foreground">{t("flag.onHint")}</span>
            </p>
          ) : (
            <p className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex rounded-full border border-tone-honey-br bg-background/70 px-2 py-0.5 font-medium text-tone-honey-fg">
                {t("flag.off")}
              </span>
              <span className="text-tone-honey-fg">{t("flag.offHint")}</span>
              <Link
                href="/runtime-config"
                className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
              >
                {t("flag.openRuntimeConfig")}
              </Link>
            </p>
          )}
        </div>
      </div>

      <AdminPanel
        title={t("table.title")}
        caption={t("table.caption")}
        dense
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as StatusFilter)}
              className="rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
              aria-label={t("filters.statusLabel")}
            >
              <option value="">{t("filters.allStatuses")}</option>
              <option value="active">{t("status.live")}</option>
              <option value="scheduled">{t("status.scheduled")}</option>
              <option value="expired">{t("status.expired")}</option>
              <option value="inactive">{t("status.inactive")}</option>
            </select>
            <select
              value={filterKind}
              onChange={(e) => setFilterKind(e.target.value as KindFilter)}
              className="rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
              aria-label={t("filters.kindLabel")}
            >
              <option value="">{t("filters.allKinds")}</option>
              <option value="mover">{t("kind.mover")}</option>
              <option value="provider">{t("kind.provider")}</option>
            </select>
          </div>
        }
      >
        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("table.loading")}</p>
        ) : placements.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title={t("empty.title")}
            description={t("empty.description")}
            action={
              <button
                type="button"
                onClick={startCreate}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                {t("newPlacement")}
              </button>
            }
          />
        ) : (
          <>
          <div className="hidden overflow-x-auto overscroll-x-contain sm:block">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  <th scope="col" className="py-2 pr-4">{t("table.target")}</th>
                  <th scope="col" className="py-2 pr-4">{t("table.kind")}</th>
                  <th scope="col" className="py-2 pr-4">{t("table.label")}</th>
                  <th scope="col" className="py-2 pr-4">{t("table.scope")}</th>
                  <th scope="col" className="py-2 pr-4">{t("table.window")}</th>
                  <th scope="col" className="py-2 pr-4">{t("table.status")}</th>
                  <th scope="col" className="py-2 pr-4 text-right">{t("table.impressions")}</th>
                  <th scope="col" className="py-2 pr-4 text-right">{t("table.clicks")}</th>
                  <th scope="col" className="py-2 text-right">{t("table.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {placements.map((placement) => {
                  const status = placementStatus(placement, now);
                  return (
                    <tr key={placement.id} className="border-b border-border/50">
                      <td className="py-2.5 pr-4">
                        <div className="font-medium text-foreground">
                          {placement.target?.name || (
                            <span className="text-destructive">{t("table.orphanTarget")}</span>
                          )}
                        </div>
                        {placement.target?.detail ? (
                          <div className="text-xs text-muted-foreground">{placement.target.detail}</div>
                        ) : null}
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{t(`kind.${placement.kind}`)}</td>
                      <td className="py-2.5 pr-4">
                        <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-foreground">
                          <BadgeDollarSign className="h-3 w-3" aria-hidden="true" />
                          {placement.label}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {placement.stateScope || t("table.allStates")}
                        {placement.categoryScope ? ` · ${placement.categoryScope}` : ""}
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-xs text-muted-foreground">
                        {new Date(placement.startsAt).toLocaleDateString()} → {new Date(placement.endsAt).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 pr-4">
                        <button
                          type="button"
                          onClick={() => toggleActive(placement)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${STATUS_PILL_CLASS[status]}`}
                          title={placement.active ? t("table.deactivateHint") : t("table.activateHint")}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_CLASS[status]}`} />
                          {t(`status.${status}`)}
                        </button>
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-foreground">
                        {placement.impressions.toLocaleString()}
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-foreground">
                        {placement.clicks.toLocaleString()}
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEdit(placement)}
                            aria-label={t("table.edit")}
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => requestDelete(placement)}
                            aria-label={t("table.delete")}
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="space-y-2.5 sm:hidden">
            {placements.map((placement) => {
              const status = placementStatus(placement, now);
              return (
                <div key={placement.id} className="rounded-2xl border border-border bg-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {placement.target?.name || <span className="text-destructive">{t("table.orphanTarget")}</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t(`kind.${placement.kind}`)}
                        {placement.target?.detail ? ` · ${placement.target.detail}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleActive(placement)}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${STATUS_PILL_CLASS[status]}`}
                      title={placement.active ? t("table.deactivateHint") : t("table.activateHint")}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_CLASS[status]}`} />
                      {t(`status.${status}`)}
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-foreground">
                      <BadgeDollarSign className="h-3 w-3" aria-hidden="true" /> {placement.label}
                    </span>
                    <span>
                      {placement.stateScope || t("table.allStates")}
                      {placement.categoryScope ? ` · ${placement.categoryScope}` : ""}
                    </span>
                  </div>
                  <div className="mt-1.5 font-mono text-xs text-muted-foreground">
                    {new Date(placement.startsAt).toLocaleDateString()} → {new Date(placement.endsAt).toLocaleDateString()}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex gap-3 font-mono text-xs tabular-nums text-muted-foreground">
                      <span>{placement.impressions.toLocaleString()}↑</span>
                      <span>{placement.clicks.toLocaleString()}↗</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => startEdit(placement)} aria-label={t("table.edit")} className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground">
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => requestDelete(placement)} aria-label={t("table.delete")} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          </>
        )}
        {total > PAGE_SIZE ? (
          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-mono">{t("table.pageOf", { page, totalPages })}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label={t("table.previousPage")}
                className="rounded-xl border border-border p-1.5 transition-colors hover:bg-accent disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label={t("table.nextPage")}
                className="rounded-xl border border-border p-1.5 transition-colors hover:bg-accent disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : null}
      </AdminPanel>

      {/* ── Create / edit drawer ─────────────────────────────────── */}
      {drawerMode !== "hidden" ? (
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
            aria-label={drawerMode === "edit" ? t("drawer.editTitle") : t("drawer.createTitle")}
            className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-border bg-card p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-bold text-foreground">
                  {drawerMode === "edit" ? t("drawer.editTitle") : t("drawer.createTitle")}
                </h2>
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

            <form
              className="mt-5 flex flex-1 flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                submitForm();
              }}
            >
              <div>
                <label htmlFor="sponsored-kind" className="mb-1 block text-xs font-medium text-muted-foreground">
                  {t("drawer.kind")}
                </label>
                <select
                  id="sponsored-kind"
                  value={form.kind}
                  onChange={(e) => {
                    const kind = e.target.value === "provider" ? "provider" : "mover";
                    // Changing the surface invalidates the picked target.
                    setForm((current) => ({ ...current, kind, targetId: "", targetName: "" }));
                    setTargetOptions([]);
                    setTargetQuery("");
                  }}
                  className={inputCls}
                >
                  <option value="mover">{t("kind.mover")}</option>
                  <option value="provider">{t("kind.provider")}</option>
                </select>
              </div>

              <div>
                <label htmlFor="sponsored-target" className="mb-1 block text-xs font-medium text-muted-foreground">
                  {t("drawer.target")}
                </label>
                {form.targetId ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-tone-sage-br bg-tone-sage-bg px-3 py-2 text-sm text-foreground">
                    <span className="truncate">{form.targetName || form.targetId}</span>
                    <button
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, targetId: "", targetName: "" }))}
                      aria-label={t("drawer.clearTarget")}
                      className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <input
                      id="sponsored-target"
                      type="text"
                      value={targetQuery}
                      onChange={(e) => setTargetQuery(e.target.value)}
                      placeholder={form.kind === "mover" ? t("drawer.moverSearchPlaceholder") : t("drawer.providerSearchPlaceholder")}
                      className={`${inputCls} pl-9`}
                      autoComplete="off"
                    />
                    {targetQuery.trim() ? (
                      <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-card py-1 shadow-lg">
                        {targetSearching ? (
                          <li className="px-3 py-2 text-xs text-muted-foreground">{t("drawer.searching")}</li>
                        ) : targetOptions.length === 0 ? (
                          <li className="px-3 py-2 text-xs text-muted-foreground">{t("drawer.noResults")}</li>
                        ) : (
                          targetOptions.map((option) => (
                            <li key={option.id}>
                              <button
                                type="button"
                                onClick={() => selectTarget(option)}
                                className={`w-full px-3 py-2 text-left text-sm hover:bg-accent ${option.eligible ? "text-foreground" : "cursor-not-allowed text-muted-foreground line-through"}`}
                              >
                                <span className="block truncate font-medium">{option.name}</span>
                                <span className="block truncate text-xs text-muted-foreground">
                                  {option.detail}
                                  {!option.eligible ? ` — ${t("drawer.notEligibleShort")}` : ""}
                                </span>
                              </button>
                            </li>
                          ))
                        )}
                      </ul>
                    ) : null}
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="sponsored-label" className="mb-1 block text-xs font-medium text-muted-foreground">
                  {t("drawer.label")}
                </label>
                <input
                  id="sponsored-label"
                  type="text"
                  value={form.label}
                  maxLength={60}
                  onChange={(e) => update("label", e.target.value)}
                  className={inputCls}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">{t("drawer.labelHint")}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="sponsored-state" className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t("drawer.stateScope")}
                  </label>
                  <input
                    id="sponsored-state"
                    type="text"
                    value={form.stateScope}
                    maxLength={2}
                    placeholder={t("drawer.stateScopePlaceholder")}
                    onChange={(e) => update("stateScope", e.target.value.toUpperCase())}
                    className={inputCls}
                  />
                </div>
                {form.kind === "provider" ? (
                  <div>
                    <label htmlFor="sponsored-category" className="mb-1 block text-xs font-medium text-muted-foreground">
                      {t("drawer.categoryScope")}
                    </label>
                    <input
                      id="sponsored-category"
                      type="text"
                      value={form.categoryScope}
                      maxLength={50}
                      placeholder={t("drawer.categoryScopePlaceholder")}
                      onChange={(e) => update("categoryScope", e.target.value)}
                      className={inputCls}
                    />
                  </div>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="sponsored-starts" className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t("drawer.startsAt")}
                  </label>
                  <input
                    id="sponsored-starts"
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={(e) => update("startsAt", e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="sponsored-ends" className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t("drawer.endsAt")}
                  </label>
                  <input
                    id="sponsored-ends"
                    type="datetime-local"
                    value={form.endsAt}
                    onChange={(e) => update("endsAt", e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

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

              <div className="mt-auto flex justify-end gap-2 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {t("drawer.cancel")}
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <MousePointerClick className="h-4 w-4" aria-hidden="true" />
                  {drawerMode === "edit" ? t("drawer.save") : t("drawer.create")}
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
