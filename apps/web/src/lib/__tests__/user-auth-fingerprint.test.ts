import { describe, it, expect } from "vitest";
import {
  generateFingerprint,
  generateMobileFingerprint,
} from "../user-auth";

describe("fingerprint generators", () => {
  it("web fingerprint is stable for same IP+UA", async () => {
    const a = await generateFingerprint("1.2.3.4", "Chrome/123");
    const b = await generateFingerprint("1.2.3.4", "Chrome/123");
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it("web fingerprint changes when IP changes", async () => {
    const a = await generateFingerprint("1.2.3.4", "Chrome/123");
    const b = await generateFingerprint("5.6.7.8", "Chrome/123");
    expect(a).not.toBe(b);
  });

  it("mobile fingerprint is stable across IP changes", async () => {
    const a = await generateMobileFingerprint("LocateFlow-iOS/1.0 CFNetwork/1500");
    const b = await generateMobileFingerprint("LocateFlow-iOS/1.0 CFNetwork/1500");
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it("mobile fingerprint changes when UA changes (device swap)", async () => {
    const a = await generateMobileFingerprint("LocateFlow-iOS/1.0 iPhone");
    const b = await generateMobileFingerprint("LocateFlow-Android/1.0 Pixel");
    expect(a).not.toBe(b);
  });

  it("mobile and web fingerprints are different domains (no collision)", async () => {
    const web = await generateFingerprint("1.2.3.4", "UA");
    const mobile = await generateMobileFingerprint("UA");
    expect(web).not.toBe(mobile);
  });
});
