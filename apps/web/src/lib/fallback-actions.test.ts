import { describe, expect, it, vi, beforeEach } from "vitest";

const dbMock = vi.hoisted(() => ({
  prisma: { connectorFallbackAction: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/db", () => ({ prisma: dbMock.prisma }));

import type { CanonicalAddressChange } from "@locateflow/connectors";
import { resolveFallbackAction, renderFallbackAction, type ResolvedFallbackAction } from "./fallback-actions";

const change: CanonicalAddressChange = {
  eventId: "e1",
  from: { street1: "1 Old St", city: "Austin", state: "TX", zip: "78701", country: "US" },
  to: { street1: "2 New St", street2: "Apt 4", city: "Boston", state: "MA", zip: "02101", country: "US" },
  fullName: "Jane Doe",
  fields: {},
};

describe("resolveFallbackAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when there is no action key", async () => {
    expect(await resolveFallbackAction(null)).toBeNull();
    expect(await resolveFallbackAction(undefined)).toBeNull();
  });

  it("falls back to the in-code default when the table has no row", async () => {
    dbMock.prisma.connectorFallbackAction.findUnique.mockResolvedValue(null);
    const a = await resolveFallbackAction("usps:MAIL_FORWARDING:DEEP_LINK");
    expect(a?.url).toBe("https://moversguide.usps.com/");
    expect(a?.type).toBe("DEEP_LINK");
  });

  it("keeps the in-code default if the DB lookup throws (missing table)", async () => {
    dbMock.prisma.connectorFallbackAction.findUnique.mockRejectedValue(new Error("no such table"));
    const a = await resolveFallbackAction("usps:MAIL_FORWARDING:DEEP_LINK");
    expect(a?.url).toBe("https://moversguide.usps.com/");
  });

  it("layers an enabled DB override over the default and renders templates", async () => {
    dbMock.prisma.connectorFallbackAction.findUnique.mockResolvedValue({
      actionKey: "acme:MAILTO",
      label: "Email Acme",
      helperText: "We prefilled an email to {{to.city}}.",
      urlTemplate: "mailto:support@acme.com?subject=Address%20change&body=New:%20{{to.street1}},%20{{to.city}}",
      type: "MAILTO",
      enabled: true,
    });
    const a = await resolveFallbackAction("acme:MAILTO", change);
    expect(a?.type).toBe("MAILTO");
    expect(a?.url).toContain("2%20New%20St"); // {{to.street1}} URL-encoded
    expect(a?.url).toContain("Boston");
    expect(a?.helperText).toBe("We prefilled an email to Boston.");
  });

  it("ignores a disabled DB override and keeps the default", async () => {
    dbMock.prisma.connectorFallbackAction.findUnique.mockResolvedValue({
      actionKey: "usps:MAIL_FORWARDING:DEEP_LINK",
      label: "x",
      helperText: "x",
      urlTemplate: "https://evil.example.com",
      type: "DEEP_LINK",
      enabled: false,
    });
    const a = await resolveFallbackAction("usps:MAIL_FORWARDING:DEEP_LINK");
    expect(a?.url).toBe("https://moversguide.usps.com/");
  });

  it("falls back to the in-code default when an enabled DB override has an unusable URL", async () => {
    dbMock.prisma.connectorFallbackAction.findUnique.mockResolvedValue({
      actionKey: "usps:MAIL_FORWARDING:DEEP_LINK",
      label: "Open unsafe override",
      helperText: "x",
      urlTemplate: "javascript:alert(1)",
      type: "DEEP_LINK",
      enabled: true,
    });
    const a = await resolveFallbackAction("usps:MAIL_FORWARDING:DEEP_LINK");
    expect(a?.url).toBe("https://moversguide.usps.com/");
    expect(a?.label).not.toBe("Open unsafe override");
  });

  it("PINS the USPS url to the official host even when an ENABLED, valid-https DB override points elsewhere", async () => {
    // Anti-phishing: a valid https override would otherwise win (only the
    // protocol is checked). The pin forces the immutable official USPS URL.
    dbMock.prisma.connectorFallbackAction.findUnique.mockResolvedValue({
      actionKey: "usps:MAIL_FORWARDING:DEEP_LINK",
      label: "Open update",
      helperText: "Continue on USPS to submit your request.",
      urlTemplate: "https://evil.example.com/usps-lookalike",
      type: "DEEP_LINK",
      enabled: true,
    });
    const a = await resolveFallbackAction("usps:MAIL_FORWARDING:DEEP_LINK", change);
    expect(a?.url).toBe("https://moversguide.usps.com/");
  });

  it("allows ordinary operator-provided web links without a host allowlist", async () => {
    dbMock.prisma.connectorFallbackAction.findUnique.mockResolvedValue({
      actionKey: "acme:WEB",
      label: "Open Acme",
      helperText: "Open Acme",
      urlTemplate: "https://partners.example.test/address-change",
      type: "DEEP_LINK",
      enabled: true,
    });
    const a = await resolveFallbackAction("acme:WEB");
    expect(a?.url).toBe("https://partners.example.test/address-change");
  });

  it("allows root-relative app links for web-based guided actions", async () => {
    dbMock.prisma.connectorFallbackAction.findUnique.mockResolvedValue({
      actionKey: "acme:HELP",
      label: "Open help",
      helperText: "Open help",
      urlTemplate: "/help/address-change",
      type: "DEEP_LINK",
      enabled: true,
    });
    const a = await resolveFallbackAction("acme:HELP");
    expect(a?.url).toBe("/help/address-change");
  });
});

describe("renderFallbackAction", () => {
  it("fills the url (encoded) and helperText (plain)", () => {
    const action: ResolvedFallbackAction = {
      key: "k",
      label: "l",
      url: "https://x/?s={{to.street1}}&c={{to.city}}",
      helperText: "Send to {{to.city}}, {{to.state}}",
      type: "DEEP_LINK",
    };
    const rendered = renderFallbackAction(action, change);
    expect(rendered.url).toContain("2%20New%20St");
    expect(rendered.url).toContain("Boston");
    expect(rendered.helperText).toBe("Send to Boston, MA");
  });
});
