import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  writeAdminAudit: vi.fn(),
  moverDocumentFindFirst: vi.fn(),
  downloadAssetObject: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requirePermission: (...args: unknown[]) => (mocks.requirePermission as any)(...args),
}));

vi.mock("@/lib/audit", () => ({
  getAuditRequestMeta: vi.fn(() => ({ ipAddress: "203.0.113.10", userAgent: "Vitest" })),
  writeAdminAudit: (...args: unknown[]) => (mocks.writeAdminAudit as any)(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    moverDocument: {
      findFirst: (...args: unknown[]) => (mocks.moverDocumentFindFirst as any)(...args),
    },
  },
}));

vi.mock("@/lib/r2-asset-storage", () => ({
  downloadAssetObject: (...args: unknown[]) => (mocks.downloadAssetObject as any)(...args),
}));

import { GET } from "./route";

const SESSION = {
  adminId: "admin_1",
  email: "admin@example.com",
  role: "ADMIN",
};

function request() {
  return new Request("https://admin.locateflow.com/api/movers/applications/app_1/documents/doc_1/download", {
    headers: { "user-agent": "Vitest" },
  }) as any;
}

function params(id = "app_1", documentId = "doc_1") {
  return { params: Promise.resolve({ id, documentId }) };
}

describe("GET /api/movers/applications/:id/documents/:documentId/download", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(SESSION);
    mocks.writeAdminAudit.mockResolvedValue({ id: "audit_1" });
    mocks.moverDocumentFindFirst.mockResolvedValue({
      id: "doc_1",
      applicationId: "app_1",
      kind: "USDOT_CERT",
      fileName: "certificate.pdf",
      objectKey: "document/mover-app_1/document.pdf",
      contentType: "application/pdf",
      sizeBytes: 12,
    });
    mocks.downloadAssetObject.mockResolvedValue({
      body: Buffer.from("%PDF-1.7\n"),
      contentType: "application/pdf",
    });
  });

  it("streams a private mover document as an audited attachment", async () => {
    const response = await GET(request(), params());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="certificate.pdf"');
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(Buffer.from(await response.arrayBuffer()).toString("utf8")).toBe("%PDF-1.7\n");
    expect(mocks.downloadAssetObject).toHaveBeenCalledWith("document/mover-app_1/document.pdf");
    expect(mocks.writeAdminAudit).toHaveBeenCalledWith(
      SESSION,
      expect.objectContaining({
        action: "MOVER_DOCUMENT_DOWNLOAD",
        entityType: "MoverDocument",
        entityId: "doc_1",
      }),
    );
  });

  it("rejects document object keys outside the application namespace before R2 fetch", async () => {
    mocks.moverDocumentFindFirst.mockResolvedValueOnce({
      id: "doc_1",
      applicationId: "app_1",
      kind: "USDOT_CERT",
      fileName: "certificate.pdf",
      objectKey: "provider-logo/provider_1/logo.png",
      contentType: "application/pdf",
      sizeBytes: 12,
    });

    const response = await GET(request(), params());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain("storage key");
    expect(mocks.downloadAssetObject).not.toHaveBeenCalled();
    expect(mocks.writeAdminAudit).toHaveBeenCalledWith(
      SESSION,
      expect.objectContaining({
        action: "MOVER_DOCUMENT_DOWNLOAD_FAILED",
        metadata: expect.objectContaining({ reason: "invalid_object_key" }),
      }),
    );
  });
});
