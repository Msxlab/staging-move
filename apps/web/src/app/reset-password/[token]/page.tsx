"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

export default function ResetPasswordPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = decodeURIComponent(params.token);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match.");
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
        setError(data.error || "Reset failed.");
        setLoading(false);
        return;
      }
      setDone(true);
      setLoading(false);
      setTimeout(() => router.push("/sign-in"), 1500);
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--surface)" }}>
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 space-y-4 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
          <h1 className="text-2xl font-bold text-white">Password reset</h1>
          <p className="text-sm text-white/60">Redirecting you to sign in…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--surface)" }}>
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 space-y-6">
        <div className="text-center space-y-1.5">
          <h1 className="text-2xl font-bold text-white">Set a new password</h1>
          <p className="text-sm text-white/50">Choose a strong one you haven't used before.</p>
        </div>

        {error && (
          <div className="flex gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="text-xs font-medium text-white/60 block mb-1">New password</label>
            <input
              id="password" type="password" required autoComplete="new-password" minLength={12}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="confirm" className="text-xs font-medium text-white/60 block mb-1">Confirm</label>
            <input
              id="confirm" type="password" required autoComplete="new-password" minLength={12}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              value={confirm} onChange={(e) => setConfirm(e.target.value)}
            />
            <p className="text-[11px] text-white/40 mt-1.5">
              At least 12 characters with upper, lower, digit, and special.
            </p>
          </div>

          <button
            type="submit" disabled={loading || !password || !confirm}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Reset password
          </button>
        </form>

        <p className="text-center text-xs text-white/40">
          <Link href="/sign-in" className="text-orange-400 hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
