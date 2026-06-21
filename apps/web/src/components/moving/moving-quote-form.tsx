"use client";

import { useState } from "react";
import { Truck, Check, Loader2 } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

const HOME_SIZES: Array<[string, string]> = [
  ["STUDIO", "Studio"],
  ["ONE_BR", "1 bedroom"],
  ["TWO_BR", "2 bedrooms"],
  ["THREE_BR", "3 bedrooms"],
  ["FOUR_PLUS", "4+ bedrooms"],
  ["OTHER", "Other"],
];

const INPUT_CLASS =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none";

/**
 * "Get up to N moving quotes" lead-capture form (R3c). Posts to /api/leads
 * (auth + flag + consent enforced server-side), fires the `lead_submitted` funnel
 * event on success, and shows a confirmation. Rendered only behind
 * offers_moving_quotes_v1 (the parent gates it). Plain copy for v1 (i18n later),
 * matching the other flag-gated revenue surfaces.
 */
export function MovingQuoteForm({
  toState,
  toZip,
  fromState,
}: {
  toState?: string | null;
  toZip?: string | null;
  fromState?: string | null;
}) {
  const [form, setForm] = useState({
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    homeSize: "",
    moveDate: "",
    fromZip: "",
    toZip: toZip || "",
    consent: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ matchedCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

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
          toState: toState || undefined,
          fromState: fromState || undefined,
          toZip: form.toZip || undefined,
          fromZip: form.fromZip || undefined,
          moveDate: form.moveDate || undefined,
          homeSize: form.homeSize || undefined,
          contactName: form.contactName,
          contactEmail: form.contactEmail || undefined,
          contactPhone: form.contactPhone || undefined,
          source: "movers",
          consent: true,
        }),
      });
      if (!res.ok) {
        setError("Could not send your request. Please try again.");
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { matchedCount?: number };
      trackEvent("lead_submitted", { offer_key: "moving_quotes", category: "moving", surface: "movers" });
      setDone({ matchedCount: data.matchedCount ?? 0 });
    } catch {
      setError("Could not send your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="mt-4 rounded-xl border border-tone-emerald-br bg-tone-emerald-bg/30 p-4">
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4 text-tone-emerald-fg" />
          <p className="text-sm font-semibold text-foreground">Request sent</p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {done.matchedCount > 0
            ? `Up to ${done.matchedCount} licensed mover${done.matchedCount === 1 ? "" : "s"} will reach out with quotes.`
            : "We've captured your request and will match you with movers serving your route."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-4 rounded-xl border border-border bg-foreground/[0.02] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Truck className="h-4 w-4 text-tone-umber-fg" />
        <p className="text-sm font-semibold text-foreground">Get up to 4 moving quotes</p>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Tell us about your move and we&apos;ll share it with licensed movers serving your route. Free — you&apos;re never charged.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          className={INPUT_CLASS}
          placeholder="Your name"
          aria-label="Your name"
          value={form.contactName}
          onChange={(e) => set("contactName", e.target.value)}
          required
        />
        <input
          className={INPUT_CLASS}
          type="email"
          placeholder="Email"
          aria-label="Email"
          value={form.contactEmail}
          onChange={(e) => set("contactEmail", e.target.value)}
        />
        <input
          className={INPUT_CLASS}
          placeholder="Phone (optional)"
          aria-label="Phone"
          value={form.contactPhone}
          onChange={(e) => set("contactPhone", e.target.value)}
        />
        <input
          className={INPUT_CLASS}
          type="date"
          aria-label="Move date"
          value={form.moveDate}
          onChange={(e) => set("moveDate", e.target.value)}
        />
        <input
          className={INPUT_CLASS}
          placeholder="From ZIP"
          aria-label="From ZIP"
          value={form.fromZip}
          onChange={(e) => set("fromZip", e.target.value)}
        />
        <input
          className={INPUT_CLASS}
          placeholder="To ZIP"
          aria-label="To ZIP"
          value={form.toZip}
          onChange={(e) => set("toZip", e.target.value)}
        />
        <select
          className={`${INPUT_CLASS} sm:col-span-2`}
          aria-label="Home size"
          value={form.homeSize}
          onChange={(e) => set("homeSize", e.target.value)}
        >
          <option value="">Home size (optional)</option>
          {HOME_SIZES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-start gap-2 text-[11px] text-muted-foreground">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={form.consent}
          onChange={(e) => set("consent", e.target.checked)}
          aria-label="Consent to share my request with movers"
        />
        <span>
          I agree to share my request with matched movers so they can contact me with quotes. See our{" "}
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
