# Module Audit: DevOps, CI, Deploy

Status: scanned.

## Source Inspected

- `.github/workflows/ci.yml`
- `.github/workflows/cron.yml`
- `Dockerfile`
- `docker-compose.dokploy.yml`
- `docker/locateflow-cron-runner.sh`
- `package.json`

## Verified Facts

- CI uses least-privilege top-level permissions.
- CI sets Node 22.
- CI runs production dependency audit and gitleaks.
- CI checks Prisma migration status.
- Production-like compose uses required environment-variable guards.
- Compose includes mutable third-party image tags.

Evidence:

- `.github/workflows/ci.yml:11-12`
- `.github/workflows/ci.yml:26`
- `.github/workflows/ci.yml:85-89`
- `.github/workflows/ci.yml:138`
- `docker-compose.dokploy.yml:343`
- `docker-compose.dokploy.yml:372`

## Findings

- `SEC-DEPLOY-001`
- `AUDIT-COVERAGE-001`

## Not Verified In Code

- Latest CI run status.
- Runtime production env configuration.
- Whether mutable tags are pinned externally by deploy platform.
- Current vulnerability audit result.

## Next Steps

- Pin mutable images.
- Rerun dependency audit with approved longer timeout or inspect trusted CI artifact.
