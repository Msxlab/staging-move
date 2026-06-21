# Step 1 — Cost / Abuse Guardrails · Implementation Spec (diff plan)

Status: **CODED + VERIFIED + COMMITTED** on branch `claude/fervent-wozniak-3e9bd6`. Decisions locked (mustafa): PRO caps stay 25/1000 · maxCustomProviders(PRO)=1000 · dossier daily backstop 50/user (DEFERRED — see Progress) · **durable per-section geo cache (option a)** · global circuit-breaker included (minimal).
Verification: full web suite + typechecks green in-worktree (node_modules + generated Prisma client present).

This step is independent of the `CONSUMER_FREE` flag — it protects today and the free world. Three changes.

---

## Progress
- ✅ **PR1a (Change 1) — coded** on branch `claude/fervent-wozniak-3e9bd6` (plan-limits.ts + plan-limits.test.ts). Type-safe; CI/typecheck pending (no node_modules in worktree). Not yet committed/pushed.
- ✅ **PR1b (Change 2) — DONE:** `AddressDataCacheEntry` model + migration (`20260620120000`, committed in the audit pass) + `apps/web/src/lib/address-data-cache.ts` (`getOrFetchSection`) + tests; the dossier route is fully wired through the cache across all sections. (The model's migration was the audit P0-1 fix.)
- ✅ **PR1c (Change 3) — DONE:** `apps/web/src/lib/global-spend-guard.ts` (`checkGlobalBudget`, fails OPEN, opt-in cap, 1/day alert) + tests. AI breaker wired into `onboarding/briefing/route.ts`; the **dossier breaker is wired across all 3 build paths** (summary/preview/full). The per-user/day **50-cap backstop (§2.6) is DEFERRED** — not retrofitted into the ~800-line route; global fuse + 60/min + durable cache bound cost (see [AUDIT-FIXES](AUDIT-FIXES.md)).

## Change 1 — Custom-provider per-owner abuse cap
**Why:** [plan-limits.ts:380-402](apps/web/src/lib/plan-limits.ts) `canCreateCustomProvider` active path returns `{allowed:true}` with **no count check** → one account can create unbounded rows.

**Files & edits**
1. `apps/web/src/lib/plan-limits.ts`
   - Extend `PLAN_LIMITS` type + rows with `maxCustomProviders`: FREE_TRIAL 25 · INDIVIDUAL 100 · FAMILY 300 · **PRO 1000**.
   - Extend the `UserPlan.limits` type (and wherever `limits` is built in `getUserPlan`) to carry `maxCustomProviders`.
   - In `canCreateCustomProvider`, replace the final `return { allowed: true }` (line 401) with a count check:
     ```ts
     const count = await prisma.userCustomProvider.count({ where: { userId, deletedAt: null } });
     if (count >= userPlan.limits.maxCustomProviders) {
       return { allowed: false, code: "CUSTOM_PROVIDER_LIMIT_REACHED",
         reason: `You've reached the maximum of ${userPlan.limits.maxCustomProviders} custom providers.`,
         current: count, limit: userPlan.limits.maxCustomProviders };
       // NOTE: finite value (no UNLIMITED sentinel) → safe to interpolate. NOT upgradeRequired (free product).
     }
     return { allowed: true };
     ```
   - Reuse the existing `CUSTOM_PROVIDER_LIMIT_REACHED` mapping already handled by the route ([custom-providers/route.ts:125](apps/web/src/app/api/custom-providers/route.ts)).
2. (mobile) confirm the custom-providers screen renders `CUSTOM_PROVIDER_LIMIT_REACHED` as a neutral "limit reached / contact support" message, **not** an "Upgrade" CTA (server-authoritative). No mobile cap mirror needed.

**Tests:** under cap → allowed; at cap → `CUSTOM_PROVIDER_LIMIT_REACHED` with finite `limit`; soft-deleted rows don't count.

---

## Change 2 — Durable, geo/address-scoped, per-section dossier cache (the real cost fix)
**Why:** today the dossier cache is an in-process `Map` ([dossier/route.ts:68](apps/web/src/app/api/addresses/[id]/dossier/route.ts)), **per-user**, **10–15 min TTL on the whole blob** → evaporates on deploy, re-fetched per user, and static federal data is re-pulled every 10 min. Goal (owner): fetch each data point **once**, serve from cache, re-fetch a section only if it's stale **or last time returned no real data**.

### 2.1 New durable model
`packages/db/prisma/schema.prisma` — add:
```prisma
model AddressDataCacheEntry {
  id         String   @id @default(cuid())
  geoKey     String   // section + rounded geo cell (+ date for weather), see 2.2
  section    String   // FLOOD|SCHOOL|WEATHER|HAZARDS|RADON|WATER|AIR|HOUSING|EV|NEIGHBORHOOD
  dataJson   String   @db.Text
  status     String   // REAL | DEGRADED | EMPTY
  fetchedAt  DateTime @default(now())
  expiresAt  DateTime
  @@unique([geoKey])
  @@index([section, expiresAt])
}
```
**Privacy:** these are **area facts** (flood zone, school district, AQI, FMR…), NOT user PII → safe to share across users and across nearby addresses. (Per-user dossier *assembly* stays per request; only the external-data sections are shared.)

### 2.2 Geo-cell keying (maximizes hit rate / minimizes cost)
- Most sections depend on **location, not the exact unit** → key by **rounded coordinates** (e.g. lat/lng to ~4–5 decimals, or a coarser cell for county-level data) so two units in one building, and two users, share one fetch.
- `geoKey = section + ":" + roundedLat + "," + roundedLng` (+ `:" + forecastDate` for WEATHER).
- School/flood can use the same cell; weather/AQI add the date/hour dimension via TTL.

### 2.3 Helper
`apps/web/src/lib/address-data-cache.ts` (new):
```ts
getOrFetchSection<T>(opts: {
  section: Section; lat: number; lng: number; date?: string;
  ttlMs: number; fetcher: () => Promise<{ data: T; status: "REAL"|"DEGRADED"|"EMPTY" }>;
}): Promise<{ data: T; cache: "HIT"|"MISS"|"RETRY" }>
```
Logic: read by `geoKey`; **HIT** if not expired AND `status==="REAL"`; otherwise call `fetcher` (**RETRY** if a stale/DEGRADED/EMPTY row existed, **MISS** if none), upsert with the section's TTL. → "gerçek veri yoksa tekrar dene; varsa cache'ten ver."

### 2.4 Per-section TTL map
| Section | Source | TTL |
|---|---|---|
| FLOOD (FEMA), SCHOOL (NCES), RADON (EPA), HAZARDS (FEMA NRI), HOUSING/FMR (HUD), NEIGHBORHOOD (ACS), EV | static federal/area | **long: 60–90 days** |
| WATER (EPA SDWIS) | semi-static | **30 days** |
| WEATHER (NWS) | volatile | **until forecast date / ~3–6 h** |
| AIR/AQI (AirNow) | volatile | **~1–3 h** |

### 2.5 Dossier route refactor
- Replace per-blob external fetches with `getOrFetchSection(...)` per section (each external lib: census-acs, airnow, nws-weather, fcc-isp, electric-utility, FEMA/EPA helpers).
- Keep a **thin** request-level response cache (assembled payload) but the durable section cache is the cost saver; lower the in-memory blob TTL's role to "same-request coalescing."
- HTTP `Cache-Control`: keep a modest `private, max-age` on the **full** payload only; under the free pivot the dossier is non-gated so this is fine. (Gated-payload `no-store` handling = Step 2 / report 16 H7.)

### 2.6 Daily backstop cap (thin)
- Keep/raise the existing per-user request limit and add a **per-user/day** gate of **50** on the route as a backstop (cache serves most reads, so this rarely bites). Only count toward the budget on **cache MISS/RETRY** (actual external work), not on HITs.

### 2.7 Route wiring recipe (apply where `prisma generate` + typecheck run)
In `apps/web/src/app/api/addresses/[id]/dossier/route.ts`, the full-dossier branch fetches every section in one `Promise.allSettled([...])` (~line 743) then maps each settled result via `floodSection(settled)` / `schoolSection(settled)` / … (each yields a `.status` like `"ok"`).
1. Wrap each `lookupX(...)` in `getOrFetchSection({ section, lat, lng, [date], fetcher })`. The `fetcher` runs the lookup and classifies status from the SAME success signal the existing `xSection` mapper uses for `status:"ok"` (flood zone present, school districtName present, air aqi/category present, …): `REAL` if real data, `EMPTY` if null, else `DEGRADED`.
2. Keep `Promise.allSettled` over the `getOrFetchSection(...)` promises; pass each `res.data` to the existing `xSection` mapper as `{ status:"fulfilled", value: res.data }` (minimal mapper change), so downstream assembly + telemetry stay identical.
3. WEATHER: pass `date: weatherTargetDate`; skip caching when there is no window (unchanged behavior).
4. WATER (city/state) & HOUSING (zip/state) don't key off coords → extend `buildGeoKey` to accept a string cell, e.g. `WATER:<state>:<city>`, `HOUSING:<state>:<zip>` (or skip caching these two — low volume).
5. Apply the same wrap to the Pro neighborhood `Promise.allSettled` (census/walk/schools) → `NEIGHBORHOOD`.
6. Keep the in-memory `dossierCache` blob as a thin same-request layer (or drop); the durable section cache is the real cost saver.
7. Daily backstop: add `rateLimit("address:dossier:daily", { limit: 50, windowSeconds: 86400 })` counted only when a section actually fetched (`res.cache` is MISS/RETRY), not on HIT.
8. **Dossier circuit-breaker** (PR1c tail): before the `Promise.allSettled` lookups, `const b = await checkGlobalBudget("dossier"); if (!b.allowed) { /* skip upstream: serve cached blob if present, else all-sections "unavailable" — no external calls */ }`. Mirrors the AI breaker already wired in the briefing route.
9. Migration: `prisma migrate dev` (then `deploy` in CI) + `prisma generate`.

**Tests:** 2nd user at same geo cell → external fetcher NOT called (HIT); static section not re-fetched within its long TTL; volatile section refreshes after short TTL; DEGRADED/EMPTY section retried next request. (Helper unit tests in `address-data-cache.test.ts`.) NOTE: the "daily backstop 429 after 50 misses" / "HIT does not consume the daily budget" tests are NOT implemented — the §2.6 per-user/day backstop was deferred (see [AUDIT-FIXES](AUDIT-FIXES.md)).

---

## Change 3 — Global spend circuit-breaker (the "fuse")
**Plain meaning:** a daily budget for the whole app on paid external calls (Anthropic AI + dossier external lookups + maps). A counter sums all users; if the day's total crosses your threshold, those features auto-degrade to **cached/basic** for the rest of the day and you get an alert — so a spike/abuse can't run up the bill.

**Files & edits**
- `RuntimeConfig` keys (read via `getRuntimeConfigValue`): `AI_DAILY_GLOBAL_CAP`, `DOSSIER_DAILY_GLOBAL_CAP` (+ optional `MAPS_DAILY_GLOBAL_CAP`).
- A small global counter per UTC day (reuse the Upstash rate-limiter as a counter keyed `global:ai:<day>` / `global:dossier:<day>`, or a `RuntimeConfig`/table counter).
- Degrade points:
  - AI briefing ([briefing/route.ts](apps/web/src/app/api/onboarding/briefing/route.ts)): over cap → serve rule-based/cached briefing (the path already exists for the per-user cap).
  - Dossier: over cap → serve cache-only (skip external fetch; return cached/partial).
- Alert: emit once per breach via `logger` + `security-events` (existing). Optional admin surface later.
- Default: caps unset → no global cap (opt-in), so this can't accidentally throttle before you set numbers.

**Tests:** at/over the global cap, AI returns rule-based and dossier serves cache-only; under cap, normal; breach emits exactly one alert/day.

---

## Not changed (already adequate)
AI per-user/day cap (3/day, Upstash global — [briefing/route.ts:355](apps/web/src/app/api/onboarding/briefing/route.ts)) · per-request rate-limit matrix ([rate-limit-policy.ts](apps/web/src/lib/rate-limit-policy.ts)) · signup friction (`auth_register` + email verify) · address/service ceiling = PRO 25/1000 (Step 2 must return PRO limits, **not** UNLIMITED).

## PR slicing
- **PR1a:** Change 1 (custom-provider cap) — small, isolated.
- **PR1b:** Change 2 (durable section cache) — schema migration + helper + dossier refactor.
- **PR1c:** Change 3 (circuit-breaker) — RuntimeConfig + counters + degrade + alert.
All behind no user-visible flag (pure backend safety); verify in CI.

## Open (none blocking) 
Geo-cell rounding precision (start ~4 decimals; tune by section) and exact long-TTL days (60 vs 90) — pick during PR1b.
