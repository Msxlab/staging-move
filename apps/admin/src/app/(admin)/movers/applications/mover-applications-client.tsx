"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ClipboardCheck,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  FileText,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  MOVER_APPLICATION_STATUSES,
  moverServiceLabels,
  moverStatusLabel,
  type MoverDecisionStatus,
} from "@locateflow/shared";
import { PasswordConfirmModal, type StepUpValues } from "@/components/password-confirm-modal";

// ── Contract types (mirror the API routes) ──────────────────────────────────
interface AppRow {
  id: string;
  companyLegalName: string;
  dbaName: string | null;
  usdotNumber: number;
  contactEmail: string;
  serviceStates: string;
  services: string;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
  linkedMovingCompanyId: string | null;
  documentCount: number;
}

interface AppDoc {
  id: string;
  kind: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  downloadUrl: string | null;
}

interface AppDetail extends AppRow {
  mcNumber: string | null;
  contactName: string;
  contactPhone: string | null;
  website: string | null;
  fleetSize: number | null;
  yearsInBusiness: number | null;
  fmcsaAuthorityActive: boolean | null;
  fmcsaHhgAuthorized: boolean | null;
  fmcsaSafetyRating: string | null;
  fmcsaCheckedAt: string | null;
  reviewNotes: string | null;
  decisionMessage: string | null;
  documents: AppDoc[];
}

interface FmcsaResult {
  status: string;
  authorityActive: boolean | null;
  hhgAuthorized: boolean | null;
  safetyRating: string | null;
  legalName: string | null;
}

const STATUS_TABS = ["ALL", ...MOVER_APPLICATION_STATUSES] as const;

function tone(status: string): string {
  switch (status) {
    case "APPROVED":
      return "bg-emerald-500/10 text-emerald-600 border-emerald-500/30";
    case "REJECTED":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "NEEDS_INFO":
      return "bg-amber-500/10 text-amber-600 border-amber-500/30";
    case "IN_REVIEW":
      return "bg-sky-500/10 text-sky-600 border-sky-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

// Status dot tint to pair with the dot-indicator pills, keyed off the same
// status string the pill uses so the dot and pill stay in sync.
function toneDot(status: string): string {
  switch (status) {
    case "APPROVED":
      return "bg-emerald-500";
    case "REJECTED":
      return "bg-destructive";
    case "NEEDS_INFO":
      return "bg-amber-500";
    case "IN_REVIEW":
      return "bg-sky-500";
    default:
      return "bg-muted-foreground";
  }
}

function yesNo(v: boolean | null): string {
  return v === true ? "Yes" : v === false ? "No" : "Unknown";
}

export default function MoverApplicationsClient() {
  const [filter, setFilter] = useState<(typeof STATUS_TABS)[number]>("PENDING");
  const [rows, setRows] = useState<AppRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [selected, setSelected] = useState<AppDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [fmcsa, setFmcsa] = useState<FmcsaResult | null>(null);
  const [fmcsaBusy, setFmcsaBusy] = useState(false);
  const [decisionMessage, setDecisionMessage] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");

  const [pending, setPending] = useState<MoverDecisionStatus | null>(null);
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [requiresMfa, setRequiresMfa] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const qs = filter === "ALL" ? "" : `?status=${filter}`;
      const res = await fetch(`/api/movers/applications${qs}`);
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "Failed to load applications.");
      const data = await res.json();
      setRows(data.applications ?? []);
      setCounts(data.statusCounts ?? {});
    } catch (err) {
      setListError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const openDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setFmcsa(null);
    setDecisionMessage("");
    setReviewNotes("");
    try {
      const res = await fetch(`/api/movers/applications/${id}`);
      if (!res.ok) throw new Error("Failed to load application.");
      const data = await res.json();
      setSelected(data.application as AppDetail);
      setReviewNotes((data.application?.reviewNotes as string) ?? "");
    } catch {
      setSelected(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const runFmcsa = useCallback(async () => {
    if (!selected) return;
    setFmcsaBusy(true);
    try {
      const res = await fetch(`/api/movers/applications/${selected.id}/fmcsa`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (data?.fmcsa) setFmcsa(data.fmcsa as FmcsaResult);
    } finally {
      setFmcsaBusy(false);
    }
  }, [selected]);

  const startDecision = useCallback(
    (decision: MoverDecisionStatus) => {
      if ((decision === "REJECTED" || decision === "NEEDS_INFO") && !decisionMessage.trim()) {
        setModalError(null);
        setListError("Add a message for the applicant before rejecting or requesting info.");
        return;
      }
      setListError(null);
      setModalError(null);
      setRequiresMfa(false);
      setPending(decision);
    },
    [decisionMessage],
  );

  const submitDecision = useCallback(
    async (_password: string, values: StepUpValues) => {
      if (!selected || !pending) return;
      setModalBusy(true);
      setModalError(null);
      try {
        const res = await fetch(`/api/movers/applications/${selected.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision: pending,
            decisionMessage: decisionMessage.trim() || undefined,
            reviewNotes: reviewNotes.trim() || undefined,
            confirmPassword: values.confirmPassword,
            mfaCode: values.mfaCode,
            backupCode: values.backupCode,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          if (data?.requiresMfa) setRequiresMfa(true);
          throw new Error(data?.error || "Failed to record the decision.");
        }
        setPending(null);
        setSelected(null);
        await loadList();
      } catch (err) {
        setModalError((err as Error).message);
      } finally {
        setModalBusy(false);
      }
    },
    [selected, pending, decisionMessage, reviewNotes, loadList],
  );

  const tabLabel = useMemo(
    () => (t: (typeof STATUS_TABS)[number]) => (t === "ALL" ? "All" : moverStatusLabel(t)),
    [],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/70 px-6 py-5 shadow-sm backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="mb-2 flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            <ClipboardCheck className="h-3.5 w-3.5" /> Verification queue
          </p>
          <h1 className="font-display text-2xl font-extrabold leading-none tracking-tight text-foreground md:text-[28px]">
            Mover Applications
          </h1>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Review carrier submissions and decide on directory listing.
          </p>
        </div>
        <button
          onClick={loadList}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => {
          const active = filter === t;
          const count = t === "ALL" ? Object.values(counts).reduce((a, b) => a + b, 0) : counts[t] ?? 0;
          return (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`flex items-center gap-2 rounded-xl border px-3.5 py-1.5 text-sm font-medium transition-colors ${active ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"}`}
            >
              {tabLabel(t)}
              <span className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {listError && (
        <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {listError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.3fr]">
        {/* List */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Queue</span>
            <button onClick={loadList} className="text-muted-foreground transition-colors hover:text-foreground" aria-label="Refresh">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">No applications in this view.</p>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((row) => (
                <li key={row.id}>
                  <button
                    onClick={() => openDetail(row.id)}
                    className={`flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors hover:bg-accent/50 ${selected?.id === row.id ? "bg-accent/40" : ""}`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{row.companyLegalName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        USDOT <span className="font-mono text-foreground">{row.usdotNumber}</span> · {row.serviceStates} · <span className="font-mono">{row.documentCount}</span> docs
                      </p>
                    </div>
                    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tone(row.status)}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${toneDot(row.status)}`} />
                      {moverStatusLabel(row.status)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Detail */}
        <div className="rounded-2xl border border-border bg-card p-6">
          {detailLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : !selected ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Select an application to review.</p>
          ) : (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-extrabold tracking-tight text-foreground">{selected.companyLegalName}</h2>
                  {selected.dbaName && <p className="text-sm text-muted-foreground">DBA: {selected.dbaName}</p>}
                </div>
                <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tone(selected.status)}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${toneDot(selected.status)}`} />
                  {moverStatusLabel(selected.status)}
                </span>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <Field label="USDOT" value={String(selected.usdotNumber)} />
                <Field label="MC #" value={selected.mcNumber ?? "—"} />
                <Field label="Contact" value={selected.contactName} />
                <Field label="Email" value={selected.contactEmail} />
                <Field label="Phone" value={selected.contactPhone ?? "—"} />
                <Field label="Website" value={selected.website ?? "—"} />
                <Field label="States" value={selected.serviceStates} />
                <Field label="Services" value={moverServiceLabels(selected.services).join(", ") || "—"} />
                <Field label="Fleet" value={selected.fleetSize != null ? String(selected.fleetSize) : "—"} />
                <Field label="Years" value={selected.yearsInBusiness != null ? String(selected.yearsInBusiness) : "—"} />
              </dl>

              {/* Documents */}
              <div>
                <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Documents</p>
                {selected.documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No documents uploaded.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {selected.documents.map((doc) => (
                      <li key={doc.id} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
                        <span className="flex min-w-0 items-center gap-2 text-sm text-foreground">
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="truncate">{doc.fileName}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">({doc.kind})</span>
                        </span>
                        {doc.downloadUrl ? (
                          <a href={doc.downloadUrl} download className="shrink-0 text-xs font-medium text-primary hover:underline">
                            Download
                          </a>
                        ) : (
                          <span className="shrink-0 text-xs text-muted-foreground">unavailable</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* FMCSA cross-check */}
              <div className="rounded-xl border border-border bg-background p-4">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">FMCSA cross-check</p>
                  <button
                    onClick={runFmcsa}
                    disabled={fmcsaBusy}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
                  >
                    {fmcsaBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                    Run check
                  </button>
                </div>
                {(fmcsa || selected.fmcsaCheckedAt) && (
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <FmcsaStat label="Authority" value={yesNo(fmcsa ? fmcsa.authorityActive : selected.fmcsaAuthorityActive)} />
                    <FmcsaStat label="HHG auth" value={yesNo(fmcsa ? fmcsa.hhgAuthorized : selected.fmcsaHhgAuthorized)} />
                    <FmcsaStat label="Safety" value={(fmcsa?.safetyRating ?? selected.fmcsaSafetyRating) || "—"} />
                  </div>
                )}
                {fmcsa && fmcsa.status !== "ok" && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {fmcsa.status === "not_configured"
                      ? "FMCSA web key not set — verify manually."
                      : fmcsa.status === "not_found"
                        ? "No carrier found for this USDOT."
                        : "FMCSA lookup unavailable — verify manually."}
                  </p>
                )}
              </div>

              {/* Decision */}
              {selected.status !== "APPROVED" && selected.status !== "REJECTED" && (
                <div className="space-y-3 border-t border-border pt-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="decisionMessage">
                      Message to applicant (required to reject / request info)
                    </label>
                    <textarea
                      id="decisionMessage"
                      rows={2}
                      value={decisionMessage}
                      onChange={(e) => setDecisionMessage(e.target.value)}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="reviewNotes">
                      Internal notes (never emailed)
                    </label>
                    <textarea
                      id="reviewNotes"
                      rows={2}
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => startDecision("APPROVED")} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700">
                      <ShieldCheck className="h-4 w-4" /> Approve & list
                    </button>
                    <button onClick={() => startDecision("NEEDS_INFO")} className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 px-3.5 py-2 text-sm font-medium text-amber-600 transition-colors hover:bg-amber-500/10">
                      <ShieldQuestion className="h-4 w-4" /> Request info
                    </button>
                    <button onClick={() => startDecision("REJECTED")} className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/40 px-3.5 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10">
                      <ShieldAlert className="h-4 w-4" /> Reject
                    </button>
                  </div>
                </div>
              )}
              {selected.decisionMessage && (
                <p className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
                  Last decision message: {selected.decisionMessage}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <PasswordConfirmModal
        open={pending !== null}
        title={
          pending === "APPROVED" ? "Approve & list this mover" : pending === "REJECTED" ? "Reject application" : "Request more info"
        }
        description={
          pending === "APPROVED"
            ? "This lists the mover in the public directory. Confirm with your password and MFA."
            : "Confirm with your password and MFA. The applicant will be emailed your message."
        }
        confirmLabel={pending === "APPROVED" ? "Approve" : pending === "REJECTED" ? "Reject" : "Request info"}
        busy={modalBusy}
        error={modalError}
        requiresMfa={requiresMfa}
        onClose={() => {
          if (!modalBusy) setPending(null);
        }}
        onConfirm={submitDecision}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-foreground">{value}</dd>
    </div>
  );
}

function FmcsaStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-2.5 py-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
