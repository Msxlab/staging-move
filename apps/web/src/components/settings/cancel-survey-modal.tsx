"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

/**
 * Cancellation survey — shown the moment the user clicks "Cancel renewal"
 * or "Cancel trial", before we send the cancel request to Stripe. The user
 * can either pick a reason (and optionally add a comment) and confirm, or
 * skip the survey and cancel anyway. Confirming both submits the reason
 * AND triggers the cancel; skipping only triggers the cancel.
 *
 * Why this exists: a one-click cancel teaches us nothing about churn. The
 * reason category powers a save-flow (e.g. "Too expensive" → discount offer)
 * and the free-text comment feeds the product roadmap.
 *
 * The parent owns the actual API call so the modal stays focused on
 * capturing intent — it just hands the chosen reason back via `onConfirm`.
 */

export type CancelReasonCode =
  | "too_expensive"
  | "not_using"
  | "missing_feature"
  | "found_alternative"
  | "just_trying"
  | "technical_issue"
  | "other";

type ReasonOption = {
  code: CancelReasonCode;
  label: string;
  /** When set, the comment textarea is required for this reason. */
  requiresComment?: boolean;
};

const REASONS: ReasonOption[] = [
  { code: "too_expensive", label: "Too expensive" },
  { code: "not_using", label: "I'm not using it enough" },
  { code: "missing_feature", label: "Missing a feature I need", requiresComment: true },
  { code: "found_alternative", label: "Switched to another tool" },
  { code: "just_trying", label: "I was only trying it out" },
  { code: "technical_issue", label: "Ran into bugs or technical issues", requiresComment: true },
  { code: "other", label: "Other" },
];

export type CancelSurveyModalProps = {
  open: boolean;
  /** "trial" tweaks the headline copy; otherwise the modal is identical. */
  flavor: "trial" | "renewal";
  /** True while the cancel request is in flight. Locks the buttons. */
  pending: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    reason: CancelReasonCode | null;
    comment: string;
  }) => void;
};

export function CancelSurveyModal({
  open,
  flavor,
  pending,
  onClose,
  onConfirm,
}: CancelSurveyModalProps) {
  const [reason, setReason] = useState<CancelReasonCode | null>(null);
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (!open) {
      setReason(null);
      setComment("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, pending, onClose]);

  if (!open) return null;

  const selectedOption = REASONS.find((option) => option.code === reason);
  const commentRequired = Boolean(selectedOption?.requiresComment);
  const commentMissing = commentRequired && comment.trim().length === 0;

  const handleConfirm = () => {
    if (pending) return;
    if (commentMissing) return;
    onConfirm({ reason, comment: comment.trim() });
  };

  const handleSkip = () => {
    if (pending) return;
    onConfirm({ reason: null, comment: "" });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-survey-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      onClick={() => {
        if (!pending) onClose();
      }}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border bg-card p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          aria-label="Close"
          className="absolute top-3 right-3 rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-foreground/5 disabled:opacity-60"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="space-y-1 pr-8">
          <h2 id="cancel-survey-title" className="text-lg font-semibold text-foreground">
            Before you go — what's making you {flavor === "trial" ? "end the trial" : "cancel renewal"}?
          </h2>
          <p className="text-sm text-muted-foreground">
            Pick the closest reason so we can keep improving LocateFlow. This is optional —
            you can skip and cancel anyway.
          </p>
        </div>

        <fieldset className="mt-5 space-y-2" disabled={pending}>
          <legend className="sr-only">Cancellation reason</legend>
          {REASONS.map((option) => {
            const checked = reason === option.code;
            return (
              <label
                key={option.code}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${
                  checked
                    ? "border-foreground/40 bg-foreground/5 text-foreground"
                    : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                }`}
              >
                <input
                  type="radio"
                  name="cancel-reason"
                  value={option.code}
                  checked={checked}
                  onChange={() => setReason(option.code)}
                  className="h-4 w-4 accent-foreground"
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </fieldset>

        {reason ? (
          <div className="mt-4">
            <label
              htmlFor="cancel-comment"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              {commentRequired ? "Tell us more (required)" : "Tell us more (optional)"}
            </label>
            <textarea
              id="cancel-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value.slice(0, 500))}
              disabled={pending}
              rows={3}
              maxLength={500}
              placeholder={
                reason === "missing_feature"
                  ? "Which feature would have changed your mind?"
                  : reason === "technical_issue"
                    ? "What went wrong? A short description helps us reproduce it."
                    : "Anything else that would help us understand."
              }
              className="mt-1 w-full rounded-xl border border-border bg-background/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-foreground/40 focus:outline-none disabled:opacity-60"
            />
            <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
              <span>{commentMissing ? "Required for this reason." : ""}</span>
              <span>{comment.length}/500</span>
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground disabled:opacity-60"
          >
            Keep subscription
          </button>
          <button
            type="button"
            onClick={handleSkip}
            disabled={pending}
            className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground disabled:opacity-60"
          >
            {pending ? "Cancelling..." : "Skip & cancel anyway"}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={pending || !reason || commentMissing}
            className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm font-semibold text-destructive transition hover:bg-destructive/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Cancelling..." : "Confirm cancellation"}
          </button>
        </div>
      </div>
    </div>
  );
}
