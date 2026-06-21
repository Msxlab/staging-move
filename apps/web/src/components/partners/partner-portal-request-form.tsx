"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * Magic-link request form for the partner portal (R4d). Posts an email; the
 * server answers generically (never reveals whether the email matches a partner).
 */
export function PartnerPortalRequestForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !email.trim()) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/partners/portal/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      setMessage(data.message || "If that email is on file for an approved partner, we've sent a sign-in link.");
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-border bg-card p-6">
      <p className="text-sm text-muted-foreground">
        Enter the email on your partner application and we&apos;ll send a sign-in link.
      </p>
      <input
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
        type="email"
        placeholder="you@company.com"
        aria-label="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      {message ? <p className="text-[12px] text-muted-foreground">{message}</p> : null}
      <button
        type="submit"
        disabled={submitting || !email.trim()}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Send sign-in link
      </button>
    </form>
  );
}
