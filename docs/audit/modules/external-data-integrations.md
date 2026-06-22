# Module Audit: External Data Integrations (gov/data APIs)

> READ-ONLY audit. Evidence = source code only. Paths are relative to repo root
> `staging-move/`. Items that could not be confirmed from code are marked
> **[needs verification]**.

## 1. Module Summary

A family of 16 server-side "lookup" libraries under `apps/web/src/lib/*` that
enrich the consumer app with free/keyed US government & public datasets, plus
one authenticated map-image proxy route. They split into three user-facing
flows:

1. **Provider serviceability** (recommendations + provider catalog):
   `fcc-isp.ts` (FCC National Broadband Map / BDC) and `electric-utility.ts`
   (OpenEI URDB), composed by `provider-serviceability.ts` and consumed by
   `app/api/providers/recommendations/route.ts` and `app/api/providers/route.ts`.
2. **New Home Dossier** (`app/api/addresses/[id]/dossier/route.ts`): aggregates
   `fema-flood.ts`, `fema-nri.ts`, `epa-radon.ts`, `epa-walkability.ts`,
   `epa-water.ts`, `nces-district.ts`, `nces-schools.ts`, `nws-weather.ts`,
   `airnow.ts`, `hud-housing.ts`, `nlr-alt-fuel-stations.ts`, `census-acs.ts`.
3. **Move-checklist helpers**: `nhtsa.ts` (VIN decode + recalls) via
   `app/api/vehicles/decode/route.ts`; `nws-weather.ts` also used by
   `app/api/cron/move-week-alerts/route.ts`.

Supporting infra: `integration-telemetry.ts` (best-effort daily outcome
counters), `global-spend-guard.ts` (app-wide daily "fuse"),
`community-popularity.ts` (DB-derived popularity boost; no external HTTP),
`http-download.ts` (filename sanitization for `Content-Disposition`), and
`app/api/maps/static/route.ts` (authenticated Geoapify static-map proxy).

**Overall posture is strong.** Every lib follows a consistent, well-engineered
"graceful degradation" contract: per-request `AbortController` timeout, defensive
schema parsing, status unions instead of throws, in-process LRU cache that only
stores `ok` answers, and machine-readable `reason` strings that never echo a
key-bearing URL. URL construction encodes all interpolated values; the two libs
that take a body-derived forecast URL (`nws-weather.ts`) pin it to a `.weather.gov`
allowlist. The dossier route layers auth, per-user rate limit, workspace scoping,
ownership checks, plan gating, and a global daily budget on top.

The most material issue is a likely **wrong upstream host** in
`nlr-alt-fuel-stations.ts` (`developer.nlr.gov`), which almost certainly should
be NREL's `developer.nrel.gov` — the EV-charging dossier section would silently
fail even when configured. Remaining findings are smaller: no test for
`community-popularity.ts`, a couple of minor reliability/observability gaps, and
some inherent multi-instance cache duplication.

## 2. Related Files

External HTTP integration libs (all `apps/web/src/lib/`):
- `airnow.ts` — AirNow current AQI (keyed; key in query string).
- `census-acs.ts` — Census geocoder (keyless) → ACS5 data (keyed).
- `epa-radon.ts` — EPA ROE_Radon ArcGIS (keyless).
- `epa-walkability.ts` — EPA WalkabilityIndex ArcGIS (keyless).
- `epa-water.ts` — EPA Envirofacts SDWIS (keyless; city/state in URL path).
- `fcc-isp.ts` — FCC BDC availability (keyed via headers) + FCC block API (keyless).
- `fema-flood.ts` — FEMA NFHL ArcGIS (keyless).
- `fema-nri.ts` — FEMA NRI ArcGIS Online (keyless).
- `hud-housing.ts` — HUD User Data API (keyed via Bearer header).
- `nces-district.ts` — NCES EDGE ArcGIS (keyless; 2-service fallback).
- `nces-schools.ts` — HIFLD/ORNL Public Schools ArcGIS (keyless).
- `nhtsa.ts` — NHTSA vPIC + recalls (keyless).
- `nlr-alt-fuel-stations.ts` — "NLR" Alternative Fuel Stations (keyed in query).
- `nws-weather.ts` — NWS api.weather.gov (keyless; 2-step, host allowlist).
- `electric-utility.ts` — OpenEI URDB (keyed in query string).
- `community-popularity.ts` — DB aggregate + optional Upstash Redis; no HTTP.

Composition / route / infra:
- `provider-serviceability.ts` — composes FCC + electric for the catalog.
- `app/api/maps/static/route.ts` — authenticated Geoapify static-map proxy.
- `integration-telemetry.ts` — fire-and-forget daily outcome counters.
- `global-spend-guard.ts` — app-wide daily spend cap.
- `runtime-config.ts` / `packages/shared/src/runtime-config.ts` — key/flag resolution.
- `http-download.ts` — `Content-Disposition` filename sanitizer.

Callers: `app/api/providers/recommendations/route.ts`,
`app/api/providers/route.ts`, `app/api/addresses/[id]/dossier/route.ts`,
`app/api/addresses/[id]/dossier/pdf/route.ts`, `app/api/vehicles/decode/route.ts`,
`app/api/cron/move-week-alerts/route.ts`.

Out-of-scope-but-related coordinate source: `packages/db/src/zip-centroid.ts`
(`zipCentroid`, `zipCentroidCount`) — provides ZIP→lat/lng centroid fallback
feeding the lookups; the `apps/web/src/lib/zip-centroid.test.ts` test imports it
from `@locateflow/db` (so that test is **not** orphaned, despite no
`apps/web/src/lib/zip-centroid.ts`).

## 3. Related Routes / Screens

- `GET /api/addresses/[id]/dossier` (and `?summary=1` lightweight variant) — New
  Home Dossier; the primary consumer of 12 of the libs.
- `GET /api/addresses/[id]/dossier/pdf` — PDF export of the same dossier.
- `GET /api/providers/recommendations` — serviceability enrichment (FCC/electric).
- `GET /api/providers` — catalog with `zipCentroid` + serviceability.
- `GET /api/vehicles/decode?vin=…` — NHTSA VIN/recall helper.
- `GET|POST /api/cron/move-week-alerts` — uses `lookupMoveDayForecast`.
- `GET /api/maps/static` — authenticated Geoapify image proxy (web RouteMapCard,
  mobile transit banner).

The libraries are server-only; the UI screens (dossier view, recommendations,
vehicle helper, map cards) consume the JSON/PNG outputs. UI rendering of these
results is owned by other modules and not re-audited here except where the
contract shape is relevant.

## 4. Related APIs

Upstream external endpoints (all hardcoded constants, overridable only for FCC):
AirNow `airnowapi.org`; Census `geocoding.geo.census.gov` + `api.census.gov`;
EPA `gispub.epa.gov`, `geodata.epa.gov`, `data.epa.gov/efservice`; FCC
`broadbandmap.fcc.gov` + `geo.fcc.gov`; FEMA `hazards.fema.gov` +
`services.arcgis.com/XG15cJAlne2vxtgt`; HUD `huduser.gov`; NCES `nces.ed.gov`;
NHTSA `vpic.nhtsa.dot.gov` + `api.nhtsa.gov`; "NLR" `developer.nlr.gov`
(**suspect — see external-data-integrations-01**); NWS `api.weather.gov`; OpenEI
`api.openei.org`; Geoapify `maps.geoapify.com`.

Internal APIs are listed in §3.

## 5. Related Components

No React components inside this module — these are pure server libs + one route.
Downstream UI components (dossier sections, RouteMapCard, recommendation cards,
vehicle helper) live in other modules and consume the typed results.

## 6. Related State / Hooks / Stores

- **In-process LRU caches** (per lib): `Map<string, CacheEntry>` with TTL +
  `MAX_CACHE_ENTRIES` eviction (e.g. `airnow.ts:84`, `fcc-isp.ts:138`,
  `nhtsa.ts:123`). Process-local; not shared across instances.
- **Map proxy LRU** (`app/api/maps/static/route.ts:196`).
- **Telemetry buffer** (`integration-telemetry.ts:60`) — in-memory counter map
  flushed to `IntegrationDailyStat`.
- **Upstash Redis** — optional 1h cache in `community-popularity.ts:25`; also the
  global-spend counter backend (`global-spend-guard.ts`).
- **Durable section cache** — `getOrFetchSection` in the dossier route persists
  coordinate-keyed lib results across users/instances (referenced
  `dossier/route.ts:790`).

No client hooks/stores in scope.

## 7. Related Database / Models

- `IntegrationDailyStat` — written by `integration-telemetry.ts`
  (`persistEntry`), read by the admin app for health dashboards.
- `Address` (lat/lng/city/state/zip), `Service`, `MovingPlan` — read by the
  dossier/recommendations routes to source coordinates and the move date.
- `RuntimeConfigEntry` — holds the enable flags + (encrypted) API keys resolved
  by `runtime-config.ts`.
- Dossier durable-section cache rows (persisted by `getOrFetchSection`) —
  **[needs verification]** of the exact model name (the section-cache module was
  not opened in full).

`community-popularity.ts` runs `prisma.address.groupBy` + `prisma.service.groupBy`
(DB-side aggregates, no per-row scan).

## 8. Impact Map

- **UI**: dossier sections, recommendation confidence badges, vehicle helper,
  route map images. Failures degrade to "fall back / hide section", never a
  broken UI (status unions everywhere).
- **API**: §3 routes. All wrap libs in `Promise.allSettled` / try-catch.
- **DB**: `IntegrationDailyStat` writes; `Address/Service/MovingPlan` reads;
  `RuntimeConfigEntry` reads.
- **Auth**: dossier/recommendations/vehicles require `requireDbUserId`; map proxy
  requires auth + plan feature; cron route uses `guardCronRequest`.
- **Admin**: reads `IntegrationDailyStat` for the health/Insights panel.
- **Mobile**: consumes `/api/maps/static` (transit banner) and the dossier/vehicle
  endpoints via the same contracts.
- **Notifications**: `move-week-alerts` cron uses the NWS forecast to drive alerts.
- **Integrations**: the whole module.
- **Analytics**: `integration-telemetry.ts` per-source outcome counts.
- **SEO**: none (server, authenticated, `no-store`/private cache).
- **Tests**: unit tests exist for 15/16 libs + the map route + telemetry +
  serviceability; `community-popularity.ts` has none (see
  external-data-integrations-07).

## 9. Buttons / Actions / Functions

These are functions (no buttons). For each public entry point:

### `lookupFccIsps(input)` — `fcc-isp.ts:399`
- **Used by**: `provider-serviceability.ts` → recommendations/providers routes.
- **Expected**: resolve lat/lng → census block → BDC availability; return `ok`
  with confirmed ISPs or a degraded status.
- **Actual**: matches expectation; flag+key gated (`not_configured`), `no_location`
  when no coords, `error` on network/parse. 7-day LRU on `ok` only.
- **Loading/disabled/error**: caller-side; lib returns status union.
- **Permission**: caller gates on `addressValidation` plan feature
  (`recommendations/route.ts:1278`).
- **Edge cases**: host-only `FCC_BDC_API_BASE` override re-appended with
  `/api/public/map` (`normalizeFccApiBase`); non-URL override falls back to default.

### `lookupElectricUtilities(input)` — `electric-utility.ts:362`
- Mirrors FCC. **Note**: `OPENEI_API_KEY` is sent as a **query parameter**
  (`electric-utility.ts:384`) — acceptable per OpenEI's scheme, but see
  external-data-integrations-04 (key-in-URL logging caution).

### `lookupAirQuality` / `lookupNeighborhoodAcs` / `lookupHudHousing` / `lookupEvCharging`
- Keyed dossier sources; key gate first, then coords/zip gate, then fetch. Census
  uses `redirect: "manual"` to treat the unkeyed 302 as a hard failure
  (`census-acs.ts:267`). AirNow/NLR/OpenEI put the key in the query string.

### `lookupFloodZone` / `lookupHazardRisks` / `lookupRadonZone` / `lookupWalkability` / `lookupSchoolDistrict` / `lookupNearbySchools`
- Keyless ArcGIS point queries; detect HTTP-200 ArcGIS `error` payloads
  (e.g. `fema-flood.ts:193`). `nces-district.ts` tries two service years in order.

### `lookupWaterSystem(input)` — `epa-water.ts:249`
- city/state in **URL path** segments, `encodeURIComponent`'d; conservative
  "largest active community system" match; recursion for a hardcoded
  `MIAMI BEACH→MIAMI` fallback (`epa-water.ts:150`, `:279`).

### `lookupMoveDayForecast(input)` — `nws-weather.ts:199`
- 2-step; **pins step-2 URL to `.weather.gov`** (`isAllowedForecastUrl`,
  `nws-weather.ts:158`). `targetDate` regex-validated.

### `lookupVehicleByVin(rawVin)` — `nhtsa.ts:313`
- VIN syntactically validated before any network call; decode + independent
  recalls block; route adds zod VIN validation + plan gate + per-user rate limit
  (`vehicles/decode/route.ts`).

### `GET /api/maps/static`
- Auth → per-user(60/min)+per-IP(120/min) rate limit → coord validation
  (range-checked) → `realMap` plan gate (non-preview) → Geoapify fetch with
  4s timeout → never forwards upstream body, streams PNG; key never in response.
  Success returns image; failure returns JSON non-200 with `X-Maps-Error-Code`.

### `recordIntegrationOutcome(s)` — `integration-telemetry.ts:88`
- Synchronous buffer push, never throws, background flush, `unref`'d timer.

### `getCommunityPopularity(state)` — `community-popularity.ts:72`
- DB aggregate + optional Redis cache; `MIN_DISTINCT_USERS=5` privacy threshold;
  any failure → `undefined` (engine ranks without the signal).

## 10. UI/UX Audit

This module produces data, not UI. Indirect UX observations:

- **Honest "no data" vs "good data"** — Every lib distinguishes `ok` with null
  fields (authoritative "no mapped data here") from `error`/`no_location`. Flood
  explicitly reports `isHighRisk: null` for unmapped points rather than implying
  "minimal risk" (`fema-flood.ts:213`). Good — prevents false reassurance.
  *Impact*: positive. *Recommendation*: keep; ensure consuming UI renders the
  null/`reason` distinction (owned by the dossier-UI module). *Priority*: low.
- **Caveat strings** — `hud-housing.ts`, `nlr-alt-fuel-stations.ts`,
  `census-acs.ts`, `epa-water.ts` carry `caveat`/source disclosures the UI must
  surface. *Recommendation*: verify the dossier UI renders `caveat` for HUD and
  EV (legal attribution requirement for HUD). *Priority*: medium.
  **[needs verification]** (UI not in scope).

## 11. Logic Audit

- **Expected flow**: gate (flag/key) → validate input → cache check → fetch
  (timeout) → parse defensively → cache `ok` → return status union. Consistently
  implemented across all 16 libs.
- **Cache only stores `ok`** (e.g. `airnow.ts:98`, `nhtsa.ts:139`) — a transient
  blip can't pin a bad answer for the TTL. Correct.
- **NHTSA partial-decode handling** — a decoded vehicle whose recalls call fails
  is **not** cached (`nhtsa.ts:139-141`), so recalls retry next request while the
  vehicle still renders. Correct, subtle, good.
- **`fema-nri.ts` overallRating sentinel guard** (`:264`) — "No Rating"/
  "Insufficient Data" mapped to null. Correct.
- **Wrong condition risk — none material found.** `pickWorstObservation`
  (`airnow.ts:164`) correctly drops negative AQI sentinels.
- **Cache key granularity** is tuned per dataset (e.g. air 2 decimals ≈1.1km,
  walkability/flood 4 decimals ≈11m). Reasonable.
- **Stale/cache risk**: caches are **per-process** (`fcc-isp.ts:128` comment
  acknowledges this). Across N instances you get up to N upstream calls per key
  before all warm — a cost/rate-limit amplification, not a correctness bug. The
  dossier route mitigates with a durable cross-instance section cache; the
  serviceability libs (FCC/electric) and NHTSA do **not** — see
  external-data-integrations-05.
- **Race conditions**: telemetry flush snapshots+clears the buffer synchronously
  before any await (`integration-telemetry.ts:193`), and `persistEntry` has a
  create-race retry (`:163`). Correct.

## 12. Reverse Logic Audit

- **Unauthorized user**: dossier/recommendations/vehicles call `requireDbUserId`;
  foreign-scope address ids return 404 not 403
  (`dossier/route.ts:500`). Map proxy returns 401 (`maps/static/route.ts:294`).
- **Empty data**: handled as `ok` with nulls / empty arrays (e.g. AirNow
  `no_observation_in_range`, schools empty list).
- **API error**: every lib catches and returns `error`; ArcGIS HTTP-200 error
  bodies detected explicitly.
- **Slow network**: `AbortController` timeouts 3–6s per call (`REQUEST_TIMEOUT_MS`
  in each lib; map proxy 4s). The dossier runs sections in `Promise.allSettled`
  so one slow source never blocks others.
- **Double-click / repeat**: idempotent reads; LRU + durable cache absorb repeats;
  per-user rate limits cap abuse (dossier 60/min, vehicles 10/min, maps 60/min).
- **Stale data**: TTLs match dataset cadence (1h for AQI/weather, 7d for
  flood/district/etc.).
- **Direct route access**: still auth+gate guarded.
- **Mobile viewport / dark theme**: N/A to libs; map proxy returns theme-specific
  palettes (`maps/static/route.ts:45`) for dark/light.
- **Role change / token expiry**: each request re-resolves auth + plan; map proxy
  uses `invalidateOnFingerprintMismatch:false` deliberately so native image
  loaders that drop UA aren't logged out (`maps/static/route.ts:292`).
- **Budget exhaustion**: dossier "fuse" makes uncached sections throw→degrade and
  skips upstream spend; fails **open** when config/limiter errors
  (`global-spend-guard.ts:83`). Reasonable for a non-revenue feature.

## 13. Security Audit

### external-data-integrations-02 — SSRF surface review (overall: low risk)
- **Severity**: Low (Info-leaning).
- **Affected area**: all libs that build upstream URLs from request-derived data.
- **Evidence**: lat/lng are `Number.isFinite`-validated before interpolation
  (e.g. `fema-flood.ts:167`, `airnow.ts:187`); ArcGIS geometry uses
  `URLSearchParams`/`JSON.stringify`; `epa-water.ts` path segments are
  `encodeURIComponent`'d (`:267`); `nhtsa.ts` VIN is regex-validated and encoded;
  `census-acs.ts` uses `URLSearchParams`. The only URL taken from a **response
  body** (NWS step-2 forecast URL) is pinned to a `.weather.gov` allowlist
  (`nws-weather.ts:158-169`). Base hosts are hardcoded constants; the single
  override (`FCC_BDC_API_BASE`) is URL-parsed, protocol-checked, and origin-pinned
  (`fcc-isp.ts:360-371`).
- **Risk**: a classic SSRF (attacker steering a server request to an internal
  host) is not reachable — no user-controlled host, validated numeric coords, and
  the one body-sourced URL is allowlisted.
- **Defensive abuse scenario (high-level)**: if a future change let
  `FCC_BDC_API_BASE` or the NWS allowlist accept arbitrary hosts, an operator-set
  or upstream-tampered value could redirect server fetches. Keep host control out
  of unauthenticated input.
- **Prevention**: keep numeric/enum validation before interpolation; keep the NWS
  allowlist and the FCC origin-pin; never interpolate a raw string host.
- **Detection**: add a unit test asserting `isAllowedForecastUrl` rejects
  `https://evil.example/` and `http://api.weather.gov` (http) — partially covered;
  confirm. **[needs verification]**
- **Analysis (root cause)**: defensive-by-construction design.
- **Recommendation**: no change required; document the invariant "external base
  hosts are constants; only numeric/enum/encoded values are interpolated".
- **Tests to add**: negative SSRF tests for the NWS allowlist and FCC base
  normalizer (assert non-weather.gov / non-http(s) rejected).

### external-data-integrations-03 — API keys in query strings (key-in-URL)
- **Severity**: Low.
- **Affected area**: `airnow.ts:202` (`API_KEY=`), `electric-utility.ts:384`
  (`api_key=`), `nlr-alt-fuel-stations.ts:268` (`api_key=`), `census-acs.ts:392`
  (`key=`).
- **Evidence**: keys are appended to the request URL (each API's documented
  scheme). Each lib's `fetchJson` throws only `"<provider> request failed: HTTP
  <status>"` and never includes the URL (e.g. `airnow.ts:144` comment + code), so
  the key does not reach `reason`, telemetry, or the client.
- **Risk**: keys in URLs can leak via upstream access logs, proxies, or any future
  code that logs the full request URL/`error` object. Today the code is careful.
- **Defensive abuse scenario (high-level)**: a later "log the failing URL for
  debugging" change, or an interceptor that records `fetch` URLs, would exfiltrate
  the key into logs/Sentry.
- **Prevention**: prefer header auth where the API supports it; centralize fetch
  so URL logging is structurally impossible; add a lint/test that the libs never
  pass the key-bearing URL to `console`/`logger`/`reason`.
- **Detection**: grep CI rule for `console.*url` inside these libs; Sentry scrub
  rule for `API_KEY|api_key|[?&]key=`.
- **Analysis (root cause)**: upstream APIs (AirNow/OpenEI/NREL/Census) require the
  key as a query param.
- **Recommendation**: keep current no-URL-logging discipline; add the scrubbing/
  lint guardrails so it can't regress.
- **Tests to add**: assert each lib's error `reason` for a non-2xx never contains
  the key or `key=`.

### external-data-integrations-04 — Map proxy is hardened (positive control)
- **Severity**: Info.
- **Evidence**: `maps/static/route.ts` — auth (401), per-user+per-IP rate limits
  (`:300`), strict coord parse+range check (`:96-105`), `realMap` plan gate
  (`:327`), 4s upstream timeout, **never forwards upstream body** and key never in
  response (`:362-364`, `:175` key only in upstream URL), private/no-CDN cache
  headers (`:270`). Good defensive design; documented as a model to follow.
- **Recommendation**: none; reference implementation for other proxies.

### Other security checks (no findings)
- **RBAC/IDOR**: dossier enforces workspace scope + ownership
  (`assertScopedRecordAction`, `dossier/route.ts:500`); recommendations gate on
  plan feature.
- **XSS**: libs return typed scalars/enums; no HTML.
- **CSRF**: GET reads, no state mutation.
- **Injection**: no SQL string-building; Prisma aggregates parameterized.
- **Exposed secrets**: keys resolved server-side via `runtime-config.ts`
  (encrypted at rest, `decrypt` on read, `:23`); never shipped to client.
- **PII/secret logging**: errors log status-only; telemetry stores counts only.
- **Rate limiting**: present on all user-facing entry points + global budget fuse.

## 14. Performance Audit

- **Redundant API calls**: minimized by per-lib LRU + dossier durable section
  cache + global budget. **Cross-instance duplication** remains for FCC/electric/
  NHTSA (per-process caches) — see external-data-integrations-05.
- **N+1 queries**: none. `community-popularity.ts` uses two `groupBy` aggregates,
  not per-row scans (`:44`, `:52`). Dossier resolves plan once and reuses it
  (`dossier/route.ts:505`).
- **Parallelism**: dossier sections run via `Promise.allSettled`
  (`dossier/route.ts:818`, `:849`); HUD fires FMR+IL in parallel
  (`hud-housing.ts:356`). Good.
- **Timeouts**: every external call bounded (3–6s); the dossier's worst-case
  latency is the slowest single section, not the sum.
- **Bundle/image/lazy/pagination/debounce**: server libs — N/A, except the map
  proxy requests `scaleFactor=2` and clamps size (`maps/static/route.ts:110`).
- **Mobile perf**: map proxy caps preview size (`PREVIEW_SIZE_MAX=480`) and
  caches; good.
- **Potential micro-cost**: `community-popularity.ts` recomputes via two
  aggregates on a Redis miss for an unbounded `state`; bounded by 50 states and
  1h TTL — acceptable.

## 15. Reliability Audit

- **Error handling / fallbacks**: best-in-class — never throws into a user path;
  every failure mode mapped to a status. Map proxy returns JSON non-200 with
  diagnostic headers.
- **Retry**: `nces-district.ts` retries across two service years (`:177`); HUD
  iterates candidate entity ids (`:355`); telemetry has a create-race retry. No
  generic network retry/backoff — acceptable given short timeouts and the
  graceful-degrade contract, but see external-data-integrations-06.
- **Offline/slow**: timeouts + allSettled isolate slow sources.
- **Transaction consistency / partial failure**: dossier builds each section
  independently; a partial failure shows the rest. Telemetry is best-effort and
  drops on DB failure by design (`integration-telemetry.ts:206`).
- **Monitoring/logging**: `IntegrationDailyStat` per-source outcomes feed an admin
  health panel. **Gap**: failures are counted but **not** alerted — a source that
  starts 100%-erroring (e.g. an upstream host change, or
  external-data-integrations-01) degrades silently with no ops alert. See
  external-data-integrations-06.
- **Wrong upstream host**: external-data-integrations-01 (EV charging) — the most
  material reliability risk.

## 16. Dead Code / Cleanup

- **No dead libs.** All 16 entry points are wired (verified by grep): FCC/electric
  via `provider-serviceability.ts` → recommendations/providers; 12 dossier libs
  via the dossier route; NHTSA via `vehicles/decode`; NWS also via
  `move-week-alerts`; `community-popularity` via the recommendation engine
  (`getCommunityPopularity`). Confirmed.
- **`apps/web/src/lib/zip-centroid.test.ts` is NOT orphaned** — it tests
  `@locateflow/db`'s `zipCentroid`/`zipCentroidCount` (`packages/db/src/
  zip-centroid.ts`), which is wired into `providers/route.ts:72` and
  `recommendations/route.ts:1107`. (No `apps/web/src/lib/zip-centroid.ts` source
  exists, which is fine.)
- **`community-popularity.ts` has no test** — see external-data-integrations-07
  (test gap, not dead code).
- **Duplicated `fetchJson` + LRU boilerplate** across ~14 libs is intentional
  isolation (each tuned: timeout, headers, error prefix). Could be a shared
  helper, but the duplication is low-risk and aids per-source tuning — flag as
  optional refactor only (external-data-integrations-08).
- **`waterCityCandidates` `MIAMI BEACH→MIAMI`** hardcode (`epa-water.ts:151`) is a
  single targeted fallback, not generalizable — acceptable but note it as a
  maintenance smell (it implies other metros may need similar entries and won't
  get them).

## 17. Tests

**Existing** (`apps/web/src/lib/__*__`/co-located `*.test.ts`): `airnow`,
`census-acs`, `electric-utility`, `epa-radon`, `epa-walkability`, `epa-water`,
`fcc-isp`, `fema-flood`, `fema-nri`, `hud-housing`, `nces-district`,
`nces-schools`, `nhtsa`, `nlr-alt-fuel-stations`, `nws-weather`,
`provider-serviceability`, `integration-telemetry`, `zip-centroid`, plus
`app/api/maps/static/route.test.ts`. Strong coverage.

**Missing / suggested**:
- **`community-popularity.ts` — no test** (external-data-integrations-07):
  threshold (`MIN_DISTINCT_USERS`), normalization, Redis hit/miss, failure→
  `undefined`.
- **NLR host correctness** (external-data-integrations-01): the existing
  `nlr-alt-fuel-stations.test.ts:75` asserts the URL origin is
  `https://developer.nlr.gov/...` — i.e. it **locks in the suspect host**. If the
  host is wrong, this test entrenches the bug. Add/repoint to the verified NREL
  host.
- **SSRF negative tests** (external-data-integrations-02): NWS allowlist rejects
  non-`weather.gov`/http; FCC base normalizer rejects non-http(s)/non-URL.
- **Key-leak tests** (external-data-integrations-03): assert error `reason` never
  contains the key/`key=` for AirNow/OpenEI/NLR/Census.
- **e2e**: dossier degrades cleanly when every source errors / when budget is
  exhausted (route already structured for it; assert the contract shape).

## 18. Findings Summary

| ID | Severity | Category | Finding | Impact | Recommendation | Files |
|----|----------|----------|---------|--------|----------------|-------|
| external-data-integrations-01 | High | Reliability | EV-charging integration targets `developer.nlr.gov`; the Alternative Fuel Stations / AFDC API is an NREL product served at `developer.nrel.gov`. The wrong host (and key naming) appears in code, runtime-config, and tests. | When enabled, the EV section would always degrade to `error` (host unlikely to resolve); silent because off-by-default + graceful-degrade + no alerting. Wasted config effort; misleading "graceful no-op". | Verify the correct host/path against NREL docs; if confirmed wrong, correct the host, key/flag naming, and the test that pins the host. | `apps/web/src/lib/nlr-alt-fuel-stations.ts:9,61,70,79`; `apps/web/src/lib/nlr-alt-fuel-stations.test.ts:75`; `packages/shared/src/runtime-config.ts:651-678` |
| external-data-integrations-02 | Low | Security | SSRF surface is defensively closed (validated numeric coords, encoded path/query, NWS body-URL allowlist, FCC origin-pin) — flagged to lock in the invariant. | Low; misuse only if a future change accepts a user/upstream host. | Keep validation; add SSRF negative tests; document the "hosts are constants" invariant. | `nws-weather.ts:158-169`; `fcc-isp.ts:360-371`; `epa-water.ts:267`; `census-acs.ts:371-395` |
| external-data-integrations-03 | Low | Security | Four libs send the API key in the query string (AirNow/OpenEI/NLR/Census). Currently never logged, but one careless URL/`error` log would leak it. | Key exposure via logs/proxies if discipline regresses. | Add log-scrub + lint/test guardrails; prefer header auth where supported. | `airnow.ts:202`; `electric-utility.ts:384`; `nlr-alt-fuel-stations.ts:268`; `census-acs.ts:392` |
| external-data-integrations-04 | Info | Security | `/api/maps/static` proxy is a hardened reference (auth, dual rate limit, plan gate, no body forward, key never in response, private cache). | Positive control. | None; reuse as the pattern for other proxies. | `app/api/maps/static/route.ts` |
| external-data-integrations-05 | Low | Performance | FCC/electric/NHTSA use per-process LRU caches only; multi-instance deployments multiply upstream calls per key before all instances warm. | Cost/rate-limit amplification (not correctness). Dossier libs already have a durable cross-instance cache; serviceability libs don't. | Optionally layer the shared/durable cache (the libs already note the seam) for FCC/electric/NHTSA. | `fcc-isp.ts:128-159`; `electric-utility.ts:98-131`; `nhtsa.ts:110-147` |
| external-data-integrations-06 | Low | Reliability | Integration outcomes are counted in `IntegrationDailyStat` but not alerted; a source that flips to 100% error degrades silently. | Slow detection of an upstream break (e.g. external-data-integrations-01) — users just see missing sections. | Add an admin/cron alert when a source's daily error ratio crosses a threshold. | `integration-telemetry.ts`; admin Insights consumer |
| external-data-integrations-07 | Low | Test | `community-popularity.ts` has no unit test (privacy threshold, normalization, Redis hit/miss, failure path). | Regressions in the `MIN_DISTINCT_USERS=5` privacy floor or scaling could ship unnoticed. | Add a unit test covering threshold, scaling, cache, and failure→`undefined`. | `apps/web/src/lib/community-popularity.ts` |
| external-data-integrations-08 | Info | Architecture | `fetchJson`+LRU boilerplate duplicated across ~14 libs (intentional isolation, per-source tuning). | Maintenance overhead; consistent-but-copied error handling. | Optional: extract a tiny shared `timedFetchJson` + `createTtlCache` while keeping per-lib config; low priority. | all `*.ts` lookup libs |

## 19. Module TODO

- [ ] **external-data-integrations-01 — Verify & fix EV-charging upstream host.**
  Severity: High. Reason: `developer.nlr.gov` is not a known NREL/gov host; the
  AFDC Alternative Fuel Stations API is `developer.nrel.gov`. Related:
  `nlr-alt-fuel-stations.ts`, its test (`:75`), `packages/shared/src/
  runtime-config.ts:651-678`. Suggested fix: confirm against NREL developer docs;
  if wrong, correct host/path + key/flag names + the host-pinning test. **[needs
  verification]** (no DNS/network in this read-only audit). Dependencies: NREL key
  signup. Complexity: low. Risk of change: low (off by default).
- [ ] **external-data-integrations-06 — Alert on integration error spikes.**
  Severity: Low. Reason: silent degradation today. Related:
  `integration-telemetry.ts` + admin Insights. Suggested fix: cron/admin check on
  per-source daily error ratio. Dependencies: admin DB read (exists). Complexity:
  med. Risk: low.
- [ ] **external-data-integrations-03 — Guardrails for key-in-URL libs.**
  Severity: Low. Reason: prevent future key leakage via logs. Related: AirNow/
  OpenEI/NLR/Census libs. Suggested fix: log-scrub rule + test that `reason` never
  contains the key. Dependencies: none. Complexity: low. Risk: low.
- [ ] **external-data-integrations-02 — Add SSRF negative tests.**
  Severity: Low. Reason: lock in the allowlist/origin-pin invariants. Related:
  `nws-weather.ts`, `fcc-isp.ts`. Suggested fix: unit tests rejecting
  non-weather.gov / non-http(s) bases. Dependencies: none. Complexity: low. Risk:
  none.
- [ ] **external-data-integrations-07 — Test `community-popularity.ts`.**
  Severity: Low. Reason: privacy threshold + scaling are untested. Suggested fix:
  unit test threshold/scaling/cache/failure. Dependencies: none. Complexity: low.
  Risk: none.
- [ ] **external-data-integrations-05 — Consider shared/durable cache for
  serviceability+NHTSA.** Severity: Low. Reason: cross-instance call amplification.
  Suggested fix: layer the durable cache the libs already anticipate. Dependencies:
  shared cache backend. Complexity: med. Risk: low.
- [ ] **external-data-integrations-08 — Optional `fetchJson`/cache extraction.**
  Severity: Info. Complexity: med. Risk: med (touches every lib) — defer unless a
  cross-cutting change is needed.

---

### Appendix: verification notes
- Wiring confirmed by grep for each `lookup*`/`getCommunityPopularity` symbol
  across `apps/` and `packages/` (callers listed in §2–§3).
- `developer.nlr.gov` confirmed consistent across source, test, and runtime-config
  — i.e. a systemic naming choice, not a one-off typo; correctness still
  **[needs verification]** against live NREL docs (out of scope for a read-only,
  no-network audit).
- Dossier route confirmed to strip lib `reason`/`source` to a contract shape
  before responding (`dossier/route.ts:424` comment + section mappers); only
  `status` is forwarded.
