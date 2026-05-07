"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Lock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Step = "warning" | "confirm";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail: string | null | undefined;
  hasPasswordLogin: boolean;
  mfaEnabled: boolean;
  onRequestSetPasswordEmail?: () => Promise<void> | void;
  setPasswordBusy?: boolean;
};

export function DeleteAccountDialog({
  open,
  onOpenChange,
  userEmail,
  hasPasswordLogin,
  mfaEnabled,
  onRequestSetPasswordEmail,
  setPasswordBusy,
}: Props) {
  const [step, setStep] = useState<Step>("warning");
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep("warning");
      setTyped("");
      setPassword("");
      setMfaCode("");
      setMfaRequired(false);
      setSubmitting(false);
    }
  }, [open]);

  const normalizedEmail = (userEmail ?? "").trim().toLowerCase();
  const trimmedTyped = typed.trim();
  const typedOk =
    trimmedTyped === "DELETE" ||
    (normalizedEmail.length > 0 && trimmedTyped.toLowerCase() === normalizedEmail);
  const showMfa = mfaEnabled || mfaRequired;
  const canSubmit =
    typedOk &&
    password.length > 0 &&
    (!showMfa || mfaCode.trim().length > 0) &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmPassword: password,
          ...(showMfa && mfaCode ? { mfaCode: mfaCode.trim() } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data?.code === "STEP_UP_REQUIRED") {
          setMfaRequired(true);
          toast.error(data.error || "Enter your two-factor code to continue.");
        } else {
          toast.error(data?.error || "Failed to delete account");
        }
        setSubmitting(false);
        return;
      }

      await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "locateflow",
        },
        body: "{}",
        cache: "no-store",
      }).catch(() => {});

      toast.success(data?.message || "Account deletion initiated.");
      setTimeout(() => {
        window.location.href = "/";
      }, 1500);
    } catch {
      toast.error("Network error. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-4rem)] space-y-4 overflow-y-auto pr-6">
        {!hasPasswordLogin ? (
          <>
            <DialogHeader>
              <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-tone-honey-bg">
                <Lock className="h-5 w-5 text-tone-honey-fg" />
              </div>
              <DialogTitle>Set a password first</DialogTitle>
              <DialogDescription>
                This account uses Google or Apple sign-in. To delete it we need
                you to set a password from a one-time email link.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-xl px-4 py-2 text-sm text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void onRequestSetPasswordEmail?.()}
                disabled={!!setPasswordBusy || !onRequestSetPasswordEmail}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-tone-orange-fg px-4 py-2 text-sm font-medium text-white transition hover:bg-tone-orange-bg disabled:opacity-50"
              >
                {setPasswordBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
                Email setup link
              </button>
            </div>
          </>
        ) : step === "warning" ? (
          <>
            <DialogHeader>
              <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-destructive/15">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <DialogTitle>Delete your account?</DialogTitle>
              <DialogDescription>
                This permanently removes your account and everything attached
                to it. There is no undo.
              </DialogDescription>
            </DialogHeader>
            <ul className="space-y-1.5 rounded-xl border border-destructive bg-destructive/5 p-4 text-xs text-muted-foreground">
              <li>All addresses, services, providers, and budgets</li>
              <li>Moving plans, tasks, documents, and notifications</li>
              <li>Active subscription is canceled at Stripe</li>
              <li>Sign-in sessions on every device are invalidated</li>
            </ul>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-xl px-4 py-2 text-sm text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
              >
                Keep my account
              </button>
              <button
                type="button"
                onClick={() => setStep("confirm")}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive ring-1 ring-primary/30 transition hover:bg-destructive"
              >
                <Trash2 className="h-4 w-4" />
                I understand, continue
              </button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-destructive/15">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
              <DialogTitle>Final confirmation</DialogTitle>
              <DialogDescription>
                Type your email{" "}
                <span className="font-mono text-foreground">
                  {userEmail || "(your email)"}
                </span>{" "}
                or <span className="font-mono font-semibold text-destructive">DELETE</span>{" "}
                to confirm.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label htmlFor="delete-typed" className="text-xs font-medium text-muted-foreground">
                  Confirm
                </label>
                <input
                  id="delete-typed"
                  className="w-full rounded-xl border border-destructive bg-foreground/5 px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-destructive/40"
                  placeholder={userEmail || "DELETE"}
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  disabled={submitting}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="delete-password" className="text-xs font-medium text-muted-foreground">
                  Your password
                </label>
                <PasswordInput
                  id="delete-password"
                  className="w-full rounded-xl border border-destructive bg-foreground/5 px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-destructive/40"
                  autoComplete="current-password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                />
              </div>

              {showMfa && (
                <div className="space-y-1.5">
                  <label htmlFor="delete-mfa" className="text-xs font-medium text-muted-foreground">
                    Two-factor code
                  </label>
                  <input
                    id="delete-mfa"
                    className="w-full rounded-xl border border-destructive bg-foreground/5 px-3 py-2 text-sm tracking-widest text-foreground placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-destructive/40"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    value={mfaCode}
                    onChange={(e) =>
                      setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 8))
                    }
                    disabled={submitting}
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setStep("warning")}
                disabled={submitting}
                className="rounded-xl px-4 py-2 text-sm text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground disabled:opacity-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-destructive px-4 py-2 text-sm font-medium text-white transition hover:bg-destructive/80 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Permanently delete
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
