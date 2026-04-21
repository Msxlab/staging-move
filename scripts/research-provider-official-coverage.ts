import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// tsx evaluates this script with CJS output in this repo, so use require-based
// loading for local TS modules to keep the research script portable.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const providersModule = require("../packages/db/prisma/seed-data/provider-seed");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const integrityModule = require("../packages/shared/src/provider-integrity");

const { FEDERAL_NEW, STATE_PROVIDERS } = providersModule as {
  FEDERAL_NEW: ProviderRecord[];
  STATE_PROVIDERS: ProviderRecord[];
};

const {
  sanitizeProviderSeedRecords,
  normalizeProviderRecord,
  normalizeProviderUrlDomain,
} = integrityModule as {
  sanitizeProviderSeedRecords: <T extends ProviderRecord>(records: T[]) => { providers: T[] };
  normalizeProviderRecord: <T extends ProviderRecord>(record: T) => T & NormalizedProvider;
  normalizeProviderUrlDomain: (value?: string | null) => string | null;
};

type ProviderRecord = {
  name: string;
  slug?: string;
  category: string;
  website?: string;
  scope?: string;
  states?: string[];
  zipCodes?: string[];
  description?: string;
};

type NormalizedProvider = {
  slug: string;
  scope: string;
  states: string[];
  zipCodes: string[];
  description?: string;
  website?: string;
};

type ResearchStatus = "resolved" | "partial" | "blocked";
type OfficialSourceType =
  | "address_checker"
  | "territory_list"
  | "system_map"
  | "coverage_map"
  | "interoperability_map"
  | "overview"
  | "unknown";
type ZipRemediationPath =
  | "seed_exact_or_prefix_after_lookup"
  | "requires_live_address_check"
  | "needs_polygon_or_corridor_model"
  | "state_only_ok"
  | "manual_research_required";

type CandidateSource = {
  url: string;
  title: string | null;
  snippet: string | null;
  sourceType: OfficialSourceType;
  score: number;
  discovery: "manual" | "sitemap" | "homepage" | "guessed-path";
};

type ProviderResearchEntry = {
  name: string;
  slug: string;
  category: string;
  scope: string;
  states: string[];
  website: string | null;
  domain: string | null;
  repoCoverage: {
    zipRules: number;
    modeledAsStateOnly: boolean;
  };
  officialResearch: {
    status: ResearchStatus;
    sourceType: OfficialSourceType;
    zipRemediationPath: ZipRemediationPath;
    bestUrl: string | null;
    title: string | null;
    snippet: string | null;
    sourceConfidence: "high" | "medium" | "low";
    discoveries: CandidateSource[];
    error?: string | null;
  };
};

const LOCATION_SENSITIVE_CATEGORIES = new Set([
  "UTILITY_ELECTRIC",
  "UTILITY_GAS",
  "UTILITY_WATER",
  "UTILITY_INTERNET",
  "TRANSPORTATION_TRANSIT",
  "TRANSPORTATION_TOLL",
]);

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  default: [
    "service area",
    "service territory",
    "coverage",
    "availability",
    "where we serve",
    "map",
    "service map",
    "system map",
    "cities",
    "counties",
    "communities",
  ],
  UTILITY_ELECTRIC: [
    "electric service territory",
    "service territory",
    "where we serve",
    "service area",
    "coverage map",
    "county",
    "cities",
  ],
  UTILITY_GAS: [
    "gas service territory",
    "service territory",
    "where we serve",
    "service area",
    "coverage map",
    "county",
    "cities",
  ],
  UTILITY_WATER: [
    "water service area",
    "service area",
    "service territory",
    "service map",
    "utilities map",
    "city limits",
    "watershed",
  ],
  UTILITY_INTERNET: [
    "check availability",
    "availability",
    "service area",
    "fiber availability",
    "enter your address",
    "find service",
    "where available",
  ],
  TRANSPORTATION_TRANSIT: [
    "system map",
    "service map",
    "route map",
    "stations",
    "lines",
    "routes",
    "trip planner",
  ],
  TRANSPORTATION_TOLL: [
    "where to use",
    "toll roads",
    "managed lanes",
    "bridge",
    "interoperability",
    "map",
    "roads",
  ],
};

const URL_HINTS = [
  "service-area",
  "service-territory",
  "coverage",
  "availability",
  "where-we-serve",
  "service-map",
  "system-map",
  "map",
  "maps",
  "routes",
  "stations",
  "territory",
  "area",
  "where-to-use",
];

const NEGATIVE_URL_HINTS = [
  "news",
  "press",
  "article",
  "blog",
  "outage",
  "outages",
  "sitemap",
  ".xml",
  ".pdf",
  "careers",
  "privacy",
  "terms",
  "faq",
  "alert",
];

const MANUAL_SOURCE_URLS: Record<string, string[]> = {
  "austintexas.gov": ["https://www.austintexas.gov/water"],
  "bart.gov": ["https://www.bart.gov/system-map"],
  "coned.com": ["https://www.coned.com/en/business-partners/service-territories"],
  "njtransit.com": ["https://www.njtransit.com/accessibility/System-Map"],
  "pge.com": ["https://www.pge.com/en/featured/pge-service-area.html"],
  "sunpass.com": ["https://www.sunpass.com/en/about/aboutsunpass.shtml"],
};

function getProviders() {
  const sanitized = sanitizeProviderSeedRecords([
    ...FEDERAL_NEW,
    ...STATE_PROVIDERS,
  ]).providers;

  return sanitized
    .map((provider) => normalizeProviderRecord(provider))
    .filter((provider) => LOCATION_SENSITIVE_CATEGORIES.has(provider.category));
}

function getKeywords(category: string) {
  return [...CATEGORY_KEYWORDS.default, ...(CATEGORY_KEYWORDS[category] || [])];
}

function normalizeUrl(url: string) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url;
  }
}

function sameDomain(candidateUrl: string, domain: string) {
  const candidateDomain = normalizeProviderUrlDomain(candidateUrl);
  return candidateDomain === domain;
}

function stripHtml(input: string) {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function clip(value: string | null | undefined, max = 280) {
  if (!value) return null;
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function extractKeywordSnippet(text: string, keywords: string[]) {
  const lower = text.toLowerCase();
  let start = 0;

  for (const keyword of keywords) {
    const index = lower.indexOf(keyword.toLowerCase());
    if (index >= 0) {
      start = Math.max(0, index - 100);
      break;
    }
  }

  return clip(text.slice(start, start + 320), 320);
}

function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? stripHtml(match[1]) : null;
}

function scoreText(text: string, keywords: string[]) {
  const haystack = text.toLowerCase();
  let score = 0;
  const matched: string[] = [];
  for (const keyword of keywords) {
    if (!haystack.includes(keyword.toLowerCase())) continue;
    score += keyword.includes(" ") ? 6 : 3;
    matched.push(keyword);
  }
  return { score, matched };
}

function scoreCandidateUrl(candidateUrl: string, anchorText: string, category: string) {
  const keywords = getKeywords(category);
  const urlText = `${candidateUrl} ${anchorText}`;
  const { score, matched } = scoreText(urlText, keywords);

  let total = score;
  for (const hint of URL_HINTS) {
    if (candidateUrl.toLowerCase().includes(hint)) total += 3;
  }
  for (const hint of NEGATIVE_URL_HINTS) {
    if (candidateUrl.toLowerCase().includes(hint)) total -= 10;
  }
  if (candidateUrl.toLowerCase().includes("404")) total -= 20;

  return { score: total, matched };
}

async function fetchText(url: string, timeoutMs = 9000) {
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "LocateflowCoverageResearchBot/1.0 (+https://locateflow.local)",
        accept: "text/html,application/xhtml+xml,application/xml,text/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      return {
        ok: false as const,
        url,
        finalUrl: response.url,
        status: response.status,
        text: "",
        contentType: response.headers.get("content-type"),
      };
    }

    const text = (await response.text()).slice(0, 300_000);
    return {
      ok: true as const,
      url,
      finalUrl: response.url,
      status: response.status,
      text,
      contentType: response.headers.get("content-type"),
    };
  } catch (error) {
    return {
      ok: false as const,
      url,
      finalUrl: url,
      status: 0,
      text: "",
      contentType: null as string | null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function extractSitemapsFromRobots(text: string) {
  return [...text.matchAll(/^sitemap:\s*(.+)$/gim)]
    .map((match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value));
}

function extractLocs(xml: string) {
  return [...xml.matchAll(/<loc>\s*([\s\S]*?)\s*<\/loc>/gi)]
    .map((match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value));
}

function extractAnchors(html: string, baseUrl: string, domain: string, category: string) {
  const anchors = [...html.matchAll(/<a\b[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)];
  const deduped = new Map<string, { url: string; anchorText: string; score: number }>();

  for (const match of anchors) {
    const href = match[2]?.trim();
    if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("#")) continue;

    try {
      const absolute = normalizeUrl(new URL(href, baseUrl).toString());
      if (!sameDomain(absolute, domain)) continue;
      const anchorText = stripHtml(match[3] || "");
      const scored = scoreCandidateUrl(absolute, anchorText, category);
      if (scored.score <= 0) continue;
      const existing = deduped.get(absolute);
      if (!existing || scored.score > existing.score) {
        deduped.set(absolute, { url: absolute, anchorText, score: scored.score });
      }
    } catch {
      continue;
    }
  }

  return [...deduped.values()]
    .sort((a, b) => b.score - a.score || a.url.localeCompare(b.url))
    .slice(0, 15)
    .map((entry) => entry.url);
}

async function discoverSitemapCandidates(origin: string, domain: string, category: string) {
  const robots = await fetchText(`${origin}/robots.txt`, 6000);
  const sitemapUrls = new Set<string>();

  if (robots.ok) {
    for (const sitemapUrl of extractSitemapsFromRobots(robots.text)) {
      sitemapUrls.add(sitemapUrl);
    }
  }
  if (sitemapUrls.size === 0) {
    sitemapUrls.add(`${origin}/sitemap.xml`);
  }

  const candidateScores = new Map<string, number>();

  for (const sitemapUrl of [...sitemapUrls].slice(0, 3)) {
    const sitemap = await fetchText(sitemapUrl, 8000);
    if (!sitemap.ok || !sitemap.contentType?.includes("xml")) continue;

    let locs = extractLocs(sitemap.text);
    const nestedSitemaps = locs.filter((loc) => loc.endsWith(".xml")).slice(0, 3);

    if (nestedSitemaps.length > 0) {
      locs = [];
      for (const nested of nestedSitemaps) {
        const nestedResponse = await fetchText(nested, 8000);
        if (!nestedResponse.ok || !nestedResponse.contentType?.includes("xml")) continue;
        locs.push(...extractLocs(nestedResponse.text));
      }
    }

    for (const loc of locs.slice(0, 600)) {
      if (!sameDomain(loc, domain)) continue;
      const scored = scoreCandidateUrl(loc, "", category);
      if (scored.score <= 0) continue;
      const existing = candidateScores.get(loc) || 0;
      candidateScores.set(loc, Math.max(existing, scored.score));
    }
  }

  return [...candidateScores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 15)
    .map(([url]) => url);
}

async function discoverGuessedPaths(homepage: string, domain: string, category: string) {
  const origin = new URL(homepage).origin;
  const guesses = new Set<string>();

  const commonPaths = [
    "/service-area",
    "/service-territory",
    "/coverage",
    "/coverage-map",
    "/where-we-serve",
    "/service-map",
    "/system-map",
    "/maps",
    "/map",
    "/routes",
    "/check-availability",
    "/availability",
  ];

  for (const path of commonPaths) {
    const absolute = `${origin}${path}`;
    const scored = scoreCandidateUrl(absolute, "", category);
    if (scored.score > 0 && sameDomain(absolute, domain)) guesses.add(absolute);
  }

  return [...guesses];
}

function detectSourceType(input: { url: string; title: string | null; snippet: string | null }, category: string): OfficialSourceType {
  const haystack = `${input.url} ${input.title || ""} ${input.snippet || ""}`.toLowerCase();

  if (haystack.includes("check availability") || haystack.includes("enter your address") || haystack.includes("availability checker")) {
    return "address_checker";
  }
  if (category === "TRANSPORTATION_TRANSIT" && (haystack.includes("system map") || haystack.includes("route map") || haystack.includes("stations"))) {
    return "system_map";
  }
  if (category === "TRANSPORTATION_TOLL" && (haystack.includes("where to use") || haystack.includes("interoperability") || haystack.includes("managed lanes"))) {
    return "interoperability_map";
  }
  if (haystack.includes("service territory") || haystack.includes("service area") || haystack.includes("where we serve") || haystack.includes("counties") || haystack.includes("communities")) {
    return "territory_list";
  }
  if (haystack.includes("coverage map") || haystack.includes("service map") || haystack.includes("map")) {
    return "coverage_map";
  }
  if (haystack.includes("about") || haystack.includes("overview")) {
    return "overview";
  }
  return "unknown";
}

function detectZipRemediationPath(
  provider: ReturnType<typeof normalizeProviderRecord<ProviderRecord>>,
  sourceType: OfficialSourceType,
  snippet: string | null
): ZipRemediationPath {
  const haystack = `${provider.name} ${provider.description || ""} ${snippet || ""}`.toLowerCase();

  if (provider.scope === "FEDERAL" && provider.category === "UTILITY_INTERNET") {
    return "requires_live_address_check";
  }

  if (sourceType === "address_checker") {
    return "requires_live_address_check";
  }

  if (provider.category === "TRANSPORTATION_TRANSIT" || provider.category === "TRANSPORTATION_TOLL") {
    return sourceType === "territory_list"
      ? "seed_exact_or_prefix_after_lookup"
      : "needs_polygon_or_corridor_model";
  }

  if (provider.category === "UTILITY_WATER") {
    return sourceType === "territory_list" || haystack.includes("square miles")
      ? "seed_exact_or_prefix_after_lookup"
      : "manual_research_required";
  }

  if (provider.category === "UTILITY_ELECTRIC" || provider.category === "UTILITY_GAS") {
    return sourceType === "territory_list" || sourceType === "coverage_map"
      ? "seed_exact_or_prefix_after_lookup"
      : "manual_research_required";
  }

  if (provider.category === "UTILITY_INTERNET") {
    return sourceType === "territory_list"
      ? "seed_exact_or_prefix_after_lookup"
      : "requires_live_address_check";
  }

  return "manual_research_required";
}

async function buildCandidateSource(
  provider: ReturnType<typeof normalizeProviderRecord<ProviderRecord>>,
  url: string,
  discovery: CandidateSource["discovery"]
) {
  const response = await fetchText(url, 9000);
  if (!response.ok) return null;

  const text = stripHtml(response.text);
  const keywords = getKeywords(provider.category);
  const snippetWindow = extractKeywordSnippet(text, keywords);
  const title = extractTitle(response.text);
  const scored = scoreText(`${response.finalUrl} ${title || ""} ${text}`, keywords);
  const sourceType = detectSourceType(
    {
      url: response.finalUrl,
      title,
      snippet: snippetWindow,
    },
    provider.category
  );

  let totalScore = scored.score;
  if (sourceType !== "unknown") totalScore += 8;
  if (provider.scope === "STATE" && provider.zipCodes.length === 0) totalScore += 2;
  const lowerUrl = response.finalUrl.toLowerCase();
  const lowerTitle = (title || "").toLowerCase();
  const lowerSnippet = (snippetWindow || "").toLowerCase();
  for (const hint of NEGATIVE_URL_HINTS) {
    if (lowerUrl.includes(hint)) totalScore -= 12;
  }
  if (lowerTitle.includes("404") || lowerSnippet.includes("page not found")) {
    totalScore -= 20;
  }
  if ((lowerUrl.includes("sitemap") || response.contentType?.includes("xml")) && sourceType === "unknown") {
    return null;
  }
  if (provider.category.startsWith("UTILITY_") && (lowerUrl.includes("outage") || lowerSnippet.includes("outage map"))) {
    totalScore -= 14;
  }
  if (provider.category === "TRANSPORTATION_TRANSIT" && lowerUrl.includes("blog")) {
    totalScore -= 14;
  }
  if (totalScore <= 0) return null;

  return {
    url: response.finalUrl,
    title,
    snippet: snippetWindow,
    sourceType,
    score: totalScore,
    discovery,
  } satisfies CandidateSource;
}

async function researchProvider(provider: ReturnType<typeof normalizeProviderRecord<ProviderRecord>>) {
  const website = provider.website || null;
  const domain = normalizeProviderUrlDomain(website);

  if (!website || !domain) {
    return {
      name: provider.name,
      slug: provider.slug,
      category: provider.category,
      scope: provider.scope,
      states: provider.states,
      website,
      domain,
      repoCoverage: {
        zipRules: provider.zipCodes.length,
        modeledAsStateOnly: provider.scope === "STATE" && provider.zipCodes.length === 0,
      },
      officialResearch: {
        status: "blocked" as const,
        sourceType: "unknown" as const,
        zipRemediationPath: "manual_research_required" as const,
        bestUrl: null,
        title: null,
        snippet: null,
        sourceConfidence: "low" as const,
        discoveries: [],
        error: "Missing or invalid official website URL",
      },
    } satisfies ProviderResearchEntry;
  }

  const homepage = website.startsWith("http://") || website.startsWith("https://") ? website : `https://${website}`;
  const origin = new URL(homepage).origin;
  const manualCandidates = MANUAL_SOURCE_URLS[domain] || [];
  const sitemapCandidates = await discoverSitemapCandidates(origin, domain, provider.category);

  const homepageResponse = await fetchText(homepage, 9000);
  const homepageCandidates = homepageResponse.ok
    ? extractAnchors(homepageResponse.text, homepageResponse.finalUrl, domain, provider.category)
    : [];
  const guessedCandidates = await discoverGuessedPaths(homepage, domain, provider.category);

  const candidateUrls = [
    ...manualCandidates,
    ...sitemapCandidates,
    ...homepageCandidates,
    ...guessedCandidates,
  ];

  const deduped = new Set<string>();
  const discoveries: CandidateSource[] = [];

  for (const url of candidateUrls) {
    const normalized = normalizeUrl(url);
    if (deduped.has(normalized)) continue;
    deduped.add(normalized);

    let discovery: CandidateSource["discovery"] = "guessed-path";
    if (manualCandidates.includes(url)) discovery = "manual";
    else if (sitemapCandidates.includes(url)) discovery = "sitemap";
    else if (homepageCandidates.includes(url)) discovery = "homepage";

    const source = await buildCandidateSource(provider, normalized, discovery);
    if (source) discoveries.push(source);
    if (discoveries.length >= 8) break;
  }

  discoveries.sort((a, b) => b.score - a.score || a.url.localeCompare(b.url));
  const best = discoveries[0] || null;

  const status: ResearchStatus = best
    ? best.score >= 14
      ? "resolved"
      : "partial"
    : homepageResponse.ok
      ? "partial"
      : "blocked";

  const zipRemediationPath = best
    ? detectZipRemediationPath(provider, best.sourceType, best.snippet)
    : "manual_research_required";

  const sourceConfidence =
    status === "resolved"
      ? "high"
      : status === "partial"
        ? "medium"
        : "low";

  return {
    name: provider.name,
    slug: provider.slug,
    category: provider.category,
    scope: provider.scope,
    states: provider.states,
    website,
    domain,
    repoCoverage: {
      zipRules: provider.zipCodes.length,
      modeledAsStateOnly: provider.scope === "STATE" && provider.zipCodes.length === 0,
    },
    officialResearch: {
      status,
      sourceType: best?.sourceType || "unknown",
      zipRemediationPath,
      bestUrl: best?.url || homepageResponse.finalUrl || homepage,
      title: best?.title || (homepageResponse.ok ? extractTitle(homepageResponse.text) : null),
      snippet: best?.snippet || (homepageResponse.ok ? clip(stripHtml(homepageResponse.text), 280) : null),
      sourceConfidence,
      discoveries,
      error: homepageResponse.ok ? null : homepageResponse.error || `Homepage fetch failed (${homepageResponse.status})`,
    },
  } satisfies ProviderResearchEntry;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
) {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function run() {
    while (true) {
      const current = index;
      index += 1;
      if (current >= items.length) return;
      results[current] = await worker(items[current], current);
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => run()));
  return results;
}

function buildSummary(entries: ProviderResearchEntry[]) {
  const statusCounts: Record<ResearchStatus, number> = {
    resolved: 0,
    partial: 0,
    blocked: 0,
  };
  const sourceTypeCounts: Record<OfficialSourceType, number> = {
    address_checker: 0,
    territory_list: 0,
    system_map: 0,
    coverage_map: 0,
    interoperability_map: 0,
    overview: 0,
    unknown: 0,
  };
  const zipPathCounts: Record<ZipRemediationPath, number> = {
    seed_exact_or_prefix_after_lookup: 0,
    requires_live_address_check: 0,
    needs_polygon_or_corridor_model: 0,
    state_only_ok: 0,
    manual_research_required: 0,
  };
  const categoryCounts = new Map<string, { total: number; resolved: number; stateOnly: number }>();

  for (const entry of entries) {
    statusCounts[entry.officialResearch.status] += 1;
    sourceTypeCounts[entry.officialResearch.sourceType] += 1;
    zipPathCounts[entry.officialResearch.zipRemediationPath] += 1;

    const bucket = categoryCounts.get(entry.category) || { total: 0, resolved: 0, stateOnly: 0 };
    bucket.total += 1;
    if (entry.officialResearch.status === "resolved") bucket.resolved += 1;
    if (entry.repoCoverage.modeledAsStateOnly) bucket.stateOnly += 1;
    categoryCounts.set(entry.category, bucket);
  }

  return {
    generatedAt: new Date().toISOString(),
    totalProviders: entries.length,
    statusCounts,
    sourceTypeCounts,
    zipPathCounts,
    categoryCounts: [...categoryCounts.entries()]
      .map(([category, counts]) => ({ category, ...counts }))
      .sort((a, b) => a.category.localeCompare(b.category)),
  };
}

function toMarkdown(summary: ReturnType<typeof buildSummary>, entries: ProviderResearchEntry[]) {
  const lines: string[] = [];
  lines.push("# Official Provider Coverage Research");
  lines.push("");
  lines.push(`Generated: ${summary.generatedAt}`);
  lines.push("");
  lines.push("## Repo Verdict");
  lines.push("");
  lines.push(`- Location-sensitive providers researched: ${summary.totalProviders}`);
  lines.push(`- Resolved official-source matches: ${summary.statusCounts.resolved}`);
  lines.push(`- Partial official-source matches: ${summary.statusCounts.partial}`);
  lines.push(`- Blocked official-source matches: ${summary.statusCounts.blocked}`);
  lines.push("");
  lines.push("Repo verdict: the current inventory is directionally useful but not location-accurate enough for ZIP precision. Most utility, water, transit, and toll providers are still modeled as state-wide rows even when official sources describe narrower service territories.");
  lines.push("");
  lines.push("## Official Source Types");
  lines.push("");
  for (const [sourceType, count] of Object.entries(summary.sourceTypeCounts)) {
    lines.push(`- ${sourceType}: ${count}`);
  }
  lines.push("");
  lines.push("## ZIP Remediation Paths");
  lines.push("");
  for (const [path, count] of Object.entries(summary.zipPathCounts)) {
    lines.push(`- ${path}: ${count}`);
  }
  lines.push("");
  lines.push("## Category Progress");
  lines.push("");
  for (const row of summary.categoryCounts) {
    lines.push(`- ${row.category}: total=${row.total}, resolved=${row.resolved}, modeledAsStateOnly=${row.stateOnly}`);
  }
  lines.push("");
  lines.push("## Highest-Priority Resolved Sources");
  lines.push("");

  for (const entry of entries
    .filter((entry) => entry.officialResearch.status === "resolved")
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
    .slice(0, 80)) {
    lines.push(
      `- ${entry.name} | ${entry.category} | ${entry.officialResearch.sourceType} | ${entry.officialResearch.zipRemediationPath} | ${entry.officialResearch.bestUrl || entry.website || ""}${entry.officialResearch.snippet ? ` | ${entry.officialResearch.snippet}` : ""}`
    );
  }

  lines.push("");
  lines.push("## Unresolved / Manual Research Queue");
  lines.push("");

  for (const entry of entries
    .filter((entry) => entry.officialResearch.status !== "resolved")
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
    .slice(0, 120)) {
    lines.push(
      `- ${entry.name} | ${entry.category} | ${entry.officialResearch.status} | ${entry.officialResearch.zipRemediationPath} | ${entry.website || ""}${entry.officialResearch.error ? ` | ${entry.officialResearch.error}` : ""}`
    );
  }

  return lines.join("\n");
}

async function main() {
  const shouldWrite = process.argv.includes("--write");
  const providers = getProviders();

  const entries = await mapWithConcurrency(providers, 4, async (provider, index) => {
    if ((index + 1) % 25 === 0 || index === providers.length - 1) {
      console.log(`Research progress: ${index + 1}/${providers.length}`);
    }
    return researchProvider(provider);
  });

  const summary = buildSummary(entries);
  const markdown = toMarkdown(summary, entries);
  const payload = {
    summary,
    providers: entries,
  };

  console.log(markdown);

  if (!shouldWrite) return;

  const outDir = resolve(process.cwd(), "docs/generated");
  await mkdir(outDir, { recursive: true });
  await Promise.all([
    writeFile(resolve(outDir, "provider-official-coverage-research.md"), `${markdown}\n`, "utf8"),
    writeFile(resolve(outDir, "provider-official-coverage-research.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8"),
  ]);
  console.log("\nWrote official coverage research artifacts to docs/generated.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
