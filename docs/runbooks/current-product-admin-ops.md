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
3. Review route, same-state/interstate status, origin service count, destination service count, and open move task count.
4. Review generated tasks for stop old service, verify availability, compare providers, start destination service, government update, insurance requote, mail forwarding, and local provider follow-up.
5. Treat low-confidence tasks as support context, not proof that a provider serves the destination.
6. Use User Detail for the broader account context.

Move tasks are user workflow records. Completing a task can update LocateFlow local service state, but LocateFlow does not update provider accounts or execute address changes.

## User Support Context

1. Open Admin > Users > user detail.
2. Review onboarding status, addresses, services, custom providers, moving plans, move tasks, support tickets, auth/session state, subscription status, and admin notes.
3. Use Move Transition Support Context to identify likely service-transition gaps and task status.
4. Do not tell users a provider is official, verified, guaranteed, or available at an address unless source-backed evidence exists.
5. Do not imply provider account linking or automatic provider-side updates.

## Provider Governance Center

Use Admin > Provider Governance for operational queues:

- Provider quality queue: missing logo, missing phone, generic description, marketing language, suspicious category, unknown source.
- Coverage gap queue: missing or broad-only critical state/category coverage.
- Duplicate review queue: duplicate-domain buckets and possible cross-link candidates.
- Missing contact queue: missing phone/contact data.
- Broad coverage review queue: state-level utilities, national/federal listings, address-check-required providers.
- Source validation backlog: providers needing official-source review.
- User-created provider review queue: private custom providers that may need support review, linking, rejection, or promotion-candidate handling.

Allowed current actions:

- Mark reviewed.
- Dismiss or reopen a governance warning.
- Flag a custom provider as needs review, reviewed, rejected, or promotion candidate.
- Link a custom provider to an existing global provider when clearly the same.
- Add internal context through existing admin audit trails.

Do not promote a custom provider into the global catalog, make official/verified claims, bulk edit broad coverage, or perform destructive provider changes without the required source review, permissions, and step-up workflow.

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
- Web moving detail shows Move Tasks, accept/complete/dismiss/reopen actions, confirmation before local effects, and no automation claim.
- Mobile moving detail shows the same task lifecycle and caveats as web.
- Admin moving list shows operator transition context and task counts.
- Admin user detail shows services, custom providers, move tasks, low-confidence warnings, and no push-device token value.
- Support detail shows move task/service context without contractual SLA claims.
- Provider recommendation reasons include coverage confidence caveats for address-sensitive categories.
- Custom provider records remain private/user-created and do not become global catalog records automatically.
- `pnpm audit:providers:readiness` regenerates provider readiness reports.
- `pnpm verify:typecheck` passes.
