import { createHmac, timingSafeEqual } from "node:crypto";
import Stripe from "stripe";
import { requireStripeSecretKeyForMutation } from "@/lib/billing-config";
import { prisma, rawPrisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { destroyAllUserSessions } from "@/lib/user-auth";
import { pickOwnershipHeir, transferWorkspaceOwnership } from "@/lib/workspace-ownership";
import { createInAppNotification } from "@/lib/in-app-notifications";
import { sendWorkspaceOwnershipEmail } from "@/lib/email-service";

/**
 * Optional "grace window" before a self-service deletion is physically purged.
 * Default 0 = immediate physical erasure (the original behavior — no change
 * unless an operator opts in). When set (clamped to ≤90d so erasure is never
 * deferred unreasonably), the account is soft-deleted (locked out) immediately
 * and only physically purged by the data-retention cron after the window, so
 * an accidental or coerced deletion can be undone via the emailed restore link.
 */
export function getAccountDeletionGraceDays(): number {
  const raw = process.env.ACCOUNT_DELETION_GRACE_DAYS;
  const n = raw ? Number.parseInt(raw, 10) : 0;
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, 90);
}

const RESTORE_TOKEN_MIN_SECRET = 32;

/**
 * Max physical-purge attempts to keep retrying a failing Stripe cancellation
 * before proceeding with the GDPR erasure anyway (and alerting ops to cancel the
 * lingering subscription manually). GDPR Art. 17 erasure must NEVER be blocked
 * indefinitely by a billing call that keeps failing.
 */
const ACCOUNT_DELETION_MAX_STRIPE_ATTEMPTS = 5;

function getRestoreSecret(): string | null {
  const dedicated = process.env.ACCOUNT_RESTORE_SECRET;
  if (dedicated && dedicated.length >= RESTORE_TOKEN_MIN_SECRET) return dedicated;
  const jwt = process.env.USER_JWT_SECRET;
  if (jwt && jwt.length >= RESTORE_TOKEN_MIN_SECRET) return jwt;
  return null;
}

/**
 * Signed, request-bound restore token for the emailed "undo deletion" link.
 * Bound to (userId, requestId) so an old link can't cancel a *new* deletion,
 * and forgery-resistant via HMAC. Returns null if no signing secret is set.
 */
export function signAccountRestoreToken(userId: string, requestId: string): string | null {
  const secret = getRestoreSecret();
  if (!secret) return null;
  const sig = createHmac("sha256", secret).update(`${userId}:${requestId}`).digest("base64url");
  return `${userId}.${requestId}.${sig}`;
}

export function verifyAccountRestoreToken(
  token: string | null | undefined,
): { userId: string; requestId: string } | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, requestId, sig] = parts;
  if (!userId || !requestId || !sig) return null;
  const secret = getRestoreSecret();
  if (!secret) return null;
  const expected = createHmac("sha256", secret).update(`${userId}:${requestId}`).digest("base64url");
  const provided = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (provided.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(provided, expectedBuf)) return null;
  return { userId, requestId };
}

/** Best-effort notice to a member who inherited ownership because the previous
 *  owner deleted their account. Never blocks the (GDPR) deletion. */
async function notifyInheritedOwner(workspaceId: string, heirUserId: string): Promise<void> {
  try {
    const [heir, ws] = await Promise.all([
      prisma.user.findUnique({ where: { id: heirUserId }, select: { email: true, firstName: true, preferredLocale: true } }),
      prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } }),
    ]);
    const wsName = ws?.name || "your workspace";
    await createInAppNotification({
      userId: heirUserId,
      type: "WORKSPACE_MEMBERSHIP",
      title: "You're now the workspace owner",
      body: `The previous owner closed their account, so ${wsName} is now yours. Nothing was lost — you manage its members, roles, and plan.`,
      href: "/settings/workspace",
      dedupeKey: `ws-owner-inherit:${workspaceId}:${heirUserId}`,
    }).catch(() => {});
    if (heir?.email) {
      const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
      await sendWorkspaceOwnershipEmail({
        newOwnerEmail: heir.email,
        newOwnerName: heir.firstName,
        workspaceName: wsName,
        manageUrl: `${base}/settings/workspace`,
        reason: "previous_owner_left",
        locale: heir.preferredLocale,
        dedupeKey: `ws-owner-inherit-email:${workspaceId}:${heirUserId}`,
        metadata: { workspaceId },
      }).catch(() => {});
    }
  } catch {
    // best-effort — never block account deletion on a notification
  }
}

export interface AccountDeletionRequestData {
  source: string;
  email?: string | null;
  stripeSubscriptionId?: string | null;
  initiatedAt?: string;
  initiatedByAdminId?: string | null;
  /** When set + in the future, the physical purge is deferred until this time
   *  (grace window). null/absent = purge as soon as the cron runs. */
  scheduledPurgeAt?: string | null;
  cleanup?: {
    stripeCanceled?: boolean;
    userDeleted?: boolean;
    attempts?: number;
    lastAttemptAt?: string | null;
    lastError?: string | null;
  };
}

function parseRequestData(raw: string | null | undefined): AccountDeletionRequestData {
  if (!raw) return { source: "unknown" };
  try {
    const parsed = JSON.parse(raw);
    return {
      source: parsed.source || "unknown",
      email: parsed.email || null,
      stripeSubscriptionId: parsed.stripeSubscriptionId || null,
      initiatedAt: parsed.initiatedAt,
      initiatedByAdminId: parsed.initiatedByAdminId || null,
      scheduledPurgeAt: parsed.scheduledPurgeAt || null,
      cleanup: parsed.cleanup || {},
    };
  } catch {
    return { source: "unknown" };
  }
}

function toRequestDataJson(data: AccountDeletionRequestData) {
  return JSON.stringify({
    source: data.source,
    email: data.email || null,
    stripeSubscriptionId: data.stripeSubscriptionId || null,
    initiatedAt: data.initiatedAt || new Date().toISOString(),
    initiatedByAdminId: data.initiatedByAdminId || null,
    scheduledPurgeAt: data.scheduledPurgeAt || null,
    cleanup: data.cleanup || {},
  });
}

export async function getActiveAccountDeletionRequest(userId: string) {
  return prisma.gDPRRequest.findFirst({
    where: {
      userId,
      type: "DELETE",
      status: { in: ["PENDING", "PROCESSING"] },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createAccountDeletionRequest(input: {
  userId: string;
  source: "self_service" | "admin";
  email: string;
  stripeSubscriptionId?: string | null;
  initiatedByAdminId?: string | null;
}) {
  return prisma.gDPRRequest.create({
    data: {
      userId: input.userId,
      type: "DELETE",
      status: "PENDING",
      requestData: toRequestDataJson({
        source: input.source,
        email: input.email,
        stripeSubscriptionId: input.stripeSubscriptionId || null,
        initiatedAt: new Date().toISOString(),
        initiatedByAdminId: input.initiatedByAdminId || null,
        cleanup: {
          stripeCanceled: false,
          userDeleted: false,
          attempts: 0,
          lastAttemptAt: null,
          lastError: null,
        },
      }),
    },
  });
}

export async function processAccountDeletionRequest(requestId: string) {
  const request = await prisma.gDPRRequest.findUnique({ where: { id: requestId } });
  if (!request || request.type !== "DELETE") {
    return { id: requestId, status: "NOT_FOUND" as const };
  }

  if (request.status === "COMPLETED" || request.status === "REJECTED") {
    return { id: request.id, status: request.status as "COMPLETED" | "REJECTED" };
  }

  const requestData = parseRequestData(request.requestData);

  // Grace window: if a future purge time is set, defer. The data-retention
  // cron re-invokes this daily and proceeds once the window elapses. (A user
  // who restores in the meantime flips the request to REJECTED, caught above.)
  const scheduledPurgeAt = requestData.scheduledPurgeAt ? new Date(requestData.scheduledPurgeAt) : null;
  if (scheduledPurgeAt && Number.isFinite(scheduledPurgeAt.getTime()) && Date.now() < scheduledPurgeAt.getTime()) {
    return { id: request.id, status: "SCHEDULED" as const, scheduledPurgeAt: scheduledPurgeAt.toISOString() };
  }

  // rawPrisma (not the soft-delete-extended client) so a user soft-deleted at
  // grace-start is still found here — otherwise the purge below would see
  // `!user`, think the work was done, and mark COMPLETED without erasing.
  const user = await rawPrisma.user.findUnique({
    where: { id: request.userId },
    include: {
      subscription: { select: { stripeSubscriptionId: true } },
    },
  });

  const stripeSubscriptionId = requestData.stripeSubscriptionId || user?.subscription?.stripeSubscriptionId || null;
  const cleanup = requestData.cleanup || {};

  let stripeCanceled = Boolean(cleanup.stripeCanceled || !stripeSubscriptionId);
  let userDeleted = Boolean(cleanup.userDeleted || !user);
  let lastError: string | null = cleanup.lastError || null;
  const attempts = (cleanup.attempts || 0) + 1;
  const lastAttemptAt = new Date().toISOString();

  await prisma.gDPRRequest.update({
    where: { id: request.id },
    data: {
      status: "PROCESSING",
      requestData: toRequestDataJson({
        ...requestData,
        stripeSubscriptionId,
        cleanup: {
          ...cleanup,
          stripeCanceled,
          userDeleted,
          attempts,
          lastAttemptAt,
          lastError: cleanup.lastError || null,
        },
      }),
    },
  });

  if (!stripeCanceled && stripeSubscriptionId) {
    try {
      const stripeSecretKey = requireStripeSecretKeyForMutation(
        await getRuntimeConfigValue("STRIPE_SECRET_KEY"),
        process.env,
      );
      const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });
      await stripe.subscriptions.cancel(stripeSubscriptionId);
      stripeCanceled = true;
    } catch (error) {
      // A "nothing to cancel" outcome means the billing side is ALREADY in the
      // desired terminal state (a previously-canceled sub, or one removed at
      // Stripe). Treat it as success so it can't wedge the erasure forever — this
      // is the common case, because the grace flow sets cancel_at_period_end, so
      // by purge time the subscription is often already fully canceled and a
      // second cancel() throws.
      const stripeErr = error as { code?: string; message?: string };
      const msg = stripeErr?.message || "";
      if (
        stripeErr?.code === "resource_missing" ||
        /no such subscription|already canceled|already been canceled|already cancelled/i.test(msg)
      ) {
        stripeCanceled = true;
      } else {
        lastError = msg || "STRIPE_CANCEL_FAILED";
        logger.error("account_deletion_stripe_cancel_failed", {
          requestId: request.id,
          userId: request.userId,
          stripeSubscriptionId,
          error,
        });
      }
    }
  }

  // GDPR Art. 17 erasure must NEVER be blocked indefinitely by billing cleanup.
  // Retry the Stripe cancel across cron runs, but once we've tried enough times,
  // proceed with the physical erasure anyway and alert ops so a human can cancel
  // any lingering subscription manually. Without this, a single permanently-
  // failing cancel leaves the user soft-deleted but never erased (PROCESSING
  // forever) — the exact silent GDPR-retention failure this guards against.
  const forceErase = !stripeCanceled && attempts >= ACCOUNT_DELETION_MAX_STRIPE_ATTEMPTS;
  if (forceErase) {
    logger.error("account_deletion_forcing_erasure_stripe_unresolved", {
      requestId: request.id,
      userId: request.userId,
      stripeSubscriptionId,
      attempts,
      lastError,
      note: "Erasure proceeding WITHOUT a confirmed Stripe cancellation — cancel this subscription manually.",
    });
  }
  const proceedWithErase = stripeCanceled || forceErase;

  if (proceedWithErase && user && !userDeleted) {
    try {
      // Invalidate any live sessions first so the user can't keep making requests
      // mid-deletion. Cascade deletes the rest (sessions, oauth, profile, etc.).
      //
      // GDPR Article 17 ("right to erasure") requires a physical delete — use
      // `rawPrisma` to bypass the global soft-delete extension, which would
      // otherwise rewrite this into a `deletedAt` update and leave the row
      // recoverable.
      await destroyAllUserSessions(request.userId);
      // Owned workspaces block user deletion (Workspace.owner is onDelete:
      // Restrict). Decide heir-vs-solo up front so we know which workspaces will
      // be hard-deleted, THEN purge MovingPlans before deleting any of them.
      const ownedWorkspaces = await rawPrisma.workspace.findMany({
        where: { ownerUserId: request.userId },
        select: { id: true },
      });
      const heirTransfers: Array<{ workspaceId: string; heir: string }> = [];
      const soloWorkspaceIds: string[] = [];
      for (const ownedWorkspace of ownedWorkspaces) {
        // Preserve data: promote ANY remaining active member (incl. a CHILD)
        // to owner rather than destroying their workspace data. Only a truly
        // sole-member (no other members) workspace is hard-deleted.
        const heir = await pickOwnershipHeir(ownedWorkspace.id, request.userId, { includeAnyRole: true });
        if (heir) heirTransfers.push({ workspaceId: ownedWorkspace.id, heir });
        else soloWorkspaceIds.push(ownedWorkspace.id);
      }
      // Purge MovingPlans BEFORE any workspace.delete. MovingPlan.from/toAddress
      // are onDelete: Restrict, and deleting a solo workspace cascade-removes its
      // Addresses first — so a plan still referencing one would abort the entire
      // erasure with FK error 1451 (the error is then swallowed below and the
      // request retries in PROCESSING forever). Cover the user's own plans plus any
      // plan stamped to a solo workspace we are about to drop.
      await rawPrisma.movingPlan.deleteMany({
        where: soloWorkspaceIds.length
          ? { OR: [{ userId: request.userId }, { workspaceId: { in: soloWorkspaceIds } }] }
          : { userId: request.userId },
      });
      // Transfer shared workspaces to an heir (workspace + its data survive, the
      // deleted user's membership then cascades away), and hard-delete the solo
      // ones (their Addresses now cascade safely — no plan references them).
      for (const { workspaceId, heir } of heirTransfers) {
        const transfer = await transferWorkspaceOwnership(workspaceId, request.userId, heir, { allowAnyRole: true });
        if (transfer.ok) await notifyInheritedOwner(workspaceId, heir);
      }
      for (const soloWorkspaceId of soloWorkspaceIds) {
        await rawPrisma.workspace.delete({ where: { id: soloWorkspaceId } });
      }
      // No-FK residue tables keyed by userId/email — the User cascade has no
      // relation to these, so without an explicit purge a GDPR Art. 17 erasure
      // leaves the user's PLAINTEXT email in WaitlistSignup, their queued
      // notification bodies in NotificationQueue, and their PLAINTEXT recipient
      // email in EmailLog (keyed by `to`). The admin hard-delete path already
      // purges all three; mirror it here so self-service erasure is complete.
      const deletedUserEmail = user.email || requestData.email || null;
      await rawPrisma.waitlistSignup.deleteMany({
        where: deletedUserEmail
          ? { OR: [{ userId: request.userId }, { email: deletedUserEmail }] }
          : { userId: request.userId },
      });
      await rawPrisma.notificationQueue.deleteMany({ where: { userId: request.userId } });
      if (deletedUserEmail) {
        await rawPrisma.emailLog.deleteMany({ where: { to: deletedUserEmail } });
      }
      // Lead has a loose ref (no FK) to User, so the User cascade won't touch it —
      // leaving the user's encrypted name/contact/notes payload behind after an
      // Art. 17 erasure. Purge their Leads explicitly; LeadDispatch cascades from
      // Lead (onDelete: Cascade), so deleting Lead first clears its dispatches too.
      await rawPrisma.lead.deleteMany({ where: { userId: request.userId } });
      await rawPrisma.user.delete({ where: { id: request.userId } });
      userDeleted = true;
    } catch (error) {
      if (!lastError) {
        lastError = (error as Error)?.message || "USER_DELETE_FAILED";
      }
    }
  }

  // COMPLETED once the user is physically erased (or was already gone), regardless
  // of whether Stripe ultimately confirmed — billing cleanup never gates Art. 17.
  const finalStatus = userDeleted || !user ? "COMPLETED" : "PROCESSING";
  // Once the user is physically erased, scrub the residual PII (plaintext email +
  // billing identifier) out of the retained GDPRRequest record. The request row
  // is kept as proof the erasure happened, but must not itself carry recoverable
  // personal data after an Art. 17 deletion.
  const scrubResidualPii = finalStatus === "COMPLETED" && userDeleted;
  await prisma.gDPRRequest.update({
    where: { id: request.id },
    data: {
      status: finalStatus,
      completedAt: finalStatus === "COMPLETED" ? new Date() : null,
      requestData: toRequestDataJson({
        ...requestData,
        email: scrubResidualPii ? null : requestData.email,
        stripeSubscriptionId: scrubResidualPii ? null : stripeSubscriptionId,
        cleanup: {
          stripeCanceled,
          userDeleted,
          attempts,
          lastAttemptAt,
          lastError,
        },
      }),
    },
  });

  return {
    id: request.id,
    status: finalStatus as "COMPLETED" | "PROCESSING",
    cleanup: {
      stripeCanceled,
      userDeleted,
      attempts,
      lastAttemptAt,
      lastError,
    },
  };
}

export async function processPendingAccountDeletionRequests(limit: number = 10) {
  const requests = await prisma.gDPRRequest.findMany({
    where: {
      type: "DELETE",
      status: { in: ["PENDING", "PROCESSING"] },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  const results = [] as Array<Awaited<ReturnType<typeof processAccountDeletionRequest>>>;
  for (const request of requests) {
    results.push(await processAccountDeletionRequest(request.id));
  }
  return results;
}

/**
 * Start a grace-windowed deletion: soft-delete (lock out) the user now, pause
 * Stripe renewal (reversibly), kill sessions, and record `scheduledPurgeAt` so
 * the retention cron physically purges only after the window. Reversible via
 * `restoreAccountFromDeletion` until then. Idempotent: a re-request keeps the
 * original window rather than extending it.
 */
export async function scheduleAccountDeletionWithGrace(requestId: string, graceDays: number) {
  const request = await prisma.gDPRRequest.findUnique({ where: { id: requestId } });
  if (!request || request.type !== "DELETE") return { id: requestId, status: "NOT_FOUND" as const };
  if (request.status === "COMPLETED" || request.status === "REJECTED") {
    return { id: request.id, status: request.status as "COMPLETED" | "REJECTED" };
  }

  const requestData = parseRequestData(request.requestData);
  const scheduledPurgeAt = requestData.scheduledPurgeAt
    ? new Date(requestData.scheduledPurgeAt)
    : new Date(Date.now() + graceDays * 24 * 60 * 60 * 1000);

  const user = await rawPrisma.user.findUnique({
    where: { id: request.userId },
    include: { subscription: { select: { stripeSubscriptionId: true } } },
  });
  const stripeSubscriptionId = requestData.stripeSubscriptionId || user?.subscription?.stripeSubscriptionId || null;

  // Pause renewal (reversible) — NOT a full cancel, so a restore resumes cleanly
  // and the user keeps the period they already paid for during the window.
  if (stripeSubscriptionId) {
    try {
      const stripeSecretKey = requireStripeSecretKeyForMutation(
        await getRuntimeConfigValue("STRIPE_SECRET_KEY"),
        process.env,
      );
      const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });
      await stripe.subscriptions.update(stripeSubscriptionId, { cancel_at_period_end: true });
    } catch (error) {
      logger.error("account_deletion_grace_stripe_pause_failed", { requestId, error: String(error) });
    }
  }

  // Soft-delete → locked out everywhere via the soft-delete extension (login +
  // session + requireDbUserId all reject), data preserved for restore.
  if (user) {
    await rawPrisma.user.update({ where: { id: request.userId }, data: { deletedAt: new Date() } }).catch(() => {});
    await destroyAllUserSessions(request.userId).catch(() => {});
  }

  await prisma.gDPRRequest.update({
    where: { id: request.id },
    data: {
      status: "PENDING",
      requestData: toRequestDataJson({ ...requestData, stripeSubscriptionId, scheduledPurgeAt: scheduledPurgeAt.toISOString() }),
    },
  });

  return { id: request.id, status: "SCHEDULED" as const, scheduledPurgeAt: scheduledPurgeAt.toISOString() };
}

/**
 * Undo a grace-windowed deletion from the emailed restore link. Clears the
 * soft-delete, resumes Stripe renewal, and marks the request REJECTED. Only
 * works while the window is still open and the user row still exists.
 */
export async function restoreAccountFromDeletion(
  token: string | null | undefined,
): Promise<{ ok: boolean; reason?: string }> {
  const parsed = verifyAccountRestoreToken(token);
  if (!parsed) return { ok: false, reason: "invalid_token" };
  const { userId, requestId } = parsed;

  const request = await prisma.gDPRRequest.findUnique({ where: { id: requestId } });
  if (!request || request.type !== "DELETE" || request.userId !== userId) {
    return { ok: false, reason: "not_found" };
  }
  if (request.status === "COMPLETED") return { ok: false, reason: "already_purged" };
  if (request.status === "REJECTED") return { ok: true }; // idempotent — already restored

  const requestData = parseRequestData(request.requestData);
  const scheduledPurgeAt = requestData.scheduledPurgeAt ? new Date(requestData.scheduledPurgeAt) : null;
  if (scheduledPurgeAt && Date.now() >= scheduledPurgeAt.getTime()) {
    return { ok: false, reason: "window_elapsed" };
  }

  const user = await rawPrisma.user.findUnique({
    where: { id: userId },
    select: { id: true, subscription: { select: { stripeSubscriptionId: true } } },
  });
  if (!user) return { ok: false, reason: "already_purged" };

  await rawPrisma.user.update({ where: { id: userId }, data: { deletedAt: null } });

  const stripeSubscriptionId = requestData.stripeSubscriptionId || user.subscription?.stripeSubscriptionId || null;
  if (stripeSubscriptionId) {
    try {
      const stripeSecretKey = requireStripeSecretKeyForMutation(
        await getRuntimeConfigValue("STRIPE_SECRET_KEY"),
        process.env,
      );
      const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });
      await stripe.subscriptions.update(stripeSubscriptionId, { cancel_at_period_end: false });
    } catch (error) {
      logger.error("account_restore_stripe_resume_failed", { requestId, error: String(error) });
    }
  }

  await prisma.gDPRRequest.update({
    where: { id: request.id },
    data: { status: "REJECTED", requestData: toRequestDataJson({ ...requestData, scheduledPurgeAt: null }) },
  });

  return { ok: true };
}
