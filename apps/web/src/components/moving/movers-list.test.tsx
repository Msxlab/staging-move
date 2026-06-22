import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  MoversListCard,
  MoversTeaser,
  isMoversGated,
  type MoverRow,
  type MoversResponse,
} from "./movers-list";

// lucide-react ships its own nested React copy, which breaks hooks under the
// test renderer — stub the icons used by the section with plain SVGs.
vi.mock("lucide-react", () => {
  const icon = (name: string) => {
    const Stub = (props: { className?: string }) => <svg data-lucide={name} className={props.className} />;
    Stub.displayName = name;
    return Stub;
  };
  return {
    ChevronDown: icon("chevron-down"),
    ChevronUp: icon("chevron-up"),
    ExternalLink: icon("external-link"),
    Loader2: icon("loader-2"),
    Check: icon("check"),
    Sparkles: icon("sparkles"),
    Truck: icon("truck"),
  };
});

// next/link → plain anchor so the teaser CTA href is assertable without a router.
vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children?: unknown; className?: string }) => (
    <a href={href} className={className}>
      {children as never}
    </a>
  ),
}));

// Resolve translations from the REAL en.json catalog so these tests pin the
// mandated copy (FMCSA disclaimer / not-endorsements framing) — a copy
// regression in the catalog fails here, not just in review. Includes a
// minimal ICU-plural resolver for the fleet/complaint counts.
vi.mock("next-intl", async () => {
  const en = (await import("@/i18n/messages/en.json")).default as unknown as Record<
    string,
    Record<string, string>
  >;
  const resolve = (key: string): string => {
    const raw = en.moving?.[key];
    if (typeof raw !== "string") throw new Error(`Missing moving.${key} in en.json`);
    return raw;
  };
  const format = (raw: string, vars?: Record<string, unknown>): string => {
    const withPlurals = raw.replace(
      /\{(\w+), plural,\s*((?:[^{}]|\{[^{}]*\})*)\}/g,
      (_m, name: string, options: string) => {
        const value = Number(vars?.[name] ?? 0);
        const opts: Record<string, string> = {};
        const re = /(=\d+|\w+)\s*\{([^{}]*)\}/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(options))) opts[m[1]] = m[2];
        const branch = opts[`=${value}`] ?? (value === 1 && opts.one ? opts.one : opts.other) ?? "";
        return branch.replace(/#/g, String(value));
      },
    );
    return withPlurals.replace(/\{(\w+)\}/g, (_m, name: string) => String(vars?.[name] ?? ""));
  };
  const useTranslations = () => {
    const t = (key: string, vars?: Record<string, unknown>) => format(resolve(key), vars);
    return t;
  };
  return { useTranslations };
});

function mover(overrides: Partial<MoverRow> = {}): MoverRow {
  return {
    id: "mc_1",
    usdotNumber: 123456,
    name: "Acme Movers",
    legalName: "Acme Van Lines LLC",
    dbaName: "Acme Movers",
    city: "Austin",
    state: "TX",
    phone: null,
    fleetSize: 12,
    complaintCount2y: 0,
    safetyRating: "Satisfactory",
    dataAsOf: "2026-06-01",
    protectYourMoveUrl: "https://ai.fmcsa.dot.gov/hhg/search.asp",
    ...overrides,
  };
}

function response(overrides: Partial<MoversResponse> = {}): MoversResponse {
  return {
    configured: true,
    entitled: true,
    state: "TX",
    movers: [mover()],
    sponsored: null,
    ...overrides,
  };
}

describe("isMoversGated", () => {
  it("is true only for a configured 200-with-gate payload", () => {
    expect(isMoversGated(response({ entitled: false, upgradeRequired: "MOVER_SUGGESTIONS_UPGRADE_REQUIRED", movers: undefined }))).toBe(true);
    expect(isMoversGated(response())).toBe(false);
    expect(isMoversGated(null)).toBe(false);
    expect(isMoversGated({ configured: false, entitled: false })).toBe(false);
  });
});

describe("MoversListCard", () => {
  it("renders the mandated honest-framing disclaimer with the mover rows", () => {
    const html = renderToStaticMarkup(<MoversListCard data={response()} />);
    expect(html).toContain(
      "FMCSA-registered household-goods carriers — licensing data from the U.S. DOT. Not endorsements. Verify quotes and reviews yourself.",
    );
    expect(html).toContain("Acme Movers");
    expect(html).toContain("USDOT #123456");
    expect(html).toContain("https://ai.fmcsa.dot.gov/hhg/search.asp");
    expect(html).toContain("12 power units");
  });

  it("treats complaintCount2y=0 as 'check the record', never 'zero complaints'", () => {
    const html = renderToStaticMarkup(<MoversListCard data={response()} />);
    expect(html).toContain("Complaint history: check the FMCSA record");
    expect(html).not.toContain("0 FMCSA complaints");
  });

  it("renders complaint context when a count is available", () => {
    const html = renderToStaticMarkup(
      <MoversListCard data={response({ movers: [mover({ complaintCount2y: 3 })] })} />,
    );
    expect(html).toContain("3 FMCSA complaints in the past 2 years");
  });

  it("renders the labeled sponsored card ABOVE organic results", () => {
    const html = renderToStaticMarkup(
      <MoversListCard
        data={response({
          sponsored: {
            placementId: "sp_1",
            label: "Sponsored",
            mover: mover({ id: "mc_sp", name: "Sponsored Van Lines", usdotNumber: 777 }),
          },
        })}
      />,
    );
    expect(html).toContain("Sponsored Van Lines");
    expect(html).toContain(">Sponsored<"); // the FTC disclosure pill text
    expect(html.indexOf("Sponsored Van Lines")).toBeLessThan(html.indexOf("Acme Movers"));
  });

  it("renders the gated teaser (no fabricated rows) with the moving CTA", () => {
    const html = renderToStaticMarkup(
      <MoversListCard
        data={{ configured: true, entitled: false, upgradeRequired: "MOVER_SUGGESTIONS_UPGRADE_REQUIRED" }}
      />,
    );
    expect(html).toContain('href="/moving"');
    expect(html).not.toContain("USDOT #");
  });

  it("shows the empty state when no carriers match", () => {
    const html = renderToStaticMarkup(<MoversListCard data={response({ movers: [] })} />);
    expect(html).toContain("TX");
    expect(html).not.toContain("USDOT #");
  });

  it("falls back to the error copy on a malformed payload", () => {
    const html = renderToStaticMarkup(<MoversListCard data={null} />);
    expect(html.length).toBeGreaterThan(0);
    expect(html).not.toContain("USDOT #");
  });
});

describe("MoversTeaser", () => {
  it("pitches the feature honestly with a check and a moving CTA", () => {
    const html = renderToStaticMarkup(<MoversTeaser />);
    expect(html).toContain('data-lucide="check"');
    expect(html).toContain('href="/moving"');
  });
});

describe("en/es catalog parity for movers keys", () => {
  it("every movers_* key exists in BOTH locales", async () => {
    const en = (await import("@/i18n/messages/en.json")).default as unknown as Record<
      string,
      Record<string, string>
    >;
    const es = (await import("@/i18n/messages/es.json")).default as unknown as Record<
      string,
      Record<string, string>
    >;
    const enKeys = Object.keys(en.moving).filter((k) => k.startsWith("movers_"));
    expect(enKeys.length).toBeGreaterThan(0);
    for (const key of enKeys) {
      expect(typeof es.moving[key], `es.json missing moving.${key}`).toBe("string");
    }
    const esKeys = Object.keys(es.moving).filter((k) => k.startsWith("movers_"));
    expect(esKeys.sort()).toEqual(enKeys.sort());
  });
});
