type Args = {
  baseUrl: string | null;
  addressId: string | null;
  state: string | null;
  zip: string | null;
  lat: string | null;
  lng: string | null;
  cookie: string | null;
  bearer: string | null;
  json: boolean;
  help: boolean;
};

type FetchResult = {
  endpoint: string;
  url: string;
  status: number;
  ok: boolean;
  durationMs: number;
  body: unknown;
  summary: unknown;
};

function readArg(argv: string[], name: string): string | null {
  const index = argv.indexOf(name);
  if (index >= 0 && argv[index + 1]) return argv[index + 1];
  const inline = argv.find((arg) => arg.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : null;
}

function parseArgs(argv: string[]): Args {
  return {
    baseUrl: readArg(argv, "--base-url") || process.env.LOCATEFLOW_DIAGNOSTIC_BASE_URL || null,
    addressId: readArg(argv, "--address-id") || process.env.LOCATEFLOW_DIAGNOSTIC_ADDRESS_ID || null,
    state: readArg(argv, "--state"),
    zip: readArg(argv, "--zip"),
    lat: readArg(argv, "--lat"),
    lng: readArg(argv, "--lng"),
    cookie: readArg(argv, "--cookie") || process.env.LOCATEFLOW_DIAGNOSTIC_COOKIE || null,
    bearer: readArg(argv, "--bearer") || process.env.LOCATEFLOW_DIAGNOSTIC_BEARER || null,
    json: argv.includes("--json"),
    help: argv.includes("--help") || argv.includes("-h"),
  };
}

function printHelp() {
  console.log(`Usage: pnpm diagnose:provider-data -- --base-url <url> [options]

Options:
  --address-id <id>      Fetch /api/addresses/:id/dossier and pass addressId to recommendations.
  --state <US-state>     Query recommendations for a state.
  --zip <zip>            Query recommendations for a ZIP.
  --lat <number>         Query recommendations with latitude.
  --lng <number>         Query recommendations with longitude.
  --cookie <cookie>      Auth cookie. Prefer LOCATEFLOW_DIAGNOSTIC_COOKIE.
  --bearer <token>       Bearer token. Prefer LOCATEFLOW_DIAGNOSTIC_BEARER.
  --json                 Print raw JSON summary.

The tool does not print secrets. It reports endpoint status plus provider
coverage/serviceability meta and dossier section statuses.`);
}

function buildHeaders(args: Args): Headers {
  const headers = new Headers({ accept: "application/json" });
  if (args.cookie) headers.set("cookie", args.cookie);
  if (args.bearer) headers.set("authorization", `Bearer ${args.bearer}`);
  return headers;
}

function buildUrl(baseUrl: string, path: string, params: Record<string, string | null>) {
  const url = new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  for (const [key, raw] of Object.entries(params)) {
    if (raw) url.searchParams.set(key, raw);
  }
  return url;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function summarizeRecommendations(body: unknown) {
  const record = asRecord(body);
  const meta = asRecord(record.meta);
  const regionGroups = Array.isArray(record.regionGroups) ? record.regionGroups : [];
  const clusters = Array.isArray(record.clusters) ? record.clusters : [];
  const providers = Array.isArray(record.providers) ? record.providers : [];
  const providerCount =
    providers.length ||
    [...regionGroups, ...clusters].reduce((sum, group) => {
      const groupProviders = asRecord(group).providers;
      return sum + (Array.isArray(groupProviders) ? groupProviders.length : 0);
    }, 0);

  return {
    providerCount,
    region: record.region || null,
    groups: regionGroups.length || clusters.length,
    coverageModels: meta.coverageModels || null,
    fcc: asRecord(meta.fcc).status || null,
    fccConfirmedCount: asRecord(meta.fcc).confirmedCount ?? null,
    electric: asRecord(meta.electric).status || null,
    electricConfirmedCount: asRecord(meta.electric).confirmedCount ?? null,
    zipMatchLevel: meta.zipMatchLevel || null,
    addressCoordinatesUsed: meta.addressCoordinatesUsed ?? null,
    error: record.error || null,
  };
}

function summarizeDossier(body: unknown) {
  const record = asRecord(body);
  const sectionStatuses = Object.fromEntries(
    Object.entries(record)
      .filter(([, value]) => {
        const section = asRecord(value);
        return typeof section.status === "string";
      })
      .map(([key, value]) => [key, asRecord(value).status]),
  );

  return {
    address: record.address || null,
    sectionStatuses,
    integrationStatuses: record.integrationStatuses || null,
    error: record.error || null,
    upgradeRequired: record.upgradeRequired || null,
  };
}

async function fetchJson(
  endpoint: string,
  url: URL,
  headers: Headers,
  summarize: (body: unknown) => unknown,
): Promise<FetchResult> {
  const started = performance.now();
  const response = await fetch(url, { headers });
  const durationMs = Math.round(performance.now() - started);
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();
  return {
    endpoint,
    url: url.toString(),
    status: response.status,
    ok: response.ok,
    durationMs,
    body,
    summary: summarize(body),
  };
}

function printText(results: FetchResult[]) {
  for (const result of results) {
    console.log(`[${result.ok ? "ok" : "fail"}] ${result.endpoint} ${result.status} ${result.durationMs}ms`);
    console.log(JSON.stringify(result.summary, null, 2));
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  if (!args.baseUrl) {
    printHelp();
    process.exitCode = 1;
    return;
  }

  const headers = buildHeaders(args);
  const results: FetchResult[] = [];

  const recommendationsUrl = buildUrl(args.baseUrl, "/api/providers/recommendations", {
    addressId: args.addressId,
    state: args.state,
    zip: args.zip,
    lat: args.lat,
    lng: args.lng,
  });
  results.push(await fetchJson("provider recommendations", recommendationsUrl, headers, summarizeRecommendations));

  if (args.addressId) {
    const dossierUrl = buildUrl(args.baseUrl, `/api/addresses/${encodeURIComponent(args.addressId)}/dossier`, {});
    results.push(await fetchJson("address dossier", dossierUrl, headers, summarizeDossier));
  }

  if (args.json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    printText(results);
  }

  if (results.some((result) => !result.ok)) {
    process.exitCode = 1;
  }
}

void main();
