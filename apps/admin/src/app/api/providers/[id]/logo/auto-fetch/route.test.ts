import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  findProvider: vi.fn(),
  findCandidate: vi.fn(),
  createCandidate: vi.fn(),
  createAuditLog: vi.fn(),
  ingestLogoFromWebsite: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requirePermission: mocks.requirePermission,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    serviceProvider: {
      findUnique: mocks.findProvider,
    },
    providerLogoCandidate: {
      findFirst: mocks.findCandidate,
      create: mocks.createCandidate,
    },
    adminAuditLog: {
      create: mocks.createAuditLog,
    },
  },
}));

vi.mock("@/lib/logo-ingest", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/logo-ingest")>();
  return {
    ...actual,
    ingestLogoFromWebsite: mocks.ingestLogoFromWebsite,
  };
});

import { LogoIngestError } from "@/lib/logo-ingest";
import { POST } from "./route";

function request() {
  return new NextRequest(
    "https://admin.locateflow.test/api/providers/provider_1/logo/auto-fetch",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    },
  );
}

describe("provider logo auto-fetch route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1" });
    mocks.findProvider.mockResolvedValue({
      id: "provider_1",
      website: "https://example.com",
    });
    mocks.findCandidate.mockResolvedValue(null);
    mocks.createCandidate.mockResolvedValue({
      id: "candidate_1",
      source: "clearbit",
      sourceUrl: "https://logo.clearbit.com/example.com",
      publicUrl: "https://cdn.example.com/provider-logo/provider_1/logo.png",
      contentType: "image/png",
      contentHash: "hash",
      bytes: 1024,
      status: "PENDING",
      createdAt: new Date("2026-04-27T00:00:00.000Z"),
    });
    mocks.createAuditLog.mockResolvedValue({});
  });

  it("returns a JSON 422 when no upstream logo candidate is usable", async () => {
    mocks.ingestLogoFromWebsite.mockResolvedValue({
      failed: {
        attempted: [{ source: "clearbit", reason: "timeout" }],
      },
    });

    const response = await POST(request(), {
      params: Promise.resolve({ id: "provider_1" }),
    });

    expect(response.status).toBe(422);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({
      error: "LOGO_FETCH_FAILED",
      message: "No logo source returned a usable image",
      details: [{ source: "clearbit", reason: "timeout" }],
    });
    expect(mocks.createCandidate).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      "[ADMIN] provider logo auto-fetch failed",
      expect.objectContaining({
        providerId: "provider_1",
        website: "https://example.com",
        stage: "download_asset",
      }),
    );
  });

  it("returns a JSON 503 when logo storage is not configured", async () => {
    mocks.ingestLogoFromWebsite.mockRejectedValue(
      new LogoIngestError({
        code: "LOGO_STORAGE_NOT_CONFIGURED",
        message: "Logo storage is not configured",
        stage: "upload_storage",
        status: 503,
        details:
          "Missing R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, or R2_SECRET_ACCESS_KEY",
      }),
    );

    const response = await POST(request(), {
      params: Promise.resolve({ id: "provider_1" }),
    });

    expect(response.status).toBe(503);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({
      error: "LOGO_STORAGE_NOT_CONFIGURED",
      message: "Logo storage is not configured",
      details:
        "Missing R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, or R2_SECRET_ACCESS_KEY",
    });
    expect(mocks.createCandidate).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      "[ADMIN] provider logo auto-fetch failed",
      expect.objectContaining({
        providerId: "provider_1",
        website: "https://example.com",
        stage: "upload_storage",
      }),
    );
  });
});
