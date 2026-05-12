"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

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
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: (password: string, values: StepUpValues) => void | Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [backupCode, setBackupCode] = useState("");

  useEffect(() => {
    if (!open) {
      setPassword("");
      setMfaCode("");
      setBackupCode("");
    }
  }, [open]);

  if (!open) return null;

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
            if (!password.trim() || busy) return;
            try {
              await onConfirm(password, {
                confirmPassword: password,
                mfaCode: mfaCode.trim() || undefined,
                backupCode: backupCode.trim() || undefined,
              });
            } finally {
              setPassword("");
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
                MFA code
              </label>
              <input
                id="admin-mfa-confirm"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={mfaCode}
                onChange={(event) => setMfaCode(event.target.value)}
                disabled={busy}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
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
              disabled={busy || !password.trim()}
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
