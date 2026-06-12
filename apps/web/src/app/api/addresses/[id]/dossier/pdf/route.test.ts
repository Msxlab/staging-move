import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// getPlanForLimitScope is mocked (no DB); planFeatures stays REAL so the dossierPdf gate
// exercises the actual @locateflow/shared matrix (Pro-only). The dossier data
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

const ENTITLED_DOSSIER = {
  configured: true,
  address: { id: "addr-1", city: "Austin", state: "TX" },
  flood: { status: "ok", zone: "X", isHighRisk: false },
  school: { status: "ok", districtName: "Austin ISD", ncesId: "1" },
  weather: { status: "too_far", forecastDate: null, summary: null, tempHighF: null, tempLowF: null, precipChancePct: null },
  hazards: { status: "ok", topRisks: [], overallRating: "Relatively Low" },
  radon: { status: "ok", zone: "2" },
  water: { status: "ok", systemName: "Austin Water", violations5y: 0 },
  air: { status: "ok", aqi: 42, category: "Good" },
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

  it("renders a PDF for an entitled PRO user", async () => {
    const res = await GET(req(), ctx());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("home-dossier-addr-1.pdf");
    expect(mockGenerate).toHaveBeenCalledWith(ENTITLED_DOSSIER, "Ada Lovelace");
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
