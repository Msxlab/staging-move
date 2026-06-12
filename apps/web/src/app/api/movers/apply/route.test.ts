import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRuntimeConfigValue: vi.fn(),
  rateLimit: vi.fn(),
  moverApplicationCreate: vi.fn(),
  moverDocumentCreate: vi.fn(),
  buildObjectKey: vi.fn(),
  putObject: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/runtime-config", () => ({
  getRuntimeConfigValue: (...args: unknown[]) => (mocks.getRuntimeConfigValue as any)(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "mover-apply:203.0.113.10"),
  rateLimit: (...args: unknown[]) => (mocks.rateLimit as any)(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    moverApplication: { create: (...args: unknown[]) => (mocks.moverApplicationCreate as any)(...args) },
    moverDocument: { create: (...args: unknown[]) => (mocks.moverDocumentCreate as any)(...args) },
  },
}));

vi.mock("@/lib/storage/r2-client", () => ({
  buildObjectKey: (...args: unknown[]) => (mocks.buildObjectKey as any)(...args),
  putObject: (...args: unknown[]) => (mocks.putObject as any)(...args),
}));

vi.mock("@/lib/email", () => ({
  renderLocateFlowEmail: vi.fn(() => "<p>email</p>"),
  sendEmail: (...args: unknown[]) => (mocks.sendEmail as any)(...args),
}));

import { POST } from "./route";

const VALID_APPLICATION = {
  companyLegalName: "Lone Star Moving LLC",
  usdotNumber: 1234567,
  contactName: "Jordan Diaz",
  contactEmail: "ops@example.com",
  serviceStates: ["TX"],
  services: ["LOCAL"],
  attestation: true,
};

function requestWithFile(file: File) {
  const form = new FormData();
  form.set("application", JSON.stringify(VALID_APPLICATION));
  form.append("documents", file);
  form.set("documentKinds", JSON.stringify(["USDOT_CERT"]));
  return new Request("https://locateflow.com/api/movers/apply", {
    method: "POST",
    body: form,
  }) as any;
}

describe("POST /api/movers/apply", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRuntimeConfigValue.mockImplementation(async (key: string) =>
      key === "MOVER_REGISTRATION_ENABLED" ? "true" : null,
    );
    mocks.rateLimit.mockResolvedValue({ success: true });
    mocks.moverApplicationCreate.mockResolvedValue({ id: "app_1" });
    mocks.moverDocumentCreate.mockResolvedValue({ id: "doc_1" });
    mocks.buildObjectKey.mockReturnValue("document/mover-app_1/document.pdf");
    mocks.putObject.mockResolvedValue(undefined);
    mocks.sendEmail.mockResolvedValue(undefined);
  });

  it("rejects a MIME-spoofed proof document before creating records or uploading", async () => {
    const file = new File([new TextEncoder().encode("<script>alert(1)</script>")], "cert.pdf", {
      type: "application/pdf",
    });

    const response = await POST(requestWithFile(file));
    const body = await response.json();

    expect(response.status).toBe(415);
    expect(body.error).toContain("does not match");
    expect(mocks.moverApplicationCreate).not.toHaveBeenCalled();
    expect(mocks.putObject).not.toHaveBeenCalled();
    expect(mocks.moverDocumentCreate).not.toHaveBeenCalled();
  });

  it("stores valid proof documents using the byte-verified content type", async () => {
    const file = new File([new TextEncoder().encode("%PDF-1.7\n")], "cert.php", {
      type: "application/pdf",
    });

    const response = await POST(requestWithFile(file));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.documentsUploaded).toBe(1);
    expect(mocks.buildObjectKey).toHaveBeenCalledWith("document", "mover-app_1", "pdf");
    expect(mocks.putObject).toHaveBeenCalledWith(expect.objectContaining({
      objectKey: "document/mover-app_1/document.pdf",
      contentType: "application/pdf",
    }));
    expect(mocks.moverDocumentCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        fileName: "cert.php",
        contentType: "application/pdf",
      }),
    }));
  });
});
