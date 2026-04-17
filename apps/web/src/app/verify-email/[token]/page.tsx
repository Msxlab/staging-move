"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

export default function VerifyEmailPage() {
  const params = useParams<{ token: string }>();
  const token = decodeURIComponent(params.token);

  const [state, setState] = useState<"verifying" | "ok" | "error">("verifying");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok) setState("ok");
        else { setError(data.error || "Verification failed."); setState("error"); }
      } catch {
        if (!cancelled) { setError("Network error."); setState("error"); }
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--surface)" }}>
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 space-y-4 text-center">
        {state === "verifying" && (
          <>
            <Loader2 className="h-10 w-10 text-orange-400 mx-auto animate-spin" />
            <h1 className="text-2xl font-bold text-white">Verifying…</h1>
            <p className="text-sm text-white/60">Confirming your email.</p>
          </>
        )}
        {state === "ok" && (
          <>
            <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
            <h1 className="text-2xl font-bold text-white">Email verified</h1>
            <p className="text-sm text-white/60">You can now sign in.</p>
            <Link
              href="/sign-in"
              className="inline-block rounded-xl bg-orange-500 hover:bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition"
            >
              Sign in
            </Link>
          </>
        )}
        {state === "error" && (
          <>
            <AlertCircle className="h-10 w-10 text-red-400 mx-auto" />
            <h1 className="text-2xl font-bold text-white">Verification failed</h1>
            <p className="text-sm text-white/60">{error}</p>
            <Link
              href="/sign-in"
              className="inline-block rounded-xl border border-white/10 hover:bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition"
            >
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
