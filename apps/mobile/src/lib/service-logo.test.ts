import { describe, expect, it } from "vitest";
import {
  resolveMobileServiceLogoAltName,
  resolveMobileServiceLogoUrl,
} from "./service-logo";

describe("mobile service logo helpers", () => {
  it("prefers the linked provider logo over flattened logo fields", () => {
    expect(
      resolveMobileServiceLogoUrl({
        provider: { name: "USPS", logoUrl: " https://assets.example/usps.png " },
        providerLogoUrl: "https://assets.example/provider-logo.png",
        logoUrl: "https://assets.example/service-logo.png",
      }),
    ).toBe("https://assets.example/usps.png");
  });

  it("falls back to flattened service logo fields", () => {
    expect(
      resolveMobileServiceLogoUrl({
        provider: { name: "USPS", logoUrl: " " },
        providerLogoUrl: null,
        logoUrl: "https://assets.example/service-logo.png",
      }),
    ).toBe("https://assets.example/service-logo.png");
  });

  it("resolves a stable accessibility name", () => {
    expect(resolveMobileServiceLogoAltName({ provider: { name: " FedEx " }, providerName: "Postal" })).toBe("FedEx");
    expect(resolveMobileServiceLogoAltName({ providerName: "GEICO" })).toBe("GEICO");
  });
});
