# Audit Fixes — pre-merge review of the free-pivot branch (2026-06-21)

Authoritative record of the end-to-end audit of the free-consumer-pivot branch and
the fixes applied. Supersedes drifted claims in the planning docs (00–19) where they
conflict. Audit method: 11-dimension adversarial review (each finding independently
verified) → 43 confirmed findings → prioritized + fixed here.

## P0 — fixed (deploy blockers)

- **P0-1 · Missing migrations.** 8 new models (`AddressDataCacheEntry`, `Lead`,
  `LeadDispatch`, `Partner`, `PartnerDocument`, `PartnerPortalToken`,
  `PartnerLedgerEntry`, `PartnerInvoice`) had no committed migration; `prisma migrate
  deploy` would not create the tables, and `AddressDataCacheEntry` (flag-independent,
  backs the always-on dossier cache) would break every dossier request.
  → migration `20260620120000_free_pivot_lead_partner_models` (generated via
  `prisma migrate diff` from the `main` schema; reviewed for indexes/uniques/FK
  cascades). **Follow-up:** add a `prisma migrate status` CI gate.
- **P0-2 · Lead worker unscheduled.** `/api/cron/lead-dispatch` was registered in zero
  schedulers → QUEUED leads never delivered, no CPL ever accrued. → registered in
  `docker/ofelia.ini`, `.github/workflows/cron.yml`, `apps/web/vercel.json`
  (mirrors `connector-dispatch`).

## P1 — fixed (correctness / PII)

- **P1-1 · PII to de-authorized partners.** The worker only read `contactEmail` at
  send time and never re-checked approval, so a partner rejected after the lead was
  queued still received the consumer's decrypted PII (+ CPL). → re-check `status`
  at send time, terminal-fail `NOT_APPROVED`, no email/charge.
- **P1-2 / P1-3 · Override coverage (resolves 16-H3).** The consumer-free override was
  applied at only `getUserPlan` + the unified snapshot, leaving seat gates and the API-
  connector gate reading RAW → half-open under `CONSUMER_FREE`. → **Option (a):**
  `getEffectiveEntitlement(sub, now, { applyConsumerFree })` adds the H3-safe override as
  a single final step (default false → preserve-suite untouched); new web helper
  `resolveConsumerEntitlement` reads the flag and is used by workspace invitations,
  invite-accept, create-workspace, and the connector gate (where `consumerFreeApplied`
  also exempts the annual-commitment requirement). Ownership-reconcile + admin stay RAW.

## P2 — fixed

- **Worker:** atomic claim (`QUEUED→DISPATCHING`) + stale-claim sweep; mark `SENT`
  only on a real send success (kill-switch / orphaned-PENDING now retries, not a false
  delivery); undecryptable payload → terminal `DECRYPT_FAILED` (no empty email, no CPL);
  category-aware email copy (cleaning/junk no longer say "moving").
- **create-lead:** P2002 race → re-query + dedupe (was a 500); dedupe key now includes
  home size / name / phone / notes so a corrected resubmit isn't silently dropped;
  added `create-lead.test.ts` (asserts PII encryption + no clear-text contact stored).
- **Consent (leadsOptIn):** new `Partner.leadsOptIn` (persisted from registration
  consent) + `MoverApplication.leadsOptIn` (default false); ANDed into both match
  queries so PII routes only to opted-in recipients (CAN-SPAM/TCPA).
- **Portal:** partner email lowercased at write; magic-link per-email rate-limit
  (`failClosed: if-redis-configured`) + token supersede/prune (one active link/partner).
- **Analytics:** phase-1 offer events slug-normalized before GTM/GA4 (no free-text
  leak); `offer_viewed` deduped per page session.

## Deferred — with rationale (NOT regressions)

- **Mover lead opt-in UI.** `MoverApplication.leadsOptIn` defaults false, so moving
  leads do not flow until movers opt in. A mover-facing opt-in capture is a pre-launch
  requirement before `offers_moving_quotes_v1` is enabled. (Partners opt in at
  registration, so cleaning/junk are unaffected.)
- **Dossier 50/user/day backstop (16-M4 / STEP-1 §2.6).** Not retrofitted into the
  ~800-line dossier route; the global daily fuse + 60/min limiter + durable geo cache
  already bound upstream cost. Implement at the route or document permanently.
- **H7 cache epoch on flip.** A flip-time client+server cache-invalidation concern;
  to be done coordinated with the actual flag flip (Step 3), not while the flag is off.
- **R5c+ live billing** (Stripe customer/invoicing, webhook reconciliation, billing UI)
  and **R6 insurance** — legal/tax-gated; not built. Consumers are never charged.
- **CI `prisma migrate status` gate** — recommended to catch future schema/migration drift.

## Verified solid (no change needed)

`packages/shared/src/entitlement.ts` core logic untouched (param wrapper only; preserve-
suite green) · consumer-free override H3-safe (lapsed/refunded/admin payers never
upgraded) · billing idempotent + fail-safe · double-send/double-bill blocked by unique
constraints · global breaker + durable cache wired across all 3 dossier paths · ranking
integrity (sponsored = separate FTC-labeled slot) · consent server-authoritative (422) ·
flags fail-closed + default-off.
