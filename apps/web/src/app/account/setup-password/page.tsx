"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Loader2, MailCheck, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { Wordmark } from "@/components/marketing/logo";
import { normalizeAppRedirectPath } from "@/lib/safe-redirect";

function SetupPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = normalizeAppRedirectPath(searchParams.get("redirect"), "/onboarding");
  const tAuth = useTranslations("auth");
  const tCommon = useTranslations("common");
  const tToast = useTranslations("toast");

  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestSetupLink() {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/auth/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request_set_password" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || tAuth("setupPasswordFailed"));
        setLoading(false);
        return;
      }

      setSent(true);
      setLoading(false);
    } catch {
      setError(tToast("networkError"));
      setLoading(false);
    }
  }

  function continueWithout() {
    router.replace(redirectTo);
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--surface)" }}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card/90 p-7 shadow-lg backdrop-blur-xl">
        <div className="space-y-4 text-center">
          <div className="flex justify-center">
            <Wordmark href="/" animated={false} />
          </div>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-tone-sage-br bg-tone-sage-bg text-tone-sage-fg">
            {sent ? <MailCheck className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {sent ? tAuth("setupPasswordSentTitle") : tAuth("setupPasswordTitle")}
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {sent ? tAuth("setupPasswordSentBody") : tAuth("setupPasswordSubtitle")}
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-5 flex gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={requestSetupLink}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailCheck className="h-4 w-4" />}
            {loading
              ? tCommon("saving")
              : sent
              ? tAuth("setupPasswordResend")
              : tAuth("setupPasswordCta")}
          </button>

          <button
            type="button"
            onClick={continueWithout}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-transparent px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted/40"
          >
            {tAuth("setupPasswordSkip")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SetupPasswordPage() {
  return (
    <Suspense fallback={null}>
      <SetupPasswordForm />
    </Suspense>
  );
}
