import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type ProviderRow = {
  id: string;
  name: string;
  slug: string;
  category: string;
  subCategory: string | null;
  description: string | null;
  website: string | null;
  phone: string | null;
  logoUrl: string | null;
  scope: string;
  states: string;
  zipCodes: string;
  tags: string;
  popularityScore: number;
  displayOrder: number;
  userCount?: number;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const includeAlts = searchParams.get("alternatives") !== "0";
    const stateParam = searchParams.get("state")?.toUpperCase() || null;

    const provider = (await prisma.serviceProvider.findFirst({
      where: { id, isActive: true },
    })) as ProviderRow | null;

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    // Find 4 alternatives in the same category (state-scoped if provided).
    let alternatives: ProviderRow[] = [];
    if (includeAlts) {
      const altWhere: Record<string, unknown> = {
        isActive: true,
        category: provider.category,
        id: { not: provider.id },
      };
      if (stateParam) {
        altWhere.OR = [
          { scope: "FEDERAL" },
          { coverages: { some: { state: stateParam } } },
        ];
      }
      alternatives = (await prisma.serviceProvider.findMany({
        where: altWhere,
        orderBy: [{ popularityScore: "desc" }, { name: "asc" }],
        take: 4,
      })) as ProviderRow[];
    }

    return NextResponse.json({
      provider: shape(provider),
      alternatives: alternatives.map(shape),
    });
  } catch (error) {
    console.error("Failed to fetch provider:", error);
    return NextResponse.json({ error: "Failed to fetch provider" }, { status: 500 });
  }
}

function shape(p: ProviderRow) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    category: p.category,
    subCategory: p.subCategory,
    description: p.description,
    website: p.website,
    phone: p.phone,
    logoUrl: p.logoUrl,
    scope: p.scope,
    states: safeJsonParse(p.states, []) as string[],
    zipCodes: safeJsonParse(p.zipCodes, []) as string[],
    tags: safeJsonParse(p.tags, []) as string[],
    popularityScore: p.popularityScore,
    displayOrder: p.displayOrder,
    userCount: p.userCount || 0,
  };
}

function safeJsonParse(value: string, fallback: unknown) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
