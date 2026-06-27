"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Check, X, BadgeDollarSign } from "lucide-react";
import { PasswordConfirmModal, type StepUpValues } from "@/components/password-confirm-modal";

// Affiliate conversion reconciliation queue: advance commissions Move
// earns from provider networks through PENDING → APPROVED → PAID (or REJECTED).
// All mutations go through password+MFA step-up server-side.

interface Conversion {
  id: string;
  network: string;
  externalTransactionId: string;
  status: string;
  amountCents: number;
  currency: string;
  occurredAt: string | null;
  createdAt: string;
  providerName: string;
}

type Action = "APPROVED" | "REJECTED" | "PAID";

const fmtUsd = (cents: number, currency = "USD") =>
  `${currency === "USD" ? "$" : ""}${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function statusTone(status: string): string {
  switch (status) {
    case "APPROVED":
      return "bg-tone-sky-bg text-tone-sky-fg border-tone-sky-br";
    case "PAID":
      return "bg-tone-sage-bg text-tone-sage-fg border-tone-sage-br";
    case "REJECTED":
      return "bg-destructive/10 text-destructive border-destructive/30";
    default:
      return "bg-tone-honey-bg text-tone-honey-fg border-tone-honey-br";
  }
}

function statusDot(status: string): string {
  switch (status) {
    case "APPROVED":
      return "bg-tone-sky-fg";
    case "PAID":
      return "bg-tone-sage-fg";
    case "REJECTED":
      return "bg-destructive";
    default:
      return "bg-tone-honey-fg";
  }
}

export function AffiliateConversionsClient() {
  const [filter, setFilter] = useState<"OPEN" | "PENDING" | "APPROVED" | "PAID" | "REJECTED">("OPEN");
  const [rows, setRows] = useState<Conversion[]>([]);
  const [summary, setSummary] = useState<Record<string, { count: number; amountCents: number }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pending, setPending] = useState<{ id: string; action: Action } | null>(null);
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [requiresMfa, setRequiresMfa] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = filter === "OPEN" ? "" : `?status=${filter}`;
      const res = await fetch(`/api/affiliate/conversions${qs}`);
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "Failed to load conversions.");
      const data = await res.json();
      setRows(data.conversions ?? []);
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

  const submit = useCallback(
    async (_password: string, values: StepUpValues) => {
      if (!pending) return;
      setModalBusy(true);
      setModalError(null);
      try {
        const res = await fetch(`/api/affiliate/conversions/${pending.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: pending.action,
            confirmPassword: values.confirmPassword,
            mfaCode: values.mfaCode,
            backupCode: values.backupCode,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          if (data?.requiresMfa) setRequiresMfa(true);
          throw new Error(data?.error || "Failed to update.");
        }
        setPending(null);
        await load();
      } catch (err) {
        setModalError((err as Error).message);
      } finally {
        setModalBusy(false);
      }
    },
    [pending, load],
  );

  const start = (id: string, action: Action) => {
    setModalError(null);
    setRequiresMfa(false);
    setPending({ id, action });
  };

  const tabs: Array<typeof filter> = ["OPEN", "PENDING", "APPROVED", "PAID", "REJECTED"];

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BadgeDollarSign className="h-5 w-5 text-primary" />
          <h2 className="font-display text-base font-bold text-foreground">Conversion reconciliation</h2>
        </div>
        <button onClick={load} className="text-muted-foreground transition-colors hover:text-foreground" aria-label="Refresh">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {tabs.map((t) => {
          const active = filter === t;
          // Summary is computed globally (groupBy with no status filter), so the
          // OPEN tab can show its own count = the open lifecycle (PENDING + APPROVED).
          const s =
            t === "OPEN"
              ? { count: (summary.PENDING?.count ?? 0) + (summary.APPROVED?.count ?? 0), amountCents: 0 }
              : summary[t];
          return (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`rounded-xl border px-2.5 py-1 text-xs font-medium transition-colors ${active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"}`}
            >
              {t === "OPEN" ? "Open" : t.charAt(0) + t.slice(1).toLowerCase()}
              {s ? <span className="ml-1 font-mono opacity-70">{s.count}</span> : null}
            </button>
          );
        })}
      </div>

      {error && (
        <div role="alert" className="mb-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No conversions in this view.</p>
      ) : (
        <>
        <div className="hidden overflow-x-auto overscroll-x-contain sm:block">
          <table className="w-full md:min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <th className="px-2 py-2">Provider</th>
                <th className="px-2 py-2">Network</th>
                <th className="px-2 py-2">Amount</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-accent/30">
                  <td className="px-2 py-2 font-medium text-foreground">{c.providerName}</td>
                  <td className="px-2 py-2 text-muted-foreground">{c.network}</td>
                  <td className="px-2 py-2 font-mono font-medium text-foreground tabular-nums">{fmtUsd(c.amountCents, c.currency)}</td>
                  <td className="px-2 py-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusTone(c.status)}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${statusDot(c.status)}`} />
                      {c.status}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex justify-end gap-1.5">
                      {c.status === "PENDING" && (
                        <>
                          <button onClick={() => start(c.id, "APPROVED")} className="inline-flex items-center gap-1 rounded-md border border-sky-500/40 px-2 py-1 text-xs font-medium text-sky-600 hover:bg-sky-500/10">
                            <Check className="h-3 w-3" /> Approve
                          </button>
                          <button onClick={() => start(c.id, "REJECTED")} className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10">
                            <X className="h-3 w-3" /> Reject
                          </button>
                        </>
                      )}
                      {c.status === "APPROVED" && (
                        <>
                          <button onClick={() => start(c.id, "PAID")} className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 px-2 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-500/10">
                            <BadgeDollarSign className="h-3 w-3" /> Mark paid
                          </button>
                          <button onClick={() => start(c.id, "REJECTED")} className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10">
                            <X className="h-3 w-3" /> Reject
                          </button>
                        </>
                      )}
                      {(c.status === "PAID" || c.status === "REJECTED") && <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-2.5 sm:hidden">
          {rows.map((c) => (
            <div key={c.id} className="rounded-2xl border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{c.providerName}</p>
                  <p className="text-xs text-muted-foreground">{c.network}</p>
                </div>
                <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusTone(c.status)}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${statusDot(c.status)}`} />
                  {c.status}
                </span>
              </div>
              <p className="mt-2 font-mono text-sm font-medium tabular-nums text-foreground">{fmtUsd(c.amountCents, c.currency)}</p>
              {(c.status === "PENDING" || c.status === "APPROVED") && (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {c.status === "PENDING" && (
                    <>
                      <button onClick={() => start(c.id, "APPROVED")} className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-sky-500/40 px-3 py-2 text-xs font-medium text-sky-600 hover:bg-sky-500/10">
                        <Check className="h-3.5 w-3.5" /> Approve
                      </button>
                      <button onClick={() => start(c.id, "REJECTED")} className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-destructive/40 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10">
                        <X className="h-3.5 w-3.5" /> Reject
                      </button>
                    </>
                  )}
                  {c.status === "APPROVED" && (
                    <>
                      <button onClick={() => start(c.id, "PAID")} className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-emerald-500/40 px-3 py-2 text-xs font-medium text-emerald-600 hover:bg-emerald-500/10">
                        <BadgeDollarSign className="h-3.5 w-3.5" /> Mark paid
                      </button>
                      <button onClick={() => start(c.id, "REJECTED")} className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-destructive/40 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10">
                        <X className="h-3.5 w-3.5" /> Reject
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        </>
      )}

      <PasswordConfirmModal
        open={pending !== null}
        title={pending?.action === "PAID" ? "Mark conversion paid" : pending?.action === "REJECTED" ? "Reject conversion" : "Approve conversion"}
        description="This updates the affiliate revenue ledger. Confirm with your password and MFA."
        confirmLabel={pending?.action === "PAID" ? "Mark paid" : pending?.action === "REJECTED" ? "Reject" : "Approve"}
        busy={modalBusy}
        error={modalError}
        requiresMfa={requiresMfa}
        onClose={() => {
          if (!modalBusy) setPending(null);
        }}
        onConfirm={submit}
      />
    </section>
  );
}
