"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle2, Megaphone } from "lucide-react";
import { US_STATES } from "@locateflow/shared";

const DURATIONS = [
  { days: 30, label: "30 days" },
  { days: 60, label: "60 days" },
  { days: 90, label: "90 days" },
];

/**
 * A mover requests a sponsored placement (state + duration). The request is
 * emailed to the Move team, who set it up via the admin tool — this is
 * the safe v2 path; a fully self-serve Stripe checkout is a planned follow-up.
 */
export function MoverPlacementRequest({ defaultState }: { defaultState: string }) {
  const states = [...US_STATES].sort((a, b) => a.label.localeCompare(b.label));
  const [stateScope, setStateScope] = useState(defaultState || states[0]?.value || "TX");
  const [durationDays, setDurationDays] = useState(30);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setError(null);
    try {
      const res = await fetch("/api/movers/portal/placements/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stateScope, durationDays, note }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Something went wrong. Please try again.");
      setStatus("sent");
    } catch (err) {
      setStatus("idle");
      setError((err as Error).message);
    }
  }

  if (status === "sent") {
    return (
      <div className="rounded-2xl border border-border bg-foreground/5 p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-tone-sage-fg" aria-hidden="true" />
        <h2 className="h2 mt-4 text-2xl text-foreground">Request received</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Thanks — our team will follow up with placement availability and pricing for your selected area.
        </p>
        <Link href="/movers/portal/dashboard" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const inputClass = "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div role="alert" className="rounded-xl border border-tone-rose-br bg-tone-rose-bg px-4 py-3 text-sm text-tone-rose-fg">
          {error}
        </div>
      )}
      <div>
        <label htmlFor="stateScope" className="mb-1.5 block text-sm font-medium text-foreground">Target state</label>
        <select id="stateScope" className={inputClass} value={stateScope} onChange={(e) => setStateScope(e.target.value)}>
          {states.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-muted-foreground">Your placement shows above the organic movers list for people moving in this state.</p>
      </div>
      <div>
        <label htmlFor="durationDays" className="mb-1.5 block text-sm font-medium text-foreground">Duration</label>
        <select id="durationDays" className={inputClass} value={durationDays} onChange={(e) => setDurationDays(Number(e.target.value))}>
          {DURATIONS.map((d) => (
            <option key={d.days} value={d.days}>{d.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="note" className="mb-1.5 block text-sm font-medium text-foreground">Anything else? (optional)</label>
        <textarea id="note" rows={3} className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
      </div>
      <button
        type="submit"
        disabled={status === "submitting"}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-tone-orange-fg px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60 sm:w-auto"
      >
        {status === "submitting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
        {status === "submitting" ? "Sending…" : "Request placement"}
      </button>
    </form>
  );
}
