import { NextRequest, NextResponse } from "next/server";
import { getProviderTrustPresentation } from "@locateflow/shared";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { customProviderSchema } from "@/lib/validators";
import { createAuditLog, extractRequestMeta } from "@/lib/audit";
import { getRateLimitKey, rateLimit } from "@/lib/rate-limit";
import { canCreateCustomProvider } from "@/lib/plan-limits";
import {
  findDuplicateCustomProvider,
  findListedProviderNameConflict,
} from "@/lib/custom-provider-duplicate-guard";

function cleanText(value: string | undefined): string | null {
  const trimmed = (value || "").trim();
  if (!trimmed) return null;
  return trimmed.replace(/[<>]/g, "");
}

function normalizeState(value: string | undefined): string | null {
  const cleaned = cleanText(value);
  return cleaned ? cleaned.toUpperCase() : null;
}

function cleanCategory(value: string | undefined): string {
  return (cleanText(value) || "OTHER").toUpperCase();
}

function presentCustomProvider(provider: any) {
  return {
    ...provider,
    trust: getProviderTrustPresentation("USER_CUSTOM"),
    manualTrackingOnly: true,
    availabilityCaveat:
      "This is your private provider record. Confirm details directly with the provider.",
  };
}

async function recordCustomProviderEvent(userId: string, event: string, metadata: Record<string, unknown>) {
  await prisma.userEvent.create({
    data: {
      userId,
      event: event.slice(0, 50),
      page: "/services/new",
      metadata: JSON.stringify(metadata),
    },
  }).catch(() => null);
}

export async function GET(request: NextRequest) {
  try {
    const userId = await requireDbUserId();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category")?.slice(0, 50);
    const search = searchParams.get("search")?.slice(0, 200);

    const providers = await prisma.userCustomProvider.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(category ? { category } : {}),
        ...(search ? { name: { contains: search } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({
      providers: providers.map(presentCustomProvider),
      metadata: {
        trustStatus: "USER_CUSTOM",
        manualTrackingOnly: true,
        privateToUser: true,
      },
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Failed to fetch custom providers:", error);
    return NextResponse.json({ error: "Failed to fetch custom providers" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireDbUserId();
    const rlKey = getRateLimitKey(request, "custom-provider:create");
    const [ipRl, userRl] = await Promise.all([
      rateLimit(rlKey, { limit: 20, windowSeconds: 60 }),
      rateLimit(`custom-provider:create:user:${userId}`, { limit: 20, windowSeconds: 60 }),
    ]);
    if (!ipRl.success || !userRl.success) {
      return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
    }

    const entitlement = await canCreateCustomProvider(userId);
    if (!entitlement.allowed) {
      return NextResponse.json({ error: entitlement.reason, upgradeRequired: true }, { status: 403 });
    }

    const body = await request.json();
    const validated = customProviderSchema.parse(body);
    const providerName = cleanText(validated.name)!;
    const category = cleanCategory(validated.category);

    const duplicate = await findDuplicateCustomProvider(prisma, {
      userId,
      name: providerName,
      category,
    });
    if (duplicate) {
      return NextResponse.json(
        {
          error: "You already have a private provider with this name and category.",
          existingProviderId: duplicate.id,
        },
        { status: 409 },
      );
    }

    const listedConflict = await findListedProviderNameConflict(prisma, {
      name: providerName,
      category,
    });
    if (listedConflict) {
      return NextResponse.json(
        {
          error: "A listed provider already matches this name and category. Add the listed provider instead, or use a more specific private provider name.",
          listedProviderId: listedConflict.id,
          listedProviderSlug: listedConflict.slug,
        },
        { status: 409 },
      );
    }

    const provider = await prisma.userCustomProvider.create({
      data: {
        userId,
        name: providerName,
        category,
        description: cleanText(validated.description),
        website: cleanText(validated.website),
        phone: cleanText(validated.phone),
        email: cleanText(validated.email),
        addressLine1: cleanText(validated.addressLine1),
        addressLine2: cleanText(validated.addressLine2),
        city: cleanText(validated.city),
        state: normalizeState(validated.state),
        zipCode: cleanText(validated.zipCode),
        notes: cleanText(validated.notes),
        providerType: validated.providerType,
        trustStatus: "USER_CUSTOM",
        adminReviewStatus: "NOT_REVIEWED",
      },
    });

    const meta = extractRequestMeta(request);
    await createAuditLog({
      userId,
      action: "CREATE",
      entityType: "UserCustomProvider",
      entityId: provider.id,
      changes: { name: provider.name, category: provider.category, providerType: provider.providerType },
      ...meta,
    });
    await recordCustomProviderEvent(userId, "CUSTOM_PROVIDER_CREATED", {
      customProviderId: provider.id,
      category: provider.category,
      providerType: provider.providerType,
      localOnly: true,
      privateToUser: true,
    });

    return NextResponse.json({ provider: presentCustomProvider(provider) }, { status: 201 });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    console.error("Failed to create custom provider:", error);
    return NextResponse.json({ error: "Failed to create custom provider" }, { status: 500 });
  }
}
