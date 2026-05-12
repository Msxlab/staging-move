import { NextRequest, NextResponse } from "next/server";
import { getProviderTrustPresentation } from "@locateflow/shared";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { apiGateErrorResponse, entitlementErrorResponse, requireAppMutationUser } from "@/lib/api-gates";
import { customProviderSchema } from "@/lib/validators";
import { createAuditLog, extractRequestMeta } from "@/lib/audit";
import { getRateLimitKey, rateLimit } from "@/lib/rate-limit";
import { canCreateCustomProvider } from "@/lib/plan-limits";
import {
  findDuplicateCustomProvider,
  findListedProviderNameConflict,
} from "@/lib/custom-provider-duplicate-guard";

const CUSTOM_PROVIDER_CREATE_RATE_LIMIT = { limit: 90, windowSeconds: 300 } as const;

// Max NEEDS_REVIEW submissions a single user can have pending at once.
// Prevents a single account from flooding the admin promotion queue.
const MAX_PENDING_REVIEW_PER_USER = 10;

const US_STATE_RE = /^[A-Z]{2}$/;

type CoverageChoice = "LOCAL" | "STATEWIDE" | "NATIONWIDE";

function resolveCoverage(input: {
  coverage?: CoverageChoice;
  submitForGlobalReview?: boolean;
  state: string | null;
}): CoverageChoice {
  if (input.coverage) return input.coverage;
  // Legacy callers that only sent submitForGlobalReview map to a coverage
  // implicitly so the server can apply consistent rules either way.
  if (input.submitForGlobalReview === true) {
    return input.state ? "STATEWIDE" : "NATIONWIDE";
  }
  return "LOCAL";
}

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
    const gateResponse = apiGateErrorResponse(error);
    if (gateResponse) return gateResponse;
    console.error("Failed to fetch custom providers:", error);
    return NextResponse.json({ error: "Failed to fetch custom providers" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAppMutationUser();
    const rlKey = getRateLimitKey(request, "custom-provider:create");
    const [ipRl, userRl] = await Promise.all([
      rateLimit(rlKey, CUSTOM_PROVIDER_CREATE_RATE_LIMIT),
      rateLimit(`custom-provider:create:user:${userId}`, CUSTOM_PROVIDER_CREATE_RATE_LIMIT),
    ]);
    if (!ipRl.success || !userRl.success) {
      return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
    }

    const entitlement = await canCreateCustomProvider(userId);
    if (!entitlement.allowed) {
      return entitlementErrorResponse(entitlement, "CUSTOM_PROVIDER_LIMIT_REACHED");
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

    const rawState = normalizeState(validated.state);
    const coverage = resolveCoverage({
      coverage: validated.coverage as CoverageChoice | undefined,
      submitForGlobalReview: validated.submitForGlobalReview,
      state: rawState,
    });

    // Server is authoritative on what the chosen coverage implies. The
    // client's submitForGlobalReview flag and state field are sanitized below
    // so an attacker cannot craft a request that bypasses these rules.
    let finalState: string | null;
    let submitForGlobalReview: boolean;
    if (coverage === "STATEWIDE") {
      if (!rawState || !US_STATE_RE.test(rawState)) {
        return NextResponse.json(
          { error: "A 2-letter US state is required for statewide coverage." },
          { status: 400 },
        );
      }
      finalState = rawState;
      submitForGlobalReview = true;
    } else if (coverage === "NATIONWIDE") {
      finalState = null;
      submitForGlobalReview = true;
    } else {
      finalState = rawState;
      submitForGlobalReview = false;
    }

    if (submitForGlobalReview) {
      const pending = await prisma.userCustomProvider.count({
        where: {
          userId,
          adminReviewStatus: "NEEDS_REVIEW",
          deletedAt: null,
        },
      });
      if (pending >= MAX_PENDING_REVIEW_PER_USER) {
        return NextResponse.json(
          {
            error:
              "You have too many provider suggestions awaiting review. Please wait for our team to process the existing ones before submitting more.",
            code: "TOO_MANY_PENDING_REVIEWS",
            pending,
            limit: MAX_PENDING_REVIEW_PER_USER,
          },
          { status: 429 },
        );
      }
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
        state: finalState,
        zipCode: cleanText(validated.zipCode),
        notes: cleanText(validated.notes),
        providerType: validated.providerType,
        trustStatus: "USER_CUSTOM",
        adminReviewStatus: submitForGlobalReview ? "NEEDS_REVIEW" : "NOT_REVIEWED",
      },
    });

    const meta = extractRequestMeta(request);
    await createAuditLog({
      userId,
      action: "CREATE",
      entityType: "UserCustomProvider",
      entityId: provider.id,
      changes: {
        name: provider.name,
        category: provider.category,
        providerType: provider.providerType,
        coverage,
        submitForGlobalReview,
      },
      ...meta,
    });
    await recordCustomProviderEvent(
      userId,
      submitForGlobalReview ? "CUSTOM_PROVIDER_SUBMITTED_FOR_REVIEW" : "CUSTOM_PROVIDER_CREATED",
      {
        customProviderId: provider.id,
        category: provider.category,
        providerType: provider.providerType,
        coverage,
        localOnly: !submitForGlobalReview,
        privateToUser: !submitForGlobalReview,
        submitForGlobalReview,
      },
    );

    return NextResponse.json(
      { provider: { ...presentCustomProvider(provider), coverage } },
      { status: 201 },
    );
  } catch (error: any) {
    const gateResponse = apiGateErrorResponse(error);
    if (gateResponse) return gateResponse;
    if (error?.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    console.error("Failed to create custom provider:", error);
    return NextResponse.json({ error: "Failed to create custom provider" }, { status: 500 });
  }
}
