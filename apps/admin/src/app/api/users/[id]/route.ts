import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, requirePasswordConfirm } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission("users", "canRead", { minimumRole: "VIEWER" });
    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        subscription: true,
        profile: true,
        addresses: { include: { services: true } },
        movingPlans: {
          include: {
            fromAddress: { select: { city: true, state: true } },
            toAddress: { select: { city: true, state: true } },
            tasks: { select: { id: true, completed: true } },
          },
        },
        budgets: { orderBy: { month: "desc" }, take: 6 },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const auditLogs = await prisma.auditLog.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Session & behavior data
    const [sessions, recentEvents, eventCounts, pushDevices] = await Promise.all([
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
      }),
    ]);

    return NextResponse.json({ user, auditLogs, sessions, recentEvents, eventCounts, pushDevices });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to fetch user:", error);
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission("users", "canUpdate", { minimumRole: "ADMIN" });
    const { id } = await params;
    const body = await request.json();

    const user = await prisma.user.findUnique({ where: { id }, include: { subscription: true } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const changes: Record<string, any> = {};

    // Update name
    if (body.firstName !== undefined || body.lastName !== undefined) {
      const updateData: any = {};
      if (body.firstName !== undefined) { updateData.firstName = body.firstName; changes.firstName = { from: user.firstName, to: body.firstName }; }
      if (body.lastName !== undefined) { updateData.lastName = body.lastName; changes.lastName = { from: user.lastName, to: body.lastName }; }
      await prisma.user.update({ where: { id }, data: updateData });
    }

    // Update subscription plan + premium management
    if (body.plan || body.premiumUntil !== undefined || body.subscriptionStatus || body.trialEndsAt !== undefined || body.premiumNote !== undefined) {
      const subData: any = {};
      if (body.plan) {
        changes.plan = { from: user.subscription?.plan, to: body.plan };
        subData.plan = body.plan;
      }
      if (body.subscriptionStatus) {
        changes.status = { from: user.subscription?.status, to: body.subscriptionStatus };
        subData.status = body.subscriptionStatus;
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

      if (user.subscription) {
        await prisma.subscription.update({ where: { userId: id }, data: subData });
      } else {
        await prisma.subscription.create({ data: { userId: id, plan: body.plan || "FREE_TRIAL", status: body.subscriptionStatus || "ACTIVE", ...subData } });
      }
    }

    // Audit log
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "UPDATE_USER",
        entityType: "User",
        entityId: id,
        changes: JSON.stringify(changes),
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to update user:", error);
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
    try {
      const body = await request.json();
      confirmPassword = body?.confirmPassword;
    } catch { /* no body is fine, password will be required */ }
    const confirm = await requirePasswordConfirm(session, confirmPassword);
    if (!confirm.confirmed) {
      return NextResponse.json({ error: confirm.error, requiresPassword: true }, { status: 403 });
    }

    const user = await prisma.user.findUnique({ where: { id }, include: { subscription: true } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "DELETE_USER",
        entityType: "User",
        entityId: id,
        changes: JSON.stringify({ email: user.email }),
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      },
    });

    const existingRequest = await prisma.gDPRRequest.findFirst({
      where: {
        userId: id,
        type: "DELETE",
        status: { in: ["PENDING", "PROCESSING"] },
      },
      orderBy: { createdAt: "desc" },
    });

    const deleteRequest = existingRequest || await prisma.gDPRRequest.create({
      data: {
        userId: id,
        type: "DELETE",
        status: "PENDING",
        requestData: JSON.stringify({
          source: "admin",
          initiatedByAdminId: session.adminId,
          email: user.email,
          stripeSubscriptionId: user.subscription?.stripeSubscriptionId || null,
          initiatedAt: new Date().toISOString(),
          cleanup: {
            stripeCanceled: false,
            cloudinaryDeletedCount: 0,
            clerkDeleted: false,
            userDeleted: false,
            attempts: 0,
            lastAttemptAt: null,
            lastError: null,
          },
        }),
      },
    });

    return NextResponse.json(
      {
        success: true,
        status: deleteRequest.status,
        requestId: deleteRequest.id,
        message: existingRequest
          ? "User deletion is already queued."
          : "User deletion has been queued for staged processing.",
      },
      { status: 202 }
    );
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to delete user:", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
