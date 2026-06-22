# Module Audit: Addresses & Address Validation

> Read-only audit. Evidence cited from source as `relative/path.ts:line`. Items that could not be confirmed from code are marked **[needs verification]**.

## 1. Module Summary

The Addresses & Address Validation module covers four cooperating concerns:

1. **Address autocomplete** — Google Places (New) backed type-ahead. Server lib `apps/web/src/lib/address-autocomplete.ts` holds the Google key and proxies search + details. Routes `apps/web/src/app/api/address-autocomplete/route.ts` and `.../details/route.ts` are the public-facing edges, gated by `requireDbUserId()` and `enforcePlacesCostControls`. Shared wire types + session-token + selection-conflict helpers live in `packages/shared/src/address-autocomplete.ts` (re-exported via `apps/web/src/lib/shared-address-autocomplete.ts`). UI: `apps/web/src/components/address/address-autocomplete-input.tsx`; mobile mirror in `apps/mobile/src/components/address/address-autocomplete-field.tsx`.
2. **Address CRUD** — `apps/web/src/app/api/addresses/route.ts` (list/create) and `.../addresses/[id]/route.ts` (get/patch/delete), validated by `addressSchema` in `apps/web/src/lib/validators.ts`, workspace-scoped via `lib/workspace-data-scope`, `formattedAddress` encrypted at rest.
3. **Coordinate fallback geocoding** — `apps/web/src/lib/census-geocoder.ts` geocodes manually-typed addresses via the keyless US Census geocoder (fail-open), invoked from create/patch and the `cron/backfill-address-coords` sweep. `packages/db/src/zip-centroid.ts` resolves ZIP→centroid from an embedded gazetteer.
4. **USPS Tier-2 validation** — `apps/web/src/lib/usps-address-validation.ts` orchestrates the USPS Addresses 3.0 standardization call (pure URL builder/parser in `packages/connectors/src/usps/request.ts`, token mint in `packages/connectors/src/core/oauth.ts`). Exposed at `apps/web/src/app/api/addresses/validate/route.ts`, entitlement- + feature-flag gated, always fail-open. `apps/web/src/lib/moving-address-validation.ts` enforces 2-letter origin/destination state codes for move-task generation.

Overall the module is defensively engineered: every external lookup fails open, coordinates are never overwritten, and PII is never logged. The notable gaps are around **rate-limit keying granularity on autocomplete cost controls**, **cache-key collisions in the durable area cache when callers pass differing data under the same geo cell**, **a config inconsistency in `enforcePlacesCostControls` reading `process.env` directly**, and **missing test coverage for the USPS validation path**.

## 2. Related Files

| File | Role |
|------|------|
| `apps/web/src/lib/address-autocomplete.ts` | Google Places search/details; holds `GOOGLE_MAPS_API_KEY` |
| `apps/web/src/lib/address-autocomplete-selection.ts` | Thin wrapper over shared selection-conflict formatter |
| `apps/web/src/lib/shared-address-autocomplete.ts` | Re-export barrel from `packages/shared` |
| `apps/web/src/lib/address-data-cache.ts` | Durable, geo-keyed dossier section cache |
| `apps/web/src/lib/census-geocoder.ts` | Keyless Census geocode fallback + in-proc LRU |
| `apps/web/src/lib/usps-address-validation.ts` | USPS Tier-2 orchestrator; holds USPS creds/token |
| `apps/web/src/lib/moving-address-validation.ts` | Origin/destination state validation |
| `apps/web/src/lib/validators.ts` | `addressSchema` (zod) |
| `packages/shared/src/address-validation.ts` | USPS wire types + `ADDRESS_VALIDATION_UNAVAILABLE` |
| `packages/shared/src/address-autocomplete.ts` | Autocomplete wire types, session token, selection conflict |
| `packages/connectors/src/usps/request.ts` | Pure USPS validate URL builder + response parser |
| `packages/connectors/src/core/oauth.ts` | `buildClientCredentialsBody` for USPS token |
| `packages/db/src/zip-centroid.ts` | ZIP→centroid lookup from embedded ZCTA data |
| `apps/web/src/app/api/address-autocomplete/route.ts` | Search edge |
| `apps/web/src/app/api/address-autocomplete/details/route.ts` | Details edge |
| `apps/web/src/app/api/address-autocomplete/cost-controls.ts` | Per-minute + per-day caps |
| `apps/web/src/app/api/addresses/route.ts` | List/create |
| `apps/web/src/app/api/addresses/[id]/route.ts` | Get/patch/delete |
| `apps/web/src/app/api/addresses/validate/route.ts` | USPS validate edge |
| `apps/web/src/app/api/addresses/[id]/dossier/route.ts` | Dossier aggregation (cache consumer) |
| `apps/web/src/app/api/cron/backfill-address-coords/route.ts` | Coordinate backfill sweep |
| `apps/web/src/components/address/address-autocomplete-input.tsx` | Web UI combobox |
| `apps/mobile/src/lib/address-autocomplete.ts` / `.../components/address/address-autocomplete-field.tsx` | Mobile client |

Tests present: `address-autocomplete.test.ts`, `census-geocoder.test.ts`, `address-data-cache.test.ts`, `moving-address-validation.test.ts`, `zip-centroid.test.ts`, `address-autocomplete/route.test.ts`, `address-autocomplete/details/route.test.ts`, `addresses/route.test.ts`, `packages/shared/src/__tests__/address-autocomplete.test.ts`, `packages/connectors/src/usps/usps.test.ts`.

## 3. Related Routes / Screens

- Web pages: `app/(app)/addresses/new/page.tsx`, `app/(app)/addresses/[id]/edit/page.tsx`, `app/(app)/moving/new/page.tsx`, `app/onboarding/onboarding-client.tsx` (all consume `AddressAutocompleteInput`).
- Mobile screens: `app/addresses/new.tsx`, `app/addresses/[id]/edit.tsx`, `app/moving/new.tsx`, `app/onboarding.tsx`.

## 4. Related APIs

- `GET|POST /api/address-autocomplete` (search)
- `GET|POST /api/address-autocomplete/details` (resolve placeId)
- `GET /api/addresses` (list), `POST /api/addresses` (create)
- `GET|PATCH|DELETE /api/addresses/[id]`
- `POST /api/addresses/validate` (USPS Tier-2)
- `GET /api/addresses/[id]/dossier` and `.../dossier/pdf` (area cache consumers)
- `GET|POST /api/cron/backfill-address-coords` (cron-guarded)

## 5. Related Components

- `AddressAutocompleteInput` (web, `components/address/address-autocomplete-input.tsx`) — combobox with debounce, keyboard nav, ARIA listbox.
- `AddressAutocompleteField` (mobile).
- Form pages above own the address form fields; autocomplete only fills street/city/state/zip/coords + metadata.

## 6. Related State / Hooks / Stores

- `AddressAutocompleteInput` local state: `predictions`, `loading`, `open`, `enabled`, `activeIndex`; refs `sessionTokenRef`, `skipNextQueryRef`.
- `createAddressAutocompleteSessionToken()` issues a client-side billing session token (`packages/shared/src/address-autocomplete.ts:57`).
- `applyAddressAutocompleteResult` / `clearAddressAutocompleteMetadata` mutate form field objects on select/manual edit.
- Server in-process caches: `census-geocoder.ts` Map LRU (`MAX_CACHE_ENTRIES=500`); USPS token cache `cachedToken`/`inflight` (single-flight); dossier `dossierCache` Map; durable `AddressDataCacheEntry` via Prisma.

## 7. Related Database / Models

- `Address` (consumed: `id, userId, workspaceId, type, nickname, street, street2, city, state, zip, country, isPrimary, ownership, startDate, endDate, formattedAddress (encrypted), placeId, latitude, longitude, deletedAt, createdAt, updatedAt`).
- `AddressDataCacheEntry` (`geoKey` unique, `section`, `status`, `dataJson`, `fetchedAt`, `expiresAt`) — referenced by `address-data-cache.ts:125-148`. **[needs verification]** that the Prisma model exists and is migrated (the file header at `address-data-cache.ts:24-25` notes it was added in the same change).
- `RuntimeConfigEntry` (Google/USPS keys), `MovingPlan` (weather window), `Service`/`Budget` (cascade on address delete).

## 8. Impact Map

- **UI**: Address forms (new/edit), onboarding, moving plan creation. Autocomplete dropdown, "Powered by Google" attribution, manual-entry fallback messaging.
- **API**: Autocomplete edges, address CRUD, USPS validate, dossier (reads address coords).
- **DB**: `Address` writes (encrypted formattedAddress, coords), `AddressDataCacheEntry` upserts, cascade soft-deletes to `Service`/`Budget`.
- **Auth**: `requireDbUserId` / `requireAppMutationUser` on every edge; workspace scope assertions for CRUD; entitlement gate on USPS validate + dossier.
- **Admin**: USPS connector test at `apps/admin/.../connectors/test-connection/route.ts` (out of scope but shares the builder).
- **Mobile**: parallel autocomplete client + screens; same API contract.
- **Notifications**: none directly.
- **Integrations**: Google Places, US Census geocoder, USPS Addresses 3.0; coords feed FCC/FEMA/NCES/NWS/EPA dossier lookups.
- **Analytics**: `recordIntegrationOutcome(s)` in dossier route; `console.warn` markers in cost-controls and census-geocoder.
- **SEO**: address pages are noindex (`middleware.ts:647`).
- **Tests**: see §17.

## 9. Buttons / Actions / Functions

**`AddressAutocompleteInput` — typing (search)** (`address-autocomplete-input.tsx:58-108`)
- Used in: all address forms. Expected: debounce 250ms, fetch `/api/address-autocomplete`, show predictions. Actual: matches. Loading: `loading` spinner. Disabled: `disabled` prop. Error: on non-AbortError, clears predictions + closes (silent — no user-facing error message). Success: dropdown opens. Permission: server `requireDbUserId`. Edge cases: `<3` chars short-circuits; `enabled=false` hides; AbortController cancels in-flight on each keystroke. Gap: a server `enabled:false` (key missing/cost cap) silently degrades to "continue manually" — acceptable, but the **429 daily-cap message body is never surfaced** (the input only reads `data.predictions`/`data.enabled`, see §10 UX-2).

**`handleSelect(prediction)`** (`address-autocomplete-input.tsx:122-154`)
- Fetches `/details`, runs `validateSelection` (state/ZIP conflict), calls `onSelect`, rotates session token. Loading: yes. Error: `try/finally` only resets loading — a failed details fetch throws but is **swallowed by the absent catch** (the `finally` runs, the promise rejects unhandled via `void handleSelect`). Success: form filled. Edge: `data.result` null → returns silently. Rejection: `onSelectionRejected` callback. (See §10 UX-3.)

**`handleKeyDown`** (`:156-180`) — Arrow/Enter/Escape nav. Correct, guarded on `predictions.length`.

**`searchAddressAutocomplete` (server)** (`address-autocomplete.ts:147`) — sanitizes query (trim, slice 200), enforces `<3` skip, posts to Places, maps predictions. Fail: throws on non-config errors (route catches). No suggestion leakage.

**`lookupAddressAutocomplete` (server)** (`address-autocomplete.ts:201`) — normalizes placeId, fetches details, normalizes components. Returns `{enabled,result}`.

**`validateAddressWithUsps`** (`usps-address-validation.ts:119`) — feature/creds/token/validate, always resolves, never throws. Statuses VALIDATED/CORRECTED/NO_MATCH/UNAVAILABLE.

**`geocodeFallbackForPersist`** (`census-geocoder.ts:210`) — runs only when both coords null + street/city/state present; never overwrites; fail-open; logs status only.

**`validateMovingAddressStates`** (`moving-address-validation.ts:19`) — both states must match `/^[A-Z]{2}$/`; returns typed field-targeted errors.

**Create / Update / Delete address** (`addresses/route.ts:68`, `[id]/route.ts:89,208`) — rate-limited (create 20/min), plan-limit gated, transactional primary-demotion, encrypt formattedAddress, geocode fallback, audit log, move-task sync, partner auto-sync (entitlement-gated). Permission checks present (`assertWorkspaceAction`/`assertScopedRecordAction`).

## 10. UI/UX Audit

- **UX-1 (Low)** — Search errors are fully silent. Evidence: `address-autocomplete-input.tsx:94-98` clears predictions and closes the dropdown on any non-abort error with no message. Impact: a transient `/api/address-autocomplete` 500 looks identical to "no results"; the user has no signal to retry. Recommendation: surface a subtle inline "Suggestions temporarily unavailable" hint distinct from the empty-results state. Priority: Low.
- **UX-2 (Low)** — Daily-cap 429 body (`PLACES_DAILY_CAP_REACHED`, with a helpful "Enter the address manually or try again tomorrow" message at `cost-controls.ts:78`) is never shown. Evidence: the input checks `response.ok` then reads only `predictions`/`enabled` (`:87-93`); on a 429 it throws and falls into the silent catch. Impact: the carefully-worded cost-cap guidance is dead copy on the web. Recommendation: read the 429 code and show its message. Priority: Low.
- **UX-3 (Medium)** — `handleSelect` has no `catch`. Evidence: `address-autocomplete-input.tsx:122-154` uses `try { … } finally { setLoading(false) }`; a thrown details fetch (network/5xx) rejects the promise (invoked via `void handleSelect(...)` at `:171,226`) with no user feedback — the spinner stops and nothing fills. Impact: selecting a suggestion can silently no-op on a flaky network. Recommendation: add a `catch` that surfaces a retry hint and keeps the dropdown open. Priority: Medium.
- **UX-4 (Info)** — "Powered by Google" wrapper uses a hardcoded `bg-white` (`:233`) inside an otherwise `bg-popover` dropdown; in dark theme the attribution strip is a white band. Acceptable per Google branding (logo asset is the on-white variant) but visually jarring in dark mode. Priority: Info.
- **UX-5 (Info)** — Combobox a11y is solid (`role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`, `role="listbox"/"option"`, `aria-selected`). Mouse `onMouseDown preventDefault` correctly avoids blur-before-click. No finding; noted as a positive.

## 11. Logic Audit

- **Expected flow**: type → debounce → search → pick → details → conflict check → fill form + coords → save → (server geocode fallback if coords null) → encrypt → persist.
- **L-1 (Medium) — Durable area cache trusts the FIRST caller's data shape for a geo cell.** `address-data-cache.ts:78-86,117-151` keys purely on `section + rounded(lat,lng) [+ date]` and stores `JSON.stringify(fetcher data)`. The cache is explicitly "shared across users and nearby addresses". Because `GEO_DECIMALS=4` (~11m), two distinct addresses can resolve to the same cell. For genuinely area-scoped facts (flood/school/etc.) that is the intended design. But the cache does **not** validate that the cached `dataJson` matches the caller's expected `section` type, and `getOrFetchSection` returns `JSON.parse(existing.dataJson) as T` with an unchecked cast (`:128,137`). If any caller ever reuses a `DossierSection` enum value for a different payload shape, stale/poisoned cross-shape data is served. Today all callers map section→shape consistently (`dossier/route.ts:819-852`), so this is latent, not active. Impact: future-proofing / correctness risk. Recommendation: store a small shape/version tag in the row and discard on mismatch. Priority: Medium. **[needs verification]** that no two sections share an enum string.
- **L-2 (Medium) — Census geocoder process-cache key omits the benchmark and is shared across all tenants.** `census-geocoder.ts:96-103` keys on normalized street|city|state|zip only. Since the geocode is a pure function of the address and the benchmark is constant, this is correct AND non-PII-keyed by address string — but it means the cache holds **raw user-entered address strings in process memory** for the process lifetime (up to 500 entries). That is PII-in-memory (acceptable, not logged), but a `no_match` for a typo'd address is cached and reused, so a later corrected save of the "same" typo never re-geocodes within the process. Minor. Recommendation: fine as-is; document the PII-in-memory property. Priority: Low.
- **L-3 (Low) — `differs()` compares ZIP on first 5 only.** `usps-address-validation.ts:104-113` normalizes and slices ZIP to 5 for the changed-check, so a USPS-returned ZIP+4 that only adds the +4 is reported as `VALIDATED` (not `CORRECTED`). Intentional and reasonable, but the +4 is still returned in `suggestion.zipPlus4` while `changed=false`, so a UI that only re-prompts on `changed` won't offer the +4. Priority: Low (by design).
- **L-4 (Info) — Selection conflict only checks state and ZIP, not city/street.** `packages/shared/src/address-autocomplete.ts:96-125`. A suggestion in the right state+ZIP but a different city silently overwrites the typed city. Acceptable (Places is authoritative once a suggestion is chosen). Info.
- **L-5 (Reliability/Logic) — `getOrFetchSection` stale fallback parses prior row even if it was never REAL.** `address-data-cache.ts:135-139`: on fetcher throw it serves `existing` regardless of `existing.status`. So a prior `DEGRADED`/`EMPTY` row is served as `STALE` on a later upstream failure. That can surface "no data" classified as a cache hit. Low impact (data is still null-shaped); noted.

## 12. Reverse Logic Audit

- **Unauthorized user**: autocomplete + validate + CRUD all call `requireDbUserId()`/`requireAppMutationUser()` → `UNAUTHORIZED` → 401 (autocomplete route maps it, `route.ts:45-47`); validate returns safe-unavailable on auth failure (`validate/route.ts:31-36`). Confirmed gated despite `/api/address-autocomplete` being in `PUBLIC_API_PREFIXES` (`middleware.ts:84`) — the handler enforces auth itself, so the middleware bypass is defense-in-depth only, not an auth hole.
- **Empty data**: predictions `[]` → dropdown stays closed; geocode `no_match` → null coords persisted; USPS `NO_MATCH` → no suggestion. All handled.
- **API error**: Places config error → `enabled:false` (route `:50-55`); generic → 500 with generic message; census/USPS fail-open. Good.
- **Slow network**: census 2.5s `AbortController` cap (`:55,160`), USPS token 8s + validate 6s `AbortSignal.timeout` (`:87,139`), Places `cache:no-store` but **no client/server timeout on Places fetch** — see SEC/REL note R-1.
- **Double-click**: create is rate-limited 20/min; autocomplete select rotates session token after success. A rapid double-select could fire two `/details` calls (no in-flight guard on `handleSelect`), each billed — minor cost, mitigated by daily cap.
- **Stale data**: dossier + area caches TTL-bounded; address `updatedAt` is part of dossier cache keys (`dossier/route.ts:511`).
- **Direct route access**: `/api/addresses/[id]` foreign-scope IDs 404 (not 403), preventing enumeration (`[id]/route.ts:61`, `dossier/route.ts:499-500`).
- **Mobile viewport / dark theme**: covered by shared component; dark-theme attribution strip noted (UX-4).
- **Role change / token expiry**: each request re-resolves session + scope; CHILD role gets reduced visibility on GET (`[id]/route.ts:47-54,66-71`).

## 13. Security Audit

### SEC-1 (Medium) — Autocomplete per-minute rate limit is IP-keyed, not user-keyed, enabling per-user cost-cap evasion / shared-NAT starvation
- **Severity**: Medium
- **Affected Area**: `apps/web/src/app/api/address-autocomplete/cost-controls.ts:46-52`
- **Evidence**: The per-minute limiter uses `getRateLimitKey(request, 'places:${kind}')` with **no `identity.userId`** passed, so it falls back to the IP-keyed form (`rate-limit.ts:326-337`). Only the per-day caps are user-keyed (`cost-controls.ts:58-65`). The daily user cap (250) is the real spend ceiling.
- **Risk**: (a) An authenticated user rotating source IP (or spoofing forwarded-for where `TRUSTED_PROXY_HEADERS` permits) resets the 45/min budget, so the only durable ceiling is the 250/day user cap — but the *details* lookup (the billable Places "details" SKU) is also only capped at 45/min IP + 250/day user, so a single account can drive ~250 details calls/day regardless of IP. (b) Conversely, many legitimate users behind one corporate NAT share the 45/min IP bucket and can starve each other.
- **Defensive Abuse Scenario (high-level)**: A logged-in attacker scripts the details endpoint to maximize Google Places "Place Details" billing up to the daily user cap, and uses IP rotation to defeat the minute throttle entirely; cost is bounded only by the per-user daily cap and the global Places enable flag.
- **Prevention**: Pass `{ userId }` to `getRateLimitKey` for the per-minute limiter (the helper already supports it), so the minute throttle is per-user; keep the IP daily cap as the anonymous-abuse backstop.
- **Detection**: `console.warn("[PLACES] daily cap reached", …)` fires on daily caps (`cost-controls.ts:69`); add a per-user minute-cap counter to surface burst abuse before the daily cap.
- **Analysis (root cause)**: the create route correctly threads `userId` into the key (`addresses/route.ts:75`), but the cost-controls minute limiter omitted it.
- **Recommendation**: user-key the minute limiter; consider lowering the per-user daily details cap.
- **Tests To Add**: a test asserting two requests from the same user but different IPs share the minute counter.

### SEC-2 (Low) — `enforcePlacesCostControls` reads daily-limit overrides from `process.env` directly, diverging from runtime-config used everywhere else
- **Severity**: Low
- **Affected Area**: `cost-controls.ts:27-30` (`readDailyLimit` → `process.env[key]`)
- **Evidence**: The enable flag uses `getRuntimeConfigValue("PLACES_AUTOCOMPLETE_ENABLED")` (`:37`), but the daily caps read `process.env[PLACES_*_DAILY_*_LIMIT]` directly, bypassing the DB-backed runtime config + decryption path (`runtime-config.ts:28`).
- **Risk**: An operator who tunes the daily caps via the runtime-config admin (as they do for the enable flag and the Google key) will see no effect; the caps silently stay at the 250/1000 fallbacks. Not a breach, but a control that appears configurable and isn't.
- **Prevention/Recommendation**: read the limits via `getRuntimeConfigValue` for consistency, or document that these are env-only.
- **Detection**: n/a (config drift).
- **Tests To Add**: assert override is honored from the same source as the enable flag.

### SEC-3 (Low) — Google Places API key is sent on every server call; no host pinning on outbound Places fetch (low SSRF surface, key exposure on egress)
- **Severity**: Low
- **Affected Area**: `address-autocomplete.ts:172-181,219-225`
- **Evidence**: The Places URLs are **hardcoded constants** (`GOOGLE_PLACES_AUTOCOMPLETE_URL`, `GOOGLE_PLACES_DETAILS_BASE_URL`), placeId is `encodeURIComponent`-escaped and stripped of a leading `places/` (`:114-116,212`), and the session token is sanitized to `[a-zA-Z0-9._-]{<=120}` (`:77-81`). So there is **no user-controlled host** → no SSRF. The key travels in `X-Goog-Api-Key` to a fixed Google host. This is the correct pattern; flagged only to confirm the SSRF check passed and that the key must remain server-side (it is — UI never sees it).
- **Risk**: none beyond standard egress; included as a verified-clean note.
- **Recommendation**: none required. Keep the URLs constant.

### SEC-4 (Low) — USPS validate route is the only address edge that returns success on auth failure, which could mask a future auth regression
- **Severity**: Low / Info
- **Affected Area**: `addresses/validate/route.ts:31-36`
- **Evidence**: On `requireDbUserId()` throw the route returns `safe()` = HTTP 200 `ADDRESS_VALIDATION_UNAVAILABLE` rather than 401. This is intentional (validation must never block saving) and leaks nothing, but it means an unauthenticated caller cannot distinguish "you're logged out" from "feature off", and an accidental future removal of the entitlement check would not be caught by a 401-expecting test.
- **Risk**: low — the route only ever returns the standardized USPS suggestion, which requires the entitlement + USPS config to even run (`:49-52`). No data leak.
- **Recommendation**: keep fail-open, but add a test asserting that an unauthenticated/unentitled caller never receives a `suggestion` payload.

### SEC-5 (Info) — USPS token + creds are correctly server-only with HTTPS host allow-list
- **Affected Area**: `usps-address-validation.ts:44-59`
- **Evidence**: `resolveCreds` rejects any token URL whose protocol isn't `https:` or host isn't `apis.usps.com` (`:52-54`), creds come from runtime-config (`:25-31`), token is cached single-flight (`:69-101`), never logged. The COA/validate endpoints are also hardcoded constants (`packages/connectors/src/usps/request.ts:16,37`). No SSRF, no secret leak. Positive note.

### SEC-6 (Info) — PII handling: addresses encrypted at rest, never logged
- **Evidence**: `formattedAddress` is encrypted on write (`addresses/route.ts:101`, `[id]/route.ts:132`) and decrypted on read; census-geocoder logs **status only** ("never the address (PII)", `census-geocoder.ts:222-223`); cost-controls logs `userId`/`ip` but not the query. Autocomplete query is sliced to 200 chars and not logged. Positive note. One caveat: `cost-controls.ts:69-75` logs `userId` and `ip` together on cap hits — acceptable for abuse triage but is user-IP correlation in logs; ensure log retention policy covers it. **[needs verification]** of log retention.

## 14. Performance Audit

- **P-1 (Info)** — Autocomplete debounce 250ms client (`address-autocomplete-input.tsx:102`) + `<3` char skip + AbortController cancellation: good. No redundant calls.
- **P-2 (Low)** — `details` lookup has no client in-flight guard; rapid re-selects can double-fetch (cost). Mitigated by daily cap. Recommend disabling option buttons while `loading`.
- **P-3 (Info)** — Census geocoder + USPS token caches reduce upstream calls; dossier durable cache + global spend guard prevent N upstream calls per request. ZIP centroid memoized lazily once (~34k rows, `zip-centroid.ts:15-32`).
- **P-4 (Low)** — `GET /api/addresses` decrypts `formattedAddress` for every row in the page (`addresses/route.ts:50-53`); fine for paginated lists, but decrypt is per-row synchronous — keep page sizes bounded (pagination already applied).
- **P-5 (Info)** — No image/lazy concerns; the only image is the static Google attribution PNG.

## 15. Reliability Audit

- **R-1 (Medium) — No timeout on the Google Places server fetch.** `address-autocomplete.ts:172,219` call `fetch` with `cache:"no-store"` but **no `AbortSignal.timeout`**, unlike census (2.5s) and USPS (6–8s). A hung Places connection ties up the route handler until the platform/Node default. Impact: under a Places slowdown, autocomplete requests pile up (each holds a server invocation), and there is no client cancellation on the *server* side. Recommendation: add `AbortSignal.timeout(~4000)` to both Places fetches and treat timeout as `enabled:true, predictions:[]`. Priority: Medium.
- **R-2 (Info)** — Every external lookup is fail-open with explicit status unions; address writes never blocked by validation/geocode. Strong.
- **R-3 (Low)** — `getOrFetchSection` serves a prior row on fetcher throw regardless of its status (see L-5); and the durable cache `upsert` is not wrapped in the request's transaction, so a crash between fetch and upsert just re-fetches next time (acceptable).
- **R-4 (Info)** — Backfill cron is bounded (`BATCH_SIZE=25`), idempotent, cron-guarded (`backfill-address-coords/route.ts:34-43`), never overwrites coords. Good.
- **R-5 (Info)** — No error boundary specific to the autocomplete component; failures degrade to manual entry, which is an acceptable UX boundary.

## 16. Dead Code / Cleanup

- **DC-1 (Info)** — `address-autocomplete-selection.ts` is a one-function wrapper over the shared formatter (`getAddressAutocompleteSelectionError`). **[needs verification]** of callers; appears thin but may be used by form pages. Not removing-worthy without confirming usage.
- **DC-2 (Info)** — `zipCentroidCount()` (`packages/db/src/zip-centroid.ts:50`) is "for diagnostics/tests"; confirm it's referenced by a test before considering it dead. **[needs verification]**.
- No duplicate logic found between web and mobile autocomplete libs — they share `packages/shared` types and helpers correctly.

## 17. Tests

**Existing**: Google Places search/details mapping + config-error (`address-autocomplete.test.ts`); census geocode happy/no_match/error/cache/fallback (`census-geocoder.test.ts`); area cache HIT/MISS/RETRY/STALE (`address-data-cache.test.ts`); moving state validation (`moving-address-validation.test.ts`); ZIP centroid (`zip-centroid.test.ts`); autocomplete + details routes (`route.test.ts` x2); address create route (`addresses/route.test.ts`); shared autocomplete helpers (`packages/shared/__tests__`); USPS pure builder/parser (`packages/connectors/.../usps.test.ts`).

**Missing / critical gaps**:
- **No test for `usps-address-validation.ts`** (the orchestrator): token mint, host allow-list rejection, feature-off short-circuit, `differs()` CORRECTED vs VALIDATED, fail-open on USPS 5xx/timeout. **High value.**
- **No test for `POST /api/addresses/validate`** route: entitlement gate, config gate, auth-fail → safe payload, schema rejection → safe payload.
- No test asserting the per-minute cost-control limiter is/should-be user-keyed (SEC-1).
- No test that autocomplete `enabled:false` / 429 paths reach the UI gracefully.
- Suggested: unit (USPS orchestrator, host allow-list), integration (validate route gates), e2e (autocomplete pick → form fill → save with geocode fallback).

## 18. Findings Summary

| ID | Severity | Category | Finding | Impact | Recommendation | Files |
|----|----------|----------|---------|--------|----------------|-------|
| addresses-validation-01 | Medium | Security | Autocomplete per-minute cost limit is IP-keyed, not user-keyed | Per-user spend cap is only the daily cap; IP rotation defeats minute throttle; shared NAT starves users | Pass `{userId}` to `getRateLimitKey` for the minute limiter | `address-autocomplete/cost-controls.ts:46` |
| addresses-validation-02 | Medium | Reliability | No timeout on Google Places server fetch | Hung Places connection ties up route invocations under slowdown | Add `AbortSignal.timeout(~4s)` to both Places fetches | `lib/address-autocomplete.ts:172,219` |
| addresses-validation-03 | Medium | UI/UX | `handleSelect` has no catch; failed details fetch silently no-ops | Selecting a suggestion can do nothing on a flaky network, spinner just stops | Add catch with retry hint; keep dropdown open | `components/address/address-autocomplete-input.tsx:122` |
| addresses-validation-04 | Medium | Data | Durable area cache returns `JSON.parse(...) as T` with no shape/version guard | Latent cross-shape poisoning if a section enum is ever reused | Store + verify a shape/version tag per row | `lib/address-data-cache.ts:117` |
| addresses-validation-05 | Low | Security | Daily-cap overrides read from `process.env`, not runtime-config | Operator tuning via admin config silently no-ops | Read caps via `getRuntimeConfigValue` or document env-only | `address-autocomplete/cost-controls.ts:27` |
| addresses-validation-06 | Low | UI/UX | Search error + 429 cap message never surfaced to user | Helpful cost-cap copy is dead; transient errors look like "no results" | Distinguish error/cap from empty; show cap message | `components/address/address-autocomplete-input.tsx:87` |
| addresses-validation-07 | Low | Security | USPS validate fail-open returns 200 on auth failure | Masks auth regressions; no 401 test signal | Add test: unauth/unentitled never gets `suggestion` | `api/addresses/validate/route.ts:31` |
| addresses-validation-08 | Low | Performance | `details` lookup has no client in-flight guard | Rapid re-select double-bills | Disable option buttons while loading | `components/address/address-autocomplete-input.tsx:122` |
| addresses-validation-09 | Medium | Test | No tests for USPS orchestrator or `/api/addresses/validate` | Token mint, host allow-list, gates, fail-open unverified | Add unit + integration tests | `lib/usps-address-validation.ts`, `api/addresses/validate/route.ts` |
| addresses-validation-10 | Info | Security | PII/secrets handling verified clean (encrypted at rest, status-only logs, host allow-lists, no SSRF) | n/a (positive) | Keep URLs constant; confirm log retention covers userId+ip cap logs | `lib/usps-address-validation.ts:44`, `lib/census-geocoder.ts:222` |
| addresses-validation-11 | Low | Logic | `getOrFetchSection` serves prior row on throw regardless of REAL status | Degraded/empty prior data served as STALE hit | Gate stale fallback on prior `status==="REAL"` if stricter freshness wanted | `lib/address-data-cache.ts:135` |
| addresses-validation-12 | Info | Theme | Google attribution strip hardcoded `bg-white` in dark dropdown | White band in dark mode | Accept per branding or wrap in themed container | `components/address/address-autocomplete-input.tsx:233` |

## 19. Module TODO

- [ ] **addresses-validation-01 (Medium)** — User-key the autocomplete per-minute limiter. Reason: bound per-user Places spend and stop IP-rotation evasion. Files: `address-autocomplete/cost-controls.ts`. Fix: `getRateLimitKey(request, 'places:${kind}', { userId })`. Deps: none. Complexity: low. Risk: low.
- [ ] **addresses-validation-02 (Medium)** — Add `AbortSignal.timeout` to both Places server fetches. Reason: prevent hung connections under Places slowdown. Files: `lib/address-autocomplete.ts`. Fix: add `signal: AbortSignal.timeout(4000)`, map timeout to empty/enabled. Deps: none. Complexity: low. Risk: low.
- [ ] **addresses-validation-03 (Medium)** — Add error handling to `handleSelect`. Reason: avoid silent no-op on details failure. Files: `components/address/address-autocomplete-input.tsx`. Fix: wrap in try/catch, show hint, keep dropdown open. Deps: none. Complexity: low. Risk: low.
- [ ] **addresses-validation-04 (Medium)** — Tag durable cache rows with a shape/version and verify on read. Reason: prevent latent cross-shape cache poisoning. Files: `lib/address-data-cache.ts`. Fix: add `version` column or embed a discriminator in `dataJson`. Deps: Prisma migration **[needs verification]**. Complexity: med. Risk: med.
- [ ] **addresses-validation-09 (Medium)** — Add USPS orchestrator + validate-route tests. Reason: critical untested path. Files: `lib/usps-address-validation.ts`, `api/addresses/validate/route.ts`. Fix: unit (token/host/gates/fail-open) + integration. Deps: none. Complexity: med. Risk: low.
- [ ] **addresses-validation-05 (Low)** — Source daily caps from runtime-config. Files: `cost-controls.ts`. Complexity: low. Risk: low.
- [ ] **addresses-validation-06 (Low)** — Surface autocomplete error/cap states in UI. Files: `address-autocomplete-input.tsx`. Complexity: low. Risk: low.
- [ ] **addresses-validation-07 (Low)** — Add unauthenticated/unentitled assertion test for validate route. Files: `api/addresses/validate/route.ts`. Complexity: low. Risk: low.
- [ ] **addresses-validation-08 (Low)** — Disable suggestion buttons while loading. Files: `address-autocomplete-input.tsx`. Complexity: low. Risk: low.
- [ ] **addresses-validation-11 (Low)** — Optionally restrict stale fallback to prior REAL rows. Files: `lib/address-data-cache.ts`. Complexity: low. Risk: low.
- [ ] **addresses-validation-12 (Info)** — Theme the Google attribution strip for dark mode. Files: `address-autocomplete-input.tsx`. Complexity: low. Risk: low.
