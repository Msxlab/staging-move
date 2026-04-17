import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

const reviewSchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().max(1000).optional(),
  })
  .strict();

/**
 * GET /api/providers/[id]/reviews
 * Returns recent reviews + caller's own review (if any).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Optional auth — caller's own review is only attached if logged in.
    let viewerId: string | null = null;
    try {
      viewerId = await requireDbUserId();
    } catch {
      viewerId = null;
    }

    const [provider, reviews, mine] = await Promise.all([
      prisma.serviceProvider.findUnique({
        where: { id },
        select: { avgRating: true, reviewCount: true },
      }),
      prisma.providerReview.findMany({
        where: { providerId: id },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          user: { select: { firstName: true } },
        },
      }),
      viewerId
        ? prisma.providerReview.findUnique({
            where: { userId_providerId: { userId: viewerId, providerId: id } },
            select: { rating: true, comment: true, updatedAt: true },
          })
        : Promise.resolve(null),
    ]);

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    return NextResponse.json({
      avgRating: provider.avgRating ?? null,
      reviewCount: provider.reviewCount,
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        authorFirstName: r.user?.firstName ?? null,
      })),
      mine: mine ?? null,
    });
  } catch (error) {
    console.error("[PROVIDER_REVIEWS GET] Failed:", error);
    return NextResponse.json({ error: "Failed to load reviews" }, { status: 500 });
  }
}

/**
 * POST /api/providers/[id]/reviews
 * Upsert the caller's review for this provider. Refreshes aggregate
 * (`avgRating`, `reviewCount`) on the provider row.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let userId: string;
  try {
    userId = await requireDbUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await rateLimit(getRateLimitKey(request, "provider:review"), {
    limit: 10,
    windowSeconds: 60,
  });
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { rating, comment } = parsed.data;

  try {
    // Verify the provider exists and is active.
    const provider = await prisma.serviceProvider.findFirst({
      where: { id, isActive: true },
      select: { id: true },
    });
    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    // Upsert review, then refresh aggregates in one transaction.
    await prisma.$transaction(async (tx) => {
      await tx.providerReview.upsert({
        where: { userId_providerId: { userId, providerId: id } },
        create: { userId, providerId: id, rating, comment: comment || null },
        update: { rating, comment: comment || null },
      });

      const stats = await tx.providerReview.aggregate({
        where: { providerId: id },
        _avg: { rating: true },
        _count: { _all: true },
      });

      await tx.serviceProvider.update({
        where: { id },
        data: {
          avgRating: stats._avg.rating ?? null,
          reviewCount: stats._count._all,
        },
      });
    });

    // Invalidate the providers-by-state cache so list views reflect new aggregates.
    try {
      revalidateTag("providers", "default");
    } catch {
      /* noop — revalidateTag can throw outside of RSC contexts */
    }

    const refreshed = await prisma.serviceProvider.findUnique({
      where: { id },
      select: { avgRating: true, reviewCount: true },
    });

    return NextResponse.json({
      ok: true,
      avgRating: refreshed?.avgRating ?? null,
      reviewCount: refreshed?.reviewCount ?? 0,
      mine: { rating, comment: comment || null },
    });
  } catch (error) {
    console.error("[PROVIDER_REVIEWS POST] Failed:", error);
    return NextResponse.json({ error: "Failed to save review" }, { status: 500 });
  }
}

/**
 * DELETE /api/providers/[id]/reviews
 * Removes the caller's review and refreshes aggregates.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let userId: string;
  try {
    userId = await requireDbUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.providerReview.deleteMany({
        where: { userId, providerId: id },
      });

      const stats = await tx.providerReview.aggregate({
        where: { providerId: id },
        _avg: { rating: true },
        _count: { _all: true },
      });

      await tx.serviceProvider.update({
        where: { id },
        data: {
          avgRating: stats._avg.rating ?? null,
          reviewCount: stats._count._all,
        },
      });
    });

    try {
      revalidateTag("providers", "default");
    } catch {
      /* noop */
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[PROVIDER_REVIEWS DELETE] Failed:", error);
    return NextResponse.json({ error: "Failed to remove review" }, { status: 500 });
  }
}
