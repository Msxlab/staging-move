"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, Check, Loader2, Plus, Users, X } from "lucide-react";
import { seatLimitForPlan } from "@locateflow/shared";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Household activation card — the guided "invite your household" moment for a
 * Family/Pro buyer who hasn't shared their workspace yet.
 *
 * Top-level dashboard card (like the pending-invitations banner — NOT a widget
 * key, so it is never part of the order/visibility/collapse prefs). Reuses the
 * existing workspace APIs end to end:
 *   - GET  /api/workspaces                      → eligibility (404 = flag off)
 *   - GET  /api/workspaces/[id]/invitations     → no-pending check
 *   - POST /api/workspaces                      → create (only when none exists)
 *   - PATCH /api/workspaces/[id]                → rename
 *   - POST /api/workspaces/[id]/invitations     → one invite per email
 * No new endpoints; all seat-limit / role / COPPA gating stays server-side
 * (we only ever invite role MEMBER, which carries no consent requirement).
 *
 * Shown only when ALL hold: effective plan is FAMILY/PRO; the user's own
 * workspace has no other members AND no pending invitations (or they have no
 * workspace yet — provisioning is best-effort); not dismissed. Dismissal
 * persists in localStorage, same pattern as the move-briefing card.
 *
 * Checkout handoff: landing on /dashboard?household=setup auto-opens the
 * guided modal exactly once (the param is stripped afterwards).
 */

const DISMISSED_KEY = "locateflow.householdActivation.dismissed";
/** Mirrors the validation in POST /api/workspaces/[id]/invitations. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Subset of GET /api/workspaces entries the visibility predicate needs. */
export interface ActivationWorkspace {
  id: string;
  name: string;
  role: string;
  status: string;
  seatLimit: number;
  memberCount: number;
  deletedAt: string | null;
}

export function isHouseholdPlan(plan: string | null | undefined): boolean {
  const upper = (plan || "").toUpperCase();
  return upper === "FAMILY" || upper === "PRO";
}

/**
 * The workspace this user would activate: one they OWN, with active status,
 * not deleted, multi-seat (seatLimit > 1 — i.e. not a personal-solo data
 * container), and still member-empty (just the owner). Null when none fits.
 */
export function eligibleActivationWorkspace(
  plan: string | null | undefined,
  workspaces: ActivationWorkspace[],
): ActivationWorkspace | null {
  if (!isHouseholdPlan(plan)) return null;
  return (
    workspaces.find(
      (w) =>
        w.role === "OWNER" &&
        w.status === "ACTIVE" &&
        !w.deletedAt &&
        w.seatLimit > 1 &&
        w.memberCount <= 1,
    ) ?? null
  );
}

/**
 * Pure visibility predicate for the card (exported for tests).
 *
 * `pendingInvitationCount === null` means the pending check failed or hasn't
 * run — fail CLOSED so we never nag a household that may already have
 * outstanding invites. An empty workspace list still shows the card (new-user
 * provisioning is best-effort; the modal creates the workspace), but any other
 * membership — a shared household they joined, a populated workspace — means
 * activation isn't this user's gap.
 */
export function shouldShowHouseholdActivation(args: {
  plan: string | null | undefined;
  workspaces: ActivationWorkspace[];
  pendingInvitationCount: number | null;
  dismissed: boolean;
}): boolean {
  if (args.dismissed) return false;
  if (!isHouseholdPlan(args.plan)) return false;
  if (args.pendingInvitationCount !== 0) return false;
  if (args.workspaces.length === 0) return true;
  return eligibleActivationWorkspace(args.plan, args.workspaces) !== null;
}

interface InviteFailure {
  email: string;
  error: string;
}

interface SetupResult {
  invited: string[];
  failed: InviteFailure[];
  householdName: string;
}

export function HouseholdActivationCard({ plan }: { plan: string | null }) {
  const td = useTranslations("dashboard");
  // undefined while reading localStorage (briefing-card pattern: no flash
  // before the persisted dismissal state is known).
  const [dismissed, setDismissed] = useState<boolean | undefined>(undefined);
  const [workspaces, setWorkspaces] = useState<ActivationWorkspace[] | null>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [emails, setEmails] = useState<string[]>(["", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<SetupResult | null>(null);
  const autoOpenConsumedRef = useRef(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISSED_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  // Eligibility fetch — only for Family/Pro and only once dismissal is known
  // (a dismissed card costs zero requests). Any failure renders nothing; when
  // workspace mode is disabled, GET /api/workspaces returns an empty list.
  useEffect(() => {
    if (dismissed !== false || !isHouseholdPlan(plan)) return;
    let cancelled = false;
    (async () => {
      try {
        const wsRes = await fetch("/api/workspaces", { cache: "no-store" });
        if (!wsRes.ok) return;
        const wsData = await wsRes.json().catch(() => ({}));
        if (wsData.workspaceModelEnabled === false) return;
        const list: ActivationWorkspace[] = Array.isArray(wsData.workspaces)
          ? wsData.workspaces
          : [];
        if (cancelled) return;
        const target = eligibleActivationWorkspace(plan, list);
        if (list.length > 0 && !target) {
          // Not this user's gap (shared/populated workspace) — stay hidden.
          setWorkspaces(list);
          return;
        }
        if (!target) {
          // No workspace at all: the modal creates one; nothing pending.
          setWorkspaces(list);
          setPendingCount(0);
          return;
        }
        const invRes = await fetch(`/api/workspaces/${target.id}/invitations`, {
          cache: "no-store",
        });
        if (!invRes.ok || cancelled) return; // unknown pending state → fail closed
        const invData = await invRes.json().catch(() => ({}));
        if (cancelled) return;
        setWorkspaces(list);
        setPendingCount(Array.isArray(invData.invitations) ? invData.invitations.length : null);
        setName(target.name);
      } catch {
        /* network error → render nothing */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dismissed, plan]);

  const target = workspaces ? eligibleActivationWorkspace(plan, workspaces) : null;
  const visible =
    workspaces !== null &&
    shouldShowHouseholdActivation({
      plan,
      workspaces,
      pendingInvitationCount: pendingCount,
      dismissed: dismissed !== false,
    });

  // Seats available to invite: everything except the owner's own seat.
  const maxInvites = Math.max(1, (target?.seatLimit ?? seatLimitForPlan(plan)) - 1);

  // Checkout handoff: /dashboard?household=setup opens the modal exactly once
  // after eligibility resolves, then strips the param so refresh/back-nav
  // doesn't re-open it. A non-eligible user simply never consumes it.
  useEffect(() => {
    if (!visible || autoOpenConsumedRef.current) return;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("household") !== "setup") return;
      autoOpenConsumedRef.current = true;
      setOpen(true);
      params.delete("household");
      const qs = params.toString();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`,
      );
    } catch {
      /* non-blocking */
    }
  }, [visible]);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      /* ignore storage failures */
    }
  };

  const closeModal = (next: boolean) => {
    if (submitting) return;
    setOpen(next);
    if (!next) {
      setFormError(null);
      // An all-failed result is transient — reopening should land back on the
      // form, not a stale failure screen. A successful result never reopens
      // (the card hides itself once invites are pending).
      setResult((prev) => (prev && prev.invited.length === 0 ? null : prev));
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);

    const trimmedName = name.trim();
    if (trimmedName.length < 1 || trimmedName.length > 60) {
      setFormError(td("household_nameInvalid"));
      return;
    }
    // Dedupe case-insensitively — the server lowercases invited emails too.
    const cleaned: string[] = [];
    const seen = new Set<string>();
    for (const raw of emails) {
      const email = raw.trim();
      if (!email) continue;
      const lower = email.toLowerCase();
      if (seen.has(lower)) continue;
      seen.add(lower);
      cleaned.push(email);
    }
    if (cleaned.length === 0) {
      setFormError(td("household_noEmails"));
      return;
    }
    const invalid = cleaned.find((email) => !EMAIL_RE.test(email));
    if (invalid) {
      setFormError(td("household_emailInvalid", { email: invalid }));
      return;
    }

    setSubmitting(true);
    try {
      let workspaceId = target?.id ?? null;
      if (!workspaceId) {
        // No owned workspace yet — create it (Family/Pro-gated server-side).
        const res = await fetch("/api/workspaces", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmedName }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || typeof data.id !== "string") {
          setFormError(data.error || td("household_error"));
          return;
        }
        workspaceId = data.id;
      } else if (target && trimmedName !== target.name) {
        // Rename the auto-provisioned workspace to the chosen household name
        // (OWNER-gated server-side).
        const res = await fetch(`/api/workspaces/${workspaceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmedName }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setFormError(data.error || td("household_error"));
          return;
        }
      }

      // One invite per email through the existing endpoint, sequentially, so
      // each gets its own seat-limit / duplicate / rate-limit verdict and we
      // can report per-address outcomes honestly.
      const invited: string[] = [];
      const failed: InviteFailure[] = [];
      for (const email of cleaned) {
        try {
          const res = await fetch(`/api/workspaces/${workspaceId}/invitations`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, role: "MEMBER" }),
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok) invited.push(email);
          else failed.push({ email, error: data.error || td("household_error") });
        } catch {
          failed.push({ email, error: td("household_error") });
        }
      }
      setResult({ invited, failed, householdName: trimmedName });
      if (invited.length > 0) {
        // Outstanding invites now exist — the predicate hides the card as
        // soon as the modal closes.
        setPendingCount((prev) => (prev ?? 0) + invited.length);
      }
    } finally {
      setSubmitting(false);
    }
  }

  // While submitted invites exist, keep rendering so the open modal (success
  // state) isn't unmounted by the card's own predicate flipping false.
  if (dismissed !== false || (!visible && !(open && result))) return null;

  return (
    <>
      <section className="relative rounded-2xl border border-border bg-foreground/[0.03] p-4">
        <div className="flex flex-col gap-3 pr-8 sm:flex-row sm:items-center sm:pr-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
            <Users className="h-4 w-4 text-primary" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {td("household_eyebrow")}
            </p>
            <h2 className="mt-0.5 text-sm font-semibold text-foreground">
              {td("household_title")}
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {td("household_body", { count: maxInvites })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            {td("household_cta")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label={td("household_dismiss")}
            className="absolute right-3 top-3 shrink-0 rounded-md p-1 text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground sm:static"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </section>

      <Dialog open={open} onOpenChange={closeModal}>
        <DialogContent>
          {result ? (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle>
                  {result.invited.length > 0
                    ? td("household_successTitle")
                    : td("household_partialTitle")}
                </DialogTitle>
                <DialogDescription>
                  {result.invited.length > 0
                    ? td("household_successBody", { name: result.householdName })
                    : td("household_partialBody")}
                </DialogDescription>
              </DialogHeader>
              {result.invited.length > 0 && (
                <ul className="space-y-1.5">
                  {result.invited.map((email) => (
                    <li key={email} className="flex items-center gap-2 text-sm text-foreground">
                      <Check className="h-4 w-4 shrink-0 text-tone-emerald-fg" aria-hidden="true" />
                      <span className="truncate">{email}</span>
                    </li>
                  ))}
                </ul>
              )}
              {result.failed.length > 0 && (
                <div className="space-y-1 rounded-xl border border-destructive/40 bg-destructive/10 p-3">
                  {result.failed.map((f) => (
                    <p key={f.email} className="text-xs text-destructive">
                      {f.email} — {f.error}
                    </p>
                  ))}
                </div>
              )}
              <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
                <Link
                  href="/settings/workspace"
                  className="text-sm text-primary underline-offset-4 hover:underline"
                >
                  {td("household_manageLink")}
                </Link>
                {result.invited.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                  >
                    {td("household_done")}
                  </button>
                ) : (
                  // Nothing went through — back to the form to adjust and retry.
                  <button
                    type="button"
                    onClick={() => setResult(null)}
                    className="rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground transition hover:bg-foreground/5"
                  >
                    {td("household_back")}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <DialogHeader>
                <DialogTitle>{td("household_modal_title")}</DialogTitle>
                <DialogDescription>{td("household_modal_desc")}</DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5">
                <label htmlFor="household-name" className="text-sm font-medium text-foreground">
                  {td("household_nameLabel")}
                </label>
                <input
                  id="household-name"
                  value={name}
                  maxLength={60}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-foreground">
                  {td("household_emailsLabel")}
                </legend>
                <p className="text-xs text-muted-foreground">
                  {td("household_seatsHint", { count: maxInvites })}
                </p>
                {emails.map((value, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="email"
                      aria-label={td("household_emailFieldLabel", { index: i + 1 })}
                      placeholder="name@email.com"
                      value={value}
                      onChange={(e) =>
                        setEmails((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))
                      }
                      className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    {emails.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setEmails((prev) => prev.filter((_, j) => j !== i))}
                        aria-label={td("household_removeEmail")}
                        className="rounded-md p-1.5 text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                {emails.length < maxInvites && (
                  <button
                    type="button"
                    onClick={() => setEmails((prev) => [...prev, ""])}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" /> {td("household_addEmail")}
                  </button>
                )}
              </fieldset>
              {formError && (
                <p role="alert" className="text-sm text-destructive">
                  {formError}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={submitting}
                  className="rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground transition hover:bg-foreground/5 disabled:opacity-50"
                >
                  {td("household_cancel")}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  {submitting ? td("household_submitting") : td("household_submit")}
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
