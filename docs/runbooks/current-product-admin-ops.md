# Current Product Admin Operations Runbook

Use this runbook for current LocateFlow operations. It does not authorize future product modules, provider connectors, partner APIs, account linking, or automatic address-change execution.

## Provider Operations

1. Open Admin > Providers.
2. Review quality warning totals before making catalog edits.
3. Prioritize missing phone, generic description, marketing language, duplicate-domain, broad coverage, and address-check-required warnings.
4. Confirm provider details with official provider or state agency sources before editing.
5. Keep providers listed/unverified unless source-backed verification storage is approved.
6. Use fallback category icons when logo source or license is not approved.
7. Do not auto-merge duplicate-domain providers. Review whether they are legitimate multi-category records, split candidates, merge candidates, or cross-link candidates.

## Moving Operations

1. Open Admin > Moving.
2. Expand a moving plan.
3. Review route, same-state/interstate status, origin service count, and destination service count.
4. If origin services exist and destination services are not tracked, expect manual transition guidance such as stop old service, verify availability, compare providers, or start destination service.
5. Use User Detail for the broader account context.

Move guidance is support context only. LocateFlow does not update provider accounts or execute address changes.

## User Support Context

1. Open Admin > Users > user detail.
2. Review onboarding status, addresses, services, moving plans, support tickets, auth/session state, subscription status, and admin notes.
3. Use Move Transition Support Context to identify likely service-transition gaps.
4. Do not tell users a provider is official, verified, guaranteed, or available at an address unless source-backed evidence exists.
5. Do not imply provider account linking or automatic provider-side updates.

## State Rules

- State rules can inform government, DMV, voter, tax, utility, and insurance guidance.
- Current state-rule content should be treated as operational guidance unless a legal/source review workflow is approved.
- Missing state-rule coverage should be captured as a cleanup item, not hidden by generic claims.

## Subscriptions And Billing

- Subscription and billing surfaces expose provider/platform/validation context.
- Do not perform refund, cancel, grace, grant, or reconciliation actions unless a product decision and audited workflow exist.
- Store credential validation remains external to this runbook.

## Backup And DR

- Production backups now fail closed without encrypted and signed archives.
- DR is not proven until a clean staging restore drill succeeds with real offsite storage and a managed database snapshot fallback.
- Use `docs/runbooks/db-restore.md` for the restore drill process.

## Manual QA Checklist

- Web provider list/detail shows listed provider, unverified data, manual tracking, and availability caveats.
- Mobile provider list/detail/card shows the same caveats as web.
- Admin provider list/detail shows quality warning counts and messages.
- Web moving detail shows Move Transition Plan guidance and no automation claim.
- Mobile moving detail shows the same transition plan language.
- Admin moving list shows operator transition context.
- Admin user detail shows move/service context and no push-device token value.
- Provider recommendation reasons include coverage confidence caveats for address-sensitive categories.
- `pnpm audit:providers:readiness` regenerates provider readiness reports.
- `pnpm verify:typecheck` passes.
