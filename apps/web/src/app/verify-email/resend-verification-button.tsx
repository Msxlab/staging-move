"use client";

import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";

export function ResendVerificationButton() {
  const tAuth = useTranslations("auth");
  const tToast = useTranslations("toast");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resend() {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(tAuth("verificationResendFailed"));
        return;
      }
      setMessage(
        data.alreadyVerified
          ? tAuth("verificationAlreadyVerified")
          : tAuth("verificationSent"),
      );
    } catch {
      setError(tToast("networkError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={resend}
        disabled={busy}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-input bg-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        {tAuth("resendVerification")}
      </button>
      {message && <p className="text-xs text-primary">{message}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
