# Fix Priority Roadmap

This roadmap is documentation-only. No fixes were applied in this pass.

## P0: Stop-Ship

No critical or high-severity source-backed issues were verified in this first pass.

Escalate to P0 if later route/security review verifies:

- Unauthenticated admin mutation.
- Production secret exposure.
- Billing entitlement bypass.
- Connector flow that sends PII to the wrong provider.
- Account deletion/export data-loss or data-retention violation.

## P1: Next Engineering Pass

1. Pin mutable third-party production-like images.
   - Finding: `SEC-DEPLOY-001`
   - Files: `docker-compose.dokploy.yml`
   - Acceptance: no `:latest` third-party images in production-like compose; image versions/digests documented.

2. Replace generic analytics metadata storage with strict allowlists.
   - Finding: `PRIV-TRACK-001`
   - Files: `apps/web/src/app/api/tracking/event/route.ts` and tests.
   - Acceptance: unknown metadata keys are dropped; benign-key sensitive values are tested.

3. Add workspace member-administration step-up.
   - Finding: `SEC-WORKSPACE-001`
   - Files: `apps/web/src/app/api/workspaces/[id]/members/[memberId]/route.ts`, `apps/web/src/app/api/workspaces/[id]/invitations/route.ts`, and tests.
   - Acceptance: privileged invite, role/status change, admin promotion, and member removal require password/MFA step-up or have an explicitly approved exception.

4. Verify and clean credential-like markdown content.
   - Finding: `REPO-HYGIENE-001`
   - Files: `SYSTEM_STATUS.md`
   - Acceptance: no real/stale credential-like values remain in committed docs; any possibly real values are rotated.

5. Produce full route authorization matrix.
   - Finding/debt: `DEBT-ROUTE-MATRIX-001`
   - Files: generated report under `docs/audit/reports/`.
   - Acceptance: each web/admin API route has classification, auth helper, mutation status, CSRF/secret boundary, and test link.

6. Complete dependency vulnerability check.
   - Finding: `AUDIT-COVERAGE-001`
   - Acceptance: trusted result from local approved longer run or CI artifact is linked.

## P2: Product/UI Stabilization

1. Mobile theme migration.
   - Finding: `UX-MOB-001`
   - Acceptance: top user flows use `useAppTheme`/`useThemedStyles`; dark/light/system manual QA screenshots captured.

2. Token drift guard.
   - Finding: `UX-THEME-001`
   - Acceptance: generated token output or snapshot tests prevent web/admin/mobile divergence.

3. Decide and implement connector fallback step-up parity.
   - Finding: `SEC-CONNECTOR-001`
   - Files: `apps/admin/src/app/api/connector-fallbacks/route.ts` and tests.
   - Acceptance: fallback POST/DELETE require password/MFA step-up or have an explicitly approved no-step-up rationale with tests.

4. Connector/address-change deep audit.
   - High-risk area.
   - Acceptance: each connector has PII, retry, fallback, idempotency, retention/export/delete, user notification, and provider-boundary notes.

5. Billing/IAP entitlement transition tests.
   - High-risk area.
   - Acceptance: purchase, renew, cancel, refund, expire, revoke, duplicate, sandbox/test, and out-of-order cases are covered by tests.

6. Admin backup/import restore drill.
   - High-risk area.
   - Acceptance: source-backed matrix is already present; next acceptance is a disposable local/staging restore drill plus test-suite run without production data.

## P3: Continuous Audit Improvements

- Add generated route and permission inventory to CI.
- Add design-token drift tests.
- Add static checks for unclassified public routes.
- Add privacy tests for telemetry metadata.
- Add periodic docs hygiene scan for credential-like strings, with redaction-safe output.
