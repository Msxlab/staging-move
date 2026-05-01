"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Wordmark } from "@/components/marketing/logo";
import { trackEvent } from "@/lib/analytics";

interface OAuthProviderStatus {
  configured: boolean;
  label: string;
  message: string;
}

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [oauthProviders, setOauthProviders] = useState<Record<string, OAuthProviderStatus> | null>(null);
  const tAuth = useTranslations("auth");
  const tCommon = useTranslations("common");
  const tLegal = useTranslations("legal");
  const tToast = useTranslations("toast");
  const tLanding = useTranslations("landing");

  useEffect(() => {
    trackEvent("sign_up_started", { method: "email" });
  }, []);

  useEffect(() => {
    fetch("/api/auth/oauth/providers", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setOauthProviders(data.providers || null))
      .catch(() => setOauthProviders(null));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "legal-acceptance-required") {
      setError(tAuth("legalAcceptanceRequired"));
    }
  }, [tAuth]);

  const googleReady = oauthProviders?.google?.configured ?? true;
  const appleReady = oauthProviders?.apple?.configured ?? true;
  const googleUnavailable = oauthProviders?.google?.configured === false;
  const appleUnavailable = oauthProviders?.apple?.configured === false;
  const showOAuthReadinessNote =
    Boolean(oauthProviders) && (!googleReady || !appleReady);

  function startGoogleOAuth() {
    if (googleUnavailable) {
      setError(oauthProviders?.google?.message || tAuth("error_unavailable"));
      return;
    }
    trackEvent("sign_up_started", { method: "google" });
    window.location.href = "/api/auth/oauth/google?redirect=/onboarding";
  }

  function startAppleOAuth() {
    if (appleUnavailable) {
      setError(oauthProviders?.apple?.message || tAuth("error_unavailable"));
      return;
    }
    trackEvent("sign_up_started", { method: "apple" });
    window.location.href = "/api/auth/oauth/apple?redirect=/onboarding";
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || tAuth("error_generic"));
        setLoading(false);
        return;
      }
      trackEvent("sign_up_completed", { method: "email" });
      setDone(true);
      setLoading(false);
    } catch {
      setError(tToast("networkError"));
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--surface)" }}>
        <div className="w-full max-w-md rounded-2xl border border-border bg-card/85 p-8 shadow-lg backdrop-blur-xl space-y-4 text-center">
          <div className="flex justify-center">
            <Wordmark href="/" animated={false} />
          </div>
          <CheckCircle2 className="h-10 w-10 text-sage mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">{tAuth("checkEmail")}</h1>
          <p className="text-sm text-muted-foreground">
            {tAuth("checkEmailDescription", { email })}
          </p>
          <Link
            href="/sign-in"
            className="inline-block rounded-xl bg-primary hover:bg-primary/90 px-4 py-2.5 text-sm font-semibold text-primary-foreground transition"
          >
            {tAuth("signInCta")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--surface)" }}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card/85 p-8 shadow-lg backdrop-blur-xl space-y-6">
        <div className="space-y-3 text-center">
          <div className="flex justify-center">
            <Wordmark href="/" animated={false} />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold text-foreground">{tAuth("signUp_title")}</h1>
            <p className="text-sm text-muted-foreground">{tAuth("signUp_subtitle")} {tLanding("noCreditCard")}</p>
          </div>
        </div>

        {error && (
          <div className="flex gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-2">
          <button
            type="button"
            aria-disabled={googleUnavailable}
            disabled={googleUnavailable}
            onClick={startGoogleOAuth}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-input bg-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
          >
            <svg className="h-4 w-4" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6 8-11.3 8a12 12 0 1 1 0-24c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 1 0 24 44c11 0 20-8.1 20-20 0-1.2-.1-2.4-.4-3.5z"/>
              <path fill="#FF3D00" d="M6.3 14.1l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.1z"/>
              <path fill="#4CAF50" d="M24 44c5.3 0 10-2 13.6-5.3l-6.3-5.3A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3A12 12 0 0 1 31.3 33.4l6.3 5.3C37.2 39.8 44 34.7 44 24c0-1.2-.1-2.4-.4-3.5z"/>
            </svg>
            {googleReady ? tAuth("continueWithGoogle") : tAuth("googleUnavailable")}
          </button>
          <button
            type="button"
            aria-disabled={appleUnavailable}
            disabled={appleUnavailable}
            onClick={startAppleOAuth}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-transparent bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.05 12.53c-.02-2.56 2.09-3.79 2.18-3.85-1.19-1.74-3.04-1.97-3.7-2-1.58-.16-3.08.93-3.88.93-.81 0-2.05-.9-3.37-.88-1.73.03-3.33 1.01-4.22 2.56-1.8 3.12-.46 7.73 1.29 10.27.85 1.24 1.87 2.64 3.2 2.59 1.29-.05 1.78-.83 3.34-.83 1.56 0 2 .83 3.37.8 1.39-.02 2.28-1.27 3.13-2.52.98-1.45 1.39-2.85 1.42-2.92-.03-.02-2.72-1.04-2.74-4.15zM14.6 5.13c.71-.87 1.2-2.07 1.07-3.27-1.04.04-2.29.69-3.03 1.55-.66.76-1.24 1.99-1.09 3.15 1.16.09 2.35-.59 3.05-1.43z"/>
            </svg>
            {appleReady ? tAuth("continueWithApple") : tAuth("appleUnavailable")}
          </button>

          {showOAuthReadinessNote && (
            <div className="rounded-xl border border-tone-honey-br bg-tone-honey-bg px-3 py-2 text-xs text-foreground">
              {tAuth("oauthReadinessNote")}
            </div>
          )}

          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{tAuth("orContinueWith").replace(/.*\s/, "")}</span>
            <div className="flex-1 h-px bg-border" />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="firstName" className="text-xs font-medium text-muted-foreground block mb-1">{tAuth("firstName")}</label>
              <input
                id="firstName" type="text" autoComplete="given-name"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                value={firstName} onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="lastName" className="text-xs font-medium text-muted-foreground block mb-1">{tAuth("lastName")}</label>
              <input
                id="lastName" type="text" autoComplete="family-name"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                value={lastName} onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label htmlFor="email" className="text-xs font-medium text-muted-foreground block mb-1">{tAuth("email")}</label>
            <input
              id="email" type="email" required autoComplete="email"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="password" className="text-xs font-medium text-muted-foreground block mb-1">{tAuth("password")}</label>
            <input
              id="password" type="password" required autoComplete="new-password" minLength={12}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder={tAuth("passwordPlaceholder")}
            />
            <p className="text-[11px] text-muted-foreground mt-1.5">
              {tAuth("resetPassword_subtitle")}
            </p>
          </div>

          <p className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
            You will review and accept LocateFlow{" "}
            <Link href="/terms" className="underline hover:text-primary">Terms</Link>
            {" "}and{" "}
            <Link href="/disclaimer" className="underline hover:text-primary">Legal Disclaimer</Link>
            {" "}before using the app.
          </p>

          <button
            type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary/90 px-4 py-2.5 text-sm font-semibold text-primary-foreground transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {tAuth("signUpCta")}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          {tAuth("haveAccount")}{" "}
          <Link href="/sign-in" className="text-primary hover:underline">{tCommon("signIn")}</Link>
        </p>

        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
          <Link href="/terms" className="underline hover:text-primary">{tCommon("terms")}</Link>
          <Link href="/privacy" className="underline hover:text-primary">{tCommon("privacy")}</Link>
          <Link href="/disclaimer" className="underline hover:text-primary">{tLegal("disclaimer_title")}</Link>
          <Link href="/contact" className="underline hover:text-primary">{tCommon("contact")}</Link>
        </div>
      </div>
    </div>
  );
}
