"use client";

import { useState } from "react";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { AuroraBackground } from "@/components/aurora";
import "../../aurora.css";

const inputCls =
  "mt-1 block w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

function passwordIssue(pw: string): string | null {
  if (pw.length < 12) return "At least 12 characters";
  if (!/[A-Z]/.test(pw)) return "Add an uppercase letter";
  if (!/[a-z]/.test(pw)) return "Add a lowercase letter";
  if (!/[0-9]/.test(pw)) return "Add a number";
  return null;
}

export default function ForcePasswordChangeClient({ email }: { email: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
      const res = await fetch("/api/auth/force-password-change", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-requested-with": "locateflow" },
        body: JSON.stringify({ newPassword: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Could not update your password");
        return;
      }
      toast.success("Password updated. Welcome aboard.");
      // The JWT was reissued with mcp:false; a full navigation picks up the
      // fresh cookie and clears the middleware rotation gate.
      window.location.assign("/");
    } catch {
      toast.error("Could not update your password");
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
            <KeyRound className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Set a new password</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Before you continue, choose your own password for{" "}
            <span className="font-medium text-foreground">{email}</span>.
          </p>
        </div>

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
            {submitting ? "Saving…" : "Set password and continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
