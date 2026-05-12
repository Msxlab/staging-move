import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, prismaUnsafe } from "@/lib/db";
import { requirePermission, requirePasswordConfirm } from "@/lib/auth";
import { notifyUserOfAdminChange } from "@/lib/user-notify";
import { maskEmail, maskProviderIdentifier, redactUserDetail } from "@/lib/privacy";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";

// Closed enums for the subscription columns admins can mutate from this
// route. Free-form VarChar in the schema means we enforce the allowlist
// at the API boundary or risk drift the rest of the app can't safely
// read (`normalizeMovingPlanStatus` style workarounds).
//
// FAMILY/BUSINESS were previously listed but have no entry in
// BILLING_PLAN_DEFINITIONS — writes that landed silently downgraded to
// FREE_TRIAL on read. Removed from the allowlist; the user-detail UI
// no longer surfaces them either.
const SUBSCRIPTION_PLAN_VALUES = ["INDIVIDUAL", "FREE_TRIAL"] as const;
// FREE_ACCESS / FREE_ACCESS_EXPIRED were missing from the allowlist
// even though the system writes them as the default and the user-detail
// dropdown offers them. Admins picking those values previously got a
// 400 from the API — round-trip the dropdown.
const SUBSCRIPTION_STATUS_VALUES = [
  "FREE_ACCESS",
  "FREE_ACCESS_EXPIRED",
  "ACTIVE",
  "TRIALING",
  "TRIAL_CANCELED",
  "CANCEL_AT_PERIOD_END",
  "CANCELED",
  "EXPIRED",
  "PAST_DUE",
  "GRACE_PERIOD",
  "PENDING_CHECKOUT",
  "PENDING_VALIDATION",
  "REFUNDED",
  "UNPAID",
] as const;
const SUBSCRIPTION_ACCESS_TYPE_VALUES = [
  "FREE_ACCESS",
  "FREE_TRIAL",
  "PAID",
] as const;
const SUBSCRIPTION_PROVIDER_VALUES = [
  "TRIAL",
  "ADMIN",
  "STRIPE",
  "APP_STORE",
  "PLAY_STORE",
  "UNKNOWN",
] as const;
const PROVIDER_BACKED_ENTITLEMENT_STATUSES = new Set([
  "ACTIVE",
  "TRIALING",
  "TRIAL_CANCELED",
  "CANCEL_AT_PERIOD_END",
  "PAST_DUE",
  "GRACE_PERIOD",
  "PENDING_VALIDATION",
]);
const PAYMENT_PROVIDER_VALUES = new Set(["STRIPE", "APP_STORE", "PLAY_STORE"]);

const userDetailSubscriptionSelect = {
  id: true,
  userId: true,
  plan: true,
  status: true,
  provider: true,
  platform: true,
  stripeCustomerId: true,
  stripeSubscriptionId: true,
  stripePriceId: true,
  stripeCurrentPeriodEnd: true,
  billingProductId: true,
  originalTransactionId: true,
  latestTransactionId: true,
  currentPeriodEndsAt: true,
  gracePeriodEndsAt: true,
  lastValidatedAt: true,
  lastSyncedAt: true,
  accessType: true,
  billingInterval: true,
  freeAccessEndsAt: true,
  cancelAtPeriodEnd: true,
  firstChargeAt: true,
  firstChargeAmount: true,
  autoRenew: true,
  campaignId: true,
  campaignCode: true,
  campaignSnapshot: true,
  checkoutConsentSnapshot: true,
  termsVersion: true,
  subscriptionPolicyVersion: true,
  refundPolicyVersion: true,
  trialEndsAt: true,
  canceledAt: true,
  premiumUntil: true,
  premiumGrantedBy: true,
  premiumGrantedAt: true,
  premiumNote: true,
  version: true,
  createdAt: true,
  updatedAt: true,
};

function canSeeRawBillingIds(role: string | null | undefined) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

function maskNullableProviderId(value: string | null | undefined) {
  return value ? maskProviderIdentifier(value) : null;
}

function redactUserDetailSubscription(subscription: any, role: string | null | undefined) {
  if (!subscription) return null;
  const showRawBillingIds = canSeeRawBillingIds(role);
  return {
    id: subscription.id,
    userId: subscription.userId,
    plan: subscription.plan,
    status: subscription.status,
    provider: subscription.provider,
    platform: subscription.platform,
    stripeCustomerId: showRawBillingIds
      ? subscription.stripeCustomerId
      : maskNullableProviderId(subscription.stripeCustomerId),
    stripeSubscriptionId: showRawBillingIds
      ? subscription.stripeSubscriptionId
      : maskNullableProviderId(subscription.stripeSubscriptionId),
    stripePriceId: showRawBillingIds
      ? subscription.stripePriceId
      : maskNullableProviderId(subscription.stripePriceId),
    stripeCurrentPeriodEnd: subscription.stripeCurrentPeriodEnd,
    billingProductId: showRawBillingIds
      ? subscription.billingProductId
      : maskNullableProviderId(subscription.billingProductId),
    originalTransactionId: showRawBillingIds
      ? subscription.originalTransactionId
      : maskNullableProviderId(subscription.originalTransactionId),
    latestTransactionId: showRawBillingIds
      ? subscription.latestTransactionId
      : maskNullableProviderId(subscription.latestTransactionId),
    currentPeriodEndsAt: subscription.currentPeriodEndsAt,
    gracePeriodEndsAt: subscription.gracePeriodEndsAt,
    lastValidatedAt: subscription.lastValidatedAt,
    lastSyncedAt: subscription.lastSyncedAt,
    accessType: subscription.accessType,
    billingInterval: subscription.billingInterval,
    freeAccessEndsAt: subscription.freeAccessEndsAt,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    firstChargeAt: subscription.firstChargeAt,
    firstChargeAmount: subscription.firstChargeAmount,
    autoRenew: subscription.autoRenew,
    campaignId: subscription.campaignId,
    campaignCode: subscription.campaignCode,
    campaignSnapshot: showRawBillingIds ? subscription.campaignSnapshot : null,
    checkoutConsentSnapshot: showRawBillingIds ? subscription.checkoutConsentSnapshot : null,
    termsVersion: subscription.termsVersion,
    subscriptionPolicyVersion: subscription.subscriptionPolicyVersion,
    refundPolicyVersion: subscription.refundPolicyVersion,
    trialEndsAt: subscription.trialEndsAt,
    canceledAt: subscription.canceledAt,
    premiumUntil: subscription.premiumUntil,
    premiumGrantedBy: subscription.premiumGrantedBy,
    premiumGrantedAt: subscription.premiumGrantedAt,
    premiumNote: showRawBillingIds ? subscription.premiumNote : null,
    version: subscription.version,
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
  };
}

// Accept either a full ISO timestamp with offset OR a YYYY-MM-DD date.
// The upstream PATCH already wraps strings in `new Date(...)` so we
// only need to gate against unbounded text and obvious garbage.
const isoDateString = z
  .string()
  .min(8)
  .max(40)
  .refine((v) => !Number.isNaN(new Date(v).getTime()), {
    message: "Invalid ISO date string",
  })
  .nullable();

// Strict admin user PATCH body. Only fields explicitly listed here can
// be set — `.strict()` rejects unknown keys (server-managed columns like
// `passwordHash`, `id`, `createdAt`, `mfaSecret`, etc.). String fields
// have explicit caps so a malicious payload can't flood storage.
const updateUserSchema = z
  .object({
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
    confirmPassword: z.string().max(256).optional(),
    mfaCode: z.string().trim().max(16).optional(),
    backupCode: z.string().trim().max(64).optional(),
    plan: z.enum(SUBSCRIPTION_PLAN_VALUES).optional(),
    subscriptionStatus: z.enum(SUBSCRIPTION_STATUS_VALUES).optional(),
    accessType: z.enum(SUBSCRIPTION_ACCESS_TYPE_VALUES).nullable().optional(),
    provider: z.enum(SUBSCRIPTION_PROVIDER_VALUES).optional(),
    premiumUntil: isoDateString.optional(),
    trialEndsAt: isoDateString.optional(),
    freeAccessEndsAt: isoDateString.optional(),
    cancelAtPeriodEnd: z.boolean().optional(),
    autoRenew: z.boolean().optional(),
    premiumNote: z.string().max(2000).nullable().optional(),
  })
  .strict();

/**
 * Validate that the requested subscription field combination is internally
 * consistent against whatever the row already contains. Returns null on
 * success; on failure returns the user-facing error string.
 */
function validateBillingCombination(
  body: z.infer<typeof updateUserSchema>,
  existing: {
    plan?: string | null;
    status?: string | null;
    accessType?: string | null;
    provider?: string | null;
    stripeSubscriptionId?: string | null;
    originalTransactionId?: string | null;
    latestTransactionId?: string | null;
    purchaseTokenHash?: string | null;
  } | null | undefined,
): string | null {
  const status = body.subscriptionStatus ?? existing?.status ?? null;
  const accessType =
    body.accessType !== undefined ? body.accessType : (existing?.accessType ?? null);
  const provider = body.provider ?? existing?.provider ?? null;

  // autoRenew and cancelAtPeriodEnd encode the same fact — they must not
  // disagree. Webhooks and subscription-actions always set them in lockstep;
  // admin PATCH must as well.
  if (body.autoRenew === true && body.cancelAtPeriodEnd === true) {
    return "autoRenew and cancelAtPeriodEnd cannot both be true.";
  }

  // accessType=PAID is the marker for "real payment provider backed access."
  // It must not be set against the TRIAL or ADMIN providers — those are
  // unpaid sources.
  if (accessType === "PAID" && (provider === "TRIAL" || provider === "ADMIN")) {
    return "accessType=PAID requires a real payment provider (Stripe / App Store / Play Store).";
  }

  // TRIALING without trialEndsAt is a misconfigured row — entitlement code
  // can't reason about expiry without the timestamp.
  const willHaveTrialEnd =
    body.trialEndsAt !== undefined ? Boolean(body.trialEndsAt) : true;
  if (status === "TRIALING" && body.trialEndsAt === null) {
    return "status=TRIALING requires a trialEndsAt date.";
  }
  if (status === "TRIALING" && body.trialEndsAt === undefined && !willHaveTrialEnd) {
    return "status=TRIALING requires a trialEndsAt date.";
  }

  // FREE_ACCESS without freeAccessEndsAt produces "free forever" silently.
  // Manual admin grants use premiumUntil instead, so we only enforce this
  // when the row is NOT a manual admin grant.
  if (status === "FREE_ACCESS" && body.freeAccessEndsAt === null && provider !== "ADMIN") {
    return "status=FREE_ACCESS requires a freeAccessEndsAt date.";
  }

  // status=ACTIVE on the ADMIN provider is a manual premium grant — it
  // must carry a premiumUntil. Don't allow admins to set "permanent
  // active manual premium" by clearing the date.
  if (status === "ACTIVE" && provider === "ADMIN" && body.premiumUntil === null) {
    return "Admin manual premium (status=ACTIVE, provider=ADMIN) requires a premiumUntil date.";
  }

  if (
    provider &&
    PAYMENT_PROVIDER_VALUES.has(provider) &&
    status &&
    PROVIDER_BACKED_ENTITLEMENT_STATUSES.has(status) &&
    accessType !== "FREE_ACCESS"
  ) {
    if (provider === "STRIPE" && !existing?.stripeSubscriptionId) {
      return "Invalid provider-backed entitlement state";
    }
    if (provider === "APP_STORE" && !(existing?.originalTransactionId || existing?.latestTransactionId)) {
      return "Invalid provider-backed entitlement state";
    }
    if (provider === "PLAY_STORE" && !existing?.purchaseTokenHash) {
      return "Invalid provider-backed entitlement state";
    }
  }

  return null;
}

const RESTORABLE_GDPR_DELETE_SOURCES = new Set(["admin", "admin_bulk"]);

function parseGdprRequestData(raw: string | null | undefined): Record<string, any> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission("users", "canRead", { minimumRole: "VIEWER" });
    const { id } = await params;

    // Admin user detail must show soft-deleted users so SUPER_ADMINs
    // can investigate deletion/restore flows. Use the raw client.
    const userRecord = await prismaUnsafe.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        imageUrl: true,
        passwordHash: true,
        emailVerifiedAt: true,
        mfaEnabled: true,
        preferredLocale: true,
        dashboardWidgetPrefs: true,
        showBudget: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        subscription: { select: userDetailSubscriptionSelect },
        profile: true,
        addresses: {
          include: {
            services: {
              include: {
                provider: { select: { id: true, name: true, slug: true, scope: true } },
                customProvider: {
                  select: {
                    id: true,
                    name: true,
                    providerType: true,
                    trustStatus: true,
                    adminReviewStatus: true,
                  },
                },
              },
            },
          },
        },
        movingPlans: {
          include: {
            fromAddress: { select: { id: true, city: true, state: true, zip: true } },
            toAddress: { select: { id: true, city: true, state: true, zip: true } },
            moveTasks: {
              where: { deletedAt: null },
              include: {
                service: { select: { id: true, providerName: true, category: true, isActive: true } },
                provider: { select: { id: true, name: true, slug: true, scope: true } },
                customProvider: {
                  select: {
                    id: true,
                    name: true,
                    providerType: true,
                    trustStatus: true,
                    adminReviewStatus: true,
                  },
                },
                destinationProvider: { select: { id: true, name: true, slug: true, scope: true } },
              },
              orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
              take: 25,
            },
          },
        },
        customProviders: {
          where: { deletedAt: null },
          include: {
            linkedServiceProvider: { select: { id: true, name: true, slug: true } },
            _count: { select: { services: true, moveTasks: true, governanceIssues: true } },
          },
          orderBy: { updatedAt: "desc" },
          take: 25,
        },
        moveTasks: {
          where: { deletedAt: null },
          include: {
            movingPlan: {
              select: {
                id: true,
                status: true,
                moveDate: true,
                fromAddress: { select: { state: true, zip: true } },
                toAddress: { select: { state: true, zip: true } },
              },
            },
            service: { select: { id: true, providerName: true, category: true, isActive: true } },
            provider: { select: { id: true, name: true, slug: true, scope: true } },
            customProvider: {
              select: {
                id: true,
                name: true,
                providerType: true,
                trustStatus: true,
                adminReviewStatus: true,
              },
            },
            destinationProvider: { select: { id: true, name: true, slug: true, scope: true } },
          },
          orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
          take: 50,
        },
        budgets: { orderBy: { month: "desc" }, take: 6 },
        supportTickets: {
          include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
          orderBy: { updatedAt: "desc" },
          take: 5,
        },
        oauthAccounts: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            provider: true,
            providerId: true,
            createdAt: true,
          },
        },
        dataConsents: {
          orderBy: { createdAt: "desc" },
          take: 30,
        },
        emailVerificationTokens: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            email: true,
            expiresAt: true,
            consumedAt: true,
            createdAt: true,
          },
        },
        passwordResetTokens: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            expiresAt: true,
            usedAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!userRecord) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const {
      passwordHash,
      oauthAccounts,
      ...safeUserRecord
    } = userRecord as any;
    const user = {
      ...safeUserRecord,
      subscription: redactUserDetailSubscription(safeUserRecord.subscription, session.role),
      hasPasswordLogin: Boolean(passwordHash),
      oauthAccounts: (oauthAccounts || []).map((account: any) => ({
        id: account.id,
        provider: account.provider,
        providerIdHint: maskProviderIdentifier(account.providerId),
        createdAt: account.createdAt,
      })),
    };

    const auditLogs = await prisma.auditLog.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Session & behavior data
    const [
      sessions,
      recentEvents,
      eventCounts,
      pushDevices,
      loginSessions,
      gdprRequests,
      adminNotes,
    ] = await Promise.all([
      prisma.userSession.findMany({
        where: { userId: id },
        orderBy: { sessionStart: "desc" },
        take: 10,
      }),
      prisma.userEvent.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.userEvent.groupBy({
        by: ["event"],
        where: { userId: id },
        _count: { id: true },
      }),
      prisma.pushDevice.findMany({
        where: { userId: id },
        orderBy: { lastSeenAt: "desc" },
        select: {
          id: true,
          platform: true,
          deviceName: true,
          lastSeenAt: true,
          createdAt: true,
        },
      }),
      prisma.userLoginSession.findMany({
        where: { userId: id },
        orderBy: [{ isActive: "desc" }, { lastActivity: "desc" }],
        take: 15,
        select: {
          id: true,
          ipAddress: true,
          userAgent: true,
          browser: true,
          os: true,
          deviceType: true,
          isActive: true,
          expiresAt: true,
          lastActivity: true,
          createdAt: true,
          impersonatedByAdminId: true,
        },
      }),
      prisma.gDPRRequest.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.adminAuditLog.findMany({
        where: {
          entityType: "User",
          entityId: id,
          action: "USER_INTERNAL_NOTE",
        },
        include: {
          adminUser: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    // Field-level redaction by role. VIEWER/MODERATOR receive a masked
    // email, no IPs/UAs, no OAuth provider IDs, no GDPR request bodies,
    // no token metadata, no admin notes. ADMIN sees IPs/UAs and notes
    // but still no impersonation context. SUPER_ADMIN is unredacted.
    const redacted = redactUserDetail(
      {
        user,
        auditLogs,
        sessions,
        recentEvents,
        eventCounts,
        pushDevices,
        loginSessions,
        gdprRequests,
        adminNotes,
      },
      session.role,
    );
    await writeAdminAudit(session, {
      action: "USER_DETAIL_VIEWED",
      entityType: "User",
      entityId: id,
      metadata: {
        operation: "user_detail_view",
        status: "success",
        role: session.role,
      },
      request: getAuditRequestMeta(request),
    });
    return NextResponse.json(redacted);
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to fetch user:", { code: error?.code || null });
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    if (body?.action === "restore_user") {
      const session = await requirePermission("users", "canDelete", { minimumRole: "SUPER_ADMIN" });
      const requestMeta = getAuditRequestMeta(request);
      const confirm = await requirePasswordConfirm(
        session,
        typeof body.confirmPassword === "string" ? body.confirmPassword : undefined,
        {
          operation: "admin_user_restore",
          requireMfa: true,
          mfaCode: typeof body.mfaCode === "string" ? body.mfaCode : undefined,
          backupCode: typeof body.backupCode === "string" ? body.backupCode : undefined,
          ipAddress: requestMeta.ipAddress,
          userAgent: requestMeta.userAgent,
        },
      );
      if (!confirm.confirmed) {
        await writeAdminAudit(session, {
          action: "USER_RESTORE_FAILED",
          entityType: "User",
          entityId: id,
          metadata: {
            operation: "admin_user_restore",
            status: "failed",
            reason: "step_up_failed",
            requiresMfa: Boolean(confirm.requiresMfa),
          },
          request: requestMeta,
        });
        return NextResponse.json({ error: confirm.error, requiresPassword: true, requiresMfa: confirm.requiresMfa || undefined }, { status: 403 });
      }

      // Restore needs to see soft-deleted rows — use the raw client.
      const user = await prismaUnsafe.user.findUnique({
        where: { id },
        select: { id: true, email: true, deletedAt: true },
      });
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      if (!user.deletedAt) {
        return NextResponse.json({ error: "User is already active", skippedReason: "already_active" }, { status: 409 });
      }
      const previousDeletedAt = user.deletedAt;

      const existingRequest = await prisma.gDPRRequest.findFirst({
        where: {
          userId: id,
          type: "DELETE",
          status: { in: ["PENDING", "PROCESSING"] },
        },
        orderBy: { createdAt: "desc" },
      });

      if (existingRequest?.status === "PROCESSING") {
        return NextResponse.json(
          {
            error: "Deletion cleanup is already processing. Do not restore from this screen.",
            skippedReason: "processing_gdpr_request",
            requestId: existingRequest.id,
          },
          { status: 409 },
        );
      }

      const requestData = parseGdprRequestData(existingRequest?.requestData);
      const requestSource = typeof requestData.source === "string" ? requestData.source : "unknown";
      const requestCleanup =
        requestData.cleanup && typeof requestData.cleanup === "object" && !Array.isArray(requestData.cleanup)
          ? requestData.cleanup
          : {};
      if (existingRequest && !RESTORABLE_GDPR_DELETE_SOURCES.has(requestSource)) {
        return NextResponse.json(
          {
            error: "This delete request was not admin-initiated. Review privacy policy obligations before restoring.",
            skippedReason: "non_admin_gdpr_request",
            requestId: existingRequest.id,
          },
          { status: 409 },
        );
      }

      const now = new Date();
      const restoredRequest = await prisma.$transaction(async (tx: any) => {
        const restore = await tx.user.updateMany({
          where: { id, deletedAt: { not: null } },
          data: { deletedAt: null },
        });
        if (restore.count !== 1) {
          throw new Error("USER_RESTORE_SKIPPED");
        }

        let rejectedRequest: any = null;
        if (existingRequest) {
          rejectedRequest = await tx.gDPRRequest.update({
            where: { id: existingRequest.id },
            data: {
              status: "REJECTED",
              completedAt: now,
              requestData: JSON.stringify({
                ...requestData,
                cleanup: {
                  ...requestCleanup,
                  userDeleted: false,
                  lastAttemptAt: now.toISOString(),
                  lastError: "ADMIN_RESTORED_BEFORE_PURGE",
                },
                restore: {
                  canceledByAdminRestore: true,
                  restoredByAdminId: session.adminId,
                  restoredAt: now.toISOString(),
                  previousDeletedAt: previousDeletedAt.toISOString(),
                },
              }),
            },
          });
        }

        return rejectedRequest;
      });

      await writeAdminAudit(session, {
        action: "USER_RESTORED",
        entityType: "User",
        entityId: id,
        metadata: {
          operation: "admin_user_restore",
          status: "success",
          maskedEmail: maskEmail(user.email),
          gdprRequestId: restoredRequest?.id || null,
          gdprRequestStatus: restoredRequest?.status || null,
          sessionsRemainRevoked: true,
        },
        request: requestMeta,
      });

      return NextResponse.json({
        success: true,
        restored: true,
        requestId: restoredRequest?.id || null,
        message: "User restored/unblocked. Existing sessions remain revoked; the user must sign in again or reset their password.",
      });
    }

    const session = await requirePermission("users", "canUpdate", { minimumRole: "ADMIN" });
    const requestMeta = getAuditRequestMeta(request);
    const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (body?.action === "add_note") {
      const note = typeof body.note === "string" ? body.note.trim() : "";
      if (!note) {
        return NextResponse.json({ error: "Note is required" }, { status: 400 });
      }
      if (note.length > 2000) {
        return NextResponse.json({ error: "Note is too long" }, { status: 400 });
      }

      const entry = await writeAdminAudit(session, {
        action: "USER_INTERNAL_NOTE",
        entityType: "User",
        entityId: id,
        metadata: {
          operation: "user_internal_note",
          status: "success",
          noteLength: note.length,
          noteRedacted: true,
        },
        request: requestMeta,
      });

      const created = await prisma.adminAuditLog.findUnique({
        where: { id: entry?.id || "" },
        include: {
          adminUser: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      return NextResponse.json({ note: created || { changes: JSON.stringify({ note: "[REDACTED]" }) } }, { status: 201 });
    }

    if (body?.action === "revoke_login_session") {
      const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
      if (!sessionId) {
        return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
      }
      const confirm = await requirePasswordConfirm(
        session,
        typeof body.confirmPassword === "string" ? body.confirmPassword : undefined,
        {
          operation: "admin_user_session_revoke",
          requireMfa: true,
          mfaCode: typeof body.mfaCode === "string" ? body.mfaCode : undefined,
          backupCode: typeof body.backupCode === "string" ? body.backupCode : undefined,
          ipAddress: requestMeta.ipAddress,
          userAgent: requestMeta.userAgent,
        },
      );
      if (!confirm.confirmed) {
        await writeAdminAudit(session, {
          action: "USER_SESSION_REVOKE_FAILED",
          entityType: "UserLoginSession",
          entityId: sessionId,
          metadata: {
            operation: "admin_user_session_revoke",
            status: "failed",
            targetUserId: id,
            reason: "step_up_failed",
            requiresMfa: Boolean(confirm.requiresMfa),
          },
          request: requestMeta,
        });
        return NextResponse.json({ error: confirm.error, requiresPassword: true, requiresMfa: confirm.requiresMfa || undefined }, { status: 403 });
      }

      const result = await prisma.userLoginSession.updateMany({
        where: { id: sessionId, userId: id, isActive: true },
        data: { isActive: false, lastActivity: new Date() },
      });

      if (result.count === 0) {
        return NextResponse.json({ error: "Session not found or already inactive" }, { status: 404 });
      }

      await writeAdminAudit(session, {
        action: "USER_SESSION_REVOKED",
        entityType: "UserLoginSession",
        entityId: sessionId,
        metadata: {
          operation: "admin_user_session_revoke",
          status: "success",
          targetUserId: id,
          mode: "single",
        },
        request: requestMeta,
      });

      return NextResponse.json({ success: true, revoked: result.count });
    }

    if (body?.action === "revoke_all_login_sessions") {
      const confirm = await requirePasswordConfirm(
        session,
        typeof body.confirmPassword === "string" ? body.confirmPassword : undefined,
        {
          operation: "admin_user_session_revoke_all",
          requireMfa: true,
          mfaCode: typeof body.mfaCode === "string" ? body.mfaCode : undefined,
          backupCode: typeof body.backupCode === "string" ? body.backupCode : undefined,
          ipAddress: requestMeta.ipAddress,
          userAgent: requestMeta.userAgent,
        },
      );
      if (!confirm.confirmed) {
        await writeAdminAudit(session, {
          action: "USER_SESSION_REVOKE_FAILED",
          entityType: "User",
          entityId: id,
          metadata: {
            operation: "admin_user_session_revoke_all",
            status: "failed",
            reason: "step_up_failed",
            requiresMfa: Boolean(confirm.requiresMfa),
          },
          request: requestMeta,
        });
        return NextResponse.json({ error: confirm.error, requiresPassword: true, requiresMfa: confirm.requiresMfa || undefined }, { status: 403 });
      }
      const result = await prisma.userLoginSession.updateMany({
        where: { userId: id, isActive: true },
        data: { isActive: false, lastActivity: new Date() },
      });

      await writeAdminAudit(session, {
        action: "USER_SESSION_REVOKED",
        entityType: "User",
        entityId: id,
        metadata: {
          operation: "admin_user_session_revoke_all",
          status: "success",
          mode: "all",
          revoked: result.count,
        },
        request: requestMeta,
      });

      return NextResponse.json({ success: true, revoked: result.count });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (error?.message === "USER_RESTORE_SKIPPED") {
      return NextResponse.json({ error: "User could not be restored because its state changed. Refresh and try again." }, { status: 409 });
    }
    console.error("Failed to perform user admin action:", error);
    return NextResponse.json({ error: "Failed to perform user admin action" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission("users", "canUpdate", { minimumRole: "ADMIN" });
    const { id } = await params;
    const raw = await request.json().catch(() => null);
    const parsed = updateUserSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue?.path?.join(".") || "body";
      const message =
        field === "subscriptionStatus" || field === "plan" || field === "accessType"
          ? `Invalid ${field}. Value must be one of the supported subscription enums.`
          : `Invalid request: ${issue?.message || "validation failed"}`;
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const body = parsed.data;

    const user = await prisma.user.findUnique({ where: { id }, include: { subscription: true } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const changes: Record<string, any> = {};
    const requestMeta = getAuditRequestMeta(request);
    const hasProfileChange = body.firstName !== undefined || body.lastName !== undefined;
    const hasBillingChange =
      body.plan ||
      body.premiumUntil !== undefined ||
      body.subscriptionStatus ||
      body.trialEndsAt !== undefined ||
      body.freeAccessEndsAt !== undefined ||
      body.accessType !== undefined ||
      body.provider !== undefined ||
      body.cancelAtPeriodEnd !== undefined ||
      body.autoRenew !== undefined ||
      body.premiumNote !== undefined;
    if (hasBillingChange) {
      await requirePermission("subscriptions", "canUpdate", { minimumRole: "ADMIN" });
    }
    if (hasProfileChange || hasBillingChange) {
      const confirm = await requirePasswordConfirm(
        session,
        typeof body.confirmPassword === "string" ? body.confirmPassword : undefined,
        {
          operation: hasBillingChange ? "billing_subscription_update" : "admin_user_profile_update",
          requireMfa: true,
          mfaCode: body.mfaCode,
          backupCode: body.backupCode,
          ipAddress: requestMeta.ipAddress,
          userAgent: requestMeta.userAgent,
        },
      );
      if (!confirm.confirmed) {
        await writeAdminAudit(session, {
          action: hasBillingChange ? "BILLING_FIELD_UPDATE_FAILED" : "USER_UPDATE_FAILED",
          entityType: "User",
          entityId: id,
          metadata: {
            operation: hasBillingChange ? "billing_subscription_update" : "admin_user_profile_update",
            status: "failed",
            reasonCode: "step_up_failed",
            requiresMfa: Boolean(confirm.requiresMfa),
          },
          request: requestMeta,
        });
        return NextResponse.json({ error: confirm.error, requiresPassword: true, requiresMfa: confirm.requiresMfa || undefined }, { status: 403 });
      }
    }

    // Update name
    if (body.firstName !== undefined || body.lastName !== undefined) {
      const updateData: any = {};
      if (body.firstName !== undefined) { updateData.firstName = body.firstName; changes.firstName = { from: user.firstName, to: body.firstName }; }
      if (body.lastName !== undefined) { updateData.lastName = body.lastName; changes.lastName = { from: user.lastName, to: body.lastName }; }
      await prisma.user.update({ where: { id }, data: updateData });
    }

    // Update subscription plan + premium management
    if (hasBillingChange) {
      // Validate the cross-field combination before any write so the API
      // rejects nonsensical states (e.g. accessType=PAID with provider=ADMIN,
      // status=ACTIVE on the ADMIN provider with no premiumUntil, etc.).
      const combinationError = validateBillingCombination(body, user.subscription);
      if (combinationError) {
        const providerBackedStateError = combinationError === "Invalid provider-backed entitlement state";
        await writeAdminAudit(session, {
          action: "BILLING_FIELD_UPDATE_FAILED",
          entityType: "User",
          entityId: id,
          metadata: {
            operation: "billing_subscription_update",
            status: "failed",
            reasonCode: providerBackedStateError
              ? "invalid_provider_backed_entitlement_state"
              : "invalid_billing_combination",
            provider: body.provider ?? user.subscription?.provider ?? null,
            subscriptionStatus: body.subscriptionStatus ?? user.subscription?.status ?? null,
            accessType: body.accessType !== undefined ? body.accessType : user.subscription?.accessType ?? null,
          },
          request: requestMeta,
        });
        return NextResponse.json(
          {
            error: combinationError,
            code: providerBackedStateError
              ? "INVALID_PROVIDER_BACKED_ENTITLEMENT_STATE"
              : "INVALID_BILLING_COMBINATION",
          },
          { status: providerBackedStateError ? 409 : 400 },
        );
      }

      const subData: any = {};
      if (body.plan) {
        changes.plan = { from: user.subscription?.plan, to: body.plan };
        subData.plan = body.plan;
      }
      if (body.subscriptionStatus) {
        changes.status = { from: user.subscription?.status, to: body.subscriptionStatus };
        subData.status = body.subscriptionStatus;
      }
      if (body.provider !== undefined) {
        changes.provider = { from: user.subscription?.provider, to: body.provider };
        subData.provider = body.provider;
      }
      if (body.premiumUntil !== undefined) {
        changes.premiumUntil = { from: user.subscription?.premiumUntil, to: body.premiumUntil };
        subData.premiumUntil = body.premiumUntil ? new Date(body.premiumUntil) : null;
        subData.premiumGrantedBy = session.adminId;
        subData.premiumGrantedAt = new Date();
      }
      if (body.premiumNote !== undefined) {
        subData.premiumNote = body.premiumNote || null;
      }
      if (body.trialEndsAt !== undefined) {
        changes.trialEndsAt = { from: user.subscription?.trialEndsAt, to: body.trialEndsAt };
        subData.trialEndsAt = body.trialEndsAt ? new Date(body.trialEndsAt) : null;
      }
      if (body.freeAccessEndsAt !== undefined) {
        changes.freeAccessEndsAt = { from: user.subscription?.freeAccessEndsAt, to: body.freeAccessEndsAt };
        subData.freeAccessEndsAt = body.freeAccessEndsAt ? new Date(body.freeAccessEndsAt) : null;
      }
      if (body.accessType !== undefined) {
        changes.accessType = { from: user.subscription?.accessType, to: body.accessType };
        subData.accessType = body.accessType || null;
      }
      // autoRenew and cancelAtPeriodEnd are derived from each other. Whichever
      // the admin sets, we mirror to the other so the row never lands in a
      // state where the two booleans disagree (cross-field validator above
      // already rejected the only way they can both be true).
      if (body.cancelAtPeriodEnd !== undefined) {
        changes.cancelAtPeriodEnd = { from: user.subscription?.cancelAtPeriodEnd, to: body.cancelAtPeriodEnd };
        subData.cancelAtPeriodEnd = Boolean(body.cancelAtPeriodEnd);
        if (body.autoRenew === undefined) {
          subData.autoRenew = !Boolean(body.cancelAtPeriodEnd);
        }
      }
      if (body.autoRenew !== undefined) {
        changes.autoRenew = { from: user.subscription?.autoRenew, to: body.autoRenew };
        subData.autoRenew = Boolean(body.autoRenew);
        if (body.cancelAtPeriodEnd === undefined) {
          subData.cancelAtPeriodEnd = !Boolean(body.autoRenew);
        }
      }

      try {
        if (user.subscription) {
          await prisma.subscription.update({ where: { userId: id }, data: subData });
        } else {
          await prisma.subscription.create({ data: { userId: id, plan: body.plan || "FREE_TRIAL", status: body.subscriptionStatus || "ACTIVE", ...subData } });
        }
      } catch (dbError) {
        await writeAdminAudit(session, {
          action: "BILLING_FIELD_UPDATE_FAILED",
          entityType: "User",
          entityId: id,
          metadata: {
            operation: "billing_subscription_update",
            status: "failed",
            reasonCode: "db_update_failed",
            fields: Object.keys(changes),
          },
          request: requestMeta,
        });
        throw dbError;
      }
    }

    await writeAdminAudit(session, {
      action: hasBillingChange ? "BILLING_FIELD_UPDATED" : "USER_UPDATED",
      entityType: "User",
      entityId: id,
      metadata: {
        operation: hasBillingChange ? "billing_subscription_update" : "admin_user_update",
        status: "success",
        fields: Object.keys(changes),
        billingChanged: Boolean(hasBillingChange),
      },
      request: requestMeta,
    });

    // GDPR / transparency: notify the user about changes an admin made on
    // their account. Debounced so a single PATCH with many fields still
    // produces only one email within a 5-minute window.
    if (Object.keys(changes).length > 0) {
      await notifyUserOfAdminChange({
        userId: id,
        changes,
        actorAdminId: session.adminId,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to update user:", { code: error?.code || null });
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission("users", "canDelete", { minimumRole: "ADMIN" });
    const { id } = await params;

    // Step-up auth: user deletion is destructive
    let confirmPassword: string | undefined;
    let mfaCode: string | undefined;
    let backupCode: string | undefined;
    try {
      const body = await request.json();
      confirmPassword = body?.confirmPassword;
      mfaCode = typeof body?.mfaCode === "string" ? body.mfaCode : undefined;
      backupCode = typeof body?.backupCode === "string" ? body.backupCode : undefined;
    } catch { /* no body is fine, password will be required */ }
    const requestMeta = getAuditRequestMeta(request);
    const confirm = await requirePasswordConfirm(session, confirmPassword, {
      operation: "admin_user_delete",
      requireMfa: true,
      mfaCode,
      backupCode,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });
    if (!confirm.confirmed) {
      await writeAdminAudit(session, {
        action: "USER_DELETE_FAILED",
        entityType: "User",
        entityId: id,
        metadata: {
          operation: "admin_user_delete",
          status: "failed",
          reason: "step_up_failed",
          requiresMfa: Boolean(confirm.requiresMfa),
        },
        request: requestMeta,
      });
      return NextResponse.json({ error: confirm.error, requiresPassword: true, requiresMfa: confirm.requiresMfa || undefined }, { status: 403 });
    }

    // Need to see deletedAt to detect already-deleted state, so use the
    // raw client.
    const user = await prismaUnsafe.user.findUnique({ where: { id }, include: { subscription: true } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (user.deletedAt) {
      return NextResponse.json({ error: "User is already deleted", skippedReason: "already_deleted" }, { status: 409 });
    }

    const existingRequest = await prisma.gDPRRequest.findFirst({
      where: {
        userId: id,
        type: "DELETE",
        status: { in: ["PENDING", "PROCESSING"] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (existingRequest?.status === "PROCESSING") {
      return NextResponse.json(
        {
          error: "User deletion is already processing",
          skippedReason: "processing_gdpr_request",
          requestId: existingRequest.id,
        },
        { status: 409 },
      );
    }

    const now = new Date();
    const deleteRequest = await prisma.$transaction(async (tx: any) => {
      const softDelete = await tx.user.updateMany({
        where: { id, deletedAt: null },
        data: { deletedAt: now },
      });
      if (softDelete.count !== 1) {
        throw new Error("USER_DELETE_SKIPPED");
      }

      await Promise.all([
        tx.userLoginSession.updateMany({
          where: { userId: id, isActive: true },
          data: { isActive: false, lastActivity: now },
        }),
        tx.userSession.updateMany({
          where: { userId: id, isActive: true },
          data: { isActive: false, sessionEnd: now, lastActivity: now },
        }),
      ]);

      const requestRecord = existingRequest || await tx.gDPRRequest.create({
        data: {
          userId: id,
          type: "DELETE",
          status: "PENDING",
          requestData: JSON.stringify({
            source: "admin",
            initiatedByAdminId: session.adminId,
            email: user.email,
            stripeSubscriptionId: user.subscription?.stripeSubscriptionId || null,
            initiatedAt: now.toISOString(),
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

      return requestRecord;
    });

    await writeAdminAudit(session, {
      action: "USER_DELETED",
      entityType: "User",
      entityId: id,
      metadata: {
        operation: "admin_user_delete",
        status: "success",
        maskedEmail: maskEmail(user.email),
        gdprRequestStatus: deleteRequest.status,
        queuedCleanup: !existingRequest,
      },
      request: requestMeta,
    });

    return NextResponse.json(
      {
        success: true,
        deleted: true,
        status: deleteRequest.status,
        requestId: deleteRequest.id,
        skipped: [],
        message: existingRequest
          ? "User was deleted from the active list. Existing GDPR cleanup request will continue."
          : "User was deleted from the active list. GDPR cleanup has been queued for staged processing.",
      },
      { status: 200 }
    );
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (error?.message === "USER_DELETE_SKIPPED") {
      return NextResponse.json({ error: "User could not be deleted because its state changed. Refresh and try again." }, { status: 409 });
    }
    console.error("Failed to delete user:", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
