import { describe, expect, it } from "vitest";
import {
  resolveMobileServiceLogoAltName,
  resolveMobileServiceLogoUrl,
  resolveMobileServiceLogoUrls,
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

  it("derives provider logo fallbacks from the service website when stored logos are missing", () => {
    expect(
      resolveMobileServiceLogoUrls({
        providerName: "Con Edison",
        website: "https://www.coned.com/accounts",
      }),
    ).toEqual([
      "https://logo.clearbit.com/coned.com",
      "https://www.google.com/s2/favicons?domain=coned.com&sz=128",
    ]);
  });

  it("keeps stored provider logos ahead of derived website fallbacks", () => {
    expect(
      resolveMobileServiceLogoUrls({
        provider: {
          name: "UPS",
          logoUrl: "https://assets.locateflow.com/providers/ups.png",
          website: "https://www.ups.com",
        },
      }),
    ).toEqual([
      "https://assets.locateflow.com/providers/ups.png",
      "https://logo.clearbit.com/ups.com",
      "https://www.google.com/s2/favicons?domain=ups.com&sz=128",
    ]);
  });

  it("resolves a stable accessibility name", () => {
    expect(resolveMobileServiceLogoAltName({ provider: { name: " FedEx " }, providerName: "Postal" })).toBe("FedEx");
    expect(resolveMobileServiceLogoAltName({ customProvider: { name: " Local Gym " }, providerName: "Fitness" })).toBe("Local Gym");
    expect(resolveMobileServiceLogoAltName({ providerName: "GEICO" })).toBe("GEICO");
  });
});
