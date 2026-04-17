"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Shield, Key, Trash2, ExternalLink, Loader2, Download,
  Lock, Fingerprint, Eye, EyeOff, QrCode, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/use-current-user";

const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition";

export default function PrivacyPage() {
  const { user, loading, refresh } = useCurrentUser();

  // ── Password ──────────────────────────────────────────
  const [showPassword, setShowPassword] = useState(false);
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [savingPw, setSavingPw] = useState(false);

  // ── MFA ───────────────────────────────────────────────
  const [mfaPassword, setMfaPassword] = useState("");
  const [mfaSetup, setMfaSetup] = useState<{
    uri: string;
    secret: string;
    backupCodes: string[];
  } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaBusy, setMfaBusy] = useState(false);
  const [disablePw, setDisablePw] = useState("");

  // ── Delete ────────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handlePasswordChange = async () => {
    if (!pwForm.current || !pwForm.next) { toast.error("Fill in all fields"); return; }
    if (pwForm.next !== pwForm.confirm) { toast.error("Passwords do not match"); return; }
    setSavingPw(true);
    try {
      const res = await fetch("/api/auth/password/change", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Failed to update password");
      } else {
        toast.success("Password updated. Other devices were signed out.");
        setPwForm({ current: "", next: "", confirm: "" });
      }
    } catch {
      toast.error("Network error");
    }
    setSavingPw(false);
  };

  const handleMfaSetup = async () => {
    if (!mfaPassword) { toast.error("Enter your password first"); return; }
    setMfaBusy(true);
    try {
      const res = await fetch("/api/auth/mfa/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: mfaPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Failed to start MFA setup");
      } else {
        setMfaSetup({
          uri: data.provisioningUri,
          secret: data.secret,
          backupCodes: data.backupCodes || [],
        });
        setMfaPassword("");
      }
    } catch {
      toast.error("Network error");
    }
    setMfaBusy(false);
  };

  const handleMfaConfirm = async () => {
    if (mfaCode.length !== 6) return;
    setMfaBusy(true);
    try {
      const res = await fetch("/api/auth/mfa/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mfaCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Invalid code");
      } else {
        toast.success("Two-factor authentication enabled!");
        setMfaSetup(null);
        setMfaCode("");
        await refresh();
      }
    } catch {
      toast.error("Network error");
    }
    setMfaBusy(false);
  };

  const handleMfaDisable = async () => {
    if (!disablePw) { toast.error("Enter your password"); return; }
    setMfaBusy(true);
    try {
      const res = await fetch("/api/auth/mfa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: disablePw }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Failed to disable 2FA");
      } else {
        toast.success("Two-factor authentication disabled");
        setDisablePw("");
        await refresh();
      }
    } catch {
      toast.error("Network error");
    }
    setMfaBusy(false);
  };

  const handleDeleteAccount = async () => {
    if (deleteText !== "DELETE") return;
    setDeleting(true);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
        toast.success(data.message || "Account deletion initiated.");
        setTimeout(() => { window.location.href = "/"; }, 1500);
      } else {
        toast.error(data.error || "Failed to delete account");
        setDeleting(false);
      }
    } catch {
      toast.error("Network error");
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-white/40" />
      </div>
    );
  }

  const twoFaEnabled = Boolean(user?.mfaEnabled);

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <button className="p-2 rounded-xl text-white/30 hover:text-white hover:bg-white/5 transition" aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Privacy & Security</h1>
          <p className="text-sm text-white/40">Manage passwords, sessions, and data</p>
        </div>
      </div>

      {/* Password */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
        <div className="p-5 pb-3 flex items-center gap-2">
          <Key className="h-4 w-4 text-orange-400" />
          <h2 className="text-sm font-semibold text-white">Change Password</h2>
        </div>
        <div className="px-5 pb-5 space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/50">Current Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className={inputCls}
                placeholder="Enter current password"
                value={pwForm.current}
                onChange={(e) => setPwForm((p) => ({ ...p, current: e.target.value }))}
              />
              <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/40" aria-label="Toggle password visibility">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/50">New Password</label>
              <input
                type="password" className={inputCls} placeholder="Min 12 characters"
                value={pwForm.next}
                onChange={(e) => setPwForm((p) => ({ ...p, next: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/50">Confirm New Password</label>
              <input
                type="password" className={inputCls} placeholder="Repeat new password"
                value={pwForm.confirm}
                onChange={(e) => setPwForm((p) => ({ ...p, confirm: e.target.value }))}
              />
            </div>
          </div>
          <p className="text-[11px] text-white/30">
            Must include upper, lower, digit, and special character. Other devices are signed out.
          </p>
          <div className="flex justify-end">
            <button
              onClick={handlePasswordChange}
              disabled={savingPw || !pwForm.current || !pwForm.next}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-medium hover:bg-orange-600 transition disabled:opacity-50"
            >
              {savingPw ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
              Update Password
            </button>
          </div>
        </div>
      </div>

      {/* Two-Factor Authentication */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
        <div className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/20">
              <Fingerprint className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Two-Factor Authentication</h3>
              <p className="text-xs text-white/40">
                {twoFaEnabled
                  ? "Enabled — your account is secured with TOTP"
                  : "Add extra security with an authenticator app"}
              </p>
            </div>
          </div>
        </div>

        {/* Disable flow */}
        {twoFaEnabled && (
          <div className="px-5 pb-5 space-y-3 border-t border-white/5 pt-4">
            <label className="text-xs font-medium text-white/50">Confirm your password to disable</label>
            <div className="flex gap-2">
              <input
                type="password" className={inputCls} placeholder="Current password"
                value={disablePw} onChange={(e) => setDisablePw(e.target.value)}
              />
              <button
                onClick={handleMfaDisable}
                disabled={!disablePw || mfaBusy}
                className="px-4 py-2 rounded-xl border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/10 transition disabled:opacity-50 shrink-0"
              >
                {mfaBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Disable"}
              </button>
            </div>
          </div>
        )}

        {/* Setup — step 1: password gate */}
        {!twoFaEnabled && !mfaSetup && (
          <div className="px-5 pb-5 space-y-3 border-t border-white/5 pt-4">
            <label className="text-xs font-medium text-white/50">Re-enter your password to start</label>
            <div className="flex gap-2">
              <input
                type="password" className={inputCls} placeholder="Current password"
                value={mfaPassword} onChange={(e) => setMfaPassword(e.target.value)}
              />
              <button
                onClick={handleMfaSetup}
                disabled={!mfaPassword || mfaBusy}
                className="px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-medium hover:bg-orange-600 transition disabled:opacity-50 shrink-0"
              >
                {mfaBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Start setup"}
              </button>
            </div>
          </div>
        )}

        {/* Setup — step 2: scan QR + verify TOTP */}
        {!twoFaEnabled && mfaSetup && (
          <div className="px-5 pb-5 space-y-4 border-t border-white/5 pt-4">
            <div className="text-center space-y-2">
              <QrCode className="h-6 w-6 mx-auto text-orange-400" />
              <p className="text-sm text-white/60">Scan this QR code with your authenticator app</p>
              <div className="inline-block bg-white p-3 rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(mfaSetup.uri)}`}
                  alt="TOTP QR Code"
                  className="w-48 h-48"
                />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-white/30">Or enter this key manually:</p>
                <code className="text-xs text-orange-400 bg-orange-500/10 px-3 py-1 rounded-lg select-all">{mfaSetup.secret}</code>
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
              <p className="text-xs font-medium text-amber-200">Save your backup codes</p>
              <p className="text-[11px] text-amber-100/70">Each code can be used once if you lose your authenticator. Store somewhere safe — we won't show them again.</p>
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                {mfaSetup.backupCodes.map((c) => (
                  <code key={c} className="text-xs text-amber-100 bg-black/30 px-2 py-1 rounded text-center font-mono">{c}</code>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-white/50">Verification Code</label>
              <div className="flex gap-2">
                <input
                  className={inputCls + " font-mono text-center tracking-[0.3em]"}
                  placeholder="123456"
                  maxLength={6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                />
                <button
                  onClick={handleMfaConfirm}
                  disabled={mfaCode.length !== 6 || mfaBusy}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-medium hover:bg-orange-600 transition disabled:opacity-50 shrink-0"
                >
                  {mfaBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Verify
                </button>
              </div>
            </div>
            <button
              onClick={() => { setMfaSetup(null); setMfaCode(""); }}
              className="text-xs text-white/30 hover:text-white transition"
            >
              Cancel setup
            </button>
          </div>
        )}
      </div>

      {/* Data Privacy */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
        <div className="p-5 pb-3 flex items-center gap-2">
          <Shield className="h-4 w-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-white">Data Privacy</h2>
        </div>
        <div className="px-5 pb-5 space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <div>
              <p className="text-sm text-white/80">Download My Data</p>
              <p className="text-[11px] text-white/30">Export all your data (GDPR compliant)</p>
            </div>
            <Link href="/settings/export">
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 text-xs text-white/50 hover:text-white hover:bg-white/5 transition">
                <Download className="h-3 w-3" />Export
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 backdrop-blur-xl overflow-hidden">
        <div className="p-5 pb-3 flex items-center gap-2">
          <Trash2 className="h-4 w-4 text-red-400" />
          <h2 className="text-sm font-semibold text-red-400">Danger Zone</h2>
        </div>
        <div className="px-5 pb-5">
          {!deleteConfirm ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white/80">Delete Account</p>
                <p className="text-xs text-white/30">Permanently delete all data. Cannot be undone.</p>
              </div>
              <button
                onClick={() => setDeleteConfirm(true)}
                className="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/20 transition"
              >
                Delete Account
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-white/40">
                This will permanently delete your account, all addresses, services, and moving plans.
                Type <strong className="text-red-400">DELETE</strong> to confirm.
              </p>
              <input
                className={`${inputCls} border-red-500/20`}
                placeholder='Type "DELETE" to confirm'
                value={deleteText}
                onChange={(e) => setDeleteText(e.target.value)}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteText !== "DELETE" || deleting}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500 text-white text-xs font-medium hover:bg-red-600 transition disabled:opacity-50"
                >
                  {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  {deleting ? "Deleting..." : "Permanently Delete"}
                </button>
                <button
                  onClick={() => { setDeleteConfirm(false); setDeleteText(""); }}
                  className="px-4 py-2 rounded-xl text-xs text-white/30 hover:text-white hover:bg-white/5 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
