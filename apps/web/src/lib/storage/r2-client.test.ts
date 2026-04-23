import { describe, expect, it } from "vitest";
import { normalizeAllowedUploadContentType } from "./r2-client";

describe("R2 upload content type allowlist", () => {
  it("allows supported image and PDF media types", () => {
    expect(normalizeAllowedUploadContentType("image/jpeg")).toBe("image/jpeg");
    expect(normalizeAllowedUploadContentType("image/png; charset=binary")).toBe("image/png");
    expect(normalizeAllowedUploadContentType("application/pdf")).toBe("application/pdf");
  });

  it("rejects executable or browser-rendered document types", () => {
    expect(() => normalizeAllowedUploadContentType("image/svg+xml")).toThrow("UNSUPPORTED_UPLOAD_CONTENT_TYPE");
    expect(() => normalizeAllowedUploadContentType("text/html")).toThrow("UNSUPPORTED_UPLOAD_CONTENT_TYPE");
  });
});
