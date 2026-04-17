import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePasswordConfirm, requirePermission } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission("settings", "canRead", { minimumRole: "ADMIN", fallbackResources: ["audit_logs"] });

    const [
      userCount, providerCount, stateRuleCount,
      subscriptionCount, movingPlanCount,
      auditLogCount, adminAuditLogCount, sessionCount, eventCount,
      adminUser,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.serviceProvider.count(),
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
    ]);

    const recentErrors = await prisma.adminAuditLog.findMany({
      where: { action: { contains: "ERROR" } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { action: true, entityType: true, createdAt: true },
    });

    // Stripe configuration status (read-only, from env)
    const stripeConfig = {
      isConfigured: !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
      hasIndividualPrice: !!process.env.STRIPE_PRICE_INDIVIDUAL,
      webhookConfigured: !!process.env.STRIPE_WEBHOOK_SECRET,
      // Show masked keys so admin knows they're set (never expose full keys)
      secretKeyMasked: process.env.STRIPE_SECRET_KEY ? `sk_...${process.env.STRIPE_SECRET_KEY.slice(-6)}` : null,
      priceIndividualId: process.env.STRIPE_PRICE_INDIVIDUAL || null,
    };

    // Encryption status
    const encryptionConfig = {
      fieldEncryptionConfigured: process.env.FIELD_ENCRYPTION_KEY?.length === 64,
    };

    return NextResponse.json({
      counts: {
        users: userCount, providers: providerCount,
        stateRules: stateRuleCount, subscriptions: subscriptionCount,
        movingPlans: movingPlanCount,
        auditLogs: auditLogCount, adminAuditLogs: adminAuditLogCount,
        sessions: sessionCount, events: eventCount,
      },
      adminProfile: adminUser,
      recentErrors,
      stripeConfig,
      encryptionConfig,
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
    const session = await requirePermission("settings", "canUpdate", { minimumRole: "SUPER_ADMIN" });
    const { action, ...data } = await request.json();

    if (action === "test_stripe") {
      // Test Stripe connectivity
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) {
        return NextResponse.json({ success: false, error: "STRIPE_SECRET_KEY not configured" });
      }
      try {
        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
        const balance = await stripe.balance.retrieve();
        return NextResponse.json({
          success: true,
          message: "Stripe connection successful",
          currency: balance.available?.[0]?.currency || "usd",
        });
      } catch (err: any) {
        return NextResponse.json({ success: false, error: err?.message || "Stripe connection failed" });
      }
    }

    if (action === "grant_premium") {
      // Step-up auth: granting premium is a sensitive billing operation
      const confirm = await requirePasswordConfirm(session, data.confirmPassword);
      if (!confirm.confirmed) {
        return NextResponse.json({ error: confirm.error, requiresPassword: true }, { status: 403 });
      }

      // Grant premium to a user by email or userId
      const { userId, email, plan, durationDays, note } = data;
      let targetUserId = userId;
      if (!targetUserId && email) {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
        targetUserId = user.id;
      }
      if (!targetUserId) return NextResponse.json({ error: "userId or email required" }, { status: 400 });

      const premiumUntil = durationDays
        ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000)
        : null;

      const sub = await prisma.subscription.upsert({
        where: { userId: targetUserId },
        create: {
          userId: targetUserId,
          plan: plan || "INDIVIDUAL",
          status: "ACTIVE",
          premiumUntil,
          premiumGrantedBy: session.adminId,
          premiumGrantedAt: new Date(),
          premiumNote: note || null,
        },
        update: {
          plan: plan || "INDIVIDUAL",
          status: "ACTIVE",
          premiumUntil,
          premiumGrantedBy: session.adminId,
          premiumGrantedAt: new Date(),
          premiumNote: note || null,
        },
      });

      await prisma.adminAuditLog.create({
        data: {
          adminUserId: session.adminId,
          action: "GRANT_PREMIUM",
          entityType: "Subscription",
          entityId: sub.id,
          changes: JSON.stringify({ targetUserId, plan: plan || "INDIVIDUAL", durationDays, note }),
          ipAddress: request.headers.get("x-forwarded-for") || "unknown",
        },
      });

      return NextResponse.json({ success: true, subscription: sub });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Settings POST failed:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
