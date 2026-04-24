import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { serviceSchema } from "@/lib/validators";
import { createAuditLog, extractRequestMeta } from "@/lib/audit";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { encrypt, decrypt } from "@/lib/shared-encryption";
import { canCreateService } from "@/lib/plan-limits";
import { parsePaginationParams, buildPaginatedResponse } from "@/lib/pagination";

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
          address: { select: { nickname: true, city: true, state: true } },
          provider: { select: { id: true, name: true, slug: true, website: true, phone: true, scope: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.service.count({ where }),
    ]);

    // Decrypt sensitive fields for response
    const decryptedServices = services.map((s: any) => ({
      ...s,
      accountNumber: s.accountNumber ? decrypt(s.accountNumber) : s.accountNumber,
      username: s.username ? decrypt(s.username) : s.username,
      phone: s.phone ? decrypt(s.phone) : s.phone,
      notes: s.notes ? decrypt(s.notes) : s.notes,
    }));

    return NextResponse.json({ services: decryptedServices, ...buildPaginatedResponse(decryptedServices, total, pagination) });
  } catch (error) {
    console.error("Failed to fetch services:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}

// POST /api/services
export async function POST(request: NextRequest) {
  try {
    const userId = await requireDbUserId();

    // Rate limit: 30 writes per minute
    const rlKey = getRateLimitKey(request, "svc:create");
    const rl = await rateLimit(rlKey, { limit: 30, windowSeconds: 60 });
    if (!rl.success) {
      return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
    }

    // Plan limit check
    const limitCheck = await canCreateService(userId);
    if (!limitCheck.allowed) {
      return NextResponse.json({ error: limitCheck.reason }, { status: 403 });
    }

    const body = await request.json();
    const validated = serviceSchema.parse(body);

    const address = await prisma.address.findUnique({ where: { id: validated.addressId } });
    if (!address) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }
    if (address.userId !== userId) {
      return NextResponse.json({ error: "You don't have permission to add services to this address" }, { status: 403 });
    }

    // Validate providerId if supplied
    if (validated.providerId) {
      const providerExists = await prisma.serviceProvider.findUnique({ where: { id: validated.providerId } });
      if (!providerExists) {
        return NextResponse.json({ error: "Provider not found" }, { status: 404 });
      }
    }

    // Encrypt sensitive fields before storage
    const encryptedData = {
      ...validated,
      accountNumber: validated.accountNumber ? encrypt(validated.accountNumber) : validated.accountNumber,
      username: validated.username ? encrypt(validated.username) : validated.username,
      phone: validated.phone ? encrypt(validated.phone) : validated.phone,
      notes: validated.notes ? encrypt(validated.notes) : validated.notes,
    };

    const service = await prisma.service.create({
      data: {
        ...encryptedData,
        userId: address.userId,
        contractEndDate: validated.contractEndDate ? new Date(validated.contractEndDate) : undefined,
        activatedAt: new Date(),
      },
    });

    const meta = extractRequestMeta(request);
    await createAuditLog({ userId, action: "CREATE", entityType: "Service", entityId: service.id, changes: { provider: validated.providerName, category: validated.category, providerId: validated.providerId || null }, ...meta });

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

    return NextResponse.json({ service }, { status: 201 });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    console.error("Failed to create service:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
