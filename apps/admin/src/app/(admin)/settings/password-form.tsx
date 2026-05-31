"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Lock } from "lucide-react";

export function PasswordChangeForm() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [mfaCode, setMfaCode] = useState("");
  const [needsMfa, setNeedsMfa] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (form.newPassword.length < 12) {
      toast.error("Password must be at least 12 characters");
      return;
    }
    setSaving(true);
    try {
      // A 6-digit value is a TOTP code; anything else is treated as a
      // single-use backup code. The field only appears once the server
      // asks for a second factor (MFA-enrolled admins).
      const code = mfaCode.trim();
      const codeField = /^\d{6}$/.test(code)
        ? { mfaCode: code }
        : code
          ? { backupCode: code }
          : {};
      const res = await fetch("/api/auth/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
          ...codeField,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // MFA-enrolled admin: reveal the code field and let them re-submit
        // without losing what they already typed.
        if (data.requiresMfa) {
          setNeedsMfa(true);
          toast.error(data.error || "Enter your two-factor code to confirm");
          return;
        }
        toast.error(data.error || "Failed to change password");
        return;
      }
      toast.success("Password changed successfully");
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setMfaCode("");
      setNeedsMfa(false);
    } catch {
      toast.error("Failed to change password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <Lock className="h-5 w-5" /> Change Password
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
        <div>
          <label className="mb-1 block text-sm font-medium text-muted-foreground">Current Password</label>
          <input
            type="password"
            value={form.currentPassword}
            onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
            required
            className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-muted-foreground">New Password</label>
          <input
            type="password"
            value={form.newPassword}
            onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
            required
            minLength={12}
            className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-muted-foreground">Confirm New Password</label>
          <input
            type="password"
            value={form.confirmPassword}
            onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
            required
            minLength={12}
            className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        {needsMfa ? (
          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">Two-factor code</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
              placeholder="6-digit code or a backup code"
              required
              className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Your account has two-factor enabled. Enter a code to confirm this change.
            </p>
          </div>
        ) : null}
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "Changing..." : "Change Password"}
        </button>
      </form>
    </div>
  );
}
