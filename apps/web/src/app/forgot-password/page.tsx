"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";

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
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--surface)" }}>
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 space-y-4 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
          <h1 className="text-2xl font-bold text-white">{tAuth("forgotPassword_sent")}</h1>
          <p className="text-sm text-white/60">
            {tAuth("forgotPassword_sentDescription", { email })}
          </p>
          <Link
            href="/sign-in"
            className="inline-block rounded-xl border border-white/10 hover:bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition"
          >
            {tAuth("signInCta")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--surface)" }}>
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 space-y-6">
        <div className="text-center space-y-1.5">
          <h1 className="text-2xl font-bold text-white">{tAuth("forgotPassword_title")}</h1>
          <p className="text-sm text-white/50">{tAuth("forgotPassword_subtitle")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="text-xs font-medium text-white/60 block mb-1">{tAuth("email")}</label>
            <input
              id="email" type="email" required autoComplete="email"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder={tAuth("emailPlaceholder")}
            />
          </div>

          <button
            type="submit" disabled={loading || !email}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {tAuth("forgotPassword_submit")}
          </button>
        </form>

        <p className="text-center text-xs text-white/40">
          <Link href="/sign-in" className="text-orange-400 hover:underline">{tAuth("signInCta")}</Link>
        </p>
      </div>
    </div>
  );
}
