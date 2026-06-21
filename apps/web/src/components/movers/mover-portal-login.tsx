"use client";

import { useState } from "react";
import { Loader2, MailCheck } from "lucide-react";

/**
 * Mover portal sign-in: an approved mover enters its contact email and we email
 * a magic link. The response is intentionally generic (no account enumeration),
 * so on success we always show the same "check your email" state.
 */
export function MoverPortalLogin({ invalidLink }: { invalidLink?: boolean }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent">("idle");
  const [error, setError] = useState<string | null>(invalidLink ? "That link is invalid or has expired. Request a new one." : null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setError(null);
    try {
      const res = await fetch("/api/movers/portal/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok && res.status === 429) throw new Error("Too many requests. Try again shortly.");
      setStatus("sent");
    } catch (err) {
      setStatus("idle");
      setError((err as Error).message);
    }
  }

  if (status === "sent") {
    return (
      <div className="rounded-2xl border border-border bg-foreground/5 p-8 text-center">
        <MailCheck className="mx-auto h-10 w-10 text-tone-sage-fg" aria-hidden="true" />
        <h2 className="h2 mt-4 text-2xl text-foreground">Check your email</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          If <span className="font-medium text-foreground">{email}</span> is on file for an approved mover, we&apos;ve
          sent a sign-in link. It expires in 24 hours.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && (
        <div role="alert" className="rounded-xl border border-tone-rose-br bg-tone-rose-bg px-4 py-3 text-sm text-tone-rose-fg">
          {error}
        </div>
      )}
      <div>
        <label htmlFor="portal-email" className="mb-1.5 block text-sm font-medium text-foreground">
          Contact email
        </label>
        <input
          id="portal-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@yourcompany.com"
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">Use the email you applied with. We&apos;ll email you a secure sign-in link.</p>
      </div>
      <button
        type="submit"
        disabled={status === "submitting"}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
      >
        {status === "submitting" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {status === "submitting" ? "Sending…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
