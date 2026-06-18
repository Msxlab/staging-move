# Build Info Auto-Stamp Handoff

## Summary

- PR #302 was merged and Dokploy autodeployed the new `main` commit.
- Live `/api/build-info` still reports `commitSha: "unknown"` because Dokploy does not currently inject a commit hash build arg automatically.
- Added a follow-up branch that generates `.build-info.json` during Docker build from minimal Git metadata and uses it as a safe fallback for `/api/build-info`.

## Change

- Include only minimal Git metadata in Docker build context: `.git/HEAD`, `.git/refs/**`, `.git/packed-refs`.
- Generate `.build-info.json` during the web/admin Docker build.
- Copy `.build-info.json` into each runtime image.
- Let web/admin `/api/build-info` read the generated file only as a fallback when env values are missing or `"unknown"`.
- No secrets, production data, migrations, Stripe/store writes, or anonymous map access changes.

## Validation

- `pnpm --filter @locateflow/web exec vitest run src/app/api/build-info/route.test.ts ../../packages/shared/src/build-info.test.ts`
- `pnpm --filter @locateflow/admin exec vitest run src/app/api/build-info/route.test.ts`
- `pnpm verify:typecheck`

## Notes

- Dokploy issue #4006 tracks native commit-hash build arg support; until that exists, the generated file is the self-contained fallback.
- `/api/maps/static?preview=1` remains authenticated by design. A raw unauthenticated curl returning `401` is expected and protects quota/abuse.
