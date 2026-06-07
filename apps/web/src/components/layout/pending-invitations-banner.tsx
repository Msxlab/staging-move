"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Mail, Check, X } from "lucide-react";

/**
 * Shape returned by GET /api/invitations/pending — a bare JSON array of the
 * caller's PENDING, non-expired invitations addressed to their account email.
 * Never carries a token/tokenHash; `id` is the handle for accept/decline.
 */
interface PendingInvitation {
  id: string;
  workspaceName: string | null;
  inviterName: string | null;
  role: string;
  expiresAt: string;
}

const KNOWN_ROLES = new Set(["OWNER", "ADMIN", "MEMBER", "CHILD", "VIEW_ONLY"]);

/**
 * In-app prompt for workspace invitations addressed to the signed-in user.
 *
 * Mounted in the authenticated AppShell so it surfaces on every app page. It
 * fetches GET /api/invitations/pending on mount and renders nothing while
 * loading, on error, or when the list is empty — so it is invisible for the
 * overwhelming majority of users who have no pending invite.
 *
 * Accept → POST .../accept, then router.refresh() so the server layout re-runs
 * and re-applies the new plan accent theme + workspace nav (the layout reads the
 * lf_workspace_id cookie the endpoint sets and recomputes the effective plan).
 * Decline → POST .../decline, then the invite is dropped from the local list.
 */
export function PendingInvitationsBanner() {
  const t = useTranslations("invitations");
  const router = useRouter();
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"accept" | "decline" | null>(null);
  // Start hidden; only ever shown once a non-empty list arrives.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/invitations/pending", { cache: "no-store" });
        if (!res.ok) return; // 401 / feature-off / 5xx → render nothing
        const data = await res.json().catch(() => null);
        if (cancelled || !Array.isArray(data)) return;
        setInvitations(data as PendingInvitation[]);
        setReady(true);
      } catch {
        /* network error → render nothing */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const roleLabel = useCallback(
    (role: string) => (KNOWN_ROLES.has(role) ? t(`role_${role}` as "role_MEMBER") : role),
    [t],
  );

  const accept = useCallback(
    async (inv: PendingInvitation) => {
      setBusyId(inv.id);
      setBusyAction("accept");
      try {
        const res = await fetch(`/api/invitations/pending/${inv.id}/accept`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Requested-With": "locateflow" },
          body: "{}",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(data.error || t("acceptError"));
          // 410 (gone/expired) or 409 (already member): drop the stale invite.
          if (res.status === 410 || res.status === 409 || res.status === 404) {
            setInvitations((prev) => prev.filter((i) => i.id !== inv.id));
          }
          return;
        }
        setInvitations((prev) => prev.filter((i) => i.id !== inv.id));
        toast.success(t("accepted", { workspace: inv.workspaceName || t("aWorkspace") }));
        // Re-run the server layout: it re-reads the lf_workspace_id cookie the
        // endpoint set and recomputes the effective plan, re-applying the
        // per-plan accent theme and the Household/Workspace nav entry.
        router.refresh();
      } catch {
        toast.error(t("acceptError"));
      } finally {
        setBusyId(null);
        setBusyAction(null);
      }
    },
    [router, t],
  );

  const decline = useCallback(
    async (inv: PendingInvitation) => {
      setBusyId(inv.id);
      setBusyAction("decline");
      try {
        const res = await fetch(`/api/invitations/pending/${inv.id}/decline`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Requested-With": "locateflow" },
          body: "{}",
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          toast.error(data.error || t("declineError"));
          if (res.status === 404) setInvitations((prev) => prev.filter((i) => i.id !== inv.id));
          return;
        }
        setInvitations((prev) => prev.filter((i) => i.id !== inv.id));
        toast.success(t("declined"));
      } catch {
        toast.error(t("declineError"));
      } finally {
        setBusyId(null);
        setBusyAction(null);
      }
    },
    [t],
  );

  if (!ready || invitations.length === 0) return null;

  return (
    <section
      aria-label={invitations.length === 1 ? t("headingOne") : t("headingMany", { count: invitations.length })}
      className="mb-5 space-y-3"
    >
      <p className="text-sm font-semibold text-foreground">
        {invitations.length === 1 ? t("headingOne") : t("headingMany", { count: invitations.length })}
      </p>
      {invitations.map((inv) => {
        const inviter = inv.inviterName || t("someone");
        const busy = busyId === inv.id;
        return (
          <div
            key={inv.id}
            data-testid="pending-invitation"
            className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-accent0/5 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Mail className="h-[18px] w-[18px]" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-foreground">
                  {inv.workspaceName
                    ? t("message", {
                        inviter,
                        workspace: inv.workspaceName,
                        role: roleLabel(inv.role),
                      })
                    : t("messageNoWorkspace", { inviter, role: roleLabel(inv.role) })}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:pl-3">
              <button
                type="button"
                onClick={() => void decline(inv)}
                disabled={busy}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground disabled:opacity-50"
              >
                {busy && busyAction === "decline" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <X className="h-4 w-4" aria-hidden="true" />
                )}
                {busy && busyAction === "decline" ? t("declining") : t("decline")}
              </button>
              <button
                type="button"
                onClick={() => void accept(inv)}
                disabled={busy}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
              >
                {busy && busyAction === "accept" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Check className="h-4 w-4" aria-hidden="true" />
                )}
                {busy && busyAction === "accept" ? t("accepting") : t("accept")}
              </button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
