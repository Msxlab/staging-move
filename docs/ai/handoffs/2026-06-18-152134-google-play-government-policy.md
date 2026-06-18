# Google Play Government Information Policy Fix

Date: 2026-06-18
Branch: codex/google-play-government-policy

## Context

Google Play Console rejected the Android app under Misleading Claims policy for "Missing Source Link for Government Information."

Verified policy issue shown in Play Console:

- Missing clear and accessible official source URLs for government information.
- Need clear disclosure that LocateFlow does not represent a government entity.

## Map Diagnostic Finding

Dokploy web logs after PR #304 showed:

- `[maps/static] google upstream returned 403`
- `[maps/static] geoapify upstream returned 401`

This means the app code and deploy are reaching the map proxy, but both upstream providers are rejecting the configured key/account request. No secret values were read or logged.

## Code Changes

- Added shared official-government source constants and non-affiliation disclaimer.
- Updated `/api/state-rules` to include visible official source links in the state-rule contract.
- Added a reusable mobile `GovernmentSourceLinks` component.
- Rendered source links and government disclaimer in mobile State Guide and provider detail state-rule surfaces.
- Added English and Spanish mobile i18n copy.

Official sources used:

- USA.gov state motor vehicle services: `https://www.usa.gov/state-motor-vehicle-services`
- Vote.gov registration: `https://vote.gov/register`
- USA.gov state taxes: `https://www.usa.gov/state-taxes`

## Tests

- `node -e "JSON.parse(...en.json); JSON.parse(...es.json)"`
- `pnpm --filter @locateflow/web exec vitest run src/app/api/state-rules/route.test.ts`
- `pnpm --filter @locateflow/mobile exec tsc --noEmit`
- `pnpm --filter @locateflow/shared exec tsc --noEmit`
- `pnpm verify:typecheck`

All passed. Local environment warns that Node v24 is running while repo expects Node 22.x.

## Manual Play Console Step

Update the Android store listing / policy declaration copy to avoid implying government affiliation:

Suggested short disclosure:

> LocateFlow is not a government agency and is not affiliated with or endorsed by any government entity. Government-related moving guidance is informational only. Users should verify requirements with official sources such as USA.gov, Vote.gov, IRS.gov, and state agency websites before acting.

## Remaining

- Configure map provider credentials:
  - Google Static Maps currently returns 403.
  - Geoapify currently returns 401.
- After this PR is merged, publish a fresh EAS update/build for Android before resubmitting to Google Play.
