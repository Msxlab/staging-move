"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";

const CATEGORIES: Array<[string, string]> = [
  ["cleaning", "Cleaning"],
  ["junk", "Junk removal"],
];

const INPUT =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none";

/**
 * Generic partner self-service application (R4b). Posts JSON to /api/partners
 * (flag + validation enforced server-side). Documents (license/COI) are uploaded
 * later via the partner portal; this captures company + contact + consent.
 */
export function PartnerApplyForm() {
  const [form, setForm] = useState({
    category: "cleaning",
    companyName: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    website: "",
    serviceStates: "",
    attestation: false,
    consent: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const canSubmit =
    form.attestation &&
    form.consent &&
    form.companyName.trim() &&
    form.contactName.trim() &&
    form.contactEmail.trim() &&
    !submitting;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: form.category,
          companyName: form.companyName,
          contactName: form.contactName,
          contactEmail: form.contactEmail,
          contactPhone: form.contactPhone || undefined,
          website: form.website || undefined,
          serviceStates: form.serviceStates || undefined,
          attestation: true,
          consent: true,
        }),
      });
      if (!res.ok) {
        setError("Could not submit your application. Please check your details and try again.");
        return;
      }
      setDone(true);
    } catch {
      setError("Could not submit your application. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-tone-emerald-br bg-tone-emerald-bg/30 p-8 text-center">
        <Check className="mx-auto h-6 w-6 text-tone-emerald-fg" />
        <h2 className="mt-2 text-xl font-bold text-foreground">Application received</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Thanks — our team will review your application and reach out by email. Submitting does not guarantee listing.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2 text-xs font-medium text-muted-foreground">
          Service
          <select className={`${INPUT} mt-1`} value={form.category} onChange={(e) => set("category", e.target.value)} aria-label="Service category">
            {CATEGORIES.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>
        <input className={INPUT} placeholder="Company name" aria-label="Company name" value={form.companyName} onChange={(e) => set("companyName", e.target.value)} required />
        <input className={INPUT} placeholder="Contact name" aria-label="Contact name" value={form.contactName} onChange={(e) => set("contactName", e.target.value)} required />
        <input className={INPUT} type="email" placeholder="Contact email" aria-label="Contact email" value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} required />
        <input className={INPUT} placeholder="Phone (optional)" aria-label="Phone" value={form.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} />
        <input className={INPUT} placeholder="Website (optional)" aria-label="Website" value={form.website} onChange={(e) => set("website", e.target.value)} />
        <input className={INPUT} placeholder="Service states e.g. TX,OK (blank = nationwide)" aria-label="Service states" value={form.serviceStates} onChange={(e) => set("serviceStates", e.target.value)} />
      </div>

      <label className="flex items-start gap-2 text-[12px] text-muted-foreground">
        <input type="checkbox" className="mt-0.5" checked={form.attestation} onChange={(e) => set("attestation", e.target.checked)} aria-label="Attestation" />
        <span>I confirm the information above is accurate and I&apos;m authorized to represent this business.</span>
      </label>
      <label className="flex items-start gap-2 text-[12px] text-muted-foreground">
        <input type="checkbox" className="mt-0.5" checked={form.consent} onChange={(e) => set("consent", e.target.checked)} aria-label="Consent to receive leads" />
        <span>
          I agree to receive customer leads and to handle their contact details per Move&apos;s{" "}
          <a href="/terms" className="underline hover:text-foreground">Terms</a> and{" "}
          <a href="/privacy" className="underline hover:text-foreground">Privacy Policy</a>.
        </span>
      </label>

      {error ? <p className="text-[12px] text-tone-rose-fg">{error}</p> : null}

      <button
        type="submit"
        disabled={!canSubmit}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Submit application
      </button>
    </form>
  );
}
