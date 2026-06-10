import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  HomeDossierCard,
  deriveDossierView,
  floodLabelKey,
  formatForecastDate,
  type HomeDossierResponse,
} from "./home-dossier";

// lucide-react ships its own nested React copy, which breaks hooks under the
// test renderer — stub the icons used by the card with plain SVGs.
vi.mock("lucide-react", () => {
  const icon = (name: string) => {
    const Stub = (props: { className?: string }) => <svg data-lucide={name} className={props.className} />;
    Stub.displayName = name;
    return Stub;
  };
  return {
    CloudSun: icon("cloud-sun"),
    Compass: icon("compass"),
    GraduationCap: icon("graduation-cap"),
    MapPin: icon("map-pin"),
    Waves: icon("waves"),
  };
});

// Resolve translations from the REAL en.json catalog so these tests pin the
// mandated copy (FEMA disclaimer, NCES fine print, no-location hint) — a copy
// regression in the catalog fails here, not just in review.
vi.mock("next-intl", async () => {
  const en = (await import("@/i18n/messages/en.json")).default as unknown as Record<
    string,
    Record<string, string>
  >;
  const resolve = (key: string): string => {
    const raw = en.dashboard?.[key];
    if (typeof raw !== "string") throw new Error(`Missing dashboard.${key} in en.json`);
    return raw;
  };
  const useTranslations = () => {
    const t = (key: string, vars?: Record<string, unknown>) =>
      resolve(key).replace(/\{(\w+)\}/g, (_m, name: string) => String(vars?.[name] ?? ""));
    t.rich = (key: string, vars?: Record<string, (chunks: unknown) => unknown>) => {
      const raw = resolve(key);
      const m = /^(.*)<em>(.*)<\/em>(.*)$/.exec(raw);
      if (!m || typeof vars?.em !== "function") return raw;
      return [m[1], vars.em(m[2]), m[3]];
    };
    return t;
  };
  return { useTranslations, useLocale: () => "en-US" };
});

function dossier(overrides: {
  configured?: boolean;
  flood?: Partial<HomeDossierResponse["flood"]>;
  school?: Partial<HomeDossierResponse["school"]>;
  weather?: Partial<HomeDossierResponse["weather"]>;
} = {}): HomeDossierResponse {
  return {
    configured: overrides.configured ?? true,
    address: { id: "addr-1", city: "Austin", state: "TX" },
    flood: { status: "ok", zone: "X", isHighRisk: false, ...overrides.flood },
    school: { status: "ok", districtName: "Austin ISD", ncesId: "4808940", ...overrides.school },
    weather: {
      status: "ok",
      forecastDate: "2026-06-12",
      summary: "Sunny",
      tempHighF: 84,
      tempLowF: 62,
      precipChancePct: 10,
      ...overrides.weather,
    },
  };
}

describe("deriveDossierView", () => {
  it("hides the whole card when every section is no_location", () => {
    const view = deriveDossierView(
      dossier({
        flood: { status: "no_location", zone: null, isHighRisk: null },
        school: { status: "no_location", districtName: null, ncesId: null },
        weather: { status: "no_location", forecastDate: null, summary: null, tempHighF: null, tempLowF: null, precipChancePct: null },
      }),
    );
    expect(view.visible).toBe(false);
  });

  it("hides the whole card when every section errored", () => {
    const view = deriveDossierView(
      dossier({
        flood: { status: "error", zone: null, isHighRisk: null },
        school: { status: "error", districtName: null, ncesId: null },
        weather: { status: "error", forecastDate: null, summary: null, tempHighF: null, tempLowF: null, precipChancePct: null },
      }),
    );
    expect(view.visible).toBe(false);
  });

  it("hides an empty shell: flood/school error + weather too_far renders nothing", () => {
    const view = deriveDossierView(
      dossier({
        flood: { status: "error", zone: null, isHighRisk: null },
        school: { status: "error", districtName: null, ncesId: null },
        weather: { status: "too_far", forecastDate: null, summary: null, tempHighF: null, tempLowF: null, precipChancePct: null },
      }),
    );
    expect(view.visible).toBe(false);
  });

  it("shows all three rows for a fully ok dossier (no hint)", () => {
    const view = deriveDossierView(dossier());
    expect(view.visible).toBe(true);
    expect(view.flood).toEqual({ zone: "X", isHighRisk: false });
    expect(view.school).toEqual({ districtName: "Austin ISD" });
    expect(view.weather?.summary).toBe("Sunny");
    expect(view.showLocationHint).toBe(false);
  });

  it("primary address without coordinates: no_location sections + too_far weather → hint row only", () => {
    const view = deriveDossierView(
      dossier({
        flood: { status: "no_location", zone: null, isHighRisk: null },
        school: { status: "no_location", districtName: null, ncesId: null },
        weather: { status: "too_far", forecastDate: null, summary: null, tempHighF: null, tempLowF: null, precipChancePct: null },
      }),
    );
    expect(view.visible).toBe(true);
    expect(view.flood).toBeNull();
    expect(view.school).toBeNull();
    expect(view.weather).toBeNull();
    expect(view.showLocationHint).toBe(true);
  });

  it("hides the weather row on too_far but keeps the ok rows", () => {
    const view = deriveDossierView(
      dossier({
        weather: { status: "too_far", forecastDate: null, summary: null, tempHighF: null, tempLowF: null, precipChancePct: null },
      }),
    );
    expect(view.visible).toBe(true);
    expect(view.weather).toBeNull();
    expect(view.flood).not.toBeNull();
    expect(view.school).not.toBeNull();
    expect(view.showLocationHint).toBe(false);
  });

  it("skips an ok section that is missing its headline datum", () => {
    const view = deriveDossierView(
      dossier({
        flood: { zone: null },
        school: { districtName: "  " },
      }),
    );
    expect(view.flood).toBeNull();
    expect(view.school).toBeNull();
    expect(view.weather).not.toBeNull();
    expect(view.visible).toBe(true);
  });

  it("degrades to hidden on null / unconfigured / malformed payloads", () => {
    expect(deriveDossierView(null).visible).toBe(false);
    expect(deriveDossierView(undefined).visible).toBe(false);
    expect(deriveDossierView(dossier({ configured: false })).visible).toBe(false);
    expect(deriveDossierView({ configured: true } as HomeDossierResponse).visible).toBe(false);
  });
});

describe("floodLabelKey", () => {
  it("maps isHighRisk to the plain-English label key", () => {
    expect(floodLabelKey(true)).toBe("dossier_flood_high");
    expect(floodLabelKey(false)).toBe("dossier_flood_low");
    expect(floodLabelKey(null)).toBe("dossier_flood_unknown");
  });
});

describe("formatForecastDate", () => {
  it("parses YYYY-MM-DD as a local date (no UTC off-by-one)", () => {
    const out = formatForecastDate("2026-06-12", "en-US");
    expect(out).toContain("Jun");
    expect(out).toContain("12");
  });

  it("returns empty string for null/invalid input", () => {
    expect(formatForecastDate(null, "en-US")).toBe("");
    expect(formatForecastDate(undefined, "en-US")).toBe("");
    expect(formatForecastDate("not-a-date", "en-US")).toBe("");
  });
});

describe("HomeDossierCard rendering", () => {
  it("renders all three rows with the mandated disclaimers and FEMA link", () => {
    const markup = renderToStaticMarkup(
      <HomeDossierCard data={dossier({ flood: { zone: "AE", isHighRisk: true } })} />,
    );

    // Flood: zone + plain-English high-risk label + honey warn pill
    expect(markup).toContain("Zone AE — high-risk flood area");
    expect(markup).toContain("High risk");
    expect(markup).toContain("bg-tone-honey-bg");
    // MANDATORY fine print + official FEMA link
    expect(markup).toContain("Informational, from FEMA flood maps — not an insurance determination.");
    expect(markup).toContain('href="https://msc.fema.gov"');

    // School district + NCES fine print
    expect(markup).toContain("Served by Austin ISD");
    expect(markup).toContain("District boundaries (NCES) — school assignment may differ.");

    // Weather: summary + figures + moving-day date label
    expect(markup).toContain("Sunny");
    expect(markup).toContain("High 84°F");
    expect(markup).toContain("Low 62°F");
    expect(markup).toContain("10% precip");
    expect(markup).toContain("Moving day:");

    // City/state eyebrow
    expect(markup).toContain("Austin, TX");
  });

  it("renders the minimal-risk label without the warn pill", () => {
    const markup = renderToStaticMarkup(<HomeDossierCard data={dossier()} />);
    expect(markup).toContain("Zone X — minimal flood risk");
    expect(markup).not.toContain("bg-tone-honey-bg");
  });

  it("renders the honest no-location hint instead of fabricated rows", () => {
    const markup = renderToStaticMarkup(
      <HomeDossierCard
        data={dossier({
          flood: { status: "no_location", zone: null, isHighRisk: null },
          school: { status: "no_location", districtName: null, ncesId: null },
          weather: { status: "too_far", forecastDate: null, summary: null, tempHighF: null, tempLowF: null, precipChancePct: null },
        })}
      />,
    );
    expect(markup).toContain("Add a precise address to unlock local insights");
    expect(markup).not.toContain("Served by");
    expect(markup).not.toContain("FEMA");
  });

  it("renders nothing when every section degrades", () => {
    const markup = renderToStaticMarkup(
      <HomeDossierCard
        data={dossier({
          flood: { status: "error", zone: null, isHighRisk: null },
          school: { status: "error", districtName: null, ncesId: null },
          weather: { status: "error", forecastDate: null, summary: null, tempHighF: null, tempLowF: null, precipChancePct: null },
        })}
      />,
    );
    expect(markup).toBe("");
  });

  it("omits the weather row when the move is too far out", () => {
    const markup = renderToStaticMarkup(
      <HomeDossierCard
        data={dossier({
          weather: { status: "too_far", forecastDate: null, summary: null, tempHighF: null, tempLowF: null, precipChancePct: null },
        })}
      />,
    );
    expect(markup).not.toContain("Moving day:");
    expect(markup).toContain("Zone X — minimal flood risk");
  });
});

describe("dashboard wiring regression", () => {
  function readWebSource(relativePath: string) {
    const cwd = process.cwd();
    const webRoot = cwd.endsWith(`${path.sep}apps${path.sep}web`) ? cwd : path.join(cwd, "apps", "web");
    return readFileSync(path.join(webRoot, relativePath), "utf8");
  }

  it("registers the homeDossier widget in the dashboard registry", () => {
    const source = readWebSource("src/app/(app)/dashboard/dashboard-client.tsx");
    expect(source).toContain('{ key: "homeDossier", default: true }');
    expect(source).toContain('homeDossier: td("widget_homeDossier")');
    expect(source).toContain('case "homeDossier":');
    expect(source).toContain('"homeDossier", "recent"');
  });

  it("uses the plan-accent primary classes on the header Plan-a-Move CTA (not the always-cool orange tone)", () => {
    const source = readWebSource("src/app/(app)/dashboard/dashboard-client.tsx");
    expect(source).toContain("rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90");
    expect(source).not.toContain("rounded-xl bg-tone-orange-fg text-white text-sm font-medium");
  });

  it("keeps en/es dossier catalog keys in parity", () => {
    const en = JSON.parse(readWebSource("src/i18n/messages/en.json"));
    const es = JSON.parse(readWebSource("src/i18n/messages/es.json"));
    const dossierKeys = (cat: Record<string, Record<string, string>>) =>
      Object.keys(cat.dashboard).filter((k) => k.startsWith("dossier_") || k === "widget_homeDossier");
    expect(dossierKeys(en).sort()).toEqual(dossierKeys(es).sort());
    expect(dossierKeys(en).length).toBeGreaterThan(0);
  });
});
