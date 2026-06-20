"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardCheck, Loader2, RefreshCw } from "lucide-react";
import { PasswordConfirmModal, type StepUpValues } from "@/components/password-confirm-modal";

interface PartnerRow {
  id: string;
  category: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  website: string | null;
  serviceStates: string;
  status: string;
  decisionMessage: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

type Decision = "APPROVED" | "REJECTED" | "NEEDS_INFO";
const STATUS_TABS = ["PENDING", "IN_REVIEW", "NEEDS_INFO", "APPROVED", "REJECTED", "ALL"] as const;

function tone(status: string): string {
  switch (status) {
    case "APPROVED": return "bg-emerald-500/10 text-emerald-600 border-emerald-500/30";
    case "REJECTED": return "bg-destructive/10 text-destructive border-destructive/30";
    case "NEEDS_INFO": return "bg-amber-500/10 text-amber-600 border-amber-500/30";
    case "IN_REVIEW": return "bg-sky-500/10 text-sky-600 border-sky-500/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

export default function PartnerApplicationsClient() {
  const [filter, setFilter] = useState<(typeof STATUS_TABS)[number]>("PENDING");
  const [rows, setRows] = useState<PartnerRow[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [decisionMessage, setDecisionMessage] = useState("");
  const [pending, setPending] = useState<Decision | null>(null);
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [requiresMfa, setRequiresMfa] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = filter === "ALL" ? "" : `?status=${filter}`;
      const res = await fetch(`/api/partners${qs}`);
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "Failed to load partners.");
      const data = await res.json();
      setRows(data.partners ?? []);
      setSummary(data.summary ?? {});
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const startDecision = (id: string, decision: Decision) => {
    setSelectedId(id);
    if ((decision === "REJECTED" || decision === "NEEDS_INFO") && !decisionMessage.trim()) {
      setError("Add a message for the applicant before rejecting or requesting info.");
      return;
    }
    setError(null);
    setModalError(null);
    setRequiresMfa(false);
    setPending(decision);
  };

  const submit = useCallback(
    async (_password: string, values: StepUpValues) => {
      if (!selectedId || !pending) return;
      setModalBusy(true);
      setModalError(null);
      try {
        const res = await fetch(`/api/partners/${selectedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision: pending,
            decisionMessage: decisionMessage.trim() || undefined,
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
        setSelectedId(null);
        setDecisionMessage("");
        await load();
      } catch (err) {
        setModalError((err as Error).message);
      } finally {
        setModalBusy(false);
      }
    },
    [selectedId, pending, decisionMessage, load],
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <ClipboardCheck className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold text-foreground">Partner Applications</h1>
        <button onClick={() => load()} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted">
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => {
          const active = filter === t;
          const count = t === "ALL" ? Object.values(summary).reduce((a, b) => a + b, 0) : summary[t] ?? 0;
          return (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
            >
              {t === "ALL" ? "All" : t} {count ? `(${count})` : ""}
            </button>
          );
        })}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {/* Shared message for the next reject / needs-info decision. */}
      <textarea
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        rows={2}
        placeholder="Message to the applicant (required to reject or request info)"
        value={decisionMessage}
        onChange={(e) => setDecisionMessage(e.target.value)}
        aria-label="Decision message"
      />

      {loading ? (
        <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No partner applications in this view.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2">Company</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Contact</th>
                <th className="px-3 py-2">States</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const open = p.status === "PENDING" || p.status === "IN_REVIEW" || p.status === "NEEDS_INFO";
                return (
                  <tr key={p.id} className="border-b border-border/50">
                    <td className="px-3 py-2 font-medium text-foreground">{p.companyName}</td>
                    <td className="px-3 py-2 text-muted-foreground">{p.category}</td>
                    <td className="px-3 py-2 text-muted-foreground">{p.contactEmail}</td>
                    <td className="px-3 py-2 text-muted-foreground">{p.serviceStates || "Nationwide"}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-md border px-1.5 py-0.5 text-[11px] ${tone(p.status)}`}>{p.status}</span>
                    </td>
                    <td className="px-3 py-2">
                      {open ? (
                        <div className="flex gap-1.5">
                          <button onClick={() => startDecision(p.id, "APPROVED")} className="rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:opacity-90">Approve</button>
                          <button onClick={() => startDecision(p.id, "NEEDS_INFO")} className="rounded-md bg-amber-500 px-2 py-1 text-[11px] font-semibold text-white hover:opacity-90">Info</button>
                          <button onClick={() => startDecision(p.id, "REJECTED")} className="rounded-md bg-destructive px-2 py-1 text-[11px] font-semibold text-white hover:opacity-90">Reject</button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <PasswordConfirmModal
        open={pending !== null}
        title={pending === "APPROVED" ? "Approve & list this partner" : pending === "REJECTED" ? "Reject application" : "Request more info"}
        description={
          pending === "APPROVED"
            ? "This lets the partner receive matching leads. Confirm with your password and MFA."
            : "Confirm with your password and MFA. The applicant will be emailed your message."
        }
        confirmLabel={pending === "APPROVED" ? "Approve" : pending === "REJECTED" ? "Reject" : "Request info"}
        busy={modalBusy}
        error={modalError}
        requiresMfa={requiresMfa}
        onClose={() => {
          if (!modalBusy) setPending(null);
        }}
        onConfirm={submit}
      />
    </div>
  );
}
