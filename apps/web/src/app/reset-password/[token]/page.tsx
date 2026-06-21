"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Loader2, AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { Wordmark } from "@/components/marketing/logo";
import { PasswordInput } from "@/components/ui/password-input";

export default function ResetPasswordPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = decodeURIComponent(params.token);
  const tAuth = useTranslations("auth");
  const tCommon = useTranslations("common");
  const tValidation = useTranslations("validation");
  const tToast = useTranslations("toast");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError(tValidation("passwordsDoNotMatch"));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/password/reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || tAuth("resetPassword_invalid"));
        setLoading(false);
        return;
      }
      setDone(true);
      setLoading(false);
      setTimeout(() => router.push("/sign-in"), 1500);
    } catch {
      setError(tToast("networkError"));
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6">
        <div className="w-full max-w-[420px] space-y-4 rounded-2xl border border-border bg-card p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <CheckCircle2 className="h-7 w-7 text-primary" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">{tAuth("resetPassword_success")}</h1>
          <p className="text-sm text-muted-foreground">{tAuth("resetPassword_successDescription")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.05fr_0.95fr]">
      {/* LEFT brand panel — hidden below lg (the design hides it on narrow screens). */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-card to-background p-12 lg:flex">
        <div aria-hidden className="pointer-events-none absolute -left-24 -top-40 h-[560px] w-[560px] rounded-full bg-primary/10 blur-3xl" />
        <div className="relative">
          <Wordmark href="/" animated={false} />
        </div>
        <div className="relative">
          <h1 className="max-w-[420px] font-display text-4xl font-extrabold leading-[1.1] text-foreground">
            {tAuth("resetPassword_title")}
          </h1>
          <p className="mt-4 max-w-[400px] text-base leading-relaxed text-muted-foreground">
            {tAuth("resetPassword_subtitle")}
          </p>
        </div>
        <div className="relative flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Secure access
        </div>
      </aside>

      {/* RIGHT form panel */}
      <main className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[380px] space-y-6">
          <div>
            <h2 className="font-display text-3xl font-bold text-foreground">{tAuth("resetPassword_title")}</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">{tAuth("resetPassword_subtitle")}</p>
          </div>

          {error && (
            <div className="flex gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="text-xs font-medium text-muted-foreground block mb-1">{tAuth("password")}</label>
              <PasswordInput
                id="password" required autoComplete="new-password" minLength={12}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder={tAuth("passwordPlaceholder")}
              />
            </div>
            <div>
              <label htmlFor="confirm" className="text-xs font-medium text-muted-foreground block mb-1">{tAuth("confirmPassword")}</label>
              <PasswordInput
                id="confirm" required autoComplete="new-password" minLength={12}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                value={confirm} onChange={(e) => setConfirm(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {tAuth("resetPassword_subtitle")}
              </p>
            </div>

            <button
              type="submit" disabled={loading || !password || !confirm}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary/90 px-4 py-2.5 text-sm font-semibold text-primary-foreground transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {tAuth("resetPassword_submit")}
            </button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            <Link href="/sign-in" className="font-semibold text-primary hover:underline">{tCommon("signIn")}</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
