# 10 · Analytics & Feature Flags

## Analytics pipeline (use the existing consented `UserEvent` funnel — PostHog is NOT installed)

Flow: client `trackEvent(name, params)` (web [analytics.ts:175](apps/web/src/lib/analytics.ts), mobile [analytics.ts:77](apps/mobile/src/lib/analytics.ts)) → batch → `PUT /api/tracking/event` ([route.ts:60](apps/web/src/app/api/tracking/event/route.ts)) → consent gate (`getConsentedTrackingSession`) + PII sanitize → `prisma.userEvent.create`. Central typed registry: [phase1-experiment-analytics.ts](packages/shared/src/phase1-experiment-analytics.ts).

### Add the 7 new events
Register in `PHASE1_ANALYTICS_EVENTS` + give each an `EVENT_ALLOWED_KEYS` entry (TS error if missing — good guardrail) + add any new closed value sets. Names lower snake_case, <50 chars.

| Event | Where to emit | How |
|---|---|---|
| `move_created` | [api/move-tasks/route.ts:196](apps/web/src/app/api/move-tasks/route.ts) (plan/`MOVE_TASK_GENERATED` path) | server, alongside existing `recordMoveTaskEvent` |
| `provider_added` | [api/custom-providers/route.ts:249](apps/web/src/app/api/custom-providers/route.ts) | server, alongside `recordCustomProviderEvent` (closed enum: `provider_category`) |
| `address_task_completed` | [api/move-tasks/route.ts:385](apps/web/src/app/api/move-tasks/route.ts) (lifecycle PATCH → completed) | server, closed enums only |
| `document_uploaded` | document/vault upload success handler | **client** `trackEvent` (inherits consent + sanitize); closed `document_type` only — no file names/sizes |
| `offer_viewed` | coming-soon Concierge/Business cards (web + mobile) | client `trackEvent` (`offer_key`, `surface`) |
| `offer_clicked` | coming-soon card CTA | client `trackEvent` |
| `concierge_interest_clicked` | "I'm interested" on Concierge card | client `trackEvent`; flush-before-nav pattern |

> **Privacy:** the server-side `record*Event` helpers ([move-tasks:70](apps/web/src/app/api/move-tasks/route.ts), [custom-providers:64](apps/web/src/app/api/custom-providers/route.ts)) write `userEvent.create` **directly**, bypassing the consent gate + sanitizer. For new server emits, pass only **pre-vetted closed enums** (status, category) — never raw names/addresses/notes — or route through a shared sanitizer. Prefer the client `trackEvent` path where possible (auto consent + sanitize). Avoid metadata keys containing PII substrings (`name`,`address`,`content`) — the generic sanitizer drops them (use `offer_key` not `offer_name`).

### Events that go quiet (expected, not a regression)
`UPGRADE_CLICKED`, `move_teaser_upgrade_clicked`, and (if teaser removed) `ONBOARDING_TEASER_VIEWED` stop firing from onboarding ([onboarding-client.tsx:906](apps/web/src/app/onboarding/onboarding-client.tsx), mobile :933/1065). Keep the event constants (dormant). **Update any funnels/dashboards** that assume these fire so the pivot doesn't read as a drop. (External — manual.)

## Feature flags — future-monetization stubs

Mechanism: `isFeatureEnabled(flagName, {userId, plan})` — DB-backed `FeatureFlag`, ALL/PERCENTAGE/USER_LIST/PLAN, 60s cache, **fail-closed** (unknown → false), **server-only** ([feature-flags.ts:36](apps/web/src/lib/feature-flags.ts)). Admin CRUD with step-up + audit — [apps/admin/.../api/feature-flags/route.ts:190](apps/admin/src/app/api/feature-flags/route.ts) (**preserve**).

### Define + TODO-stub these (default OFF, ship dark)
`offers_partner_v1`, `offers_moving_quotes_v1`, `offers_renters_insurance_v1`, `offers_internet_setup_v1`, `offers_storage_v1`, `offers_cleaning_junk_v1`, `verified_move_profile_v1`, `business_dashboard_v1`. Plus the master `CONSUMER_FREE` switch (see [01](01-ENTITLEMENTS-AND-GATES.md)).

Gate each future-offer surface behind `isFeatureEnabled(flag, {userId, plan})` with a `// TODO(monetization):` marker. PLAN targeting maps to future Free/Concierge/Business.

### Client-flag gap
`isFeatureEnabled` is server-only (imports prisma). Pattern for client/RN surfaces: resolve flags in the page server component and **prop-drill booleans** down (already used: [dashboard/page.tsx:53](apps/web/src/app/(app)/dashboard/page.tsx), onboarding/page.tsx, moving/plan). RN offer stubs need the value passed from the server snapshot. Stubs render nothing when false (fail-closed). (`FEATURE_FLAGS.md` documents this gap.)

## `CONSUMER_FREE` representation
- Web-only async gates (`getUserPlan`) → DB flag via `isFeatureEnabled` (runtime toggle).
- Shared pure code (`planFeatures`, `getEffectiveEntitlement`) cannot await DB → use an **env constant** `CONSUMER_FREE=1` (or thread a boolean param). Pick one source of truth; document it.
