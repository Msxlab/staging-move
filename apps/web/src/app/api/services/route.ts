import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId, requireVerifiedUser } from "@/lib/auth";
import { serviceSchema } from "@/lib/validators";
import { createAuditLog, extractRequestMeta } from "@/lib/audit";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { canCreateService } from "@/lib/plan-limits";
import { parsePaginationParams, buildPaginatedResponse } from "@/lib/pagination";
import { safeSyncMoveTasksForAddress } from "@/lib/move-task-sync";
import {
  decryptServiceSensitiveFields,
  encryptServiceSensitiveFields,
} from "@/lib/service-sensitive-fields";
import {
  duplicateServiceError,
  findDuplicateTrackedService,
} from "@/lib/service-duplicate-guard";

const VERIFY_EMAIL_REDIRECT = "/verify-email?redirect=%2Fservices";

function serviceError(code: string, error: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ code, error, ...extra }, { status });
}

function authErrorResponse(error: unknown) {
  if (!(error instanceof Error)) return null;
  if (error.message === "UNAUTHORIZED") {
    return serviceError("UNAUTHORIZED", "Please sign in again.", 401);
  }
  if (error.message === "EMAIL_VERIFICATION_REQUIRED") {
    return serviceError(
      "EMAIL_VERIFICATION_REQUIRED",
      "Please verify your email to manage services.",
      403,
      { redirectTo: VERIFY_EMAIL_REDIRECT },
    );
  }
  return null;
}

function limitErrorCode(code?: string) {
  if (code === "SERVICE_LIMIT_REACHED" || code === "SETUP_SERVICE_LIMIT_REACHED") {
    return "SERVICE_LIMIT_REACHED";
  }
  return "SUBSCRIPTION_REQUIRED";
}

// GET /api/services
export async function GET(request: NextRequest) {
  try {
    const userId = await requireDbUserId();
    const { searchParams } = new URL(request.url);
    const addressId = searchParams.get("addressId")?.slice(0, 50);
    const category = searchParams.get("category")?.slice(0, 50);
    const search = searchParams.get("search")?.slice(0, 200);

    const where: any = { userId, deletedAt: null };
    if (addressId) where.addressId = addressId;
    if (category) where.category = category;
    if (search) {
      where.providerName = { contains: search };
    }

    const pagination = parsePaginationParams(searchParams);
    const [services, total] = await Promise.all([
      prisma.service.findMany({
        where,
        include: {
          address: { select: { id: true, nickname: true, city: true, state: true } },
          provider: { select: { id: true, name: true, slug: true, category: true, website: true, phone: true, logoUrl: true, scope: true } },
          customProvider: { select: { id: true, name: true, category: true, phone: true, website: true, email: true, providerType: true, trustStatus: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.service.count({ where }),
    ]);

    // Decrypt sensitive fields for response
    const decryptedServices = services.map((s: any) => decryptServiceSensitiveFields(s));

    return NextResponse.json({ services: decryptedServices, ...buildPaginatedResponse(decryptedServices, total, pagination) });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Failed to fetch services:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}

// POST /api/services
export async function POST(request: NextRequest) {
  try {
    const userId = await requireVerifiedUser();

    // Rate limit: 30 writes per minute
    const rlKey = getRateLimitKey(request, "svc:create");
    const [ipRl, userRl] = await Promise.all([
      rateLimit(rlKey, { limit: 30, windowSeconds: 60 }),
      rateLimit(`svc:create:user:${userId}`, { limit: 30, windowSeconds: 60 }),
    ]);
    if (!ipRl.success || !userRl.success) {
      return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
    }

    // Plan limit check
    const limitCheck = await canCreateService(userId);
    if (!limitCheck.allowed) {
      let subscription: { status: string | null; accessType: string | null; plan: string | null } | null = null;
      try {
        subscription = await prisma.subscription.findUnique({
          where: { userId },
          select: { status: true, accessType: true, plan: true },
        });
      } catch {
        subscription = null;
      }
      const status = subscription?.status || null;
      const accessType = subscription?.accessType || null;
      const plan = subscription?.plan || null;
      const eligibleForTrial = !(
        status === "TRIALING" ||
        status === "ACTIVE" ||
        status === "CANCEL_AT_PERIOD_END" ||
        status === "TRIAL_CANCELED"
      );
      return serviceError(
        limitErrorCode(limitCheck.code),
        limitCheck.reason || "Subscription required to add services.",
        403,
        {
          upgradeRequired: limitCheck.upgradeRequired,
          current: limitCheck.current,
          limit: limitCheck.limit,
          entitlementCode: limitCheck.code,
          accessType,
          plan,
          eligibleForTrial,
          upgradePath: "/settings/subscription",
        },
      );
    }

    const body = await request.json();
    const validated = serviceSchema.parse(body);
    const normalizedCategory = validated.category.trim().toUpperCase();

    if (validated.providerId && validated.customProviderId) {
      return NextResponse.json({ error: "Choose either a listed provider or a custom provider, not both" }, { status: 400 });
    }

    const address = await prisma.address.findUnique({ where: { id: validated.addressId } });
    if (!address) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }
    if (address.userId !== userId) {
      return serviceError("FORBIDDEN", "You don't have permission to add services to this address", 403);
    }
    if (address.deletedAt) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }

    // Validate providerId if supplied
    if (validated.providerId) {
      const providerExists = await prisma.serviceProvider.findUnique({ where: { id: validated.providerId } });
      if (!providerExists || providerExists.deletedAt) {
        return NextResponse.json({ error: "Provider not found" }, { status: 404 });
      }
    }

    if (validated.customProviderId) {
      const customProvider = await prisma.userCustomProvider.findFirst({
        where: { id: validated.customProviderId, userId, deletedAt: null },
      });
      if (!customProvider) {
        return NextResponse.json({ error: "Custom provider not found" }, { status: 404 });
      }
    }

    const duplicate = await findDuplicateTrackedService(prisma, {
      userId,
      addressId: validated.addressId,
      category: normalizedCategory,
      providerName: validated.providerName,
      providerId: validated.providerId || null,
      customProviderId: validated.customProviderId || null,
    });
    if (duplicate) {
      return NextResponse.json(duplicateServiceError(duplicate), { status: 409 });
    }

    // Encrypt sensitive fields before storage
    const encryptedData = encryptServiceSensitiveFields({
      ...validated,
      category: normalizedCategory,
    });

    const service = await prisma.service.create({
      data: {
        ...encryptedData,
        userId: address.userId,
        contractEndDate: validated.contractEndDate ? new Date(validated.contractEndDate) : undefined,
        activatedAt: new Date(),
      },
    });

    const meta = extractRequestMeta(request);
    await createAuditLog({
      userId,
      action: "CREATE",
      entityType: "Service",
      entityId: service.id,
      changes: {
        provider: validated.providerName,
        category: normalizedCategory,
        providerId: validated.providerId || null,
        customProviderId: validated.customProviderId || null,
      },
      ...meta,
    });

    // ── Update ServiceProvider stats (atomic increment, non-blocking) ──
    if (validated.providerId) {
      try {
        await prisma.serviceProvider.update({
          where: { id: validated.providerId },
          data: { userCount: { increment: 1 } },
        });
      } catch (statsErr) {
        console.error("Provider stats update failed (non-blocking):", statsErr);
      }
    }

    const moveTaskSync = await safeSyncMoveTasksForAddress(userId, validated.addressId);

    return NextResponse.json({ service: decryptServiceSensitiveFields(service as any), moveTaskSync }, { status: 201 });
  } catch (error: any) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    if (error?.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    console.error("Failed to create service:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
