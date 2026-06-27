import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { scoreForAir } from "@locateflow/shared";
import { DossierScaleCard } from "./dossier-scale-card";

// next-intl mock resolving NESTED dotted keys from the real en.json catalog, so
// these tests pin the actual narration + caveat copy (the home-dossier mock only
// does flat lookups, which can't reach dossier.air.l2 style keys).
vi.mock("next-intl", async () => {
  const en = (await import("@/i18n/messages/en.json")).default as unknown as Record<string, unknown>;
  const resolveNested = (ns: string, key: string): string => {
    let node: unknown = (en as Record<string, unknown>)[ns];
    for (const part of key.split(".")) {
      node = node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined;
    }
    if (typeof node !== "string") throw new Error(`Missing ${ns}.${key} in en.json`);
    return node;
  };
  return { useTranslations: (ns: string) => (key: string) => resolveNested(ns, key) };
});

describe("DossierScaleCard", () => {
  it("renders the band, narration, value, and a 5-segment scale with `level` active", () => {
    const result = scoreForAir({ aqi: 75 }); // Moderate → level 2
    const html = renderToStaticMarkup(<DossierScaleCard result={result} title="Air quality" />);

    expect(html).toContain("Moderate");
    expect(html).toContain("AQI 75");
    expect(html).toContain("Fine for most"); // narration dossier.air.l2 from en.json
    expect(html).toContain('role="img"');

    const segments = html.match(/data-active=/g) ?? [];
    expect(segments).toHaveLength(5);
    const active = html.match(/data-active="true"/g) ?? [];
    expect(active).toHaveLength(2);
  });

  it("renders an honest unavailable state (no faked level)", () => {
    const result = scoreForAir({ aqi: null });
    const html = renderToStaticMarkup(<DossierScaleCard result={result} title="Air quality" />);
    expect(html).toContain("Air reading unavailable here.");
    const active = html.match(/data-active="true"/g) ?? [];
    expect(active).toHaveLength(0);
  });
});
