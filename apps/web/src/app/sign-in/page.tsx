"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  "google-not-configured": "Google sign-in is not available right now.",
  "apple-not-configured": "Apple sign-in is not available right now.",
  "missing-code": "Sign-in was cancelled.",
  "state-mismatch": "Sign-in session expired. Please try again.",
  "token-exchange-failed": "We couldn't finish the sign-in. Please try again.",
  "invalid-token": "The identity provider returned an invalid token.",
  "email-unverified": "Your Google account must have a verified email.",
  "apple-no-email": "Apple did not share your email. Try a different sign-in method.",
  "apple-bad-body": "Apple sign-in response was malformed. Please try again.",
  "apple-missing-fields": "Apple sign-in is missing required fields.",
};

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";
  const oauthErrorKey = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    oauthErrorKey ? OAUTH_ERROR_MESSAGES[oauthErrorKey] || "Sign-in failed. Please try again." : null,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          ...(requiresMfa && mfaCode ? { mfaCode } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 403 && data.requiresMfa) {
        setRequiresMfa(true);
        setError(null);
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError(data.error || "Sign-in failed.");
        setLoading(false);
        return;
      }

      router.replace(redirectTo);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--surface)" }}>
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 space-y-6">
        <div className="text-center space-y-1.5">
          <h1 className="text-2xl font-bold text-white">Sign in</h1>
          <p className="text-sm text-white/50">Welcome back to LocateFlow</p>
        </div>

        {error && (
          <div className="flex gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!requiresMfa && (
          <div className="space-y-2">
            <a
              href={`/api/auth/oauth/google?redirect=${encodeURIComponent(redirectTo)}`}
              className="flex items-center justify-center gap-3 w-full rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition"
            >
              {/* Google G logo */}
              <svg className="h-4 w-4" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6 8-11.3 8a12 12 0 1 1 0-24c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 1 0 24 44c11 0 20-8.1 20-20 0-1.2-.1-2.4-.4-3.5z"/>
                <path fill="#FF3D00" d="M6.3 14.1l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.1z"/>
                <path fill="#4CAF50" d="M24 44c5.3 0 10-2 13.6-5.3l-6.3-5.3A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44z"/>
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3A12 12 0 0 1 31.3 33.4l6.3 5.3C37.2 39.8 44 34.7 44 24c0-1.2-.1-2.4-.4-3.5z"/>
              </svg>
              Continue with Google
            </a>
            <a
              href={`/api/auth/oauth/apple?redirect=${encodeURIComponent(redirectTo)}`}
              className="flex items-center justify-center gap-3 w-full rounded-xl border border-white/10 bg-black hover:bg-black/80 px-4 py-2.5 text-sm font-medium text-white transition"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.05 12.53c-.02-2.56 2.09-3.79 2.18-3.85-1.19-1.74-3.04-1.97-3.7-2-1.58-.16-3.08.93-3.88.93-.81 0-2.05-.9-3.37-.88-1.73.03-3.33 1.01-4.22 2.56-1.8 3.12-.46 7.73 1.29 10.27.85 1.24 1.87 2.64 3.2 2.59 1.29-.05 1.78-.83 3.34-.83 1.56 0 2 .83 3.37.8 1.39-.02 2.28-1.27 3.13-2.52.98-1.45 1.39-2.85 1.42-2.92-.03-.02-2.72-1.04-2.74-4.15zM14.6 5.13c.71-.87 1.2-2.07 1.07-3.27-1.04.04-2.29.69-3.03 1.55-.66.76-1.24 1.99-1.09 3.15 1.16.09 2.35-.59 3.05-1.43z"/>
              </svg>
              Continue with Apple
            </a>

            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-[11px] uppercase tracking-wider text-white/30">or</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!requiresMfa && (
            <>
              <div>
                <label htmlFor="email" className="text-xs font-medium text-white/60 block mb-1">Email</label>
                <input
                  id="email" type="email" required autoComplete="email"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="password" className="text-xs font-medium text-white/60">Password</label>
                  <Link href="/forgot-password" className="text-xs text-orange-400 hover:underline">Forgot?</Link>
                </div>
                <input
                  id="password" type="password" required autoComplete="current-password"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </>
          )}

          {requiresMfa && (
            <div>
              <label htmlFor="mfaCode" className="text-xs font-medium text-white/60 block mb-1">
                Authenticator code
              </label>
              <input
                id="mfaCode" type="text" inputMode="numeric" maxLength={6} required autoComplete="one-time-code"
                placeholder="123456"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/50 font-mono text-center tracking-[0.4em]"
                value={mfaCode} onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                autoFocus
              />
              <p className="text-[11px] text-white/40 mt-1.5">
                Open your authenticator app and enter the 6-digit code.
              </p>
            </div>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {requiresMfa ? "Verify" : "Sign in"}
          </button>
        </form>

        {!requiresMfa && (
          <p className="text-center text-xs text-white/40">
            Don't have an account?{" "}
            <Link href="/sign-up" className="text-orange-400 hover:underline">Create one</Link>
          </p>
        )}
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}
