# Staging verification & go-live checklist — free-consumer pivot

> Authored 2026-06-21. This is the review/run sheet for verifying the free-pivot on
> **staging before going live**. Pairs with [AUDIT-FIXES.md](AUDIT-FIXES.md) (what was
> fixed) and [18-OPEN-ITEMS.md](../18-OPEN-ITEMS.md) (register). Nothing here flips
> production — going live is a separate, explicitly-approved step (§5).

---

## 1. What is on staging now

- **Repo:** `https://github.com/Msxlab/staging-move` → branch **`main`**.
- **Commit:** `2975b06e` (full system + all 44 pivot commits). Production repo
  `Msxlab/move-main` is **NOT touched** — still unpushed.
- **Master flag `CONSUMER_FREE` is default-OFF** → the seed is inert; the app behaves
  exactly as today until a flag is flipped in the staging DB. Safe to deploy.
- **Pre-push verification (all green):** web 312 files / 2704 tests · shared 380 ·
  admin 759 · `verify:typecheck` (web/admin/mobile/db/connectors) + shared `tsc` clean.

## 2. Status — what is done vs. gated

**Done + verified + committed (on staging):**
- Step 1 guardrails (custom-provider cap, durable geo dossier cache, global spend breaker).
- Step 2 entitlement core behind `CONSUMER_FREE` (override Option (a), H3-safe).
- Step 4 web UI/copy/SEO (Free + coming-soon pricing, settings panel, blog, llms/SEO).
- Revenue R1 (affiliate disclosure + funnel events + junk category), R2 (surface
  affiliate + sponsored slot), R3 (lead-gen: models, /api/leads, quote forms, delivery
  worker, admin queue), R4 (generic Partner platform + registration + admin verify +
  portal + cleaning/junk capture), R5a/R5b (CPL ledger + accrual + rate catalog).
- Pre-merge audit: all P0 + P1 + P2 fixed (see AUDIT-FIXES.md).
- R6 insurance **plan** (spec only, regulatory-gated).
- Lead-program opt-in surfaces (partner self-serve toggle + mover admin enroll).

**Remaining — GATED, not code-completable here:**
- **Step 3** — flip the flag (ops/deploy; this checklist is its staging half).
- **Step 5** — mobile pivot UI (blocked on the redesign branch `beautiful-tharp-7f815e`
  merge; deferred by decision 2026-06-21).
- **R5c+** (live Stripe invoicing, webhook reconciliation, billing UI) and **R6 build**
  (insurance) — legal/tax-gated; no money/PII moves until cleared.

## 3. Staging verification checklist (ops — needs staging GitHub secrets / DB / scheduler)

> These require access I don't have (staging repo secrets, staging DB, scheduler).

- [ ] **3.1 Secrets + deploy.** Configure the staging GitHub repo secrets
  (`DATABASE_URL`, Stripe/email/etc. as in prod) and wire the staging deploy target.
- [ ] **3.2 Run migrations.** On the staging DB:
  `pnpm --filter @locateflow/db exec prisma migrate deploy`
  → applies the 8 free-pivot models (`AddressDataCacheEntry`, `Lead`, `LeadDispatch`,
  `Partner`, `PartnerDocument`, `PartnerPortalToken`, `PartnerLedgerEntry`,
  `PartnerInvoice`) + the `MoverApplication.leadsOptIn` ALTER. Confirm all tables exist.
- [ ] **3.3 Scheduler.** Confirm the **lead-dispatch** worker runs on staging
  (`/api/cron/lead-dispatch` — registered in `docker/ofelia.ini`, `.github/workflows/
  cron.yml`, `apps/web/vercel.json`), alongside the existing connector-dispatch.
- [ ] **3.4 Baseline (flags OFF).** With every flag off, smoke-test that the app is
  unchanged: pricing shows the paid tiers, in-app gates behave as today, dossier loads.
- [ ] **3.5 Free pivot (flip `CONSUMER_FREE`=on in the staging DB FeatureFlag).** Verify:
  - every consumer account resolves to PRO / everything-free (web + mobile snapshot via
    `/api/profile`);
  - pricing → Free ($0, everything included) + Concierge/Business coming-soon;
  - `/settings/subscription` shows "You're on Free", no checkout;
  - **seats**: a free owner CAN invite members (was the half-open bug — now fixed);
  - **connectors**: API connectors available without an annual commitment;
  - a real/lapsed Stripe/store payer is NOT altered (admin billing reads RAW);
  - **H7 (cache staleness at flip)** — see §6: stale "paid" screens may persist from
    caches right at the flip; decide whether to build the cache-epoch bust before
    flipping in prod.
- [ ] **3.6 Affiliate + lead-gen (flip the monetization flags).** Turn on
  `offers_affiliate_v1`, `offers_moving_quotes_v1`, `offers_cleaning_junk_v1`,
  `partner_registration_v1` and exercise end-to-end:
  - affiliate CTA + FTC disclosure on provider/recommendation/move-task surfaces;
  - sponsored slot renders as a separate labeled box (organic order unchanged);
  - partner registration → admin verification (step-up) → **enroll in lead program**;
  - mover: admin **enroll in lead program** checkbox on the application decision;
  - consumer quote form (moving + cleaning/junk) → `Lead` + `QUEUED` `LeadDispatch`;
  - worker delivers ONLY to APPROVED + opted-in recipients; partner gets the email;
  - partner portal magic-link → own-leads dashboard + self-serve lead on/off toggle;
  - (R5) a delivered generic-partner lead accrues a PENDING CPL **only if** a
    `CPL_CENTS_<CATEGORY>` rate is set (default unset → free; no money moves).
- [ ] **3.7 PII/abuse spot-checks.** Lead PII never appears in a response/log/analytics
  or in admin/portal list views; rate limits + the global spend breaker hold.

## 4. Flags reference (all DB FeatureFlags, fail-closed, default-off)

| Flag | Effect |
|---|---|
| `CONSUMER_FREE` | Everyone resolves to PRO / everything free (the pivot master switch). |
| `offers_affiliate_v1` | New affiliate surfaces (move-task offer + sponsored slot). |
| `offers_moving_quotes_v1` | Moving lead capture form + routing. |
| `offers_cleaning_junk_v1` | Cleaning/junk lead capture + routing. |
| `partner_registration_v1` | Public generic-partner self-service application. |
| `offers_renters_insurance_v1` | R6 (NOT built — plan only, legal-gated). |

CPL rates (RuntimeConfig, unset → free): `CPL_CENTS_CLEANING`, `CPL_CENTS_JUNK`.

## 5. Going LIVE (production) — boundary + hard gates

Going live is **separate** from this staging push and needs explicit approval:
1. Merge the pivot to **prod** (`Msxlab/move-main` main) via PR.
2. Pre-flip ops: run `prisma migrate deploy` on the **prod** DB; confirm the
   lead-dispatch cron on prod; (recommended) add a `prisma migrate status` CI gate.
3. **Legal sign-off (HARD):** Privacy/Terms lead-sharing clause; partner ToS (CPL
   model/cadence/disputes/tax) before any real invoicing (R5c+); insurance model +
   disclosures before any R6 build.
4. Flip `CONSUMER_FREE`=on in **prod** (+ the monetization flags you want live).
5. **H7 cache-epoch** should be in place before the prod flip (§6).

## 6. Deferred items & follow-ups (with rationale)

- **H7 — cache epoch / flip-time invalidation.** Stale gated payloads (paid screens)
  can survive caches right at the flip. Deferred because it's meaningless while the flag
  is off (nothing to invalidate yet) and is best built with the actual flip. **Build the
  server/web part (RuntimeConfig epoch + `no-store` on gated payloads + React-Query key)
  before the prod flip;** mobile cache part should land with the redesign.
- **Dossier 50/user/day backstop** (STEP-1 §2.6) — not retrofitted into the ~800-line
  dossier route (risk); the global fuse + 60/min + durable cache already bound cost.
- **CI `prisma migrate status` gate** — recommended; needs a shadow DB in CI to wire.
- **Step 5 mobile pivot UI** — blocked on the redesign merge; do it in the new theme +
  reconcile the redesign's paid mobile pricing → free, in one pass.
- **R5c+ / R6 build** — legal/tax-gated; consumers are never charged.

---

**Bottom line:** the free-pivot + monetization stack is on staging behind default-off
flags, fully green and audited. Verify §3 on staging, decide on H7 before the prod flip,
and clear the §5 legal gates before going live.
