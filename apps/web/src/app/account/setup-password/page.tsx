"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { Wordmark } from "@/components/marketing/logo";
import { PasswordInput } from "@/components/ui/password-input";
import { normalizeAppRedirectPath } from "@/lib/safe-redirect";

function SetupPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = normalizeAppRedirectPath(searchParams.get("redirect"), "/onboarding");
  const tAuth = useTranslations("auth");
  const tCommon = useTranslations("common");
  const tToast = useTranslations("toast");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(tAuth("setupPasswordMismatch"));
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_password", newPassword: password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || tAuth("setupPasswordFailed"));
        setLoading(false);
        return;
      }

      router.replace(redirectTo);
      router.refresh();
    } catch {
      setError(tToast("networkError"));
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--surface)" }}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card/90 p-7 shadow-lg backdrop-blur-xl">
        <div className="space-y-4 text-center">
          <div className="flex justify-center">
            <Wordmark href="/" animated={false} />
          </div>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-tone-sage-br bg-tone-sage-bg text-tone-sage-fg">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{tAuth("setupPasswordTitle")}</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {tAuth("setupPasswordSubtitle")}
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-5 flex gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="newPassword" className="mb-1 block text-xs font-medium text-muted-foreground">
              {tAuth("password")}
            </label>
            <PasswordInput
              id="newPassword"
              required
              autoComplete="new-password"
              minLength={12}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={tAuth("passwordPlaceholder")}
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="mb-1 block text-xs font-medium text-muted-foreground">
              {tAuth("confirmPassword")}
            </label>
            <PasswordInput
              id="confirmPassword"
              required
              autoComplete="new-password"
              minLength={12}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder={tAuth("confirmPassword")}
            />
          </div>

          <p className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs leading-5 text-muted-foreground">
            {tAuth("setupPasswordHelper")}
          </p>

          <button
            type="submit"
            disabled={loading || !password || !confirmPassword}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {loading ? tCommon("saving") : tAuth("setupPasswordCta")}
          </button>
        </form>
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
