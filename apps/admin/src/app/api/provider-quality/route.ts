import { NextRequest, NextResponse } from "next/server";
import {
  buildProviderQualitySnapshot,
  buildProviderQueryDiagnostics,
  type ProviderQualityRecord,
} from "@locateflow/shared";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAdminRuntimeConfigValues } from "@/lib/runtime-config";

export const dynamic = "force-dynamic";

type LiveDataStatus = "ready" | "missing" | "partial" | "disabled" | "keyless";

interface LiveDataReadinessItem {
  id: string;
  label: string;
  status: LiveDataStatus;
  configured: boolean;
  detail: string;
}

const LIVE_DATA_KEYS = [
  "FCC_BDC_ENABLED",
  "FCC_BDC_API_KEY",
  "FCC_BDC_USERNAME",
  "ELECTRIC_LOOKUP_ENABLED",
  "OPENEI_API_KEY",
  "AIRNOW_API_KEY",
  "CENSUS_API_KEY",
  "FMCSA_WEBKEY",
] as const;

function isEnabled(value: string | null | undefined): boolean {
  return value === "true" || value === "1" || value === "yes";
}

function isConfigured(value: string | null | undefined): boolean {
  return Boolean(value && value.trim());
}

function parseOptionalNumber(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toQualityRecord(provider: any): ProviderQualityRecord {
  return {
    id: provider.id,
    name: provider.name,
    slug: provider.slug,
    category: provider.category,
    subCategory: provider.subCategory,
    description: provider.description,
    website: provider.website,
    phone: provider.phone,
    logoUrl: provider.logoUrl,
    scope: provider.scope,
    states: provider.states as string[] | string | null,
    zipCodes: provider.zipCodes as string[] | string | null,
    tags: provider.tags as string[] | string | null,
    popularityScore: provider.popularityScore,
    isActive: provider.isActive,
    displayOrder: provider.displayOrder,
    coverageModel: provider.coverageModel,
    deletedAt: provider.deletedAt,
    updatedAt: provider.updatedAt,
    coverages: provider.coverages,
  };
}

function buildLiveDataReadiness(values: Record<string, string | null>): LiveDataReadinessItem[] {
  const fccEnabled = isEnabled(values.FCC_BDC_ENABLED);
  const fccKey = isConfigured(values.FCC_BDC_API_KEY);
  const fccUsername = isConfigured(values.FCC_BDC_USERNAME);
  const electricEnabled = isEnabled(values.ELECTRIC_LOOKUP_ENABLED);
  const openEiKey = isConfigured(values.OPENEI_API_KEY);
  const airNowKey = isConfigured(values.AIRNOW_API_KEY);
  const censusKey = isConfigured(values.CENSUS_API_KEY);
  const fmcsaKey = isConfigured(values.FMCSA_WEBKEY);

  return [
    {
      id: "fcc-bdc",
      label: "FCC broadband address verification",
      status: !fccEnabled ? "disabled" : fccKey && fccUsername ? "ready" : "partial",
      configured: fccEnabled && fccKey && fccUsername,
      detail: !fccEnabled
        ? "Disabled by FCC_BDC_ENABLED."
        : fccKey && fccUsername
          ? "Address-level ISP confirmation can run."
          : "Enablement is on, but FCC_BDC_API_KEY and/or FCC_BDC_USERNAME is missing.",
    },
    {
      id: "openei-electric",
      label: "OpenEI electric utility lookup",
      status: !electricEnabled ? "disabled" : openEiKey ? "ready" : "missing",
      configured: electricEnabled && openEiKey,
      detail: !electricEnabled
        ? "Disabled by ELECTRIC_LOOKUP_ENABLED."
        : openEiKey
          ? "Electric utility enrichment can run."
          : "ELECTRIC_LOOKUP_ENABLED is on, but OPENEI_API_KEY is missing.",
    },
    {
      id: "airnow",
      label: "AirNow air quality",
      status: airNowKey ? "ready" : "missing",
      configured: airNowKey,
      detail: airNowKey ? "Air quality enrichment can run." : "AIRNOW_API_KEY is missing.",
    },
    {
      id: "census",
      label: "Census area data",
      status: censusKey ? "ready" : "keyless",
      configured: true,
      detail: censusKey
        ? "Census calls can use the configured key."
        : "Census data can use keyless public endpoints; add CENSUS_API_KEY for higher reliability.",
    },
    {
      id: "fmcsa",
      label: "FMCSA mover checks",
      status: fmcsaKey ? "ready" : "missing",
      configured: fmcsaKey,
      detail: fmcsaKey ? "Mover verification can call FMCSA." : "FMCSA_WEBKEY is missing.",
    },
  ];
}

export async function GET(request: NextRequest) {
  try {
    await requirePermission("providers", "canRead", { minimumRole: "VIEWER" });

    const { searchParams } = new URL(request.url);
    const state = searchParams.get("state");
    const zip = searchParams.get("zip");
    const lat = parseOptionalNumber(searchParams.get("lat"));
    const lng = parseOptionalNumber(searchParams.get("lng"));

    const [providers, runtimeConfig] = await Promise.all([
      prisma.serviceProvider.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          slug: true,
          category: true,
          subCategory: true,
          description: true,
          website: true,
          phone: true,
          logoUrl: true,
          scope: true,
          states: true,
          zipCodes: true,
          tags: true,
          popularityScore: true,
          displayOrder: true,
          isActive: true,
          coverageModel: true,
          deletedAt: true,
          updatedAt: true,
          coverages: {
            select: {
              state: true,
              zipPrefix: true,
              zipExact: true,
            },
          },
        },
      }),
      getAdminRuntimeConfigValues([...LIVE_DATA_KEYS]),
    ]);

    const qualityRecords = providers.map(toQualityRecord);
    const snapshot = buildProviderQualitySnapshot(qualityRecords);
    const queryDiagnostics = buildProviderQueryDiagnostics(qualityRecords, { state, zip, lat, lng });

    return NextResponse.json({
      snapshot,
      queryDiagnostics,
      liveDataReadiness: buildLiveDataReadiness(runtimeConfig),
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to load provider quality report:", error?.message, error);
    return NextResponse.json({ error: "Failed to load provider quality report" }, { status: 500 });
  }
}
