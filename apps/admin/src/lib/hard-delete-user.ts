/**
 * Irreversible admin HARD DELETE of a user — physically erases the account and
 * all of its data "as if they never existed". This is NOT the soft-delete path
 * (deletedAt + queued GDPRRequest + retention cron); it bypasses the
 * soft-delete extension with `rawPrisma` and removes rows outright.
 *
 * Trace-free by design: every row that references the user is removed. The ONE
 * deliberate survivor is AdminAuditLog (the operator's USER_HARD_DELETED entry)
 * — it has no FK to User and is the legally-required record that the deletion
 * happened, with the email already masked.
 *
 * Caller is responsible for authorization (SUPER_ADMIN + password + MFA) and
 * for verifying the single-use, target-bound email OTP BEFORE invoking this.
 *
 * The ownership-heir logic is ported from apps/web/src/lib/workspace-ownership.ts
 * (pickOwnershipHeir / transferWorkspaceOwnership). The admin app is a separate
 * Next build and cannot import from apps/web, so the relevant logic is inlined
 * here on `rawPrisma` (the un-extended client) so the Workspace.ownerUserId FK
 * — which is onDelete: Restrict — is cleared before the user row is deleted.
 */

import Stripe from "stripe";
import { rawPrisma } from "@/lib/db";
import { getAdminRuntimeConfigValue } from "@/lib/runtime-config";
import { reconcileWorkspaceSeats } from "@/lib/workspace-seats";

function isBillingProductionLike() {
  const appEnv = (process.env.APP_ENV || process.env.VERCEL_ENV || "").toLowerCase();
  if (["development", "dev", "test", "staging", "preview"].includes(appEnv)) return false;
  return appEnv === "production" || (!appEnv && process.env.NODE_ENV === "production");
}

function requireStripeSecretKey(key: string | null | undefined) {
  if (!key) throw new Error("STRIPE_SECRET_KEY is missing");
  if (isBillingProductionLike() && !key.startsWith("sk_live_")) {
    throw new Error("STRIPE_SECRET_KEY must be live in production billing environments");
  }
  if (!isBillingProductionLike() && !key.startsWith("sk_test_") && !key.startsWith("sk_live_")) {
    throw new Error("STRIPE_SECRET_KEY has an invalid prefix");
  }
  return key;
}

/**
 * Best heir for a forced auto-transfer when the owner is being erased: the
 * longest-tenured ACTIVE ADMIN, else longest-tenured ACTIVE MEMBER, else
 * (final fallback) the longest-tenured ACTIVE member of ANY role — so erasing
 * a parent doesn't destroy a child's workspace data. Returns null only when the
 * owner is the workspace's sole member (caller then deletes the empty workspace).
 *
 * Ported from workspace-ownership.ts pickOwnershipHeir({ includeAnyRole: true }).
 */
async function pickOwnershipHeir(
  tx: any,
  workspaceId: string,
  excludeUserId: string,
): Promise<string | null> {
  const preferred = await tx.workspaceMember.findFirst({
    where: {
      workspaceId,
      status: "ACTIVE",
      userId: { not: excludeUserId },
      role: { in: ["ADMIN", "MEMBER"] },
    },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }], // ADMIN before MEMBER, oldest first
    select: { userId: true },
  });
  if (preferred) return preferred.userId;
  const anyMember = await tx.workspaceMember.findFirst({
    where: { workspaceId, status: "ACTIVE", userId: { not: excludeUserId } },
    orderBy: { joinedAt: "asc" },
    select: { userId: true },
  });
  return anyMember?.userId ?? null;
}

/**
 * Force-transfer ownership from the user being erased to an heir, inside the
 * caller's transaction: demote old owner→ADMIN, promote heir→OWNER, repoint
 * ownerUserId. Ported from workspace-ownership.ts transferWorkspaceOwnership
 * with { allowAnyRole: true } (a CHILD/VIEW_ONLY may inherit so data survives).
 * Returns true on success. The old owner's membership row then cascades away
 * with the user delete; the workspace survives for the remaining members.
 */
async function transferWorkspaceOwnership(
  tx: any,
  workspaceId: string,
  fromUserId: string,
  toUserId: string,
): Promise<boolean> {
  if (fromUserId === toUserId) return false;
  const ws = await tx.workspace.findUnique({ where: { id: workspaceId }, select: { ownerUserId: true } });
  if (!ws || ws.ownerUserId !== fromUserId) return false;

  const target = await tx.workspaceMember.findFirst({
    where: { workspaceId, userId: toUserId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!target) return false;

  const current = await tx.workspaceMember.findFirst({
    where: { workspaceId, userId: fromUserId },
    select: { id: true },
  });
  if (current) {
    await tx.workspaceMember.update({ where: { id: current.id }, data: { role: "ADMIN" } });
  }
  await tx.workspaceMember.update({ where: { id: target.id }, data: { role: "OWNER" } });
  await tx.workspace.update({ where: { id: workspaceId }, data: { ownerUserId: toUserId } });
  return true;
}

export interface HardDeleteResult {
  success: true;
  maskedEmail: string;
  stripeCanceled: boolean;
  ownedWorkspacesTransferred: number;
  ownedWorkspacesDeleted: number;
  gdprRequestsPurged: number;
}

/**
 * Returned (instead of erasing) when the user has a live Stripe subscription
 * that we could NOT cancel. The DB delete is irreversible, so we refuse to run
 * it while the provider subscription would keep billing a "deleted" account.
 * The caller surfaces this to the operator (resolve Stripe first, or re-run with
 * `force` to erase anyway and reconcile billing manually).
 */
export interface HardDeleteBlockedResult {
  success: false;
  blocked: true;
  code: "STRIPE_CANCEL_FAILED";
  maskedEmail: string;
  /** Present so the operator can locate the subscription in the Stripe dashboard. */
  stripeSubscriptionId: string;
}

export type HardDeleteOutcome = HardDeleteResult | HardDeleteBlockedResult;

export interface HardDeleteOptions {
  /**
   * Operator override: proceed with the irreversible erasure EVEN IF the Stripe
   * cancel failed. Use only after the operator has acknowledged they will
   * reconcile the provider subscription out of band. Default false (fail-closed).
   */
  force?: boolean;
}

/**
 * Attempt to cancel a live Stripe subscription. Returns true on success, false
 * on any failure (missing/invalid key, network error, Stripe API error). Never
 * throws — the caller decides whether a false result blocks the erasure.
 */
async function tryCancelStripeSubscription(stripeSubscriptionId: string): Promise<boolean> {
  try {
    const stripe = new Stripe(
      requireStripeSecretKey(await getAdminRuntimeConfigValue("STRIPE_SECRET_KEY")),
      { apiVersion: "2024-06-20" },
    );
    await stripe.subscriptions.cancel(stripeSubscriptionId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Physically erase a user and everything that references them.
 *
 * Cascade order (the ORDER MATTERS — FK constraints dictate it):
 *   --- BEFORE the irreversible DB delete ---
 *   0. Cancel the Stripe subscription, if the user has a live one. This MUST
 *      happen first: the DB delete is irreversible, so if the cancel fails we
 *      refuse to erase (returning a STRIPE_CANCEL_FAILED blocked result) rather
 *      than leave a "deleted" account whose provider subscription keeps billing.
 *      A user with NO subscription skips this entirely (clean delete unchanged).
 *      The operator can override with { force: true } once they accept they must
 *      reconcile billing manually.
 *   --- inside a single $transaction (all-or-nothing on the DB side) ---
 *   1. Deactivate userLoginSession + userSession (kill live access immediately).
 *   2. For each owned Workspace (Workspace.owner = Restrict): classify into
 *      heir-transfer vs solo-delete (the FK is cleared either way).
 *   3. movingPlan.deleteMany (MovingPlan.from/toAddress = Restrict): remove the
 *      user's plans — and any plan stamped to a solo workspace about to be
 *      dropped — BEFORE deleting workspaces, because a solo workspace.delete
 *      cascade-removes its Addresses first; a lingering plan reference would
 *      abort the whole $transaction (FK 1451).
 *   3b. Transfer shared workspaces to their heir, hard-delete the solo ones.
 *   4. gDPRRequest.deleteMany: GDPRRequest has NO FK to User, so the DB cascade
 *      will NOT remove these — delete them explicitly to leave no trace.
 *   5. user.delete: cascades all remaining direct children (addresses, services,
 *      budgets, sessions, oauth, profile, consents, tokens, notifications,
 *      memberships, push devices, events, etc.) via onDelete: Cascade.
 *
 * Returns details for the USER_HARD_DELETED audit entry, OR a blocked result
 * ({ success:false, code:"STRIPE_CANCEL_FAILED" }) when a live subscription could
 * not be canceled and `force` was not set — in which case NOTHING was deleted.
 * Throws if the user is not found (caller maps to 404).
 */
export async function hardDeleteUser(
  userId: string,
  options: HardDeleteOptions = {},
): Promise<HardDeleteOutcome> {
  // Read via rawPrisma so a soft-deleted user is still found (the operator may
  // hard-delete a user that was previously soft-deleted).
  const user = await rawPrisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      subscription: { select: { stripeSubscriptionId: true } },
    },
  });
  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  const maskedEmail = maskEmailLocal(user.email);
  const stripeSubscriptionId = user.subscription?.stripeSubscriptionId || null;

  // 0. Cancel Stripe BEFORE the irreversible DB delete. A user with no live
  //    subscription is a clean delete (stripeCanceled=true, nothing to do). If
  //    the user DOES have a subscription and the cancel fails, we refuse to
  //    proceed (unless the operator passed force) — erasing now would leave a
  //    "deleted" account that Stripe keeps billing, with the operator none the
  //    wiser. The caller turns this blocked result into an audit row + alert +
  //    an actionable message.
  let stripeCanceled = !stripeSubscriptionId;
  if (stripeSubscriptionId) {
    stripeCanceled = await tryCancelStripeSubscription(stripeSubscriptionId);
    if (!stripeCanceled && !options.force) {
      return {
        success: false,
        blocked: true,
        code: "STRIPE_CANCEL_FAILED",
        maskedEmail,
        stripeSubscriptionId,
      };
    }
  }

  let ownedWorkspacesTransferred = 0;
  let ownedWorkspacesDeleted = 0;
  let gdprRequestsPurged = 0;
  const reconcileWorkspaceIds: string[] = [];

  await rawPrisma.$transaction(async (tx: any) => {
    const now = new Date();

    // 1. Kill live access.
    await tx.userLoginSession.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false, lastActivity: now },
    });
    await tx.userSession.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false, sessionEnd: now, lastActivity: now },
    });

    // 2. Owned workspaces (Workspace.owner = Restrict): decide heir-vs-solo up
    //    front so we know which workspaces will be hard-deleted.
    const ownedWorkspaces = await tx.workspace.findMany({
      where: { ownerUserId: userId },
      select: { id: true },
    });
    const heirTransfers: Array<{ workspaceId: string; heir: string }> = [];
    const soloWorkspaceIds: string[] = [];
    for (const ws of ownedWorkspaces) {
      const heir = await pickOwnershipHeir(tx, ws.id, userId);
      if (heir) heirTransfers.push({ workspaceId: ws.id, heir });
      else soloWorkspaceIds.push(ws.id);
    }

    // 3. MovingPlan (from/toAddress = Restrict): purge BEFORE deleting any solo
    //    workspace. Deleting a solo workspace cascade-removes its Addresses first,
    //    so a plan still referencing one would abort the whole $transaction (FK
    //    1451) and the operator would get a 500. Cover the user's own plans plus
    //    any plan stamped to a solo workspace we are about to drop.
    await tx.movingPlan.deleteMany({
      where: soloWorkspaceIds.length
        ? { OR: [{ userId }, { workspaceId: { in: soloWorkspaceIds } }] }
        : { userId },
    });

    // 3b. Now transfer shared workspaces to their heir (workspace survives) and
    //     hard-delete the solo ones (their Addresses cascade safely — no plan
    //     references them anymore).
    for (const { workspaceId, heir } of heirTransfers) {
      const ok = await transferWorkspaceOwnership(tx, workspaceId, userId, heir);
      if (ok) {
        ownedWorkspacesTransferred += 1;
        reconcileWorkspaceIds.push(workspaceId);
      } else {
        // Heir vanished mid-tx (shouldn't happen) — delete to clear the FK.
        await tx.workspace.delete({ where: { id: workspaceId } });
        ownedWorkspacesDeleted += 1;
      }
    }
    for (const wsId of soloWorkspaceIds) {
      await tx.workspace.delete({ where: { id: wsId } });
      ownedWorkspacesDeleted += 1;
    }

    // 4. GDPRRequest has NO FK to User — the User cascade won't touch it, so
    //    purge explicitly to leave no trace (incl. any prior soft-delete queue).
    const purged = await tx.gDPRRequest.deleteMany({ where: { userId } });
    gdprRequestsPurged = purged.count;

    // 4b. No-FK residue tables keyed by userId/email — the User cascade has no
    //     relation to these, so purge them explicitly to truly leave no trace:
    //     WaitlistSignup retains the user's PLAINTEXT email (a GDPR-erasure leak);
    //     NotificationQueue keeps queued/sent notification bodies for the user;
    //     EmailLog (keyed by the recipient `to`) retains the PLAINTEXT email too.
    await tx.waitlistSignup.deleteMany({ where: { OR: [{ userId }, { email: user.email }] } });
    await tx.notificationQueue.deleteMany({ where: { userId } });
    await tx.emailLog.deleteMany({ where: { to: user.email } });

    // 5. Delete the user — cascades all remaining direct children.
    await tx.user.delete({ where: { id: userId } });
  });

  // Ownership moved to a new billing anchor whose plan may be smaller —
  // reconcile seats outside the tx, best-effort (never block on this).
  for (const wsId of reconcileWorkspaceIds) {
    await reconcileWorkspaceSeats(wsId).catch(() => {});
  }

  return {
    success: true,
    maskedEmail,
    stripeCanceled,
    ownedWorkspacesTransferred,
    ownedWorkspacesDeleted,
    gdprRequestsPurged,
  };
}

/**
 * Local email mask (`j***@d***.com`-style) so this helper has no import
 * coupling to the privacy module's signature. Matches the intent of
 * privacy.maskEmail: never log or persist the full target address.
 */
function maskEmailLocal(email: string | null | undefined): string {
  if (!email || typeof email !== "string" || !email.includes("@")) return "***";
  const [local, domain] = email.split("@");
  const maskedLocal = local.length <= 1 ? "*" : `${local[0]}***`;
  const domainParts = domain.split(".");
  const maskedDomain =
    domainParts[0].length <= 1
      ? `*.${domainParts.slice(1).join(".")}`
      : `${domainParts[0][0]}***.${domainParts.slice(1).join(".")}`;
  return `${maskedLocal}@${maskedDomain}`;
}
