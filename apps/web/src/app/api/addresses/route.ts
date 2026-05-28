import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { apiGateErrorResponse, entitlementErrorResponse, requireAppMutationUser } from "@/lib/api-gates";
import { addressSchema } from "@/lib/validators";
import { canCreateAddress } from "@/lib/plan-limits";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { encrypt, decrypt } from "@/lib/shared-encryption";
import { parsePaginationParams, buildPaginatedResponse } from "@/lib/pagination";
import { activeTrackedServiceWhere } from "@/lib/service-active";

// GET /api/addresses
export async function GET(request: NextRequest) {
  try {
    const userId = await requireDbUserId();
    const { searchParams } = new URL(request.url);
    const pagination = parsePaginationParams(searchParams);
    const where = { userId, deletedAt: null };

    const [addresses, total] = await Promise.all([
      prisma.address.findMany({
        where,
        include: {
          services: {
            where: activeTrackedServiceWhere(userId),
            select: { id: true, providerName: true, category: true, monthlyCost: true },
          },
          user: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.address.count({ where }),
    ]);

    // Decrypt sensitive address fields
    const decryptedAddresses = addresses.map((a: any) => ({
      ...a,
      formattedAddress: a.formattedAddress ? decrypt(a.formattedAddress) : a.formattedAddress,
    }));

    return NextResponse.json({ addresses: decryptedAddresses, ...buildPaginatedResponse(decryptedAddresses, total, pagination) });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Failed to fetch addresses:", error);
    return NextResponse.json({ error: "Failed to fetch addresses" }, { status: 500 });
  }
}

// POST /api/addresses
export async function POST(request: NextRequest) {
  try {
    const userId = await requireAppMutationUser();

    // Rate limit: 20 writes per minute
    const rlKey = getRateLimitKey(request, "addr:create");
    const rl = await rateLimit(rlKey, { limit: 20, windowSeconds: 60 });
    if (!rl.success) {
      return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
    }

    const limitCheck = await canCreateAddress(userId);
    if (!limitCheck.allowed) {
      return entitlementErrorResponse(limitCheck, "ADDRESS_LIMIT_REACHED");
    }

    const body = await request.json();
    const validated = addressSchema.parse(body);

    // Encrypt sensitive fields
    const encryptedData = {
      ...validated,
      formattedAddress: validated.formattedAddress ? encrypt(validated.formattedAddress) : validated.formattedAddress,
    };

    // Unset other primaries and create in one transaction so a failed create
    // can never leave the user with zero primary addresses.
    const address = await prisma.$transaction(async (tx) => {
      if (validated.isPrimary) {
        await tx.address.updateMany({
          where: { userId, isPrimary: true },
          data: { isPrimary: false },
        });
      }
      return tx.address.create({
        data: {
          ...encryptedData,
          userId,
          startDate: new Date(validated.startDate),
          endDate: validated.endDate ? new Date(validated.endDate) : undefined,
        },
      });
    });

    return NextResponse.json({
      address: {
        ...address,
        formattedAddress: address.formattedAddress ? decrypt(address.formattedAddress) : address.formattedAddress,
      },
    }, { status: 201 });
  } catch (error: any) {
    const gateResponse = apiGateErrorResponse(error);
    if (gateResponse) return gateResponse;
    if (error?.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    console.error("Failed to create address:", error);
    return NextResponse.json({ error: "Failed to create address" }, { status: 500 });
  }
}
