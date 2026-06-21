# R3 · Lead-gen marketplace (movers first) — implementation plan

> Status: PLAN (awaiting approval — no code yet). Scope: the biggest NEW revenue
> primitive (docs/ai/free-pivot/19 §3 Layer 3, §5, §10.4). Movers first because
> the partner side (FMCSA `MovingCompany` catalog + mover portal) already exists.
> Gated by `offers_moving_quotes_v1` (already in `monetization-flags.ts`,
> fail-closed). CPL **billing** is deferred to R5; R3 ends at capture → route →
> status (the partner is delivered the lead; charging comes later).

## Goal
A consumer at the high-intent moving moment submits ONE structured quote request
("Get up to N moving quotes"); we match N licensed movers serving the route and
deliver the lead to each via a retrying outbox; each lead + delivery is tracked
for later CPL billing. No consumer charge, ever.

## Reuse map (don't reinvent)
| Need | Reuse |
|---|---|
| Partner identity (movers) | `MovingCompany` (FMCSA catalog) + approved `MoverApplication` contactEmail/serviceStates/services |
| Outbox / retry / idempotency | the **`ConnectorDispatch` pattern** (status machine, idempotencyKey, attemptCount, nextRetryAt, payloadEncrypted via FIELD_ENCRYPTION_KEY) → new `LeadDispatch` |
| Consent snapshot | the **`AcquisitionRedemption` pattern** (consentAcceptedAt / consentIpHash / consentUserAgentHash / termsVersion) — immutable on submit |
| Capture style | generalize **`WaitlistSignup`** (target/source/ipHash/userAgent/locale) |
| Analytics | `lead_submitted` event — **already registered** in phase1-experiment-analytics (R1b) |
| Email delivery | existing transactional email infra (same as lifecycle/mover-portal emails) |
| Flag / rate-limit / audit | `FeatureFlag`, rate-limit-policy, audit log |

## Data model (NEW — additive migration, zero orphan risk)
1. **`Lead`** — `id`, `category` (VarChar; "moving" for v1), `status`
   (`NEW|MATCHED|SENT|PARTIALLY_ACCEPTED|ACCEPTED|REJECTED|EXPIRED`), `userId`
   (required v1 — auth-only; revisit anon later), `fromZip`/`toZip`/`fromState`/
   `toState`, `moveDate`, `homeSize` (enum-ish VarChar), **`payloadEncrypted`**
   (name + contact + notes, FIELD_ENCRYPTION_KEY — never plaintext PII at rest),
   attribution (`source`, `clickToken?`), `matchedCount`, `idempotencyKey`
   (@unique — dedupe double-submit), consent columns (mirror AcquisitionRedemption),
   `ipHash`/`userAgent`/`locale`, timestamps. Indexes: `[category,status]`,
   `[userId]`, `[createdAt]`.
2. **`LeadDispatch`** — one row per partner the lead is routed to: `id`, `leadId`
   (FK), `movingCompanyId` (loose ref v1; generalizes to `partnerId` in R4),
   `status` (`QUEUED|DISPATCHING|SENT|ACCEPTED|REJECTED|FAILED`), `idempotencyKey`
   (@unique), `attemptCount`, `lastErrorCode?`, `nextRetryAt?`, `sentAt?`,
   `cplCents?` (null until R5 billing), timestamps. Indexes: `[status,nextRetryAt]`,
   `[leadId]`, `[movingCompanyId]`.

## Build phases (each its own verified commit)
- **R3a — model + matching lib.** Add `Lead`/`LeadDispatch` + migration + prisma
  generate. `lib/leads/match-movers.ts`: given from/to state + services, pick up
  to N (cap, e.g. 4) active HHG-authorized `MovingCompany` rows serving the route
  (reuse the movers query in `lib/movers.ts`); dedupe; return matches. Pure +
  unit-tested.
- **R3b — `lib/leads/create-lead.ts` + POST `/api/leads`.** Validate (zod), require
  auth, enforce `offers_moving_quotes_v1` (fail-closed), rate-limit (IP+user),
  capture the **immutable consent snapshot**, encrypt PII payload, create `Lead`
  + N `QUEUED` `LeadDispatch` rows in one transaction (idempotencyKey dedupe),
  fire `lead_submitted` (offer_key="moving_quotes", category="moving"). Tests:
  gate off→404/disabled, no-consent→422, dedupe, match-cap, PII encrypted.
- **R3c — capture UI.** A "Get up to N moving quotes" form on the movers surface
  (`MoversSection`/movers-list, web) — gated by the flag (prop-drilled from the
  moving-plan page like R2b). Fields: move date, from/to ZIP, home size, name,
  email/phone, **explicit lead-sharing consent checkbox** (links Privacy/Terms).
  Success → "N movers will reach out." Tests: render gated, submit calls /api/leads.
- **R3d — delivery worker.** A cron/route that drains `QUEUED` `LeadDispatch`
  (mirror the ConnectorDispatch worker): email the partner's contactEmail with the
  decrypted lead, mark `SENT`, retry with backoff on failure (attemptCount/
  nextRetryAt), idempotent. Tests: happy path, retry, idempotency, decrypt.
- **R3e — admin lead queue (light).** Read-only admin list of leads + dispatch
  status (reuse admin RBAC/table). Partner-facing acceptance + CPL billing are R5.

## Hard rules / open decisions (flag for the user before/while coding)
- **Legal:** lead-sharing requires a Privacy/Terms clause + the consent snapshot.
  Copy needs sign-off (tracked in 18-OPEN-ITEMS §F). v1 ships the consent
  mechanism; final legal copy is a gate before flag-on.
- **Auth-only v1:** leads require a logged-in user (clean attribution + abuse
  control). Anonymous capture is a later option.
- **Partner acceptance:** v1 delivers by email (no accept/reject loop yet) →
  status stops at `SENT`. Accept/reject + CPL billing = R5 (partner portal).
- **Pricing (CPL):** not set in R3 (`cplCents` nullable). R5 decides rates + who sets them.
- **Match cap N + fairness:** start N≤4, newest/most-complete movers; rotation/
  auction is a later refinement (log the cap, never silently drop — house rule).
- **Cleaners/junk:** same machinery, but needs the generic `Partner` onboarding
  (R4) since they have no FMCSA catalog. R3 is movers-only.

## Verification
Per-phase: prisma migrate + generate; `verify:typecheck` (all packages); targeted
vitest for each lib/route/UI; full web suite for regressions. Flag OFF by default →
the whole feature is dark until ops enables `offers_moving_quotes_v1`.
