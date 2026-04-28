import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, requirePasswordConfirm } from "@/lib/auth";
import { notifyUserOfAdminChange } from "@/lib/user-notify";
import { maskProviderIdentifier } from "@/lib/privacy";

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
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission("users", "canRead", { minimumRole: "VIEWER" });
    const { id } = await params;

    const userRecord = await prisma.user.findUnique({
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
        subscription: true,
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

    return NextResponse.json({
      user,
      auditLogs,
      sessions,
      recentEvents,
      eventCounts,
      pushDevices,
      loginSessions,
      gdprRequests,
      adminNotes,
    });
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    if (body?.action === "restore_user") {
      const session = await requirePermission("users", "canDelete", { minimumRole: "SUPER_ADMIN" });
      const confirm = await requirePasswordConfirm(
        session,
        typeof body.confirmPassword === "string" ? body.confirmPassword : undefined,
      );
      if (!confirm.confirmed) {
        return NextResponse.json({ error: confirm.error, requiresPassword: true }, { status: 403 });
      }

      const user = await prisma.user.findUnique({
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

        await tx.adminAuditLog.create({
          data: {
            adminUserId: session.adminId,
            action: "RESTORE_USER",
            entityType: "User",
            entityId: id,
            changes: JSON.stringify({
              email: user.email,
              previousDeletedAt: previousDeletedAt.toISOString(),
              restoredAt: now.toISOString(),
              gdprRequestId: rejectedRequest?.id || null,
              gdprRequestStatus: rejectedRequest?.status || null,
              sessionsRemainRevoked: true,
            }),
            ipAddress: request.headers.get("x-forwarded-for") || "unknown",
          },
        });

        return rejectedRequest;
      });

      return NextResponse.json({
        success: true,
        restored: true,
        requestId: restoredRequest?.id || null,
        message: "User restored/unblocked. Existing sessions remain revoked; the user must sign in again or reset their password.",
      });
    }

    const session = await requirePermission("users", "canUpdate", { minimumRole: "ADMIN" });
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

      const entry = await prisma.adminAuditLog.create({
        data: {
          adminUserId: session.adminId,
          action: "USER_INTERNAL_NOTE",
          entityType: "User",
          entityId: id,
          changes: JSON.stringify({ note }),
          ipAddress: request.headers.get("x-forwarded-for") || "unknown",
        },
      });

      const created = await prisma.adminAuditLog.findUnique({
        where: { id: entry.id },
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

      return NextResponse.json({ note: created }, { status: 201 });
    }

    if (body?.action === "revoke_login_session") {
      const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
      if (!sessionId) {
        return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
      }

      const result = await prisma.userLoginSession.updateMany({
        where: { id: sessionId, userId: id, isActive: true },
        data: { isActive: false, lastActivity: new Date() },
      });

      if (result.count === 0) {
        return NextResponse.json({ error: "Session not found or already inactive" }, { status: 404 });
      }

      await prisma.adminAuditLog.create({
        data: {
          adminUserId: session.adminId,
          action: "REVOKE_LOGIN",
          entityType: "UserLoginSession",
          entityId: sessionId,
          changes: JSON.stringify({ userId: id, mode: "single" }),
          ipAddress: request.headers.get("x-forwarded-for") || "unknown",
        },
      });

      return NextResponse.json({ success: true, revoked: result.count });
    }

    if (body?.action === "revoke_all_login_sessions") {
      const result = await prisma.userLoginSession.updateMany({
        where: { userId: id, isActive: true },
        data: { isActive: false, lastActivity: new Date() },
      });

      await prisma.adminAuditLog.create({
        data: {
          adminUserId: session.adminId,
          action: "REVOKE_LOGIN",
          entityType: "User",
          entityId: id,
          changes: JSON.stringify({ mode: "all", revoked: result.count }),
          ipAddress: request.headers.get("x-forwarded-for") || "unknown",
        },
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

    const hasBillingChange =
      body.plan ||
      body.premiumUntil !== undefined ||
      body.subscriptionStatus ||
      body.trialEndsAt !== undefined ||
      body.freeAccessEndsAt !== undefined ||
      body.accessType !== undefined ||
      body.cancelAtPeriodEnd !== undefined ||
      body.autoRenew !== undefined ||
      body.premiumNote !== undefined;

    // Update subscription plan + premium management
    if (hasBillingChange) {
      const confirm = await requirePasswordConfirm(
        session,
        typeof body.confirmPassword === "string" ? body.confirmPassword : undefined,
      );
      if (!confirm.confirmed) {
        return NextResponse.json({ error: confirm.error, requiresPassword: true }, { status: 403 });
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
      if (body.cancelAtPeriodEnd !== undefined) {
        changes.cancelAtPeriodEnd = { from: user.subscription?.cancelAtPeriodEnd, to: body.cancelAtPeriodEnd };
        subData.cancelAtPeriodEnd = Boolean(body.cancelAtPeriodEnd);
      }
      if (body.autoRenew !== undefined) {
        changes.autoRenew = { from: user.subscription?.autoRenew, to: body.autoRenew };
        subData.autoRenew = Boolean(body.autoRenew);
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
    if (id === session.adminId) {
      return NextResponse.json({ error: "Self-delete is not allowed from this screen" }, { status: 400 });
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

      await tx.adminAuditLog.create({
        data: {
          adminUserId: session.adminId,
          action: "DELETE_USER",
          entityType: "User",
          entityId: id,
          changes: JSON.stringify({
            email: user.email,
            softDeletedAt: now.toISOString(),
            gdprRequestStatus: requestRecord.status,
            queuedCleanup: !existingRequest,
          }),
          ipAddress: request.headers.get("x-forwarded-for") || "unknown",
        },
      });

      return requestRecord;
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
