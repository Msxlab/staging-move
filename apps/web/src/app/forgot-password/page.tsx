"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle2, KeyRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { Wordmark } from "@/components/marketing/logo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const tAuth = useTranslations("auth");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/auth/password/reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
    } catch {
      /* intentionally ignore — always show the generic success message */
    }
    setSubmitted(true);
    setLoading(false);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-4 rounded-[1.75rem] border border-border/70 bg-card/75 p-8 text-center shadow-lg backdrop-blur-xl">
          <div className="flex justify-center">
            <Wordmark href="/" animated={false} />
          </div>
          <CheckCircle2 className="h-10 w-10 text-sage mx-auto" />
          <h1 className="font-display text-2xl font-bold text-foreground">{tAuth("forgotPassword_sent")}</h1>
          <p className="text-sm text-muted-foreground">
            {tAuth("forgotPassword_sentDescription", { email })}
          </p>
          <Link
            href="/sign-in"
            className="inline-block rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-primary/10"
          >
            {tAuth("signInCta")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6 rounded-[1.75rem] border border-border/70 bg-card/75 p-8 shadow-lg backdrop-blur-xl">
        <div className="space-y-3 text-center">
          <div className="flex justify-center">
            <Wordmark href="/" animated={false} />
          </div>
          <div className="flex justify-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
              <KeyRound className="h-6 w-6" />
            </span>
          </div>
          <div className="space-y-1.5">
            <h1 className="font-display text-2xl font-bold text-foreground">{tAuth("forgotPassword_title")}</h1>
            <p className="text-sm text-muted-foreground">{tAuth("forgotPassword_subtitle")}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="text-xs font-medium text-muted-foreground block mb-1">{tAuth("email")}</label>
            <input
              id="email" type="email" required autoComplete="email"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder={tAuth("emailPlaceholder")}
            />
          </div>

          <button
            type="submit" disabled={loading || !email}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary/90 px-4 py-2.5 text-sm font-semibold text-primary-foreground transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {tAuth("forgotPassword_submit")}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          <Link href="/sign-in" className="text-primary hover:underline">{tAuth("signInCta")}</Link>
        </p>
      </div>
    </div>
  );
}
