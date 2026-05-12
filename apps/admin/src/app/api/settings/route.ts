import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, requirePasswordConfirm, requirePermission } from "@/lib/auth";
import {
  getAdminRuntimeConfigValue,
  listRuntimeConfigCatalog,
  type RuntimeConfigCatalogItem,
} from "@/lib/runtime-config";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";

// grant_premium is a manual subscription override — billing accounting
// drifts from Stripe the moment we issue one, so we cap how far that
// drift can run. 365d is the longest term we sell; anything longer is
// almost certainly a typo (e.g. 36500 instead of 365), and capping
// here costs nothing because operators can extend by issuing a fresh
// grant later.
const GRANT_PREMIUM_MAX_DURATION_DAYS = 365;

function isPurchaseTokenHashCompatError(error: unknown): boolean {
  const message = String((error as { message?: string })?.message || "");
  const code = (error as { code?: string })?.code;
  const meta = (error as { meta?: { column?: string; field_name?: string; target?: unknown } })?.meta;
  const metaText = [
    meta?.column,
    meta?.field_name,
    Array.isArray(meta?.target) ? meta?.target.join(" ") : meta?.target,
  ].filter(Boolean).join(" ");
  return (
    (code === "P2022" && metaText.includes("purchaseTokenHash")) ||
    (message.includes("purchaseTokenHash") &&
      (message.includes("Unknown argument") ||
        message.includes("Unknown arg") ||
        message.includes("Unknown column") ||
        message.includes("does not exist")))
  );
}

const grantPremiumSchema = z
  .object({
    userId: z.string().min(1).max(40).optional(),
    email: z.string().email().max(254).optional(),
    // FAMILY/BUSINESS are not real billing tiers — only INDIVIDUAL is in
    // BILLING_PLAN_DEFINITIONS. Allowing them here would write a value
    // the read side silently downgrades to FREE_TRIAL.
    plan: z.literal("INDIVIDUAL").optional(),
    // durationDays is required: an admin manual premium grant must always
    // have an explicit expiration. premiumUntil is the entitlement gate;
    // a null expiration grants permanent premium silently.
    durationDays: z
      .number()
      .int()
      .min(1)
      .max(GRANT_PREMIUM_MAX_DURATION_DAYS),
    // Reason is required so the audit row carries operator intent —
    // "why did this user get a free year" must always be answerable.
    note: z.string().min(3).max(500),
    confirmPassword: z.string().min(1).max(200),
    mfaCode: z.string().trim().max(16).optional(),
    backupCode: z.string().trim().max(64).optional(),
  })
  .strict()
  .refine((value) => Boolean(value.userId || value.email), {
    message: "userId or email required",
    path: ["userId"],
  });

function detectDatabaseLabel(databaseUrl: string | undefined) {
  if (!databaseUrl) return "Database URL missing";
  if (databaseUrl.startsWith("mysql://")) return "MySQL (Prisma)";
  if (databaseUrl.startsWith("postgres://") || databaseUrl.startsWith("postgresql://")) {
    return "PostgreSQL (Prisma)";
  }
  if (databaseUrl.startsWith("file:")) return "SQLite (Prisma)";
  return "Managed Database (Prisma)";
}

function billingOperationEntityId(value: string | null | undefined) {
  return value && value.length <= 30 ? value : "unknown";
}

async function writePremiumGrantAudit(
  session: any,
  request: NextRequest,
  input: {
    status: "success" | "failed";
    reasonCode?: string;
    targetUserId?: string | null;
    subscriptionId?: string | null;
    plan?: string | null;
    durationDays?: number | null;
    noteLength?: number | null;
  },
) {
  await writeAdminAudit(session, {
    action: input.status === "success" ? "PREMIUM_GRANTED" : "PREMIUM_GRANT_FAILED",
    entityType: input.subscriptionId ? "Subscription" : "User",
    entityId: billingOperationEntityId(input.subscriptionId || input.targetUserId),
    metadata: {
      operation: "premium_grant",
      targetUserId: input.targetUserId || null,
      plan: input.plan || null,
      durationDays: input.durationDays ?? null,
      noteLength: input.noteLength ?? null,
      status: input.status,
      reasonCode: input.reasonCode || null,
    },
    request: getAuditRequestMeta(request),
  });
}

function getPremiumGrantAuditHints(data: any) {
  return {
    targetUserId: typeof data?.userId === "string" ? data.userId : null,
    plan: typeof data?.plan === "string" ? data.plan : null,
    durationDays: typeof data?.durationDays === "number" ? data.durationDays : null,
    noteLength: typeof data?.note === "string" ? data.note.length : null,
  };
}

async function requirePremiumGrantAuthority(request: NextRequest, data: any) {
  const session = await requireAdmin();
  const auditHints = getPremiumGrantAuditHints(data);

  try {
    await requirePermission("settings", "canUpdate", { minimumRole: "SUPER_ADMIN" });
    return await requirePermission("subscriptions", "canUpdate", { minimumRole: "SUPER_ADMIN" });
  } catch (error: any) {
    if (error?.message === "FORBIDDEN") {
      await writePremiumGrantAudit(session, request, {
        status: "failed",
        reasonCode: "forbidden",
        ...auditHints,
      });
    }
    throw error;
  }
}

function isBillingProductionLike() {
  const appEnv = (process.env.APP_ENV || process.env.VERCEL_ENV || "").toLowerCase();
  if (["development", "dev", "test", "staging", "preview"].includes(appEnv)) return false;
  return appEnv === "production" || (!appEnv && process.env.NODE_ENV === "production");
}

function validateStripeSecretKey(key: string | null | undefined) {
  if (!key) return { ok: false as const, reasonCode: "stripe_secret_missing" };
  if (isBillingProductionLike() && !key.startsWith("sk_live_")) {
    return { ok: false as const, reasonCode: "stripe_secret_not_live" };
  }
  if (!isBillingProductionLike() && !key.startsWith("sk_test_") && !key.startsWith("sk_live_")) {
    return { ok: false as const, reasonCode: "stripe_secret_invalid_prefix" };
  }
  return { ok: true as const, key };
}

function buildIntegrationStatus(
  catalogMap: Map<string, RuntimeConfigCatalogItem>,
  id: string,
  label: string,
  keys: string[],
) {
  const missingKeys = keys.filter((key) => !catalogMap.get(key)?.configured);
  return {
    id,
    label,
    configured: missingKeys.length === 0,
    missingKeys,
  };
}

const CURRENT_PRODUCT_READINESS_MODES = [
  {
    id: "provider_trust_labels_enabled",
    label: "Provider trust labels",
    status: "enabled",
    detail: "Providers are presented as listed/manual directory records unless future source-backed verification exists.",
  },
  {
    id: "move_transition_classifier_enabled",
    label: "Move transition guidance",
    status: "enabled",
    detail: "Move service guidance is deterministic and creates local move tasks. Provider account updates are not executed.",
  },
  {
    id: "move_transition_tasks_enabled",
    label: "Move task tracking",
    status: "enabled",
    detail: "Users can accept, complete, dismiss, and reopen local move tasks. Completion updates LocateFlow only.",
  },
  {
    id: "custom_provider_enabled",
    label: "User-created providers",
    status: "enabled",
    detail: "Users can create private local provider records for manual service tracking.",
  },
  {
    id: "provider_quality_admin_enabled",
    label: "Provider quality admin visibility",
    status: "enabled",
    detail: "Admin provider surfaces show quality warnings, governance queues, and user-created provider review context.",
  },
  {
    id: "provider_recommendation_explainability_enabled",
    label: "Provider recommendation explanations",
    status: "enabled",
    detail: "Recommendations expose coverage confidence, caveats, and manual-confirmation language.",
  },
  {
    id: "backup_dr_proof",
    label: "Backup DR proof",
    status: "not_proven",
    detail: "Backups are stricter, but DR is not proven until a clean staging restore drill succeeds with offsite storage.",
  },
];

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission("settings", "canRead", { minimumRole: "ADMIN", fallbackResources: ["audit_logs"] });

    const [
      userCount, providerCount, customProviderCount, moveTaskCount, stateRuleCount,
      subscriptionCount, movingPlanCount,
      auditLogCount, adminAuditLogCount, sessionCount, eventCount,
      adminUser,
      runtimeCatalog,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.serviceProvider.count(),
      prisma.userCustomProvider.count({ where: { deletedAt: null } }),
      prisma.moveTask.count({ where: { deletedAt: null } }),
      prisma.stateRule.count(),
      prisma.subscription.count(),
      prisma.movingPlan.count(),
      prisma.auditLog.count(),
      prisma.adminAuditLog.count(),
      prisma.userSession.count(),
      prisma.userEvent.count(),
      prisma.adminUser.findUnique({
        where: { id: session.adminId },
        select: {
          id: true, email: true, firstName: true, lastName: true,
          role: true, lastLoginAt: true, createdAt: true,
          _count: { select: { auditLogs: true } },
        },
      }),
      listRuntimeConfigCatalog(),
    ]);

    const recentErrors = await prisma.adminAuditLog.findMany({
      where: { action: { contains: "ERROR" } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { action: true, entityType: true, createdAt: true },
    });

    const runtimeConfigMap = new Map<string, RuntimeConfigCatalogItem>(
      runtimeCatalog.map((item: RuntimeConfigCatalogItem) => [item.key, item]),
    );
    const runtimeSummary = {
      managedKeys: runtimeCatalog.length,
      configured: runtimeCatalog.filter(
        (item: RuntimeConfigCatalogItem) => item.configured,
      ).length,
      dbOverrides: runtimeCatalog.filter(
        (item: RuntimeConfigCatalogItem) =>
          item.source === "Runtime Config" ||
          item.source === "ENV + Runtime Config",
      ).length,
      missingRequired: runtimeCatalog.filter(
        (item: RuntimeConfigCatalogItem) =>
          item.requiredInProduction && !item.configured,
      ).length,
      missingRequiredKeys: runtimeCatalog
        .filter(
          (item: RuntimeConfigCatalogItem) =>
            item.requiredInProduction && !item.configured,
        )
        .map((item: RuntimeConfigCatalogItem) => item.key),
    };

    const integrations = [
      buildIntegrationStatus(runtimeConfigMap, "google_oauth", "Google OAuth", [
        "GOOGLE_OAUTH_CLIENT_ID",
        "GOOGLE_OAUTH_CLIENT_SECRET",
      ]),
      buildIntegrationStatus(runtimeConfigMap, "apple_oauth", "Apple OAuth", [
        "APPLE_OAUTH_CLIENT_ID",
        "APPLE_OAUTH_TEAM_ID",
        "APPLE_OAUTH_KEY_ID",
        "APPLE_OAUTH_PRIVATE_KEY",
      ]),
      buildIntegrationStatus(runtimeConfigMap, "stripe", "Stripe Billing", [
        "STRIPE_SECRET_KEY",
        "STRIPE_WEBHOOK_SECRET",
        "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
        "STRIPE_PRICE_INDIVIDUAL_MONTHLY",
        "STRIPE_PRICE_INDIVIDUAL_YEARLY",
      ]),
      buildIntegrationStatus(runtimeConfigMap, "resend", "Transactional Email", [
        "RESEND_API_KEY",
        "EMAIL_FROM",
      ]),
      buildIntegrationStatus(runtimeConfigMap, "google_maps", "Google Maps", [
        "GOOGLE_MAPS_API_KEY",
      ]),
      buildIntegrationStatus(runtimeConfigMap, "mobile_app_store", "Apple Mobile Billing", [
        "APPLE_BUNDLE_ID",
        "APPLE_APP_STORE_ISSUER_ID",
        "APPLE_APP_STORE_KEY_ID",
        "APPLE_APP_STORE_PRIVATE_KEY",
        "MOBILE_IOS_PRODUCT_INDIVIDUAL",
      ]),
      buildIntegrationStatus(runtimeConfigMap, "mobile_play", "Google Play Billing", [
        "GOOGLE_PLAY_PACKAGE_NAME",
        "GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL",
        "GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY",
        "GOOGLE_PLAY_RTDN_AUDIENCE",
        "MOBILE_ANDROID_PRODUCT_INDIVIDUAL",
      ]),
      buildIntegrationStatus(runtimeConfigMap, "backup_storage", "Encrypted Backup Storage", [
        "BACKUP_STORAGE_PROVIDER",
        "BACKUP_STORAGE_BUCKET",
        "BACKUP_STORAGE_REGION",
        "BACKUP_STORAGE_ACCESS_KEY_ID",
        "BACKUP_STORAGE_SECRET_ACCESS_KEY",
      ]),
      buildIntegrationStatus(runtimeConfigMap, "redis", "Rate Limit Redis", [
        "UPSTASH_REDIS_REST_URL",
        "UPSTASH_REDIS_REST_TOKEN",
      ]),
    ];

    return NextResponse.json({
      counts: {
        users: userCount, providers: providerCount,
        customProviders: customProviderCount, moveTasks: moveTaskCount,
        stateRules: stateRuleCount, subscriptions: subscriptionCount,
        movingPlans: movingPlanCount,
        auditLogs: auditLogCount, adminAuditLogs: adminAuditLogCount,
        sessions: sessionCount, events: eventCount,
      },
      adminProfile: adminUser,
      recentErrors,
      runtimeSummary,
      integrations,
      currentProductReadiness: CURRENT_PRODUCT_READINESS_MODES,
      systemInfo: {
        version: "0.1.0",
        framework: "Next.js 16.1.6",
        database: detectDatabaseLabel(process.env.DATABASE_URL),
        auth: "JWT + bcrypt + TOTP",
        node: process.version,
        environment: process.env.NODE_ENV || "development",
      },
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

// POST /api/settings — Admin can grant premium, update subscription via admin panel
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action, ...data } = body || {};

    if (action === "test_stripe") {
      const session = await requirePermission("settings", "canUpdate", { minimumRole: "SUPER_ADMIN" });
      const stripeKey = await getAdminRuntimeConfigValue("STRIPE_SECRET_KEY");
      const validatedKey = validateStripeSecretKey(stripeKey);
      if (!validatedKey.ok) {
        await writeAdminAudit(session, {
          action: "BILLING_FIELD_UPDATE_FAILED",
          entityType: "RuntimeConfig",
          entityId: "STRIPE_SECRET_KEY",
          metadata: {
            operation: "test_stripe",
            status: "failed",
            reasonCode: validatedKey.reasonCode,
          },
          request: getAuditRequestMeta(request),
        });
        return NextResponse.json(
          { success: false, error: "Stripe configuration is unavailable or invalid.", code: "STRIPE_CONFIG_INVALID" },
          { status: 503 },
        );
      }
      try {
        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(validatedKey.key, { apiVersion: "2024-06-20" });
        const balance = await stripe.balance.retrieve();
        return NextResponse.json({
          success: true,
          message: "Stripe connection successful",
          currency: balance.available?.[0]?.currency || "usd",
        });
      } catch (err: any) {
        await writeAdminAudit(session, {
          action: "BILLING_FIELD_UPDATE_FAILED",
          entityType: "RuntimeConfig",
          entityId: "STRIPE_SECRET_KEY",
          metadata: {
            operation: "test_stripe",
            status: "failed",
            reasonCode: "stripe_connection_failed",
            errorType: err?.type || null,
            errorCode: err?.code || null,
          },
          request: getAuditRequestMeta(request),
        });
        return NextResponse.json(
          { success: false, error: "Stripe connection failed.", code: "STRIPE_CONNECTION_FAILED" },
          { status: 502 },
        );
      }
    }

    if (action === "grant_premium") {
      const session = await requirePremiumGrantAuthority(request, data);
      let premiumGrantFailureAudited = false;
      const parsed = grantPremiumSchema.safeParse(data);
      if (!parsed.success) {
        await writePremiumGrantAudit(session, request, {
          status: "failed",
          reasonCode: "validation_failed",
          targetUserId: typeof data?.userId === "string" ? data.userId : null,
          plan: typeof data?.plan === "string" ? data.plan : null,
          durationDays: typeof data?.durationDays === "number" ? data.durationDays : null,
          noteLength: typeof data?.note === "string" ? data.note.length : null,
        });
        return NextResponse.json(
          { error: "Validation failed", details: parsed.error.errors },
          { status: 400 },
        );
      }

      try {
      const requestMeta = getAuditRequestMeta(request);
      const confirm = await requirePasswordConfirm(session, parsed.data.confirmPassword, {
        operation: "billing_premium_grant",
        requireMfa: true,
        mfaCode: parsed.data.mfaCode,
        backupCode: parsed.data.backupCode,
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent,
      });
      if (!confirm.confirmed) {
        await writePremiumGrantAudit(session, request, {
          status: "failed",
          reasonCode: "step_up_failed",
          targetUserId: parsed.data.userId || null,
          plan: parsed.data.plan || "INDIVIDUAL",
          durationDays: parsed.data.durationDays,
          noteLength: parsed.data.note.length,
        });
        return NextResponse.json(
          { error: confirm.error, requiresPassword: true, requiresMfa: confirm.requiresMfa || undefined },
          { status: 403 },
        );
      }

      const { userId, email, plan, durationDays, note } = parsed.data;
      let targetUserId = userId;
      if (!targetUserId && email) {
        const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
        if (!user) {
          await writePremiumGrantAudit(session, request, {
            status: "failed",
            reasonCode: "user_not_found",
            plan: plan || "INDIVIDUAL",
            durationDays,
            noteLength: note.length,
          });
          return NextResponse.json({ error: "User not found" }, { status: 404 });
        }
        targetUserId = user.id;
      }
      if (!targetUserId) {
        await writePremiumGrantAudit(session, request, {
          status: "failed",
          reasonCode: "target_user_missing",
          plan: plan || "INDIVIDUAL",
          durationDays,
          noteLength: note.length,
        });
        return NextResponse.json({ error: "userId or email required" }, { status: 400 });
      }

      // Refuse the manual grant if a real provider subscription is currently
      // billing the user. Issuing premium on top of a live Stripe / App Store
      // / Play Store sub creates a confusing dual-source state and the next
      // webhook delivery would overwrite the local grant. The admin must
      // cancel the provider subscription first.
      const existing = await prisma.subscription.findUnique({
        where: { userId: targetUserId },
        select: {
          provider: true,
          status: true,
          stripeSubscriptionId: true,
          originalTransactionId: true,
          latestTransactionId: true,
          purchaseToken: true,
        },
      });
      const liveProviderStatuses = new Set([
        "ACTIVE",
        "TRIALING",
        "CANCEL_AT_PERIOD_END",
        "PAST_DUE",
        "GRACE_PERIOD",
        "PENDING_VALIDATION",
      ]);
      const hasLiveProvider =
        existing &&
        (existing.provider === "STRIPE" ||
          existing.provider === "APP_STORE" ||
          existing.provider === "PLAY_STORE") &&
        liveProviderStatuses.has(existing.status || "") &&
        Boolean(
          existing.stripeSubscriptionId ||
            existing.originalTransactionId ||
            existing.latestTransactionId ||
            existing.purchaseToken,
        );
      if (hasLiveProvider) {
        await writePremiumGrantAudit(session, request, {
          status: "failed",
          reasonCode: "provider_subscription_active",
          targetUserId,
          plan: plan || "INDIVIDUAL",
          durationDays,
          noteLength: note.length,
        });
        return NextResponse.json(
          {
            error:
              "User has an active Stripe or store subscription. Cancel the provider subscription first, then grant manual premium.",
            code: "PROVIDER_SUBSCRIPTION_ACTIVE",
            provider: existing!.provider,
          },
          { status: 409 },
        );
      }

      const premiumUntil = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
      const grantedAt = new Date();

      // Clear any stale provider identifiers when switching to ADMIN. The
      // user no longer has a Stripe/IAP subscription (we just confirmed
      // none is live), so leaving the IDs around lets the nightly Stripe
      // reconcile cron treat the row as drifted and overwrite the grant.
      let sub: any;
      try {
        sub = await prisma.subscription.upsert({
        where: { userId: targetUserId },
        create: {
          userId: targetUserId,
          plan: plan || "INDIVIDUAL",
          status: "ACTIVE",
          provider: "ADMIN",
          platform: "web",
          accessType: "FREE_ACCESS",
          premiumUntil,
          premiumGrantedBy: session.adminId,
          premiumGrantedAt: grantedAt,
          premiumNote: note,
          autoRenew: false,
          cancelAtPeriodEnd: false,
        },
        update: {
          plan: plan || "INDIVIDUAL",
          status: "ACTIVE",
          provider: "ADMIN",
          accessType: "FREE_ACCESS",
          premiumUntil,
          premiumGrantedBy: session.adminId,
          premiumGrantedAt: grantedAt,
          premiumNote: note,
          autoRenew: false,
          cancelAtPeriodEnd: false,
          // Stale Stripe / store identifiers — must be cleared so the
          // reconcile cron and provider webhooks do not later overwrite
          // this admin grant. We only reach this line when no live
          // provider sub was found, so the IDs are dead anyway.
          stripeSubscriptionId: null,
          stripePriceId: null,
          stripeCurrentPeriodEnd: null,
          billingProductId: null,
          originalTransactionId: null,
          latestTransactionId: null,
          purchaseToken: null,
          appStoreEnvironment: null,
          gracePeriodEndsAt: null,
          trialEndsAt: null,
          canceledAt: null,
        },
        });
      } catch (dbError) {
        premiumGrantFailureAudited = true;
        await writePremiumGrantAudit(session, request, {
          status: "failed",
          reasonCode: "db_error",
          targetUserId,
          plan: plan || "INDIVIDUAL",
          durationDays,
          noteLength: note.length,
        });
        throw dbError;
      }

      await (prisma.subscription as any)
        .update({
          where: { userId: targetUserId },
          data: { purchaseTokenHash: null },
        })
        .catch((error: unknown) => {
          if (!isPurchaseTokenHashCompatError(error)) {
            console.warn("[settings] failed to clear purchaseTokenHash", error);
          }
        });

      await writePremiumGrantAudit(session, request, {
        status: "success",
        targetUserId,
        subscriptionId: sub.id,
        plan: plan || "INDIVIDUAL",
        durationDays,
        noteLength: note.length,
      });

      const safeSub = { ...sub };
      delete safeSub.purchaseToken;
      delete safeSub.purchaseTokenHash;
      delete safeSub.premiumNote;
      return NextResponse.json({ success: true, subscription: { ...safeSub, noteStored: Boolean(sub.premiumNote) } });
      } catch (error) {
        if (!premiumGrantFailureAudited) {
          await writePremiumGrantAudit(session, request, {
            status: "failed",
            reasonCode: "unexpected_exception",
            targetUserId: parsed.data.userId || null,
            plan: parsed.data.plan || "INDIVIDUAL",
            durationDays: parsed.data.durationDays,
            noteLength: parsed.data.note.length,
          });
        }
        throw error;
      }
    }

    await requirePermission("settings", "canUpdate", { minimumRole: "SUPER_ADMIN" });
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Settings POST failed:", {
      code: error?.code || null,
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
