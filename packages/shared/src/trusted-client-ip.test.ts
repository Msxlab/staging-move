import { describe, expect, it } from "vitest";
import {
  normalizeTrustedProxyHeaderMode,
  resolveTrustedClientIpFromHeaders,
} from "./trusted-client-ip";

function headers(input: Record<string, string>) {
  return new Headers(input);
}

describe("trusted client IP resolver", () => {
  it("keeps compatibility precedence by default", () => {
    expect(resolveTrustedClientIpFromHeaders(headers({
      "x-forwarded-for": "198.51.100.1",
      "x-real-ip": "198.51.100.2",
      "cf-connecting-ip": "198.51.100.3",
    }))).toBe("198.51.100.3");
  });

  it("uses the Vercel edge header in compat mode only when Vercel is detected", () => {
    expect(resolveTrustedClientIpFromHeaders(headers({
      "x-vercel-forwarded-for": "198.51.100.9",
      "x-forwarded-for": "198.51.100.1",
    }), { vercelEnv: "production" })).toBe("198.51.100.9");
  });

  it("can ignore all forwarded headers for direct-origin deployments", () => {
    expect(resolveTrustedClientIpFromHeaders(headers({
      "x-forwarded-for": "198.51.100.1",
      "x-real-ip": "198.51.100.2",
      "cf-connecting-ip": "198.51.100.3",
    }), { mode: "none", fallback: "anonymous" })).toBe("anonymous");
  });

  it("supports explicit platform modes", () => {
    expect(resolveTrustedClientIpFromHeaders(headers({
      "x-vercel-forwarded-for": "198.51.100.9",
      "cf-connecting-ip": "198.51.100.3",
      "x-forwarded-for": "198.51.100.1",
    }), { mode: "vercel" })).toBe("198.51.100.9");
    expect(resolveTrustedClientIpFromHeaders(headers({
      "cf-connecting-ip": "198.51.100.3",
      "x-forwarded-for": "198.51.100.1",
    }), { mode: "cloudflare" })).toBe("198.51.100.3");
    expect(resolveTrustedClientIpFromHeaders(headers({
      "x-real-ip": "198.51.100.2",
      "x-forwarded-for": "198.51.100.1",
    }), { mode: "standard" })).toBe("198.51.100.2");
  });

  it("skips malformed forwarded candidates", () => {
    expect(resolveTrustedClientIpFromHeaders(headers({
      "cf-connecting-ip": "not-an-ip",
      "x-real-ip": "198.51.100.2",
    }))).toBe("198.51.100.2");
    expect(resolveTrustedClientIpFromHeaders(headers({
      "cf-connecting-ip": "999.999.999.999",
      "x-real-ip": "198.51.100.2",
    }))).toBe("198.51.100.2");
    expect(resolveTrustedClientIpFromHeaders(headers({
      "cf-connecting-ip": "198.51.100.9:1234",
      "x-real-ip": "198.51.100.2",
    }))).toBe("198.51.100.2");
  });

  it("accepts legitimate IPv6 client addresses", () => {
    expect(resolveTrustedClientIpFromHeaders(headers({
      "cf-connecting-ip": "2001:db8::1",
    }))).toBe("2001:db8::1");
  });

  it("normalizes mode aliases without failing closed on typos", () => {
    expect(normalizeTrustedProxyHeaderMode("false")).toBe("none");
    expect(normalizeTrustedProxyHeaderMode("true")).toBe("standard");
    expect(normalizeTrustedProxyHeaderMode("cf")).toBe("cloudflare");
    expect(normalizeTrustedProxyHeaderMode("surprise")).toBe("compat");
  });
});
