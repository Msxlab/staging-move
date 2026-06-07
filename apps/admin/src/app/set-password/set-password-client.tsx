"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, ShieldCheck } from "lucide-react";
import { AuroraBackground } from "@/components/aurora";
import "../aurora.css";

type TokenState = "validating" | "valid" | "invalid";

const inputCls =
  "mt-1 block w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

function passwordIssue(pw: string): string | null {
  if (pw.length < 12) return "At least 12 characters";
  if (!/[A-Z]/.test(pw)) return "Add an uppercase letter";
  if (!/[a-z]/.test(pw)) return "Add a lowercase letter";
  if (!/[0-9]/.test(pw)) return "Add a number";
  return null;
}

export default function SetPasswordClient() {
  const [token, setToken] = useState<string | null>(null);
  const [tokenState, setTokenState] = useState<TokenState>("validating");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Read the token from the URL on the client so it never ends up in any
  // server log or referrer beyond this request.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (!t) {
      setTokenState("invalid");
      return;
    }
    setToken(t);
    void (async () => {
      try {
        const res = await fetch(`/api/auth/set-password?token=${encodeURIComponent(t)}`, {
          headers: { "x-requested-with": "locateflow" },
        });
        const data = await res.json().catch(() => ({}));
        setTokenState(res.ok && data.valid ? "valid" : "invalid");
      } catch {
        setTokenState("invalid");
      }
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    const issue = passwordIssue(password);
    if (issue) {
      toast.error(issue);
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-requested-with": "locateflow" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Could not set your password");
        // A consumed/expired token can't be retried — reflect that.
        if (res.status === 400 && /invalid or has expired/i.test(data.error || "")) {
          setTokenState("invalid");
        }
        return;
      }
      setDone(true);
      toast.success("Password set. You can sign in now.");
    } catch {
      toast.error("Could not set your password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="adm-aurora relative flex min-h-screen items-center justify-center bg-background">
      <AuroraBackground />
      <div className="relative z-10 w-full max-w-md space-y-8 rounded-2xl border border-border bg-card p-8 shadow-2xl backdrop-blur-xl">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
            {done ? (
              <ShieldCheck className="h-8 w-8 text-primary" />
            ) : (
              <KeyRound className="h-8 w-8 text-primary" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {done ? "Password set" : "Set your password"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {done
              ? "Your admin account is now active."
              : "Choose a strong password to activate your admin account."}
          </p>
        </div>

        {tokenState === "validating" && (
          <p className="text-center text-sm text-muted-foreground">Checking your invitation…</p>
        )}

        {tokenState === "invalid" && !done && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-destructive">
              This invitation link is invalid or has expired.
            </p>
            <p className="text-sm text-muted-foreground">
              Ask an administrator to send you a new invitation, then open the latest link.
            </p>
            <a
              href="/login"
              className="inline-block rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
            >
              Go to sign in
            </a>
          </div>
        )}

        {tokenState === "valid" && !done && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground">
                New password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={12}
                className={inputCls}
                placeholder="••••••••••••"
                autoComplete="new-password"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                At least 12 characters with upper, lower, and a number.
              </p>
            </div>
            <div>
              <label htmlFor="confirm" className="block text-sm font-medium text-foreground">
                Confirm password
              </label>
              <input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={12}
                className={inputCls}
                placeholder="••••••••••••"
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? "Setting…" : "Set password"}
            </button>
          </form>
        )}

        {done && (
          <a
            href="/login"
            className="block w-full rounded-lg bg-primary px-4 py-2.5 text-center font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Continue to sign in
          </a>
        )}
      </div>
    </div>
  );
}
