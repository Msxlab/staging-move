"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, AlertCircle, CheckCircle2, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { Wordmark } from "@/components/marketing/logo";
import { PasswordInput } from "@/components/ui/password-input";
import { trackEvent } from "@/lib/analytics";
import { normalizeAppRedirectPath } from "@/lib/safe-redirect";

interface OAuthProviderStatus {
  configured: boolean;
  label: string;
  message: string;
}

function SignUpForm() {
  const searchParams = useSearchParams();
  // Carry the post-signup destination THROUGH account creation so an invited
  // user who lands here from /invitations/<token> is returned to that landing
  // after verifying + signing in — where the existing email-matched Join button
  // consumes the invite exactly once. normalizeAppRedirectPath rejects anything
  // outside the app's allow-listed prefixes (and resolves to /dashboard
  // otherwise), so an attacker can't smuggle an off-site redirect through here.
  const rawRedirect = searchParams.get("redirect");
  const redirectTo = normalizeAppRedirectPath(rawRedirect);
  // We only treat it as an INVITE redirect when it actually points at an invite
  // landing — that's what flips the copy to "joining a household" framing and
  // forwards the context to sign-in instead of a generic onboarding handoff.
  const isInviteRedirect = useMemo(
    () => redirectTo.startsWith("/invitations/"),
    [redirectTo],
  );
  const oauthRedirect = isInviteRedirect ? redirectTo : "/onboarding";
  const signInHref = rawRedirect
    ? `/sign-in?redirect=${encodeURIComponent(redirectTo)}`
    : "/sign-in";

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
    window.location.href = `/api/auth/oauth/google?redirect=${encodeURIComponent(oauthRedirect)}`;
  }

  function startAppleOAuth() {
    if (appleUnavailable) {
      setError(oauthProviders?.apple?.message || tAuth("error_unavailable"));
      return;
    }
    trackEvent("sign_up_started", { method: "apple" });
    window.location.href = `/api/auth/oauth/apple?redirect=${encodeURIComponent(oauthRedirect)}`;
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
          {isInviteRedirect && (
            <p className="text-xs text-muted-foreground">
              {tAuth("inviteAfterVerify")}
            </p>
          )}
          <Link
            href={signInHref}
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

        {isInviteRedirect && (
          <div className="flex gap-2 rounded-xl border border-tone-orange-br bg-tone-orange-bg px-3 py-2.5 text-sm text-tone-orange-fg">
            <Users className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{tAuth("inviteSignUpContext")}</span>
          </div>
        )}

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
            className="group relative flex min-h-12 w-full items-center justify-center gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-950 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_24px_-12px_rgba(15,23,42,0.25)] transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-[0_2px_4px_rgba(15,23,42,0.1),0_12px_28px_-12px_rgba(15,23,42,0.3)] active:translate-y-0 active:shadow-[0_1px_2px_rgba(15,23,42,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-100 disabled:hover:translate-y-0 dark:border-white/15 dark:bg-white dark:text-slate-950 dark:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_8px_24px_-8px_rgba(0,0,0,0.5)] dark:hover:bg-slate-50 dark:hover:shadow-[0_2px_4px_rgba(0,0,0,0.4),0_16px_32px_-8px_rgba(0,0,0,0.6)]"
          >
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6 8-11.3 8a12 12 0 1 1 0-24c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 1 0 24 44c11 0 20-8.1 20-20 0-1.2-.1-2.4-.4-3.5z"/>
              <path fill="#FF3D00" d="M6.3 14.1l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.1z"/>
              <path fill="#4CAF50" d="M24 44c5.3 0 10-2 13.6-5.3l-6.3-5.3A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3A12 12 0 0 1 31.3 33.4l6.3 5.3C37.2 39.8 44 34.7 44 24c0-1.2-.1-2.4-.4-3.5z"/>
            </svg>
            <span>{googleReady ? tAuth("continueWithGoogle") : tAuth("googleUnavailable")}</span>
          </button>
          <button
            type="button"
            aria-disabled={appleUnavailable}
            disabled={appleUnavailable}
            onClick={startAppleOAuth}
            className="group relative flex min-h-12 w-full items-center justify-center gap-3 overflow-hidden rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-950 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_24px_-12px_rgba(15,23,42,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-400 hover:bg-slate-50 hover:shadow-[0_2px_4px_rgba(15,23,42,0.1),0_12px_28px_-12px_rgba(15,23,42,0.3)] active:translate-y-0 active:shadow-[0_1px_2px_rgba(15,23,42,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 disabled:opacity-100 disabled:shadow-none disabled:hover:translate-y-0 dark:border-white/15 dark:bg-white dark:text-slate-950 dark:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_8px_24px_-8px_rgba(0,0,0,0.5)] dark:hover:bg-slate-50 dark:hover:shadow-[0_2px_4px_rgba(0,0,0,0.4),0_16px_32px_-8px_rgba(0,0,0,0.6)] dark:disabled:bg-slate-100 dark:disabled:text-slate-500"
          >
            <svg className="h-5 w-5 shrink-0 -translate-y-px" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.05 12.53c-.02-2.56 2.09-3.79 2.18-3.85-1.19-1.74-3.04-1.97-3.7-2-1.58-.16-3.08.93-3.88.93-.81 0-2.05-.9-3.37-.88-1.73.03-3.33 1.01-4.22 2.56-1.8 3.12-.46 7.73 1.29 10.27.85 1.24 1.87 2.64 3.2 2.59 1.29-.05 1.78-.83 3.34-.83 1.56 0 2 .83 3.37.8 1.39-.02 2.28-1.27 3.13-2.52.98-1.45 1.39-2.85 1.42-2.92-.03-.02-2.72-1.04-2.74-4.15zM14.6 5.13c.71-.87 1.2-2.07 1.07-3.27-1.04.04-2.29.69-3.03 1.55-.66.76-1.24 1.99-1.09 3.15 1.16.09 2.35-.59 3.05-1.43z"/>
            </svg>
            <span>{appleReady ? tAuth("continueWithApple") : tAuth("appleUnavailable")}</span>
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
            <PasswordInput
              id="password" required autoComplete="new-password" minLength={12}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder={tAuth("passwordPlaceholder")}
            />
            <p className="text-[11px] text-muted-foreground mt-1.5">
              {tAuth("resetPassword_subtitle")}
            </p>
          </div>

          <p className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
            {tAuth("signUpLegalReviewNotice")}
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
          <Link href={signInHref} className="text-primary hover:underline">{tCommon("signIn")}</Link>
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

export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <SignUpForm />
    </Suspense>
  );
}
