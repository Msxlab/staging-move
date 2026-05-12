"use client";

import { useEffect, useRef, useState } from "react";
import { X, KeyRound } from "lucide-react";

export interface StepUpValues {
  confirmPassword: string;
  mfaCode?: string;
  backupCode?: string;
}

export function PasswordConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  busy = false,
  error,
  /**
   * When true, the server has signalled that an MFA code (or backup
   * code) is mandatory for this operation — usually because the
   * admin's account has MFA enabled and step-up `requireMfa` is set.
   * The submit button is disabled until one of the two fields has a
   * value, the MFA field is auto-focused, and a hint is shown so the
   * operator knows which field is the missing piece. Without this,
   * the previous UX cleared all fields on every 403 and operators
   * couldn't tell whether to re-type the password or add an MFA code.
   */
  requiresMfa = false,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  error?: string | null;
  requiresMfa?: boolean;
  onClose: () => void;
  onConfirm: (password: string, values: StepUpValues) => void | Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const mfaInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      setPassword("");
      setMfaCode("");
      setBackupCode("");
    }
  }, [open]);

  // When the server signals that MFA was the missing piece, focus the
  // MFA field so the operator can fix it without hunting for the cursor.
  useEffect(() => {
    if (open && requiresMfa) mfaInputRef.current?.focus();
  }, [open, requiresMfa]);

  if (!open) return null;

  const hasMfaCredential = Boolean(mfaCode.trim() || backupCode.trim());
  const submitDisabled = busy || !password.trim() || (requiresMfa && !hasMfaCredential);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 backdrop-blur-sm p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-confirm-title"
        aria-describedby="password-confirm-description"
        className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="password-confirm-title" className="text-base font-semibold text-foreground">
              {title}
            </h2>
            <p id="password-confirm-description" className="mt-1 text-sm text-muted-foreground">
              {description}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          className="mt-5 space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (submitDisabled) return;
            try {
              await onConfirm(password, {
                confirmPassword: password,
                mfaCode: mfaCode.trim() || undefined,
                backupCode: backupCode.trim() || undefined,
              });
            } finally {
              // Clear the one-time MFA + backup codes (re-using a code
              // that was rejected once won't ever succeed) but keep the
              // password so the operator only has to add the missing
              // MFA piece on retry instead of starting from zero.
              setMfaCode("");
              setBackupCode("");
            }
          }}
        >
          <div>
            <label htmlFor="admin-password-confirm" className="mb-1 block text-xs font-medium text-muted-foreground">
              Admin password
            </label>
            <input
              id="admin-password-confirm"
              type="password"
              autoComplete="off"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              autoFocus
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="admin-mfa-confirm" className="mb-1 block text-xs font-medium text-muted-foreground">
                MFA code{requiresMfa ? <span className="ml-1 text-destructive">*</span> : null}
              </label>
              <input
                id="admin-mfa-confirm"
                ref={mfaInputRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={mfaCode}
                onChange={(event) => setMfaCode(event.target.value)}
                disabled={busy}
                aria-required={requiresMfa || undefined}
                className={`w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 ${
                  requiresMfa ? "border-destructive/40 focus:border-destructive" : "border-input focus:border-primary"
                }`}
              />
            </div>
            <div>
              <label htmlFor="admin-backup-code-confirm" className="mb-1 block text-xs font-medium text-muted-foreground">
                Backup code
              </label>
              <input
                id="admin-backup-code-confirm"
                type="text"
                autoComplete="one-time-code"
                value={backupCode}
                onChange={(event) => setBackupCode(event.target.value)}
                disabled={busy}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
              />
            </div>
          </div>
          {requiresMfa ? (
            <div role="status" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <KeyRound className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                MFA is required for this operation. Enter a current authenticator code <em>or</em> an unused backup code in addition to your password.
              </span>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Most destructive actions require a current authenticator code or
              an unused backup code in addition to your password. Leave both
              blank only if the action explicitly says password is enough.
            </p>
          )}

          {error ? (
            <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitDisabled}
              className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              {busy ? "Confirming..." : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
