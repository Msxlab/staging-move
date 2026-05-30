import Stripe from "stripe";
import { requireStripeSecretKeyForMutation } from "@/lib/billing-config";
import { prisma, rawPrisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { destroyAllUserSessions } from "@/lib/user-auth";
import { pickOwnershipHeir, transferWorkspaceOwnership } from "@/lib/workspace-ownership";

export interface AccountDeletionRequestData {
  source: string;
  email?: string | null;
  stripeSubscriptionId?: string | null;
  initiatedAt?: string;
  initiatedByAdminId?: string | null;
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
  const user = await prisma.user.findUnique({
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
      lastError = (error as Error)?.message || "STRIPE_CANCEL_FAILED";
      logger.error("account_deletion_stripe_cancel_failed", {
        requestId: request.id,
        userId: request.userId,
        stripeSubscriptionId,
        error,
      });
    }
  }

  const cleanupComplete = stripeCanceled;

  if (cleanupComplete && user && !userDeleted) {
    try {
      // Invalidate any live sessions first so the user can't keep making requests
      // mid-deletion. Cascade deletes the rest (sessions, oauth, profile, etc.).
      //
      // GDPR Article 17 ("right to erasure") requires a physical delete — use
      // `rawPrisma` to bypass the global soft-delete extension, which would
      // otherwise rewrite this into a `deletedAt` update and leave the row
      // recoverable. MovingPlan has required Address relations with
      // onDelete: Restrict, so remove the user's plans first; then User
      // cascades physically remove addresses, services, budgets, sessions,
      // OAuth links, etc.
      await destroyAllUserSessions(request.userId);
      // Owned workspaces block user deletion (Workspace.owner is onDelete:
      // Restrict). Transfer each shared workspace to an heir (the deleted user's
      // own membership then cascades away, the workspace survives for the rest);
      // hard-delete solo ones. rawPrisma bypasses soft-delete so the FK clears.
      const ownedWorkspaces = await rawPrisma.workspace.findMany({
        where: { ownerUserId: request.userId },
        select: { id: true },
      });
      for (const ownedWorkspace of ownedWorkspaces) {
        // Preserve data: promote ANY remaining active member (incl. a CHILD)
        // to owner rather than destroying their workspace data. Only a truly
        // sole-member (no other members) workspace is hard-deleted.
        const heir = await pickOwnershipHeir(ownedWorkspace.id, request.userId, { includeAnyRole: true });
        if (heir) {
          await transferWorkspaceOwnership(ownedWorkspace.id, request.userId, heir, { allowAnyRole: true });
        } else {
          await rawPrisma.workspace.delete({ where: { id: ownedWorkspace.id } });
        }
      }
      await rawPrisma.movingPlan.deleteMany({ where: { userId: request.userId } });
      await rawPrisma.user.delete({ where: { id: request.userId } });
      userDeleted = true;
    } catch (error) {
      if (!lastError) {
        lastError = (error as Error)?.message || "USER_DELETE_FAILED";
      }
    }
  }

  const finalStatus = cleanupComplete && (userDeleted || !user) ? "COMPLETED" : "PROCESSING";
  await prisma.gDPRRequest.update({
    where: { id: request.id },
    data: {
      status: finalStatus,
      completedAt: finalStatus === "COMPLETED" ? new Date() : null,
      requestData: toRequestDataJson({
        ...requestData,
        stripeSubscriptionId,
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
