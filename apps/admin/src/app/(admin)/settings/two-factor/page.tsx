"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ShieldCheck, ShieldOff, Copy, Download, Loader2, KeyRound,
  CheckCircle2, AlertTriangle, ArrowLeft, Eye, EyeOff, Lock,
} from "lucide-react";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin-page-header";

type MfaStatus = "loading" | "disabled" | "enabled";
type SetupStep = "idle" | "confirming" | "scanning" | "verifying" | "done";

const inputCls = "w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export default function TwoFactorPage() {
  const searchParams = useSearchParams();
  // Middleware redirects SUPER_ADMIN here with `?required=1` when their
  // JWT lacks `mfaEnabled`. The banner explains why the rest of the panel
  // is gated and the Back link is hidden until setup completes.
  const enrollmentRequired = searchParams.get("required") === "1";
  const [status, setStatus] = useState<MfaStatus>("loading");
  const [setupStep, setSetupStep] = useState<SetupStep>("idle");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [provisioningURI, setProvisioningURI] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verifyCode, setVerifyCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableMfaCode, setDisableMfaCode] = useState("");
  const [disableBackupCode, setDisableBackupCode] = useState("");
  const [disableStepUpHint, setDisableStepUpHint] = useState<string | null>(null);
  const [disabling, setDisabling] = useState(false);
  const [showDisable, setShowDisable] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        setStatus(data.admin?.mfaEnabled ? "enabled" : "disabled");
      })
      .catch(() => setStatus("disabled"));
  }, []);

  async function handleSetupInit() {
    if (!confirmPassword) { toast.error("Password required"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/mfa/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Setup failed");
        return;
      }
      setProvisioningURI(data.provisioningURI);
      setQrDataUrl(data.qrDataUrl || "");
      setSecret(data.secret);
      setBackupCodes(data.backupCodes || []);
      setSetupStep("scanning");
    } catch { toast.error("Setup failed"); }
    finally { setLoading(false); }
  }

  async function handleVerify() {
    if (verifyCode.length !== 6) { toast.error("Enter a 6-digit code"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: verifyCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Verification failed");
        return;
      }
      setSetupStep("done");
      setStatus("enabled");
      toast.success("Two-factor authentication enabled!");
    } catch { toast.error("Verification failed"); }
    finally { setLoading(false); }
  }

  async function handleDisable() {
    if (!disablePassword) { toast.error("Password required"); return; }
    setDisabling(true);
    try {
      const res = await fetch("/api/auth/mfa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmPassword: disablePassword,
          mfaCode: disableMfaCode.trim() || undefined,
          backupCode: disableBackupCode.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.requiresMfa) {
          setDisableStepUpHint("Enter an authenticator code or a backup code to disable 2FA.");
        }
        // Keep typed values so the operator can correct a single field
        // instead of starting over. Clear only the one-time codes — re-using
        // a code that was rejected once will never succeed.
        setDisableMfaCode("");
        setDisableBackupCode("");
        toast.error(data.error || "Failed to disable");
        return;
      }
      setStatus("disabled");
      setShowDisable(false);
      setDisablePassword("");
      setDisableMfaCode("");
      setDisableBackupCode("");
      setDisableStepUpHint(null);
      setSetupStep("idle");
      toast.success("Two-factor authentication disabled. Sign in again.");
      window.location.assign("/login");
    } catch { toast.error("Failed to disable MFA"); }
    finally { setDisabling(false); }
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  }

  function downloadBackupCodes() {
    const content = [
      "LocateFlow Admin — 2FA Backup Codes",
      "====================================",
      `Generated: ${new Date().toISOString()}`,
      "",
      "Each code can only be used once.",
      "Store these codes in a safe place.",
      "",
      ...backupCodes.map((code, i) => `${i + 1}. ${code}`),
    ].join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "locateflow-admin-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Backup codes downloaded");
  }

  // QR code rendered server-side and returned as a data: URL. Keeps the
  // TOTP secret off third-party services and satisfies the admin CSP's
  // img-src 'self' data: blob: directive without a host exception.
  const qrUrl = qrDataUrl;

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const showEnrollmentBanner = enrollmentRequired && status === "disabled";

  return (
    <div className="space-y-6 max-w-2xl">
      <AdminPageHeader
        eyebrow="Security"
        title="Two-Factor <em>Authentication</em>"
        subtitle="Add an extra layer of security to your admin account"
        actions={
          <>
            {!showEnrollmentBanner && (
              <Link href="/settings" aria-label="Back to settings" className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            )}
          </>
        }
      />

      {showEnrollmentBanner && (
        <div
          role="alert"
          className="rounded-xl border border-tone-honey-br bg-tone-honey-bg p-4 flex items-start gap-3"
        >
          <div className="rounded-lg bg-tone-honey-bg p-2 mt-0.5">
            <Lock className="h-5 w-5 text-tone-honey-fg" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-foreground">
              Two-factor enrollment is required for your role
            </p>
            <p className="text-sm text-muted-foreground">
              SUPER_ADMIN accounts must enroll MFA before accessing the rest
              of the admin panel. Complete the steps below — the rest of the
              navigation will unlock automatically once MFA is verified.
            </p>
          </div>
        </div>
      )}

      {/* Current Status */}
      <div className={`rounded-xl border p-6 ${status === "enabled" ? "border-tone-sage-br bg-tone-sage-bg" : "border-border bg-card"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {status === "enabled" ? (
              <div className="rounded-lg bg-tone-sage-bg p-2.5">
                <ShieldCheck className="h-6 w-6 text-tone-sage-fg" />
              </div>
            ) : (
              <div className="rounded-lg bg-tone-honey-bg p-2.5">
                <AlertTriangle className="h-6 w-6 text-tone-honey-fg" />
              </div>
            )}
            <div>
              <p className="font-semibold text-foreground">
                {status === "enabled" ? "2FA is enabled" : "2FA is not enabled"}
              </p>
              <p className="text-sm text-muted-foreground">
                {status === "enabled"
                  ? "Your account is protected with an authenticator app"
                  : "Your account is only protected by a password"}
              </p>
            </div>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${status === "enabled" ? "bg-tone-sage-bg text-tone-sage-fg" : "bg-tone-honey-bg text-tone-honey-fg"}`}>
            {status === "enabled" ? "Active" : "Inactive"}
          </span>
        </div>
      </div>

      {/* Setup Flow — Disabled state */}
      {status === "disabled" && setupStep === "idle" && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <KeyRound className="h-5 w-5" /> Enable Two-Factor Authentication
          </h2>
          <p className="text-sm text-muted-foreground">
            You&apos;ll need an authenticator app like <strong>Google Authenticator</strong>, <strong>Authy</strong>, or <strong>1Password</strong>.
          </p>
          <button onClick={() => setSetupStep("confirming")}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Set Up 2FA
          </button>
        </div>
      )}

      {/* Step 1: Password Confirmation */}
      {setupStep === "confirming" && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Confirm Your Password</h2>
          <p className="text-sm text-muted-foreground">Enter your admin password to continue the 2FA setup.</p>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Enter your password"
            className={inputCls}
            onKeyDown={(e) => e.key === "Enter" && handleSetupInit()}
          />
          <div className="flex gap-2">
            <button onClick={handleSetupInit} disabled={loading || !confirmPassword}
              className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Continue
            </button>
            <button onClick={() => { setSetupStep("idle"); setConfirmPassword(""); }}
              className="rounded-lg border border-border px-5 py-2.5 text-sm text-muted-foreground hover:bg-accent">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Scan QR Code */}
      {setupStep === "scanning" && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-5">
          <h2 className="text-lg font-semibold text-foreground">Scan QR Code</h2>
          <p className="text-sm text-muted-foreground">
            Scan this QR code with your authenticator app, or enter the secret key manually.
          </p>

          <div className="flex flex-col items-center gap-4">
            {qrUrl && (
              <div className="rounded-xl border border-border bg-card p-4">
                <img src={qrUrl} alt="2FA QR Code" width={240} height={240} className="block" />
              </div>
            )}

            <div className="w-full rounded-lg bg-muted/30 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase">Manual Entry Key</p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setShowSecret(!showSecret)} aria-label={showSecret ? "Hide secret key" : "Show secret key"} aria-pressed={showSecret} className="rounded p-1 text-muted-foreground hover:text-foreground">
                    {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => copyToClipboard(secret, "Secret key")} aria-label="Copy secret key" className="rounded p-1 text-muted-foreground hover:text-foreground">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-sm font-mono text-foreground tracking-wider break-all">
                {showSecret ? secret : "••••••••••••••••••••••••••••••••"}
              </p>
            </div>
          </div>

          {/* Backup Codes */}
          <div className="rounded-lg border border-tone-honey-br bg-tone-honey-bg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-tone-honey-fg" /> Backup Codes
              </p>
              <button onClick={downloadBackupCodes}
                className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent">
                <Download className="h-3 w-3" /> Download
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Save these backup codes in a safe place. Each can only be used once if you lose access to your authenticator.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {backupCodes.map((code, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                  <span className="font-mono text-sm text-foreground">{code}</span>
                  <button onClick={() => copyToClipboard(code, "Code")} aria-label="Copy backup code" className="text-muted-foreground hover:text-foreground">
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button onClick={() => setSetupStep("verifying")}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            I&apos;ve saved the backup codes — Continue
          </button>
        </div>
      )}

      {/* Step 3: Verify Code */}
      {setupStep === "verifying" && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Verify Setup</h2>
          <p className="text-sm text-muted-foreground">
            Enter the 6-digit code from your authenticator app to confirm the setup.
          </p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            className={inputCls + " text-center text-2xl tracking-[0.5em] font-mono max-w-xs"}
            onKeyDown={(e) => e.key === "Enter" && verifyCode.length === 6 && handleVerify()}
          />
          <div className="flex gap-2">
            <button onClick={handleVerify} disabled={loading || verifyCode.length !== 6}
              className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Verify & Enable
            </button>
            <button onClick={() => setSetupStep("scanning")}
              className="rounded-lg border border-border px-5 py-2.5 text-sm text-muted-foreground hover:bg-accent">
              Back
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Done */}
      {setupStep === "done" && (
        <div className="rounded-xl border border-tone-sage-br bg-tone-sage-bg p-6 text-center space-y-3">
          <CheckCircle2 className="h-12 w-12 text-tone-sage-fg mx-auto" />
          <h2 className="text-lg font-semibold text-foreground">Two-Factor Authentication Enabled</h2>
          <p className="text-sm text-muted-foreground">
            Your account is now secured with an authenticator app. You&apos;ll need to enter a code each time you sign in.
          </p>
          <Link href="/settings" className="inline-block rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-accent">
            Back to Settings
          </Link>
        </div>
      )}

      {/* Disable 2FA (only when enabled) */}
      {status === "enabled" && setupStep !== "done" && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <ShieldOff className="h-5 w-5 text-destructive" /> Disable Two-Factor Authentication
              </h2>
              <p className="text-sm text-muted-foreground mt-1">This will remove the extra security layer from your account.</p>
            </div>
            {!showDisable && (
              <button onClick={() => setShowDisable(true)}
                className="rounded-lg border border-destructive/30 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10">
                Disable 2FA
              </button>
            )}
          </div>
          {showDisable && (
            <div className="space-y-3 pt-2 border-t border-border">
              <input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                placeholder="Confirm your password"
                className={inputCls}
                onKeyDown={(e) => e.key === "Enter" && handleDisable()}
              />
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={disableMfaCode}
                onChange={(e) => setDisableMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="Authenticator code"
                className={inputCls}
              />
              <input
                type="text"
                maxLength={16}
                value={disableBackupCode}
                onChange={(e) => setDisableBackupCode(e.target.value.toUpperCase().slice(0, 16))}
                placeholder="Backup code"
                className={inputCls}
              />
              {disableStepUpHint && (
                <p className="text-xs text-tone-honey-fg">{disableStepUpHint}</p>
              )}
              <div className="flex gap-2">
                <button onClick={handleDisable} disabled={disabling || !disablePassword}
                  className="flex items-center gap-2 rounded-lg bg-destructive px-5 py-2.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50">
                  {disabling ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Confirm Disable
                </button>
                <button onClick={() => { setShowDisable(false); setDisablePassword(""); }}
                  className="rounded-lg border border-border px-5 py-2.5 text-sm text-muted-foreground hover:bg-accent">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
