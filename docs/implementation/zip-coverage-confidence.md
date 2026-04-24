# ZIP And Coverage Confidence Behavior

## Current Architecture

LocateFlow does not store a full table of every U.S. ZIP code today.

The current provider coverage system uses:

- A shared 3-digit ZIP-prefix-to-state map in `packages/shared/src/provider-coverage.ts`.
- Provider `states` and `zipCodes` JSON fields on `ServiceProvider`.
- Generated `ServiceProviderCoverage` rows with `state`, `zipPrefix`, and `zipExact`.
- Server-side provider APIs that query indexed coverage rows and then tier matches.
- Optional in-code coverage metadata for `state`, `zip_prefix`, `polygon`, and `live_address` models.

The ZIP-prefix map is not proof of service availability. It is only used to infer a likely state and normalize provider coverage rows. The app should treat ZIP and ZIP-prefix matches as confidence signals, not guarantees.

## Client Data Rule

Web and mobile clients should not download or keep all U.S. ZIP codes in memory.

Provider availability should be resolved server-side from:

1. Destination state.
2. Destination ZIP, when present.
3. `ServiceProviderCoverage` rows.
4. Coverage metadata when present.
5. Provider scope as a final broad fallback.

## Confidence Order

Coverage confidence uses the shared labels in `packages/shared/src/provider-move-domain.ts`.

Recommended ranking order:

1. `EXACT_ZIP`
2. `ZIP_PREFIX`
3. `MAPPED_SERVICE_AREA`
4. `STATE_LEVEL`
5. `NATIONAL_OR_FEDERAL`
6. `ADDRESS_CHECK_REQUIRED`
7. `UNKNOWN`

Exact ZIP and ZIP prefix improve ranking confidence, but neither should be presented as verified address-level service. Address-sensitive categories still need user-facing caveats.

## Provider Matching Behavior

The web provider matching helper now returns both:

- `zipMatchLevel`: the existing API-level match tier.
- `coverageConfidence`: the shared cross-surface confidence label.

For database-backed provider matching:

- Exact ZIP rows outrank ZIP prefix rows.
- ZIP prefix rows outrank mapped polygon/service-area metadata.
- Mapped service-area metadata outranks state-level rows.
- State-level rows outrank live-address-required providers.
- Federal/national providers remain broad matches and should not outrank high-confidence local providers for address-sensitive categories.

## Current Limitations

- There is no full ZIP reference table.
- There is no schema-backed provider verification or source metadata.
- There are no exact ZIP rules in the current generated provider coverage audit.
- Polygon and live-address metadata are currently code-level metadata, not official source-backed records.
- Provider coverage should be displayed as listed/unverified unless future official-source validation proves otherwise.

## If A ZIP Reference Dataset Is Needed Later

The smallest safe current-product option would be a server-only ZIP reference table or generated server artifact used for normalization and state inference. It should not be sent wholesale to web or mobile clients.

A schema-backed ZIP dataset should only be added if the product needs:

- Full 5-digit ZIP validation.
- ZIP-to-city/state display.
- County or utility-territory joins.
- State/provider gap reports that cannot be derived from existing coverage rows.
