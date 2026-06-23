# Adversarial Verification: external-data-integrations-01

**Finding:** EV-charging integration targets a likely-wrong upstream host (`developer.nlr.gov` vs NREL `developer.nrel.gov`)
**Original severity:** High
**Category:** Reliability
**Verdict:** confirmed (with one residual needs-verification caveat on live DNS)

## What the code shows

### 1. The host is hardcoded, systemic, and has no override
`apps/web/src/lib/nlr-alt-fuel-stations.ts:70`
```
const NLR_NEAREST_URL = "https://developer.nlr.gov/api/alt-fuel-stations/v1/nearest.json";
```
Used directly in the fetch at line 277:
```
const parsed = parseEvChargingPayload(await fetchJson(`${NLR_NEAREST_URL}?${params.toString()}`));
```
There is no env-var or runtime-config override for the base URL. The host is a literal constant.
The same `developer.nlr.gov` host also appears in the doc-source comment (`:9`) and the public `source.url`
exposed to users (`:61`, `:79`).

### 2. The path + query + response schema are unmistakably NREL's AFDC Alternative Fuel Stations API
- Path: `/api/alt-fuel-stations/v1/nearest.json` — the documented NREL AFDC nearest-stations endpoint.
- Query params (lines 267-276): `api_key`, `latitude`, `longitude`, `radius`, `fuel_type=ELEC`,
  `access=public`, `status=E`, `limit` — the documented NREL AFDC parameter set.
- Response fields parsed in `RawStation` (lines 184-197) and `parseEvChargingPayload` (lines 224-245):
  `fuel_stations`, `total_results`, `station_name`, `ev_network`, `ev_connector_types`,
  `ev_dc_fast_num`, `ev_level2_evse_num` — all the NREL AFDC response schema.

The integration is therefore unambiguously consuming NREL's AFDC product, whose canonical host is
`developer.nrel.gov`. "NLR" is a letter transposition of "NREL". `developer.nlr.gov` is not a known
NREL/government host.

### 3. The runtime-config keys carry the same wrong "NLR" naming
`packages/shared/src/runtime-config.ts:651-678` defines `NLR_ALT_FUEL_STATIONS_ENABLED` (off by default,
line 657-664) and `NLR_API_KEY`, both describing the "NLR Alternative Fuel Stations" / "NLR Developer
Network". Naming is consistent with the wrong host, confirming this is systemic, not a single typo.

### 4. The test entrenches the suspect host
`apps/web/src/lib/nlr-alt-fuel-stations.test.ts:75`
```
expect(url.origin + url.pathname).toBe("https://developer.nlr.gov/api/alt-fuel-stations/v1/nearest.json");
```
A green test locks in the wrong origin. `apps/web/src/app/api/addresses/[id]/dossier/route.test.ts:241`
likewise pins the `developer.nlr.gov` doc URL.

### 5. The break would be invisible (graceful degradation, off by default, no alerting)
`lookupEvCharging` (lines 247-292) catches every fetch failure — including a DNS/host-resolution failure —
and returns `degraded("error", ...)`. The flag is off by default (runtime-config line 657-664), so a
wrong host never surfaces as a visible error; the dossier EV-charging section simply never appears once an
owner enables the flag + key.

## Why not refuted
My task was to refute. The code substantiates every code-checkable element of the claim: the host is
systemically `developer.nlr.gov`, while the path, params, and response schema are unmistakably the NREL
AFDC product canonically served at `developer.nrel.gov`. There is no base-URL override, no middleware/
wrapper that rewrites the host, and the test pins the suspect origin. The claim is not a false positive.

## Residual caveat (does not change the verdict)
I cannot perform DNS/network resolution in this read-only audit, so "the lookup almost certainly fails host
resolution" is not 100% code-proven — it is a strong inference from the schema match plus the host not being
a known NREL host. This matches the original auditor's own `[needs verification]` framing. The defect (wrong/
non-canonical host hardcoded for an NREL product) is fully proven from source; only the precise live failure
mode carries the needs-verification flag.

## Severity assessment
Retain **High**. When enabled with a valid key, the entire EV-charging dossier enrichment is dead on arrival
and silently so. Configuration effort is wasted and the failure is unobservable. The systemic naming and the
test that locks in the host make accidental correction unlikely. Severity unchanged.
