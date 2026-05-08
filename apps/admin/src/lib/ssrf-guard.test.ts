import { describe, expect, it, vi } from "vitest";
import { SsrfBlockedError, assertSafeOutboundUrl } from "@/lib/ssrf-guard";

vi.mock("node:dns/promises", () => ({
  lookup: async (hostname: string) => {
    if (hostname === "logo.clearbit.com") return { address: "104.18.10.20", family: 4 };
    if (hostname === "internal.example.com") return { address: "10.0.0.5", family: 4 };
    if (hostname === "metadata-redirect.example.com") return { address: "169.254.169.254", family: 4 };
    if (hostname === "ipv6.example.com") return { address: "2606:4700::1", family: 6 };
    if (hostname === "ipv6-private.example.com") return { address: "fd00::1", family: 6 };
    throw new Error("ENOTFOUND");
  },
}));

describe("assertSafeOutboundUrl", () => {
  it("allows a public HTTPS URL on the allowlist", async () => {
    const result = await assertSafeOutboundUrl("https://logo.clearbit.com/example.com", {
      allowedHostnames: ["logo.clearbit.com"],
    });
    expect(result.url.hostname).toBe("logo.clearbit.com");
  });

  it("rejects non-http schemes", async () => {
    await expect(
      assertSafeOutboundUrl("file:///etc/passwd"),
    ).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("rejects a literal loopback IP", async () => {
    await expect(
      assertSafeOutboundUrl("http://127.0.0.1/admin"),
    ).rejects.toMatchObject({ reason: "private_ip_literal" });
  });

  it("rejects 169.254.169.254 cloud metadata", async () => {
    await expect(
      assertSafeOutboundUrl("http://169.254.169.254/latest/meta-data/"),
    ).rejects.toMatchObject({ reason: "private_ip_literal" });
  });

  it("rejects metadata.google.internal hostname", async () => {
    await expect(
      assertSafeOutboundUrl("http://metadata.google.internal/computeMetadata/v1/"),
    ).rejects.toMatchObject({ reason: "internal_hostname" });
  });

  it("rejects a hostname that resolves to a private IP", async () => {
    await expect(
      assertSafeOutboundUrl("https://internal.example.com/admin"),
    ).rejects.toMatchObject({ reason: "resolved_private_ip" });
  });

  it("rejects a hostname that resolves to link-local IP", async () => {
    await expect(
      assertSafeOutboundUrl("https://metadata-redirect.example.com/"),
    ).rejects.toMatchObject({ reason: "resolved_private_ip" });
  });

  it("rejects a hostname not on the allowlist", async () => {
    await expect(
      assertSafeOutboundUrl("https://logo.clearbit.com/example.com", {
        allowedHostnames: ["icons.duckduckgo.com"],
      }),
    ).rejects.toMatchObject({ reason: "hostname_not_allowlisted" });
  });

  it("rejects URLs with embedded credentials", async () => {
    await expect(
      assertSafeOutboundUrl("https://user:pass@logo.clearbit.com/example.com"),
    ).rejects.toMatchObject({ reason: "embedded_credentials" });
  });

  it("rejects a private IPv6 ULA", async () => {
    await expect(
      assertSafeOutboundUrl("https://ipv6-private.example.com/"),
    ).rejects.toMatchObject({ reason: "resolved_private_ip" });
  });

  it("allows a public IPv6 host", async () => {
    const result = await assertSafeOutboundUrl("https://ipv6.example.com/");
    expect(result.resolvedIp).toBe("2606:4700::1");
  });
});
