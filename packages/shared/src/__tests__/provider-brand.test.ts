import { describe, it, expect } from "vitest";
import { getProviderBrand, registrableDomain } from "../provider-brand";

describe("registrableDomain", () => {
  it("collapses subdomains to the registrable domain", () => {
    expect(registrableDomain("https://www.chase.com")).toBe("chase.com");
    expect(registrableDomain("https://creditcards.chase.com")).toBe("chase.com");
    expect(registrableDomain("http://secure.bankofamerica.com/login")).toBe("bankofamerica.com");
  });

  it("handles bare hosts and missing protocols", () => {
    expect(registrableDomain("chase.com")).toBe("chase.com");
    expect(registrableDomain("www.geico.com")).toBe("geico.com");
  });

  it("guards a common 2-part public suffix", () => {
    expect(registrableDomain("https://foo.bar.co.uk")).toBe("bar.co.uk");
  });

  it("returns null for empty/invalid input", () => {
    expect(registrableDomain(null)).toBeNull();
    expect(registrableDomain(undefined)).toBeNull();
    expect(registrableDomain("not a url")).toBeNull();
  });
});

describe("getProviderBrand", () => {
  it("clusters Chase the bank and Chase Credit Cards under one brand", () => {
    const bank = getProviderBrand({ name: "Chase", website: "https://www.chase.com" });
    const cards = getProviderBrand({ name: "Chase Credit Cards", website: "https://creditcards.chase.com" });
    // Same grouping key (the audit's "looks like two domains" gap).
    expect(bank.brandKey).toBe("chase.com");
    expect(cards.brandKey).toBe("chase.com");
    expect(bank.brandKey).toBe(cards.brandKey);
    // Clean, shared display label.
    expect(bank.brandLabel).toBe("Chase");
    expect(cards.brandLabel).toBe("Chase");
  });

  it("strips trailing service-type words from the brand label", () => {
    expect(getProviderBrand({ name: "Capital One Credit Cards", website: "https://capitalone.com" }).brandLabel).toBe("Capital One");
    expect(getProviderBrand({ name: "Geico Insurance", website: "https://geico.com" }).brandLabel).toBe("Geico");
    expect(getProviderBrand({ name: "Wells Fargo Bank", website: "https://wellsfargo.com" }).brandLabel).toBe("Wells Fargo");
  });

  it("falls back to a name-derived key when there is no usable website", () => {
    const a = getProviderBrand({ name: "Chase", website: null });
    const b = getProviderBrand({ name: "Chase Credit Cards", website: "" });
    // Both normalize to the same brand-from-name key so they still cluster.
    expect(a.brandKey).toBe("name:chase");
    expect(b.brandKey).toBe("name:chase");
  });

  it("keeps unrelated brands in distinct clusters", () => {
    const chase = getProviderBrand({ name: "Chase", website: "https://www.chase.com" });
    const amex = getProviderBrand({ name: "American Express", website: "https://www.americanexpress.com" });
    expect(chase.brandKey).not.toBe(amex.brandKey);
  });
});
