import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  getAdminRuntimeConfigValue: vi.fn(),
  fetch: vi.fn(),
  prisma: {
    providerGovernanceIssue: {
      findMany: vi.fn(),
    },
    serviceProvider: {
      findMany: vi.fn(),
    },
    adminAuditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/runtime-config", () => ({ getAdminRuntimeConfigValue: mocks.getAdminRuntimeConfigValue }));
vi.mock("@/lib/db", () => ({ prisma: mocks.prisma }));

import { POST } from "./route";

function jsonRequest(body: Record<string, unknown> = {}) {
  return new NextRequest("https://admin.locateflow.test/api/provider-governance/ai-audit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/provider-governance/ai-audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mocks.fetch);
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1", role: "ADMIN" });
    mocks.getAdminRuntimeConfigValue.mockResolvedValue("anthropic-key");
    mocks.prisma.providerGovernanceIssue.findMany.mockResolvedValue([]);
    mocks.prisma.serviceProvider.findMany.mockResolvedValue([]);
    mocks.prisma.adminAuditLog.create.mockResolvedValue({});
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: "text", text: JSON.stringify({ summary: "Clean", overallRisk: "low", items: [] }) }] }),
    });
  });

  it("does not call Anthropic when the API key is missing", async () => {
    mocks.getAdminRuntimeConfigValue.mockResolvedValueOnce(null);

    const response = await POST(jsonRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ configured: false, reason: "ANTHROPIC_API_KEY_MISSING" });
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.prisma.providerGovernanceIssue.findMany).not.toHaveBeenCalled();
  });

  it("sends only sanitized provider source-gap context to Haiku", async () => {
    mocks.prisma.providerGovernanceIssue.findMany.mockResolvedValueOnce([
      {
        id: "issue_1",
        title: "Source provider missing: UTILITY_ELECTRIC Commonwealth Edison",
        description: "OpenEI returned provider",
        severity: "HIGH",
        createdAt: new Date("2026-06-13T10:00:00.000Z"),
        updatedAt: new Date("2026-06-13T11:00:00.000Z"),
        metadata: {
          source: "OPENEI_URDB",
          category: "UTILITY_ELECTRIC",
          providerName: "Commonwealth Edison",
          sourceProviderId: "14328",
          evidenceUrl: "https://api.openei.org/utility_rates",
          addressId: "addr_private",
          sampleAddressIds: ["addr_private"],
          latitude: 41.88,
          longitude: -87.62,
          occurrenceCount: 2,
          states: ["IL"],
          zips: ["60601"],
          sampleLocations: ["IL 60601"],
        },
      },
    ]);
    mocks.prisma.serviceProvider.findMany.mockResolvedValueOnce([
      {
        id: "sp_1",
        name: "ComEd",
        slug: "comed",
        category: "UTILITY_ELECTRIC",
        website: "https://www.comed.com",
        phone: "800-334-7661",
        scope: "STATE",
        states: JSON.stringify(["IL"]),
        zipCodes: JSON.stringify([]),
        tags: JSON.stringify([]),
      },
    ]);
    mocks.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              summary: "ComEd likely matches Commonwealth Edison.",
              overallRisk: "medium",
              items: [
                {
                  title: "Review alias",
                  providerName: "Commonwealth Edison",
                  category: "UTILITY_ELECTRIC",
                  recommendedAction: "add_alias",
                  confidence: "high",
                  reason: "Candidate has same state and name family.",
                  fieldsToCollect: [],
                  suggestedCatalogPatch: {
                    officialName: "Commonwealth Edison",
                    aliases: ["ComEd"],
                    website: "https://www.comed.com",
                    phone: "800-334-7661",
                    coverageNote: "IL electric utility",
                  },
                  matchedCandidateIds: ["sp_1"],
                },
              ],
            }),
          },
        ],
      }),
    });

    const response = await POST(jsonRequest({ limit: 20 }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.configured).toBe(true);
    expect(body.analysis.items[0]).toMatchObject({
      recommendedAction: "add_alias",
      matchedCandidateIds: ["sp_1"],
    });

    const anthropicBody = JSON.parse(mocks.fetch.mock.calls[0][1].body);
    const prompt = anthropicBody.messages[0].content;
    expect(anthropicBody.model).toBe("claude-haiku-4-5");
    expect(prompt).toContain("Commonwealth Edison");
    expect(prompt).toContain("ComEd");
    expect(prompt).not.toContain("addr_private");
    expect(prompt).not.toContain("sampleAddressIds");
    expect(prompt).not.toContain("41.88");
    expect(prompt).not.toContain("-87.62");
    expect(mocks.prisma.providerGovernanceIssue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 12 }),
    );
  });

  it("returns a controlled fallback when Haiku is unavailable", async () => {
    mocks.prisma.providerGovernanceIssue.findMany.mockResolvedValueOnce([
      {
        id: "issue_1",
        title: "Source provider missing: UTILITY_INTERNET Example ISP",
        description: null,
        severity: "MEDIUM",
        createdAt: new Date("2026-06-13T10:00:00.000Z"),
        updatedAt: new Date("2026-06-13T11:00:00.000Z"),
        metadata: {
          source: "FCC_BDC",
          category: "UTILITY_INTERNET",
          providerName: "Example ISP",
          occurrenceCount: 1,
          states: ["NJ"],
          zips: ["07470"],
          sampleLocations: ["NJ 07470"],
        },
      },
    ]);
    mocks.fetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) });

    const response = await POST(jsonRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      configured: true,
      error: "AI_ANALYSIS_UNAVAILABLE",
      analysis: null,
    });
    expect(mocks.prisma.adminAuditLog.create).toHaveBeenCalled();
  });
});
