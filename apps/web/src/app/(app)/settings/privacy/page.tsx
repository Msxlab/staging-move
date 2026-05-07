"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Shield, Key, Trash2, Loader2, Download,
  Lock, Fingerprint, QrCode, CheckCircle2, Monitor, Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { PasswordInput } from "@/components/ui/password-input";
import { useCurrentUser } from "@/hooks/use-current-user";
import { DeleteAccountDialog } from "@/components/settings/delete-account-dialog";

const inputCls =
  "w-full rounded-xl border border-border bg-foreground/5 px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/50 transition";

interface AccountSecurityState {
  account: {
    hasPasswordLogin: boolean;
    emailVerified: boolean;
    emailVerifiedAt: string | null;
    mfaEnabled: boolean;
  };
  linkedMethods: Array<{
    type: string;
    label: string;
    enabled: boolean;
    linkedAt: string | null;
  }>;
  sessions: Array<{
    id: string;
    current: boolean;
    browser: string | null;
    os: string | null;
    deviceType: string | null;
    ipAddress: string | null;
    isActive: boolean;
    expiresAt: string;
    lastActivity: string;
    createdAt: string;
    impersonated: boolean;
  }>;
  capabilities: {
    canSetPassword: boolean;
    canChangePassword: boolean;
    canManageMfa: boolean;
    canRevokeSessions: boolean;
  };
}

export default function PrivacyPage() {
  const { user, loading, refresh } = useCurrentUser();
  const [securityState, setSecurityState] = useState<AccountSecurityState | null>(null);
  const [securityLoading, setSecurityLoading] = useState(true);
  const [securityBusy, setSecurityBusy] = useState(false);
  const [passwordSetupBusy, setPasswordSetupBusy] = useState(false);

  async function loadSecurityState() {
    setSecurityLoading(true);
    try {
      const res = await fetch("/api/auth/security", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSecurityState(null);
        return;
      }
      setSecurityState(data);
    } catch {
      setSecurityState(null);
    } finally {
      setSecurityLoading(false);
    }
  }

  useEffect(() => {
    loadSecurityState();
  }, []);

  // â”€â”€ Password â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [savingPw, setSavingPw] = useState(false);

  // â”€â”€ MFA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [mfaPassword, setMfaPassword] = useState("");
  const [mfaSetup, setMfaSetup] = useState<{
    uri: string;
    secret: string;
    backupCodes: string[];
  } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaBusy, setMfaBusy] = useState(false);
  const [disablePw, setDisablePw] = useState("");

  // â”€â”€ Delete â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [deleteOpen, setDeleteOpen] = useState(false);

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

  const handleRequestSetPasswordEmail = async () => {
    setPasswordSetupBusy(true);
    try {
      const res = await fetch("/api/auth/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request_set_password" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Failed to send password setup email");
      } else {
        toast.success(data.message || "Password setup email sent. Check your inbox.");
        setSecurityState(data);
        await refresh();
      }
    } catch {
      toast.error("Network error");
    } finally {
      setPasswordSetupBusy(false);
    }
  };

  const handleRevokeOtherSessions = async () => {
    setSecurityBusy(true);
    try {
      const res = await fetch("/api/auth/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke_other_sessions" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Failed to revoke sessions");
      } else {
        toast.success(`${data.revoked || 0} other session(s) revoked.`);
        setSecurityState(data);
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSecurityBusy(false);
    }
  };

  const handleRevokeSession = async (sessionId: string, current: boolean) => {
    if (current && !confirm("Revoke this current session? You will be signed out.")) return;
    setSecurityBusy(true);
    try {
      const res = await fetch("/api/auth/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke_session", sessionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Failed to revoke session");
      } else if (data.currentSessionRevoked) {
        toast.success("Current session revoked.");
        window.location.href = "/sign-in";
      } else {
        toast.success("Session revoked.");
        await loadSecurityState();
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSecurityBusy(false);
    }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasPasswordLogin = securityState?.account.hasPasswordLogin ?? true;
  const activeSessions = securityState?.sessions.filter((session) => session.isActive) || [];
  const otherActiveSessions = activeSessions.filter((session) => !session.current);
  const twoFaEnabled = Boolean(securityState?.account.mfaEnabled ?? user?.mfaEnabled);

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <button className="p-2 rounded-xl text-foreground/40 hover:text-foreground hover:bg-foreground/5 transition" aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Privacy & Security</h1>
          <p className="text-sm text-muted-foreground">Manage passwords, sessions, and data</p>
        </div>
      </div>

      {/* Account Access */}
      <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl overflow-hidden">
        <div className="p-5 pb-3 flex items-center gap-2">
          <Shield className="h-4 w-4 text-tone-orange-fg" />
          <h2 className="text-sm font-semibold text-foreground">Account Access</h2>
        </div>
        <div className="px-5 pb-5 space-y-4">
          {securityLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading account security...
            </div>
          ) : !securityState ? (
            <div className="rounded-xl border border-destructive bg-destructive/5 p-3 text-sm text-destructive">
              Account security state could not be loaded. Refresh and try again.
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <SecuritySummaryCard
                  label="Email"
                  value={securityState.account.emailVerified ? "Verified" : "Needs verification"}
                  tone={securityState.account.emailVerified ? "ok" : "warn"}
                />
                <SecuritySummaryCard
                  label="Password"
                  value={hasPasswordLogin ? "Enabled" : "Not set"}
                  tone={hasPasswordLogin ? "ok" : "warn"}
                />
                <SecuritySummaryCard
                  label="MFA"
                  value={twoFaEnabled ? "Enabled" : "Off"}
                  tone={twoFaEnabled ? "ok" : "neutral"}
                />
              </div>

              <div className="rounded-xl border border-border bg-black/20 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Linked sign-in methods</p>
                <div className="flex flex-wrap gap-2">
                  {securityState.linkedMethods.map((method) => (
                    <span
                      key={`${method.type}-${method.linkedAt || "none"}`}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        method.enabled
                          ? "bg-tone-emerald-bg text-tone-emerald-fg"
                          : "bg-foreground/5 text-foreground/35"
                      }`}
                    >
                      {method.label}{method.enabled ? "" : " not enabled"}
                    </span>
                  ))}
                </div>
                {!hasPasswordLogin && (
                  <p className="mt-3 text-xs text-tone-honey-fg/70">
                    This account can sign in through linked OAuth, but password and MFA management require setting a password first.
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-border bg-black/20 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Login sessions</p>
                    <p className="mt-1 text-xs text-foreground/40">{activeSessions.length} active session(s)</p>
                  </div>
                  <button
                    onClick={handleRevokeOtherSessions}
                    disabled={securityBusy || otherActiveSessions.length === 0}
                    className="rounded-xl border border-destructive px-3 py-1.5 text-xs font-medium text-destructive transition hover:bg-destructive/10 disabled:opacity-50"
                  >
                    Revoke other sessions
                  </button>
                </div>
                <div className="space-y-2">
                  {securityState.sessions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No authenticated sessions are currently recorded.</p>
                  ) : (
                    securityState.sessions.slice(0, 6).map((session) => (
                      <div key={session.id} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-foreground/[0.03] p-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {session.deviceType?.toLowerCase().includes("mobile") ? (
                              <Smartphone className="h-4 w-4 text-foreground/35" />
                            ) : (
                              <Monitor className="h-4 w-4 text-foreground/35" />
                            )}
                            <p className="truncate text-sm font-medium text-foreground/80">
                              {session.browser || "Unknown browser"}{session.os ? ` / ${session.os}` : ""}
                            </p>
                            {session.current && <span className="rounded-full bg-tone-orange-bg px-2 py-0.5 text-[10px] text-tone-orange-fg">Current</span>}
                            {!session.isActive && <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] text-foreground/35">Revoked</span>}
                          </div>
                          <p className="mt-1 text-xs text-foreground/35">
                            {session.ipAddress || "No IP"} Â· Last active {new Date(session.lastActivity).toLocaleString()}
                          </p>
                        </div>
                        {session.isActive && (
                          <button
                            onClick={() => handleRevokeSession(session.id, session.current)}
                            disabled={securityBusy}
                            className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-xs text-foreground/45 hover:bg-foreground/5 hover:text-foreground disabled:opacity-50"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Password */}
      <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl overflow-hidden">
        <div className="p-5 pb-3 flex items-center gap-2">
          <Key className="h-4 w-4 text-tone-orange-fg" />
          <h2 className="text-sm font-semibold text-foreground">{hasPasswordLogin ? "Change Password" : "Set Password"}</h2>
        </div>
        {!hasPasswordLogin ? (
          <div className="px-5 pb-5 space-y-3">
            <p className="text-xs text-muted-foreground">
              We'll email a secure password setup link to your verified address. Your linked OAuth method remains available.
            </p>
            <p className="text-[11px] text-foreground/40">
              After you set it, this account can sign in with email/password and with its linked Google or Apple method.
            </p>
            <div className="flex justify-end">
              <button
                onClick={handleRequestSetPasswordEmail}
                disabled={passwordSetupBusy}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-tone-orange-fg text-white text-xs font-medium hover:bg-tone-orange-bg transition disabled:opacity-50"
              >
                {passwordSetupBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                Email Setup Link
              </button>
            </div>
          </div>
        ) : (
          <div className="px-5 pb-5 space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Current Password</label>
              <PasswordInput
                className={inputCls}
                placeholder="Enter current password"
                value={pwForm.current}
                onChange={(e) => setPwForm((p) => ({ ...p, current: e.target.value }))}
              />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">New Password</label>
              <PasswordInput
                className={inputCls} placeholder="Min 12 characters"
                value={pwForm.next}
                onChange={(e) => setPwForm((p) => ({ ...p, next: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Confirm New Password</label>
              <PasswordInput
                className={inputCls} placeholder="Repeat new password"
                value={pwForm.confirm}
                onChange={(e) => setPwForm((p) => ({ ...p, confirm: e.target.value }))}
              />
            </div>
          </div>
          <p className="text-[11px] text-foreground/40">
            Must include upper, lower, digit, and special character. Other devices are signed out.
          </p>
          <div className="flex justify-end">
            <button
              onClick={handlePasswordChange}
              disabled={savingPw || !pwForm.current || !pwForm.next}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-tone-orange-fg text-white text-xs font-medium hover:bg-tone-orange-bg transition disabled:opacity-50"
            >
              {savingPw ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
              Update Password
            </button>
          </div>
        </div>
        )}
      </div>

      {/* Two-Factor Authentication */}
      <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl overflow-hidden">
        <div className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-tone-orange-bg border border-tone-orange-br">
              <Fingerprint className="h-5 w-5 text-tone-orange-fg" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Two-Factor Authentication</h3>
              <p className="text-xs text-muted-foreground">
                {twoFaEnabled
                  ? "Enabled â€” your account is secured with TOTP"
                  : "Add extra security with an authenticator app"}
              </p>
            </div>
          </div>
        </div>

        {/* Disable flow */}
        {twoFaEnabled && (
          <div className="px-5 pb-5 space-y-3 border-t border-border pt-4">
            <label className="text-xs font-medium text-muted-foreground">Confirm your password to disable</label>
            <div className="flex gap-2">
              <PasswordInput
                wrapperClassName="flex-1"
                className={inputCls} placeholder="Current password"
                value={disablePw} onChange={(e) => setDisablePw(e.target.value)}
              />
              <button
                onClick={handleMfaDisable}
                disabled={!disablePw || mfaBusy}
                className="px-4 py-2 rounded-xl border border-destructive text-destructive text-xs font-medium hover:bg-destructive/10 transition disabled:opacity-50 shrink-0"
              >
                {mfaBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Disable"}
              </button>
            </div>
          </div>
        )}

        {/* Setup â€” step 1: password gate */}
        {!twoFaEnabled && !mfaSetup && !hasPasswordLogin && (
          <div className="px-5 pb-5 border-t border-border pt-4">
            <div className="rounded-xl border border-tone-honey-br bg-tone-honey-bg p-3 text-xs text-tone-honey-fg/75">
              Set a password before enabling MFA. This prevents OAuth-only accounts from getting locked out during authenticator recovery.
            </div>
          </div>
        )}

        {!twoFaEnabled && !mfaSetup && hasPasswordLogin && (
          <div className="px-5 pb-5 space-y-3 border-t border-border pt-4">
            <label className="text-xs font-medium text-muted-foreground">Re-enter your password to start</label>
            <div className="flex gap-2">
              <PasswordInput
                wrapperClassName="flex-1"
                className={inputCls} placeholder="Current password"
                value={mfaPassword} onChange={(e) => setMfaPassword(e.target.value)}
              />
              <button
                onClick={handleMfaSetup}
                disabled={!mfaPassword || mfaBusy}
                className="px-4 py-2 rounded-xl bg-tone-orange-fg text-white text-xs font-medium hover:bg-tone-orange-bg transition disabled:opacity-50 shrink-0"
              >
                {mfaBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Start setup"}
              </button>
            </div>
          </div>
        )}

        {/* Setup â€” step 2: scan QR + verify TOTP */}
        {!twoFaEnabled && mfaSetup && (
          <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
            <div className="text-center space-y-2">
              <QrCode className="h-6 w-6 mx-auto text-tone-orange-fg" />
              <p className="text-sm text-muted-foreground">Scan this QR code with your authenticator app</p>
              <div className="inline-block bg-white p-3 rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(mfaSetup.uri)}`}
                  alt="TOTP QR Code"
                  className="w-48 h-48"
                />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-foreground/40">Or enter this key manually:</p>
                <code className="text-xs text-tone-orange-fg bg-tone-orange-bg px-3 py-1 rounded-lg select-all">{mfaSetup.secret}</code>
              </div>
            </div>

            <div className="rounded-xl border border-tone-honey-br bg-tone-honey-bg p-3 space-y-2">
              <p className="text-xs font-medium text-tone-honey-fg">Save your backup codes</p>
              <p className="text-[11px] text-tone-honey-fg/70">Each code can be used once if you lose your authenticator. Store somewhere safe â€” we won't show them again.</p>
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                {mfaSetup.backupCodes.map((c) => (
                  <code key={c} className="text-xs text-tone-honey-fg bg-foreground/20 backdrop-blur-sm px-2 py-1 rounded text-center font-mono">{c}</code>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Verification Code</label>
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
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-tone-orange-fg text-white text-xs font-medium hover:bg-tone-orange-bg transition disabled:opacity-50 shrink-0"
                >
                  {mfaBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Verify
                </button>
              </div>
            </div>
            <button
              onClick={() => { setMfaSetup(null); setMfaCode(""); }}
              className="text-xs text-foreground/40 hover:text-foreground transition"
            >
              Cancel setup
            </button>
          </div>
        )}
      </div>

      {/* Data Privacy */}
      <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl overflow-hidden">
        <div className="p-5 pb-3 flex items-center gap-2">
          <Shield className="h-4 w-4 text-tone-emerald-fg" />
          <h2 className="text-sm font-semibold text-foreground">Data Privacy</h2>
        </div>
        <div className="px-5 pb-5 space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl bg-foreground/[0.02] border border-border">
            <div>
              <p className="text-sm text-foreground/80">Download My Data</p>
              <p className="text-[11px] text-foreground/40">Export supported account data</p>
            </div>
            <Link href="/settings/export">
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition">
                <Download className="h-3 w-3" />Export
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Danger Zone â€” actual flow lives in <DeleteAccountDialog /> below. */}
      <div className="rounded-2xl border border-destructive bg-destructive/5 backdrop-blur-xl overflow-hidden">
        <div className="p-5 pb-3 flex items-center gap-2">
          <Trash2 className="h-4 w-4 text-destructive" />
          <h2 className="text-sm font-semibold text-destructive">Danger Zone</h2>
        </div>
        <div className="px-5 pb-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground/80">Delete Account</p>
              <p className="text-xs text-foreground/40">Permanently delete all data. Cannot be undone.</p>
            </div>
            <button
              onClick={() => setDeleteOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-destructive/10 border border-destructive text-destructive text-xs font-medium hover:bg-destructive transition"
            >
              Delete Account
            </button>
          </div>
        </div>
      </div>

      <DeleteAccountDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        userEmail={user?.email}
        hasPasswordLogin={hasPasswordLogin}
        mfaEnabled={twoFaEnabled}
        onRequestSetPasswordEmail={handleRequestSetPasswordEmail}
        setPasswordBusy={passwordSetupBusy}
      />
    </div>
  );
}

function SecuritySummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "warn" | "neutral";
}) {
  const toneClass =
    tone === "ok"
      ? "text-tone-emerald-fg"
      : tone === "warn"
        ? "text-tone-honey-fg"
        : "text-muted-foreground";
  return (
    <div className="rounded-xl border border-border bg-black/20 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/35">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
