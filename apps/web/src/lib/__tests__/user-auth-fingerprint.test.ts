import { describe, it, expect } from "vitest";
import {
  generateFingerprint,
  generateMobileFingerprint,
} from "../user-auth";

describe("fingerprint generators", () => {
  it("web fingerprint is stable for the same UA", async () => {
    const a = await generateFingerprint("1.2.3.4", "Chrome/123");
    const b = await generateFingerprint("1.2.3.4", "Chrome/123");
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it("web fingerprint is stable across IP changes", async () => {
    const a = await generateFingerprint("1.2.3.4", "Chrome/123");
    const b = await generateFingerprint("5.6.7.8", "Chrome/123");
    expect(a).toBe(b);
  });

  it("web fingerprint changes when UA changes", async () => {
    const a = await generateFingerprint("1.2.3.4", "Chrome/123");
    const b = await generateFingerprint("1.2.3.4", "Firefox/123");
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

  it("mobile fingerprint is stable across app version bumps (no mass logout)", async () => {
    // The mobile client UA is "LocateFlow/<version> (iOS; Expo)". A version bump
    // must NOT change the fingerprint, otherwise every signed-in user is logged
    // out on the deploy that ships the new version.
    const v123 = await generateMobileFingerprint("LocateFlow/1.2.3 (iOS; Expo)");
    const v124 = await generateMobileFingerprint("LocateFlow/1.2.4 (iOS; Expo)");
    expect(v123).toBe(v124);
  });

  it("mobile fingerprint still distinguishes platform across version bumps", async () => {
    // Stripping the version must not collapse iOS and Android into one fp.
    const ios = await generateMobileFingerprint("LocateFlow/9.9.9 (iOS; Expo)");
    const android = await generateMobileFingerprint("LocateFlow/1.0.0 (Android; Expo)");
    expect(ios).not.toBe(android);
  });

  it("mobile and web fingerprints are different domains (no collision)", async () => {
    const web = await generateFingerprint("1.2.3.4", "UA");
    const mobile = await generateMobileFingerprint("UA");
    expect(web).not.toBe(mobile);
  });
});
