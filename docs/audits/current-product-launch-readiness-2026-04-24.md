# Current Product Launch Readiness Audit - 2026-04-24

## Scope

This audit covers the current LocateFlow product on `pr/current-product-readiness-epic`: web, mobile, admin, API/backend, schema/migrations, provider data, move tasks, custom providers, backup/recovery, security, privacy, observability, and operations.

It does not approve or add Family, Pro, KYC, Plaid, USPS connectors, provider connectors, partner APIs, external provider account automation, or official/verified provider claims without source-backed validation.

## Executive Verdict

Launch status: **YELLOW - launch only after listed manual QA and infrastructure steps**.

The current product is materially more complete: persistent move tasks, custom providers, provider governance, coverage confidence, recommendation caveats, web/mobile task UX, admin governance queues, and local-only task effects now exist. The branch is PR-ready after automated checks pass, but the product is not green for paying users until staging migration, manual QA, Sentry/log alert review, and a real backup/restore drill are completed.

## Surface Matrix

| Surface | Status | Notes |
|---|---|---|
| Public homepage | Usable but needs manual QA | Current-product copy only; no fake metrics, no future-tier teaser. |
| Pricing | Usable but needs manual QA | Free trial and Individual plan only. |
| Auth | Usable but needs security smoke | Sign in/up/reset/verify/MFA routes exist. |
| Onboarding | Usable but thin | Captures profile/address/service flow; custom provider addition is available through provider/service flows, not a dedicated onboarding step. |
| Dashboard | Usable | Links into services, moving, checklist/task context. |
| Addresses | Production-ready after QA | CRUD exists; address updates refresh related move tasks. |
| Moving plans | Production-ready after QA | Create/update/list/detail plus move-task generation. |
| Services | Production-ready after QA | Listed and custom providers supported; service create/update refresh affected move tasks. |
| Providers | Production-ready after QA | Listed/unverified labels and coverage caveats are shown. |
| Custom providers | Production-ready after QA | User-private provider CRUD and service/task attachment exist. |
| Move tasks | Production-ready after QA | Persistent lifecycle, dedupe, local effects, caveats, and audit events exist. |
| Settings/account security | Usable | Export/delete/privacy/subscription/security flows exist. |
| Notifications | Usable but thin | In-app records exist; external delivery depends on configured providers/workers. |
| Support/help | Usable | Tickets and help surfaces exist. |
| Legal/policy | Usable after copy review | Privacy, terms, cookie, disclaimer, refund, DPA, CCPA, acceptable-use, security, and contact pages exist. |
| Mobile app | Usable but requires device QA | Core flows exist; mobile caveats and task UX need real-device review. Dedicated custom-provider edit/delete is still a parity gap; mobile can create a private provider through service creation. |
| Admin dashboard/users | Usable | User detail includes services, custom providers, move plans, tasks, and support context. |
| Admin providers | Production-ready after QA | Provider list/detail/edit plus quality visibility. |
| Admin provider governance | Production-ready after QA | Quality, gap, duplicate, contact, broad coverage, source backlog, and custom-provider queues exist. |
| Admin moving/support | Usable | Move/task/support context visible. |
| Admin subscriptions/billing | Read-only/operational | No refund/cancel/grace actions added. |
| Admin state rules | Usable but thin | Current state-rule visibility, no legal claims. |
| Admin backups | Usable but DR not proven | New workflow tables are in app backup scope; restore drill still required. |
| Admin security/logs/runtime/flags | Usable but needs ops QA | Kill-switch/readiness copy exists; alerting must be validated in infra. |
| Admin help/email/waitlist/team/reports | Usable but thin | Current control-plane surfaces exist; manual QA required. |

## Route And Navigation Findings

- Web app has public, auth, onboarding, app-shell, settings, support, provider, service, moving, address, and policy routes.
- Mobile has auth, onboarding, tabs, address, moving, service, provider, budget, help, notifications, and settings screens.
- Mobile custom-provider management is thinner than web: create-through-service exists, but a dedicated custom-provider edit/delete screen still needs implementation before a green launch verdict.
- Admin sidebar reaches dashboard, users, subscriptions, billing, providers, provider governance, state rules, moving, support, notifications, email templates, help center, waitlist, analytics, reports, feature flags, security, runtime config, backups, logs, team, and settings.
- Remaining manual QA: verify no dead buttons in provider governance queues, mobile back navigation, modals, empty states, and local-effect confirmation flows.

## Move Task Lifecycle

Allowed lifecycle events are now constrained:

| Current status | Allowed events |
|---|---|
| `SUGGESTED` | `ACCEPT`, `START`, `COMPLETE`, `DISMISS` |
| `ACCEPTED` | `START`, `COMPLETE`, `DISMISS` |
| `IN_PROGRESS` | `COMPLETE`, `DISMISS` |
| `COMPLETED` | `REOPEN` |
| `DISMISSED` | `REOPEN` |
| `REOPENED` | `ACCEPT`, `START`, `COMPLETE`, `DISMISS` |

Invalid transitions return a 400 response from the move-task API.

## Local Effects

Task completion only mutates LocateFlow local state:

- `STOP_SERVICE` and `CANCEL_OR_CLOSE`: mark the local service inactive.
- `TRANSFER_SERVICE`: create or link a destination local service and mark the origin local service inactive.
- `START_SERVICE`, `SHOP_PROVIDER`, `FIND_REPLACEMENT`: create/link a destination local service only when the user selects a listed or custom provider.
- `UPDATE_ADDRESS`, `VERIFY_AVAILABILITY`, `GOVERNMENT_UPDATE`, `INSURANCE_REQUOTE`, `MAIL_FORWARDING`: record local task completion only.

No external provider account is updated.

## Backup And Recovery

The app-level backup catalog now includes:

- `UserCustomProvider`
- `MoveTask`
- `ProviderGovernanceIssue`

Backup verify/import/cron paths and the restore runbook were updated. DR is still not proven until a clean staging restore drill runs with real offsite storage and a managed database snapshot fallback.

## Privacy And Export

User export now includes move tasks and custom providers. Free-form notes remain omitted by default and require `includeNotes=true` to export in plaintext.

## Provider Data Verdict

Provider data is safe only when presented as listed/unverified directory guidance. The generated reports show broad-only coverage, missing logo/contact data, generic or marketing descriptions, duplicate domains, and source-validation backlog. Do not mark providers official or verified without a future source-backed validation path.

## ZIP And Recommendation Verdict

The product does not ship a full U.S. ZIP dataset to web or mobile clients. ZIP prefixes and coverage rows are confidence signals, not proof. Recommendation safety should continue to favor exact ZIP, ZIP prefix, mapped service area, state, national/federal, address-check-required, then unknown coverage.

## Security Verdict

Prevention is materially improved through ownership checks, rate limits, status transition validation, custom-provider scoping, admin permission checks, and audit logs. Remaining launch steps are manual/security QA: verify deployed security headers, CORS, cookies, Sentry redaction, rate-limit behavior, and admin permission boundaries in staging.

## Launch Must-Pass Items

1. Apply Prisma migrations to staging and run Prisma generate.
2. Run the full automated verification matrix.
3. Complete web/mobile/admin manual QA from `docs/qa/current-product-readiness-epic-manual-qa.md`.
4. Run a clean staging backup and restore drill with offsite storage.
5. Confirm DigitalOcean managed backups/PITR and object storage lifecycle/retention.
6. Validate Sentry/log redaction and alerting for auth, backup, billing webhook, and task/governance events.
7. Review policy copy with the business/legal owner before accepting paying users.

## Product Decisions Still Needed

- Whether onboarding should include a dedicated custom-provider step.
- Whether completed/dismissed tasks should ever be regenerated after material input changes.
- Whether source verification metadata should be added to the provider schema.
- Whether custom-provider promotion to global catalog should be implemented as a formal approval workflow.
- Whether broader admin financial actions are allowed. None were added.
