"use client";

import { useState } from "react";
import { Sparkles, Check, Loader2 } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

const CATEGORIES: Array<[string, string]> = [
  ["cleaning", "Cleaning"],
  ["junk", "Junk removal"],
];

const INPUT =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none";

/**
 * "Get quotes" lead form for single-location settle-in services (cleaning / junk),
 * R4e. Reuses the lead pipeline (POST /api/leads) with the selected category;
 * routing → approved Partners of that category (matchPartnersForLead). The service
 * location is prefilled from the new home. Rendered behind offers_cleaning_junk_v1.
 */
export function ServiceQuoteForm({
  toState,
  toZip,
}: {
  toState?: string | null;
  toZip?: string | null;
}) {
  const [form, setForm] = useState({
    category: "cleaning",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    date: "",
    toZip: toZip || "",
    consent: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ matchedCount: number; category: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const canSubmit = form.consent && form.contactName.trim().length > 0 && !submitting;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: form.category,
          toState: toState || undefined,
          toZip: form.toZip || undefined,
          moveDate: form.date || undefined,
          contactName: form.contactName,
          contactEmail: form.contactEmail || undefined,
          contactPhone: form.contactPhone || undefined,
          source: "moving_plan",
          consent: true,
        }),
      });
      if (!res.ok) {
        setError("Could not send your request. Please try again.");
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { matchedCount?: number };
      trackEvent("lead_submitted", { offer_key: form.category, category: form.category, surface: "moving_plan" });
      setDone({ matchedCount: data.matchedCount ?? 0, category: form.category });
    } catch {
      setError("Could not send your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    const label = done.category === "junk" ? "junk-removal" : "cleaning";
    return (
      <div className="mt-4 rounded-xl border border-tone-emerald-br bg-tone-emerald-bg/30 p-4">
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4 text-tone-emerald-fg" />
          <p className="text-sm font-semibold text-foreground">Request sent</p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {done.matchedCount > 0
            ? `Up to ${done.matchedCount} ${label} provider${done.matchedCount === 1 ? "" : "s"} will reach out.`
            : `We've captured your ${label} request and will match you with providers in your area.`}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-3 rounded-xl border border-border bg-foreground/[0.02] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold text-foreground">Get settle-in service quotes</p>
      </div>
      <p className="text-[11px] text-muted-foreground">
        We&apos;ll share your request with vetted local providers. Free — you&apos;re never charged.
      </p>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <select className={`${INPUT} sm:col-span-2`} value={form.category} onChange={(e) => set("category", e.target.value)} aria-label="Service">
          {CATEGORIES.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <input className={INPUT} placeholder="Your name" aria-label="Your name" value={form.contactName} onChange={(e) => set("contactName", e.target.value)} required />
        <input className={INPUT} type="email" placeholder="Email" aria-label="Email" value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} />
        <input className={INPUT} placeholder="Phone (optional)" aria-label="Phone" value={form.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} />
        <input className={INPUT} type="date" aria-label="Preferred date" value={form.date} onChange={(e) => set("date", e.target.value)} />
        <input className={INPUT} placeholder="Service ZIP" aria-label="Service ZIP" value={form.toZip} onChange={(e) => set("toZip", e.target.value)} />
      </div>

      <label className="flex items-start gap-2 text-[11px] text-muted-foreground">
        <input type="checkbox" className="mt-0.5" checked={form.consent} onChange={(e) => set("consent", e.target.checked)} aria-label="Consent to share my request" />
        <span>
          I agree to share my request with matched providers. See our{" "}
          <a href="/privacy" className="underline hover:text-foreground">Privacy Policy</a> and{" "}
          <a href="/terms" className="underline hover:text-foreground">Terms</a>.
        </span>
      </label>

      {error ? <p className="text-[11px] text-tone-rose-fg">{error}</p> : null}

      <button
        type="submit"
        disabled={!canSubmit}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Get quotes
      </button>
    </form>
  );
}
