// Curated CITY/METRO landing-page set for /moving/[state]/[city].
//
// HAND-MAINTAINED (unlike data.ts, which is generated from the seed). These
// are the higher-intent SEO surfaces: one page per major metro for the
// LARGEST states only. Each metro is a REAL city — no fabricated places.
//
// Critically, we invent NO city-specific legal data. A city page inherits the
// state's verbatim seed rules + provider list (from data.ts) and presents them
// honestly as "statewide rules apply in {City}". The only city-level copy is
// neutral relocation framing (neighborhood/commute/cost-of-living prompts that
// are true of any large metro) plus the inherited statewide facts.
//
// Kept Prisma-free, like data.ts, so the static route never pulls the DB
// client into its build graph.

import { STATE_GUIDE_BY_SLUG, type StateGuide } from "./data";

export interface MetroSeed {
  /** URL slug, e.g. "los-angeles". Unique within its state. */
  slug: string;
  /** Full display name, e.g. "Los Angeles". */
  name: string;
  /** One-line, evergreen orientation blurb — true of the metro, no invented
   *  rules/stats. Used in the intro and meta description. */
  blurb: string;
}

/**
 * State-slug -> ordered list of real metros. Only the largest states get city
 * pages; smaller states stay state-level only. Add a state here (with real
 * cities) to extend coverage.
 */
const METROS_BY_STATE: Record<string, MetroSeed[]> = {
  california: [
    {
      slug: "los-angeles",
      name: "Los Angeles",
      blurb:
        "Southern California's largest metro — sprawling, car-dependent, and split across dozens of distinct neighborhoods from the coast to the valleys.",
    },
    {
      slug: "san-francisco",
      name: "San Francisco",
      blurb:
        "A dense, transit-friendly Bay Area hub where housing is competitive and many newcomers arrive for tech and biotech roles.",
    },
    {
      slug: "san-diego",
      name: "San Diego",
      blurb:
        "A coastal Southern California city known for its mild climate, large military presence, and a more relaxed pace than LA.",
    },
    {
      slug: "sacramento",
      name: "Sacramento",
      blurb:
        "California's capital in the Central Valley — more affordable than the coastal metros and a common landing spot for in-state moves.",
    },
    {
      slug: "san-jose",
      name: "San Jose",
      blurb:
        "The largest city in the South Bay and the heart of Silicon Valley, with high housing costs and a heavily commuter-driven layout.",
    },
  ],
  texas: [
    {
      slug: "houston",
      name: "Houston",
      blurb:
        "Texas's largest city — a sprawling, no-zoning metro with a major energy and medical economy and a wide range of housing costs.",
    },
    {
      slug: "san-antonio",
      name: "San Antonio",
      blurb:
        "A large South Texas city with a lower cost of living, a deep cultural history, and a significant military footprint.",
    },
    {
      slug: "dallas",
      name: "Dallas",
      blurb:
        "The anchor of the larger Dallas-Fort Worth metroplex, with a fast-growing job market and extensive suburban sprawl.",
    },
    {
      slug: "austin",
      name: "Austin",
      blurb:
        "The Texas capital and a major tech hub — fast-growing, with rising housing costs and a famously dense central core.",
    },
    {
      slug: "fort-worth",
      name: "Fort Worth",
      blurb:
        "The western half of the DFW metroplex, generally more affordable than Dallas with a strong historic-district character.",
    },
  ],
  florida: [
    {
      slug: "jacksonville",
      name: "Jacksonville",
      blurb:
        "Florida's largest city by land area, in the state's northeast, with a lower cost of living than the South Florida metros.",
    },
    {
      slug: "miami",
      name: "Miami",
      blurb:
        "A dense, international South Florida metro with high housing costs, no state income tax, and significant hurricane-season planning.",
    },
    {
      slug: "tampa",
      name: "Tampa",
      blurb:
        "A growing Gulf Coast metro that draws many relocations for its job market, beaches, and relative affordability versus Miami.",
    },
    {
      slug: "orlando",
      name: "Orlando",
      blurb:
        "A Central Florida hub anchored by tourism and a fast-expanding suburban housing market.",
    },
  ],
  "new-york": [
    {
      slug: "new-york-city",
      name: "New York City",
      blurb:
        "The densest, most transit-dependent metro in the US, spread across five boroughs with some of the highest housing costs in the country.",
    },
    {
      slug: "buffalo",
      name: "Buffalo",
      blurb:
        "An affordable Western New York city with a much lower cost of living than downstate and a notable lake-effect winter.",
    },
    {
      slug: "rochester",
      name: "Rochester",
      blurb:
        "A mid-sized Finger Lakes-region city with affordable housing and a strong higher-education and healthcare base.",
    },
    {
      slug: "albany",
      name: "Albany",
      blurb:
        "New York's capital in the upstate Capital Region — a government and education hub far more affordable than NYC.",
    },
  ],
  illinois: [
    {
      slug: "chicago",
      name: "Chicago",
      blurb:
        "The Midwest's largest city — a dense, transit-served metro with distinct neighborhoods and a wide span of housing costs.",
    },
    {
      slug: "aurora",
      name: "Aurora",
      blurb:
        "A large city in the western Chicago suburbs, popular with families for its more affordable housing and commuter-rail access.",
    },
    {
      slug: "naperville",
      name: "Naperville",
      blurb:
        "A western suburb of Chicago consistently rated for its schools and amenities, with higher housing costs than the city average.",
    },
    {
      slug: "rockford",
      name: "Rockford",
      blurb:
        "Northern Illinois's largest city outside the Chicago area, with notably low housing costs.",
    },
  ],
  pennsylvania: [
    {
      slug: "philadelphia",
      name: "Philadelphia",
      blurb:
        "Pennsylvania's largest city — a dense, walkable East Coast metro with a local wage tax and a wide range of neighborhood costs.",
    },
    {
      slug: "pittsburgh",
      name: "Pittsburgh",
      blurb:
        "A Western Pennsylvania city known for affordable housing, a hilly river-valley layout, and a strong healthcare and education economy.",
    },
    {
      slug: "allentown",
      name: "Allentown",
      blurb:
        "The largest city in the Lehigh Valley, within commuting reach of both Philadelphia and the New York metro.",
    },
  ],
  ohio: [
    {
      slug: "columbus",
      name: "Columbus",
      blurb:
        "Ohio's capital and largest city — a fast-growing metro with a large university presence and relatively affordable housing.",
    },
    {
      slug: "cleveland",
      name: "Cleveland",
      blurb:
        "A Lake Erie city with very low housing costs, a strong healthcare sector, and distinct established neighborhoods.",
    },
    {
      slug: "cincinnati",
      name: "Cincinnati",
      blurb:
        "A southwestern Ohio metro on the Ohio River, affordable relative to the national average with a revitalized urban core.",
    },
  ],
  georgia: [
    {
      slug: "atlanta",
      name: "Atlanta",
      blurb:
        "The economic hub of the Southeast — a sprawling, car-oriented metro with a fast-growing job market and emissions testing in the metro counties.",
    },
    {
      slug: "savannah",
      name: "Savannah",
      blurb:
        "A historic coastal Georgia city with a walkable historic district and a lower cost of living than Atlanta.",
    },
    {
      slug: "augusta",
      name: "Augusta",
      blurb:
        "Georgia's second-largest city, on the South Carolina border, with affordable housing and a major medical and military presence.",
    },
  ],
  "north-carolina": [
    {
      slug: "charlotte",
      name: "Charlotte",
      blurb:
        "North Carolina's largest city and a major banking center — fast-growing, with extensive suburbs and a rising housing market.",
    },
    {
      slug: "raleigh",
      name: "Raleigh",
      blurb:
        "The state capital and a corner of the Research Triangle, drawing many relocations for tech, research, and university jobs.",
    },
    {
      slug: "greensboro",
      name: "Greensboro",
      blurb:
        "A Piedmont Triad city with a lower cost of living and a central location within the state.",
    },
  ],
  michigan: [
    {
      slug: "detroit",
      name: "Detroit",
      blurb:
        "Michigan's largest city — the historic center of the US auto industry, with very low housing costs and ongoing neighborhood revitalization.",
    },
    {
      slug: "grand-rapids",
      name: "Grand Rapids",
      blurb:
        "A growing West Michigan city known for affordability, a strong job market, and a walkable downtown.",
    },
    {
      slug: "ann-arbor",
      name: "Ann Arbor",
      blurb:
        "A university city west of Detroit with higher housing costs and a research- and education-driven economy.",
    },
  ],
};

export interface MetroGuide extends MetroSeed {
  /** The parent state's full guide — rules + providers inherited verbatim. */
  state: StateGuide;
}

/** All [state, city] slug pairs, for generateStaticParams + sitemap. */
export const METRO_SLUG_PAIRS: Array<{ state: string; city: string }> =
  Object.entries(METROS_BY_STATE).flatMap(([state, metros]) =>
    metros.map((m) => ({ state, city: m.slug })),
  );

/** Total number of city pages — used in docs/reporting. */
export const METRO_PAGE_COUNT = METRO_SLUG_PAIRS.length;

/** Sibling metros within the same state (for the internal-link rail). */
export function siblingMetros(stateSlug: string, citySlug: string): MetroSeed[] {
  const metros = METROS_BY_STATE[stateSlug] ?? [];
  return metros.filter((m) => m.slug !== citySlug);
}

/** All metros for a state (e.g. to cross-link from the state page later). */
export function metrosForState(stateSlug: string): MetroSeed[] {
  return METROS_BY_STATE[stateSlug] ?? [];
}

/**
 * Resolve a [state, city] slug pair to a full guide, or null if either the
 * state is unknown or the city isn't a curated metro of that state. The route
 * calls notFound() on null.
 */
export function getMetroGuide(stateSlug: string, citySlug: string): MetroGuide | null {
  const state = STATE_GUIDE_BY_SLUG[stateSlug];
  if (!state) return null;
  const metro = (METROS_BY_STATE[stateSlug] ?? []).find((m) => m.slug === citySlug);
  if (!metro) return null;
  return { ...metro, state };
}
