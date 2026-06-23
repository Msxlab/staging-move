import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// getPlanForLimitScope is mocked (no DB); planFeatures stays REAL so the dossierPdf gate
// exercises the actual @locateflow/shared matrix (Pro only). The dossier data
// route and the pdfkit generator are mocked at their boundaries.
vi.mock("@/lib/auth", () => ({
  requireDbUserId: vi.fn(),
}));

vi.mock("@/lib/api-gates", () => ({
  apiGateErrorResponse: (error: unknown) => {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    return null;
  },
}));

vi.mock("@/lib/plan-limits", () => ({
  getPlanForLimitScope: vi.fn(),
}));

vi.mock("@/lib/workspace-data-scope", () => ({
  resolveWorkspaceDataScope: vi.fn(async () => ({
    actorUserId: "user-1",
    ownerUserId: "user-1",
    workspaceId: null,
    workspaceMode: false,
    memberRole: null,
    memberStatus: null,
  })),
  planLimitScopeForDataScope: vi.fn(() => ({})),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/pdf/dossier-report", () => ({
  generateDossierReportPdf: vi.fn(),
}));

vi.mock("../route", () => ({
  GET: vi.fn(),
}));

import { requireDbUserId } from "@/lib/auth";
import { getPlanForLimitScope } from "@/lib/plan-limits";
import { prisma } from "@/lib/db";
import { generateDossierReportPdf } from "@/lib/pdf/dossier-report";
import { GET as getDossier } from "../route";
import { GET } from "./route";

const mockRequireDbUserId = requireDbUserId as unknown as Mock;
const mockGetPlanForLimitScope = getPlanForLimitScope as unknown as Mock;
const mockUserFindUnique = prisma.user.findUnique as unknown as Mock;
const mockGenerate = generateDossierReportPdf as unknown as Mock;
const mockGetDossier = getDossier as unknown as Mock;

// Current full-Dossier payload as the data route emits it at the entitled
// full-sections branch (route.ts ~858-911): the seven public sections PLUS the
// extended housing / evCharging / neighborhood sections. The PDF generator must
// render this whole shape without throwing.
const ENTITLED_DOSSIER = {
  configured: true,
  dossierPdf: true,
  address: { id: "addr-1", city: "Austin", state: "TX", zip: "78701" },
  flood: { status: "ok", zone: "X", isHighRisk: false },
  school: { status: "ok", districtName: "Austin ISD", ncesId: "1" },
  weather: { status: "too_far", forecastDate: null, summary: null, tempHighF: null, tempLowF: null, precipChancePct: null },
  hazards: { status: "ok", topRisks: [{ hazard: "Tornado", rating: "Relatively High" }], overallRating: "Relatively Low" },
  radon: { status: "ok", zone: "2" },
  water: { status: "ok", systemName: "Austin Water", violations5y: 0 },
  air: { status: "ok", aqi: 42, category: "Good" },
  housing: {
    status: "ok",
    zip: "78701",
    entityId: null,
    countyFips: null,
    cbsaCode: null,
    countyName: null,
    metroName: null,
    areaName: null,
    fairMarketRent: null,
    incomeLimits: null,
    caveat: null,
  },
  evCharging: {
    status: "ok",
    radiusMiles: 10,
    totalResults: 3,
    stationCount: 3,
    nearestDistanceMiles: 1.2,
    dcFastPortCount: 2,
    level2PortCount: 4,
    teslaCompatibleCount: 1,
    ccsCompatibleCount: 2,
    stations: [],
    caveat: null,
  },
  neighborhood: {
    status: "ok",
    upgradeRequired: null,
    medianHomeValue: 450000,
    medianGrossRent: 1800,
    medianHouseholdIncome: 90000,
    ownerOccupiedPct: 55,
    incomeBand: "unknown",
    homeValueBand: "unknown",
    walkScore: 12.3,
    walkBand: "above_average",
    schools: [{ name: "Foo Elementary", level: "elementary" }],
    caveat: null,
  },
};

function ctx(id = "addr-1") {
  return { params: Promise.resolve({ id }) };
}
function req() {
  return new NextRequest("http://localhost/api/addresses/addr-1/dossier/pdf");
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireDbUserId.mockResolvedValue("user-1");
  mockGetPlanForLimitScope.mockResolvedValue({ plan: "PRO" });
  mockGetDossier.mockResolvedValue(NextResponse.json(ENTITLED_DOSSIER));
  mockUserFindUnique.mockResolvedValue({ firstName: "Ada", lastName: "Lovelace" });
  mockGenerate.mockResolvedValue(Buffer.from("%PDF-1.4 fake"));
});

describe("GET /api/addresses/:id/dossier/pdf — dossierPdf gate (Pro only)", () => {
  it("401s when unauthenticated before any plan read or aggregation", async () => {
    mockRequireDbUserId.mockRejectedValue(new Error("UNAUTHORIZED"));
    const res = await GET(req(), ctx());
    expect(res.status).toBe(401);
    expect(mockGetPlanForLimitScope).not.toHaveBeenCalled();
    expect(mockGetDossier).not.toHaveBeenCalled();
  });

  it.each(["FREE_TRIAL", "INDIVIDUAL", "FAMILY"])(
    "answers 200 entitled:false for %s without aggregating or rendering",
    async (plan) => {
      mockGetPlanForLimitScope.mockResolvedValue({ plan });
      const res = await GET(req(), ctx());
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        configured: true,
        entitled: false,
        upgradeRequired: "DOSSIER_PDF_UPGRADE_REQUIRED",
      });
      expect(mockGetDossier).not.toHaveBeenCalled();
      expect(mockGenerate).not.toHaveBeenCalled();
    },
  );

  it("renders a PDF for an entitled Pro user", async () => {
    const plan = "PRO";
    mockGetPlanForLimitScope.mockResolvedValue({ plan });
    const res = await GET(req(), ctx());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("home-dossier-addr-1.pdf");
    expect(res.headers.get("Content-Disposition")).toContain("filename*=UTF-8''");
    expect(mockGenerate).toHaveBeenCalledWith(ENTITLED_DOSSIER, "Ada Lovelace");
  });

  it("sanitizes hostile address ids before emitting PDF download headers", async () => {
    const res = await GET(req(), ctx('addr-1"\r\nInjected: yes'));
    const contentDisposition = res.headers.get("Content-Disposition") || "";

    expect(res.status).toBe(200);
    expect(contentDisposition).toMatch(
      /^attachment; filename="[A-Za-z0-9._-]+\.pdf"; filename\*=UTF-8''[A-Za-z0-9._~-]+\.pdf$/,
    );
    expect(contentDisposition).not.toContain("\r");
    expect(contentDisposition).not.toContain("\n");
    expect(contentDisposition).not.toContain("Injected:");
  });

  it("passes a non-200 dossier outcome (e.g. 404) straight through", async () => {
    mockGetDossier.mockResolvedValue(NextResponse.json({ error: "Address not found" }, { status: 404 }));
    const res = await GET(req(), ctx());
    expect(res.status).toBe(404);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("surfaces the teaser rather than an empty PDF if the dossier route itself gates", async () => {
    mockGetDossier.mockResolvedValue(
      NextResponse.json({ configured: true, entitled: false, upgradeRequired: "HOME_DOSSIER_UPGRADE_REQUIRED" }),
    );
    const res = await GET(req(), ctx());
    expect(res.status).toBe(200);
    expect((await res.json()).entitled).toBe(false);
    expect(mockGenerate).not.toHaveBeenCalled();
  });
});

// Regression for dossier-pdf-500: the route mocks the generator everywhere
// above, so a shape mismatch between the CURRENT dossier payload and the
// generator's field access slipped through (the route returned HTTP 500
// "Failed to build dossier PDF"). This block wires the REAL generator into the
// route and renders the current full-Dossier fixture end-to-end. Pre-fix the
// generator threw "Cannot read properties of undefined (reading 'status')" on a
// missing/renamed section and the route 500'd; post-fix it renders "—" for any
// absent section and the route returns 200 application/pdf.
describe("GET /api/addresses/:id/dossier/pdf — real generator (regression: dossier-pdf-500)", () => {
  it("returns 200 application/pdf for the current full-Dossier payload (Pro)", async () => {
    const { generateDossierReportPdf: realGenerate } = await vi.importActual<
      typeof import("@/lib/pdf/dossier-report")
    >("@/lib/pdf/dossier-report");
    mockGenerate.mockImplementation(realGenerate);

    const res = await GET(req(), ctx());

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    const bytes = new Uint8Array(await res.arrayBuffer());
    // A real PDF starts with the "%PDF-" magic; proves the generator ran.
    expect(bytes.length).toBeGreaterThan(100);
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe("%PDF-");
  });

  it("still returns 200 application/pdf when a section is omitted (defensive render)", async () => {
    const { generateDossierReportPdf: realGenerate } = await vi.importActual<
      typeof import("@/lib/pdf/dossier-report")
    >("@/lib/pdf/dossier-report");
    mockGenerate.mockImplementation(realGenerate);

    // Drop a section the generator reads to prove it no longer throws on a
    // payload whose shape drifted (omitted/renamed section).
    const { flood: _flood, ...withoutFlood } = ENTITLED_DOSSIER;
    mockGetDossier.mockResolvedValue(NextResponse.json(withoutFlood));

    const res = await GET(req(), ctx());

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
  });
});
