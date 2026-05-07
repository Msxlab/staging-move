"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
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
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--surface)" }}>
        <div className="w-full max-w-md rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl p-8 space-y-4 text-center">
          <CheckCircle2 className="h-10 w-10 text-tone-emerald-fg mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">{tAuth("resetPassword_success")}</h1>
          <p className="text-sm text-muted-foreground">{tAuth("resetPassword_successDescription")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--surface)" }}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl p-8 space-y-6">
        <div className="text-center space-y-1.5">
          <h1 className="text-2xl font-bold text-foreground">{tAuth("resetPassword_title")}</h1>
          <p className="text-sm text-muted-foreground">{tAuth("resetPassword_subtitle")}</p>
        </div>

        {error && (
          <div className="flex gap-2 rounded-xl border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="text-xs font-medium text-muted-foreground block mb-1">{tAuth("password")}</label>
            <PasswordInput
              id="password" required autoComplete="new-password" minLength={12}
              className="w-full rounded-xl border border-border bg-foreground/5 px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder={tAuth("passwordPlaceholder")}
            />
          </div>
          <div>
            <label htmlFor="confirm" className="text-xs font-medium text-muted-foreground block mb-1">{tAuth("confirmPassword")}</label>
            <PasswordInput
              id="confirm" required autoComplete="new-password" minLength={12}
              className="w-full rounded-xl border border-border bg-foreground/5 px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={confirm} onChange={(e) => setConfirm(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground mt-1.5">
              {tAuth("resetPassword_subtitle")}
            </p>
          </div>

          <button
            type="submit" disabled={loading || !password || !confirm}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-tone-orange-fg hover:bg-tone-orange-bg px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {tAuth("resetPassword_submit")}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          <Link href="/sign-in" className="text-tone-orange-fg hover:underline">{tCommon("signIn")}</Link>
        </p>
      </div>
    </div>
  );
}
