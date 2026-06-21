"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Shield, Key, Trash2, Loader2, Download,
  Lock, Fingerprint, QrCode, CheckCircle2, Monitor, Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { useLocale } from "next-intl";
import { PasswordInput } from "@/components/ui/password-input";
import { useCurrentUser } from "@/hooks/use-current-user";
import { DeleteAccountDialog } from "@/components/settings/delete-account-dialog";

const inputCls =
  "w-full rounded-xl border border-border bg-foreground/5 px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/50 transition";

const PRIVACY_COPY = {
  en: {
    back: "Back",
    title: "Privacy & Security",
    subtitle: "Manage passwords, sessions, and data",
    accountAccess: "Account Access",
    loadingSecurity: "Loading account security...",
    securityLoadFailed: "Account security state could not be loaded. Refresh and try again.",
    email: "Email",
    verified: "Verified",
    needsVerification: "Needs verification",
    password: "Password",
    enabled: "Enabled",
    notSet: "Not set",
    mfa: "MFA",
    off: "Off",
    linkedMethods: "Linked sign-in methods",
    notEnabled: "not enabled",
    oauthPasswordHint: "This account can sign in through linked OAuth, but password and MFA management require setting a password first.",
    loginSessions: "Login sessions",
    activeSessions: (count: number) => `${count} active session(s)`,
    revokeOtherSessions: "Revoke other sessions",
    noSessions: "No authenticated sessions are currently recorded.",
    unknownBrowser: "Unknown browser",
    current: "Current",
    revoked: "Revoked",
    noIp: "No IP",
    lastActive: "Last active",
    revoke: "Revoke",
    dataPrivacy: "Data Privacy",
    downloadData: "Download My Data",
    exportData: "Export supported account data",
    export: "Export",
    dangerZone: "Danger Zone",
    deleteAccount: "Delete Account",
    deleteBody: "Permanently delete all data. Cannot be undone.",
  },
  es: {
    back: "Volver",
    title: "Privacidad y seguridad",
    subtitle: "Administra contrasenas, sesiones y datos",
    accountAccess: "Acceso de cuenta",
    loadingSecurity: "Cargando seguridad de la cuenta...",
    securityLoadFailed: "No se pudo cargar el estado de seguridad. Actualiza e intenta de nuevo.",
    email: "Email",
    verified: "Verificado",
    needsVerification: "Requiere verificacion",
    password: "Contrasena",
    enabled: "Activa",
    notSet: "No configurada",
    mfa: "MFA",
    off: "Desactivado",
    linkedMethods: "Metodos de inicio vinculados",
    notEnabled: "no activado",
    oauthPasswordHint: "Esta cuenta puede iniciar sesion con OAuth vinculado, pero para administrar password y MFA primero debe configurar una contrasena.",
    loginSessions: "Sesiones de login",
    activeSessions: (count: number) => `${count} sesion(es) activa(s)`,
    revokeOtherSessions: "Revocar otras sesiones",
    noSessions: "No hay sesiones autenticadas registradas.",
    unknownBrowser: "Navegador desconocido",
    current: "Actual",
    revoked: "Revocada",
    noIp: "Sin IP",
    lastActive: "Ultima actividad",
    revoke: "Revocar",
    dataPrivacy: "Privacidad de datos",
    downloadData: "Descargar mis datos",
    exportData: "Exportar datos soportados de la cuenta",
    export: "Exportar",
    dangerZone: "Zona de riesgo",
    deleteAccount: "Eliminar cuenta",
    deleteBody: "Elimina todos los datos permanentemente. No se puede deshacer.",
  },
} as const;

function copyForLocale(locale: string) {
  return locale.toLowerCase().startsWith("es") ? PRIVACY_COPY.es : PRIVACY_COPY.en;
}

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
  const locale = useLocale();
  const copy = copyForLocale(locale);
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

  // Password
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [savingPw, setSavingPw] = useState(false);

  // MFA
  const [mfaPassword, setMfaPassword] = useState("");
  const [mfaSetup, setMfaSetup] = useState<{
    uri: string;
    qrDataUrl: string;
    secret: string;
    backupCodes: string[];
  } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaBusy, setMfaBusy] = useState(false);
  const [disablePw, setDisablePw] = useState("");
  const [disableCode, setDisableCode] = useState("");

  // Delete
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
          qrDataUrl: data.qrDataUrl,
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
    const code = disableCode.trim();
    if (!code) { toast.error("Enter your authenticator code or a backup code"); return; }
    setMfaBusy(true);
    try {
      // A 6-digit numeric value is treated as a TOTP code; anything else (e.g.
      // a longer alphanumeric recovery code) is sent as a backup code.
      const isTotp = /^\d{6}$/.test(code);
      const res = await fetch("/api/auth/mfa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: disablePw, ...(isTotp ? { mfaCode: code } : { backupCode: code }) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Failed to disable 2FA");
      } else {
        toast.success("Two-factor authentication disabled");
        setDisablePw("");
        setDisableCode("");
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
        <Link
          href="/settings"
          className="p-2 rounded-xl text-foreground/40 hover:text-foreground hover:bg-foreground/5 transition"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{copy.title}</h1>
          <p className="text-sm text-muted-foreground">{copy.subtitle}</p>
        </div>
      </div>

      {/* Account Access */}
      <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl overflow-hidden">
        <div className="p-5 pb-3 flex items-center gap-2">
          <Shield className="h-4 w-4 text-tone-orange-fg" />
          <h2 className="text-sm font-semibold text-foreground">{copy.accountAccess}</h2>
        </div>
        <div className="px-5 pb-5 space-y-4">
          {securityLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {copy.loadingSecurity}
            </div>
          ) : !securityState ? (
            <div className="rounded-xl border border-destructive bg-destructive/5 p-3 text-sm text-destructive">
              {copy.securityLoadFailed}
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <SecuritySummaryCard
                  label={copy.email}
                  value={securityState.account.emailVerified ? copy.verified : copy.needsVerification}
                  tone={securityState.account.emailVerified ? "ok" : "warn"}
                />
                <SecuritySummaryCard
                  label={copy.password}
                  value={hasPasswordLogin ? copy.enabled : copy.notSet}
                  tone={hasPasswordLogin ? "ok" : "warn"}
                />
                <SecuritySummaryCard
                  label={copy.mfa}
                  value={twoFaEnabled ? copy.enabled : copy.off}
                  tone={twoFaEnabled ? "ok" : "neutral"}
                />
              </div>

              <div className="rounded-xl border border-border bg-black/20 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{copy.linkedMethods}</p>
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
                      {method.label}{method.enabled ? "" : ` ${copy.notEnabled}`}
                    </span>
                  ))}
                </div>
                {!hasPasswordLogin && (
                  <p className="mt-3 text-xs text-tone-honey-fg/70">
                    {copy.oauthPasswordHint}
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-border bg-black/20 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{copy.loginSessions}</p>
                    <p className="mt-1 text-xs text-foreground/40">{copy.activeSessions(activeSessions.length)}</p>
                  </div>
                  <button
                    onClick={handleRevokeOtherSessions}
                    disabled={securityBusy || otherActiveSessions.length === 0}
                    className="rounded-xl border border-destructive px-3 py-1.5 text-xs font-medium text-destructive transition hover:bg-destructive/10 disabled:opacity-50"
                  >
                    {copy.revokeOtherSessions}
                  </button>
                </div>
                <div className="space-y-2">
                  {securityState.sessions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{copy.noSessions}</p>
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
                              {session.browser || copy.unknownBrowser}{session.os ? ` / ${session.os}` : ""}
                            </p>
                            {session.current && <span className="rounded-full bg-tone-orange-bg px-2 py-0.5 text-[10px] text-tone-orange-fg">{copy.current}</span>}
                            {!session.isActive && <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] text-foreground/35">{copy.revoked}</span>}
                          </div>
                          <p className="mt-1 text-xs text-foreground/35">
                            {session.ipAddress || copy.noIp} · {copy.lastActive} {new Date(session.lastActivity).toLocaleString()}
                          </p>
                        </div>
                        {session.isActive && (
                          <button
                            onClick={() => handleRevokeSession(session.id, session.current)}
                            disabled={securityBusy}
                            className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-xs text-foreground/45 hover:bg-foreground/5 hover:text-foreground disabled:opacity-50"
                          >
                            {copy.revoke}
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
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-tone-orange-fg text-white text-xs font-medium hover:opacity-90 transition disabled:opacity-50"
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
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-tone-orange-fg text-white text-xs font-medium hover:opacity-90 transition disabled:opacity-50"
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
                  ? "Enabled — your account is secured with TOTP"
                  : "Add extra security with an authenticator app"}
              </p>
            </div>
          </div>
        </div>

        {/* Disable flow */}
        {twoFaEnabled && (
          <div className="px-5 pb-5 space-y-3 border-t border-border pt-4">
            <label className="text-xs font-medium text-muted-foreground">Confirm your password and a second factor to disable</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <PasswordInput
                wrapperClassName="flex-1"
                className={inputCls} placeholder="Current password"
                value={disablePw} onChange={(e) => setDisablePw(e.target.value)}
              />
              <input
                className={`${inputCls} flex-1`}
                inputMode="text" autoComplete="one-time-code"
                placeholder="Authenticator or backup code"
                value={disableCode} onChange={(e) => setDisableCode(e.target.value)}
              />
              <button
                onClick={handleMfaDisable}
                disabled={!disablePw || !disableCode.trim() || mfaBusy}
                className="px-4 py-2 rounded-xl border border-destructive text-destructive text-xs font-medium hover:bg-destructive/10 transition disabled:opacity-50 shrink-0"
              >
                {mfaBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Disable"}
              </button>
            </div>
          </div>
        )}

        {/* Setup — step 1: password gate */}
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
                className="px-4 py-2 rounded-xl bg-tone-orange-fg text-white text-xs font-medium hover:opacity-90 transition disabled:opacity-50 shrink-0"
              >
                {mfaBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Start setup"}
              </button>
            </div>
          </div>
        )}

        {/* Setup — step 2: scan QR + verify TOTP */}
        {!twoFaEnabled && mfaSetup && (
          <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
            <div className="text-center space-y-2">
              <QrCode className="h-6 w-6 mx-auto text-tone-orange-fg" />
              <p className="text-sm text-muted-foreground">Scan this QR code with your authenticator app</p>
              <div className="inline-block bg-white p-3 rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mfaSetup.qrDataUrl}
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
              <p className="text-[11px] text-tone-honey-fg/70">Each code can be used once if you lose your authenticator. Store somewhere safe — we won't show them again.</p>
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
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-tone-orange-fg text-white text-xs font-medium hover:opacity-90 transition disabled:opacity-50 shrink-0"
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
          <h2 className="text-sm font-semibold text-foreground">{copy.dataPrivacy}</h2>
        </div>
        <div className="px-5 pb-5 space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl bg-foreground/[0.02] border border-border">
            <div>
              <p className="text-sm text-foreground/80">{copy.downloadData}</p>
              <p className="text-[11px] text-foreground/40">{copy.exportData}</p>
            </div>
            <Link
              href="/settings/export"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition"
            >
              <Download className="h-3 w-3" />{copy.export}
            </Link>
          </div>
        </div>
      </div>

      {/* Danger Zone — actual flow lives in <DeleteAccountDialog /> below. */}
      <div className="rounded-2xl border border-destructive bg-destructive/5 backdrop-blur-xl overflow-hidden">
        <div className="p-5 pb-3 flex items-center gap-2">
          <Trash2 className="h-4 w-4 text-destructive" />
          <h2 className="text-sm font-semibold text-destructive">{copy.dangerZone}</h2>
        </div>
        <div className="px-5 pb-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground/80">{copy.deleteAccount}</p>
              <p className="text-xs text-foreground/40">{copy.deleteBody}</p>
            </div>
            <button
              onClick={() => setDeleteOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-destructive/10 border border-destructive text-destructive text-xs font-medium hover:bg-destructive transition"
            >
              {copy.deleteAccount}
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
