import { describe, expect, it } from "vitest";
import {
  contentTypeForSniffed,
  detectDangerousPayload,
  sniffImageFormat,
} from "@/lib/image-magic-bytes";

describe("sniffImageFormat", () => {
  it("recognises a PNG header", () => {
    const buf = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d,
    ]);
    expect(sniffImageFormat(buf)).toBe("png");
  });

  it("recognises a JPEG header", () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(sniffImageFormat(buf)).toBe("jpeg");
  });

  it("recognises a WEBP header", () => {
    const buf = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0,
      0x57, 0x45, 0x42, 0x50,
    ]);
    expect(sniffImageFormat(buf)).toBe("webp");
  });

  it("recognises a GIF89a header", () => {
    const buf = Buffer.from([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0,
    ]);
    expect(sniffImageFormat(buf)).toBe("gif");
  });

  it("recognises an ICO header", () => {
    const buf = Buffer.from([0x00, 0x00, 0x01, 0x00, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(sniffImageFormat(buf)).toBe("ico");
  });

  it("returns null for an SVG (text payload)", () => {
    const buf = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(sniffImageFormat(buf)).toBe(null);
  });

  it("returns null for HTML", () => {
    const buf = Buffer.from("<!DOCTYPE html><html><body></body></html>");
    expect(sniffImageFormat(buf)).toBe(null);
  });

  it("returns null for an empty buffer", () => {
    expect(sniffImageFormat(Buffer.alloc(0))).toBe(null);
  });
});

describe("detectDangerousPayload", () => {
  it("flags SVG / HTML / XML payloads", () => {
    expect(detectDangerousPayload(Buffer.from("<svg></svg>"))).toBe("xml_or_html_payload");
    expect(detectDangerousPayload(Buffer.from("<!DOCTYPE html>"))).toBe("xml_or_html_payload");
    expect(detectDangerousPayload(Buffer.from("   <html>"))).toBe("xml_or_html_payload");
  });

  it("does not flag a PNG header", () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    expect(detectDangerousPayload(buf)).toBe(null);
  });

  it("flags an empty payload", () => {
    expect(detectDangerousPayload(Buffer.alloc(0))).toBe("empty_payload");
  });
});

describe("contentTypeForSniffed", () => {
  it("maps formats to canonical content types", () => {
    expect(contentTypeForSniffed("png")).toBe("image/png");
    expect(contentTypeForSniffed("jpeg")).toBe("image/jpeg");
    expect(contentTypeForSniffed("webp")).toBe("image/webp");
    expect(contentTypeForSniffed("gif")).toBe("image/gif");
    expect(contentTypeForSniffed("ico")).toBe("image/x-icon");
  });
});
