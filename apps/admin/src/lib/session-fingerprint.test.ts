import { describe, expect, it } from "vitest";
import {
  bucketClientIp,
  buildFingerprintMaterial,
  generateAdminSessionFingerprint,
} from "./session-fingerprint";

describe("admin session fingerprint", () => {
  it("buckets IPv4 addresses at /24", () => {
    expect(bucketClientIp("203.0.113.77")).toBe("203.0.113.0/24");
  });

  it("buckets IPv6 addresses at /64", () => {
    expect(bucketClientIp("2606:4700:3036::6815:323d")).toBe("2606:4700:3036:0000::/64");
  });

  it("includes coarse IP and stable browser headers", () => {
    const material = buildFingerprintMaterial({
      ip: "203.0.113.77",
      userAgent: "Chrome/123",
      acceptLanguage: "en-US,en;q=0.9",
      secChUa: '"Chromium";v="123"',
    });
    expect(material).toContain("ip:203.0.113.0/24");
    expect(material).toContain("ua:chrome/123");
    expect(material).toContain("al:en-us,en;q=0.9");
  });

  it("changes when the IP bucket changes", async () => {
    const common = {
      userAgent: "Chrome/123",
      acceptLanguage: "en-US",
      secChUa: '"Chromium";v="123"',
    };
    const first = await generateAdminSessionFingerprint({ ip: "203.0.113.77", ...common });
    const second = await generateAdminSessionFingerprint({ ip: "203.0.114.77", ...common });
    expect(first).not.toBe(second);
  });
});
