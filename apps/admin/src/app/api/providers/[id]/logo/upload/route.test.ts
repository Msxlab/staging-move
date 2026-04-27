import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  findProvider: vi.fn(),
  findCandidate: vi.fn(),
  createCandidate: vi.fn(),
  createAuditLog: vi.fn(),
  ingestLogoFromUpload: vi.fn(),
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
    ingestLogoFromUpload: mocks.ingestLogoFromUpload,
  };
});

import { LogoIngestError } from "@/lib/logo-ingest";
import { POST } from "./route";

function uploadRequest(file?: File) {
  const body = new FormData();
  if (file) body.set("file", file);
  return new NextRequest(
    "https://admin.locateflow.test/api/providers/provider_1/logo/upload",
    {
      method: "POST",
      body,
    },
  );
}

const ingestResult = {
  publicUrl: "https://assets.locateflow.com/provider-logo/provider_1/logo.png",
  objectKey: "provider-logo/provider_1/logo.png",
  source: "manual-upload",
  sourceUrl: null,
  contentType: "image/png",
  contentHash: "hash",
  bytes: 512,
};

const candidate = {
  id: "candidate_1",
  source: "manual-upload",
  sourceUrl: null,
  publicUrl: ingestResult.publicUrl,
  contentType: "image/png",
  contentHash: "hash",
  bytes: 512,
  status: "PENDING",
  createdAt: new Date("2026-04-27T00:00:00.000Z"),
};

describe("provider logo upload route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1" });
    mocks.findProvider.mockResolvedValue({ id: "provider_1" });
    mocks.findCandidate.mockResolvedValue(null);
    mocks.ingestLogoFromUpload.mockResolvedValue(ingestResult);
    mocks.createCandidate.mockResolvedValue(candidate);
    mocks.createAuditLog.mockResolvedValue({});
  });

  it("returns INVALID_LOGO_FILE when the file field is missing", async () => {
    const response = await POST(uploadRequest(), {
      params: Promise.resolve({ id: "provider_1" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "INVALID_LOGO_FILE",
      message: "Missing 'file' field",
      details: null,
    });
  });

  it("returns LOGO_STORAGE_NOT_CONFIGURED as JSON", async () => {
    mocks.ingestLogoFromUpload.mockRejectedValue(
      new LogoIngestError({
        code: "LOGO_STORAGE_NOT_CONFIGURED",
        message: "Logo storage is not configured",
        stage: "upload_storage",
        status: 503,
        details: "R2_ENDPOINT must be the S3 API endpoint",
      }),
    );

    const response = await POST(
      uploadRequest(new File([Buffer.alloc(512)], "logo.png", { type: "image/png" })),
      { params: Promise.resolve({ id: "provider_1" }) },
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "LOGO_STORAGE_NOT_CONFIGURED",
      message: "Logo storage is not configured",
      details: "R2_ENDPOINT must be the S3 API endpoint",
    });
  });

  it("returns CANDIDATE_CREATE_FAILED when candidate persistence fails", async () => {
    mocks.createCandidate.mockRejectedValue(new Error("table missing"));

    const response = await POST(
      uploadRequest(new File([Buffer.alloc(512)], "logo.png", { type: "image/png" })),
      { params: Promise.resolve({ id: "provider_1" }) },
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: "CANDIDATE_CREATE_FAILED",
      message: "Failed to create logo candidate",
    });
  });

  it("uses an audit action that fits AdminAuditLog.action", async () => {
    const response = await POST(
      uploadRequest(new File([Buffer.alloc(512)], "logo.png", { type: "image/png" })),
      { params: Promise.resolve({ id: "provider_1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "LOGO_CAND_ADD",
        }),
      }),
    );
    expect("LOGO_CAND_ADD".length).toBeLessThanOrEqual(20);
  });
});
