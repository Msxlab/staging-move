# Next Agent Tasks

Updated: 2026-06-23

## Current Staging Thread Note

Use [[handoffs/2026-06-23-full-qa-audit]] as the active staging QA memory, with
[[handoffs/2026-06-22-theme-source-integration-pass]] as the theme/runtime
baseline and [[handoffs/2026-06-21-staging-audit-prep]] as the security/runtime
baseline.

Latest QA report: [[audits/2026-06-23-full-qa-audit]]
Completion matrix: [[audits/2026-06-23-full-qa-completion-matrix]]
Free-pivot verification: [[audits/2026-06-23-free-pivot-verification]]
Latest free-pivot handoff: [[handoffs/2026-06-23-free-pivot-verification]]
Free-pivot runtime follow-up: [[audits/2026-06-23-free-pivot-followup]]
Latest free-pivot runtime handoff: [[handoffs/2026-06-23-free-pivot-followup]]
Free-pivot source fixes: [[audits/2026-06-23-live-staging-source-fixes]]
Latest free-pivot source-fix handoff: [[handoffs/2026-06-23-live-staging-source-fixes]]

Immediate follow-up from the free-pivot verification and runtime follow-up:

1. Redeploy staging from the intended branch/commit and verify authenticated `/api/build-info`; live staging web currently reports `feat/design-foundation` commit `38cb3718abf1958f6fd1c6cd731abd3974047b23`, not the latest `origin/staging` or `origin/main`.
2. Build or provide an official signed Android `preview` / `staging-preview` artifact, install it, and rerun the mobile QA matrix. A local debug APK was installed with staging env and tested successfully, but this is not the signed preview artifact.
3. Redeploy and re-verify public mobile web horizontal overflow on staging home, pricing, and why-free at 390px. Source already hides the logged-out desktop header CTA below `lg`; live staging still shows the old bundle.
4. Deploy and verify the admin `CONSUMER_FREE` missing-row default fix so admin status matches the web product default.
5. Deploy and verify visible "free / no credit card / affiliate-funded" reassurance on sign-up/sign-in, and confirm stale "checkout terms" wording is gone from live staging.
6. Provide approved admin QA credentials or an approved admin test account before authenticated admin runtime screenshots.
7. Get legal review for the billing/refund free-pivot disclosure language.

Immediate QA blockers found 2026-06-23:

1. Fix public mobile header overflow on staging/web.
2. Fix portal magic-link invalid-token redirects that point to `https://0.0.0.0:3000/...`.
3. Fix authenticated Dossier PDF export returning HTTP 500 with `Failed to build dossier PDF`.
4. Fix onboarding moving-plan creation validation rejecting a visibly filled destination/date form.
5. Install or publish a current Android `preview` / `staging-preview` build that embeds `EXPO_PUBLIC_API_URL=https://staging.locateflow.com/api`; the installed APK has no staging API config and falls back toward production.
6. Decide Dossier consumer-free/pricing copy contract and update the failing web test.
7. Update stale admin static tests after page/client split.

Additional QA evidence added 2026-06-23:

- Live staging source-fix pass checked 16 public/auth/legal routes at mobile `390x844` and desktop `1440x900`, saving screenshots and metrics under [[audits/2026-06-23-live-staging-source-fixes]]. Live staging still showed mobile header overflow and stale sign-up checkout copy, but the current source branch contains fixes/tests for those source issues.
- Public/protected web internal link check found 18 unique staging links and 0 404/5xx/bad redirects.
- Portal enter sentinel check still reproduces 2 bad `0.0.0.0:3000` invalid-token redirects.
- Dossier source contract was reviewed: Free preview, Individual+ full Dossier, Pro PDF/neighborhood unless the `CONSUMER_FREE` feature flag intentionally promotes consumer read paths to Pro.
- Authenticated web QA for `mobile.qa@locateflow.com` completed after user approval: signup, auto-ready account state, legal/profile/address/services/moving onboarding, dashboard, address detail/edit, custom provider/service create, service detail/edit, budget, settings/support/help route batch, logout self-reset.
- Live authenticated Dossier payload returned HTTP 200 with flood, school, weather, hazards, radon, water, air, housing, EV charging, neighborhood, and `dossierPdf`; summary mode returned air/housing only; PDF export returned HTTP 500.
- Authenticated internal link crawl checked 27 logged-in links; only the Dossier PDF endpoint failed.
- Android `mobile.qa@locateflow.com` login was previously blocked by an installed production-targeted APK. Follow-up runtime QA installed a local debug APK with staging env, proved `https://staging.locateflow.com/api` in logcat, completed mobile login/seed/screenshots/delete, and saved artifacts under [[audits/2026-06-23-free-pivot-followup]]. Official signed `staging-preview` APK QA remains pending.
- Web logout self-reset was verified: after logout, the same email/password stayed on `/sign-in` with `Invalid email or password`.
- In-app Browser desktop health check covered `/`, `/pricing`, `/account/delete`, `/sign-in`, `/movers/portal`, and `/partners/portal`: no blank page, framework overlay, relevant console warning/error, or desktop horizontal overflow.
- Mobile source route inventory was saved: 50 Expo routes total, 37 static, 13 dynamic. Use it as the authenticated mobile screenshot matrix after a staging/preview Android build is installed.

## Current Audit Package Note

Docs-only audit package work is active under `docs/audit/`.

Latest audit handoffs:

- [[handoffs/2026-06-22-audit-package-phase1]]
- [[handoffs/2026-06-22-route-auth-matrix-pass]]
- [[handoffs/2026-06-22-billing-connectors-matrix-pass]]
- [[handoffs/2026-06-22-privacy-backup-matrix-pass]]

Current audit outputs include first-pass source/config findings, module maps,
flow maps, route guard summary, a route auth matrix scaffold, a billing/IAP
route matrix, a connectors/address-change route matrix, a privacy/export/account
deletion matrix, and an admin backup/import matrix. Application source code has
not been modified for this audit package.

Audit P1 queue:

1. Verify and clean credential-like markdown content without printing values.
2. Pin mutable third-party production-like compose image tags.
3. Add or explicitly waive workspace member-administration step-up.
4. Replace generic tracking metadata storage with event-specific allowlists.
5. Finish the manual one-row-per-route web/admin API auth matrix.
6. Rerun dependency audit with approved longer timeout or inspect trusted CI output.

Audit P2 queue:

1. Decide whether connector fallback action POST/DELETE should require password/MFA step-up (`SEC-CONNECTOR-001`).
2. Add billing/IAP transition tests for purchase, renew, cancel, refund, expire, revoke, duplicate, sandbox/test, and out-of-order cases.
3. Complete connector retention/export/delete and user-notification proof.
4. Build the model-by-model privacy export/delete policy table.
5. Run an approved disposable backup restore drill and backup route test suite.

The current product/theme decision is `LocateFlow`: dark mode follows the new
theme bundle's Gold (`#CBA45E`, `#DCBC7C`, `#B0852F`), while light mode follows
Sapphire/blue (`#2E5FB0`, `#3D74C8`, `#244C90`). Older memory that says
all-Sapphire across both modes is stale. `Move` is a domain noun only, not the product
wordmark.

The latest pass ports the homepage hero/mobile-phone direction from the new HTML
theme sources, remaps web/admin/mobile/shared premium and plan accents to the
dark-Gold/light-Sapphire split, and keeps warning amber only for warning
semantics. Local typecheck/tests/build passed, commit `8fb63c5b` was deployed to
Dokploy staging, and Chrome confirmed the homepage dark Gold + light Sapphire
views. Remaining staging work: authenticated
admin dashboard QA after the user handles credentials/password manager, official signed
Android `staging-preview` artifact QA, and redeploy verification because live staging web build-info is stale. Public web,
source-inventoried protected-route auth gates, admin unauthenticated static
routes, authenticated web routes, web self-reset, and Android auth-surface/config screenshots were captured on 2026-06-23. All 58
static web page routes and all 53 static admin page routes now have saved
unauthenticated screenshot artifacts. Dynamic web pages with QA IDs now have address/service evidence; native Android logged-in pages have local debug staging evidence, but signed preview artifact evidence is still pending.

Use this note as the Obsidian task queue for the next Codex, Claude Product Explorer, or Claude Product Judge pass.

## Current Strategic Context

Dashboard: [[00_PRODUCT_BRAIN_DASHBOARD]]
Experience layer: [[experience/USER_JOURNEY_MAP]], [[experience/FRICTION_LOG]], [[experience/AHA_MOMENT_MAP]], [[experience/EXPERIENCE_BACKLOG]]
Vision layer: [[vision/VISION_MASTER_PLAN]], [[vision/VISION_DECISION_SUMMARY]], [[vision/90_180_365_DAY_PLAN]]

## Active Ops Task

Current handoffs:

- Full-stack release QA: [[handoffs/2026-06-18-120744-full-stack-release-qa]]
- Dokploy cutover baseline: [[handoffs/2026-06-16-2313-dokploy-cutover-complete]]
- Current catch-up and QA triage: [[handoffs/2026-06-17-212646-product-brain-live-qa-billing-catchup]]
- Cron live fix: [[handoffs/2026-06-17-224200-ofelia-cron-live-fix]]
- Cron runbook/typecheck follow-up: [[handoffs/2026-06-17-225300-dokploy-cron-runbook-typecheck]]
- Live QA and billing readiness pass: [[handoffs/2026-06-18-094301-live-qa-billing-readiness]]

Latest full-stack QA findings recorded 2026-06-18:

- Local gates are green: lint, full typecheck, web/admin/mobile/connectors tests, Chromium public Playwright, and Chromium accessibility Playwright.
- Production health endpoints are green for web and admin.
- Live public web and admin surfaces checked in Chrome render without checked stale pricing/trial copy.
- Release is not fully clean: live Pro dashboard Route Map remains stylized/no real map image, and logged-in dashboard still has three nested `<a><button>` CTA instances.
- Mobile source/tests and latest production OTA metadata look correct for runtime `sdk55-1.0.0`, but on-device mobile QA remains blocked until a real device/emulator pass is run.

Verified 2026-06-17 ET / recorded 2026-06-18:

- Dokploy production compose app source deployment is `Done` at commit
  `df5307ef8bff1387bf775df76d690be4284a0f6a`.
- `main` also contains docs-only cron runbook merge
  `e6f3f9cdaeda568a186cfa7bf0795f3de22b74c6`.
- Containers shown running in Dokploy: `locateflow-web` healthy,
  `locateflow-admin` healthy, `locateflow-mysql` healthy,
  `locateflow-imgproxy` running, and `locateflow-cron` running.
- Dokploy Ofelia cron command parsing was fixed with
  `docker/locateflow-cron-runner.sh`; live 10:40 PM ET cron tick verified
  `blog-publish`, `checkout-cleanup`, and `connector-dispatch` all finished
  with `failed: false`.
- `pnpm verify:typecheck` passed after clearing ignored stale cache
  `apps/web/.next`.
- Public acquisition campaign now returns `INDIVIDUAL90` as a compatibility
  code with `trialDays: 14`, `$24/year`, `$4.99/month`, and no public
  `3 months`/`90 days`/`$3.99` offer text.
- Mobile OTA production update was published for runtime `sdk55-1.0.0`, update
  group `8303c581-4450-4ce0-9cc0-c78fdde17cf4`.
- Live public Chromium QA passed for public pages and accessibility; see
  [[handoffs/2026-06-18-094301-live-qa-billing-readiness]].
- Logged-in dashboard structural QA found 4 remaining nested `<a><button>`
  CTA instances around `Plan a Move` and `Add Address`.
- Two local web test expectations appear stale after accepted UX changes:
  pricing copy regression still expects `role="tablist"` instead of
  `role="group"` + `aria-pressed`, and Home Dossier still expects the old
  nine locked rows instead of the current limited free preview.

Ops cleanup still pending:

- Remove temporary Dokploy env keys `SOURCE_MYSQL_HOST`, `SOURCE_MYSQL_PORT`,
  `SOURCE_MYSQL_USER`, `SOURCE_MYSQL_PASSWORD`, and `SOURCE_MYSQL_DATABASE`.
  Do not reveal or record their values.
- Keep GitHub scheduled cron disabled while Dokploy cron is the intended single
  cron source.
- After any future cron config or runner change, explicitly restart/recreate
  `locateflow-cron` and verify the next runner-form tick; Dokploy did not
  automatically reload the long-running Ofelia daemon during the cron fix.
- Keep old DigitalOcean app and DB untouched for the rollback archive window
  unless the owner decides otherwise.

Accepted direction: LocateFlow is moving toward Address Life OS / Move Command Center.

Current strategy:

- Do not build AI from scratch.
- Surface, harden, and monetize existing [[product/AI_MOVE_BRIEFING_SPEC]].
- Surface [[product/PROVIDER_TRANSITION_WORKSPACE]] over existing MoveTask data.
- Package post-move monitoring into a user-facing retention surface.
- Use consented transition-outcome graph as the data moat.
- Defer partner-facing workspace and SEO-first strategy until validated.
- New vision candidates emphasize monetizing/surfacing existing intelligence, trust positioning, free tools that save into accounts, proof/export upsells, and compliant referral click-outs only after validation.

## Ready For Human Approval

These tasks may require source-code work in a separate session. Do not start them without explicit approval.

1. Review and ship the Route Map + dashboard CTA fix branch.
   - Evidence: [[handoffs/2026-06-18-120744-full-stack-release-qa]], [[handoffs/2026-06-18-122234-route-map-dashboard-fixes]]
   - Branch: `codex/route-map-geocode-fix`.
   - Fixes prepared: inline moving-plan destination geocode fallback, `/api/moving` nested coordinate payload, RouteMapCard full-map-to-OSM-preview fallback, and logged-in dashboard CTA nesting cleanup.
   - Approval needed: PR/push/deploy approval; production address re-save/backfill only with separate explicit approval if the owner’s existing plan still lacks coordinates after deploy.

2. Run post-deploy Route Map verification.
   - Scope: authenticated QA dashboard with a manually entered destination address; confirm real map or OSM preview image appears, `/api/maps/static` no longer yields a user-visible fallback-only card, and dashboard DOM has zero `a button` matches.
   - Approval needed: deploy approval and QA-account/live-session use.

3. Clean up stale test expectations from accepted pricing/free-preview UX.
   - Evidence: [[handoffs/2026-06-18-094301-live-qa-billing-readiness]]
   - Scope: update `subscription-copy-regression.test.ts` for
     `role="group"` + `aria-pressed`; update `home-dossier.test.tsx` for the
     current limited free preview instead of the old nine locked rows.
   - Approval needed: test-only changes.

4. Finish remaining live QA and billing readiness.
   - Scope: dedicated free QA-account dashboard checks, free-tier enforcement network checks, on-device mobile OTA verification, Stripe Dashboard price object verification, App Store / Google Play price verification.
   - Approval needed: use of QA accounts, Stripe/store dashboard read access, and any production config write.

4. AI Briefing experience hardening implementation.
   - Linked spec: [[product/AI_MOVE_BRIEFING_SPEC]]
   - Experience note: [[experience/AI_MOVE_BRIEFING_EXPERIENCE]]
   - Experiment: [[experiments/EXPERIMENT_BACKLOG]]
   - Scope: visibility, source/limitation explainer, gates, fallback, privacy tests, telemetry, upgrade teaser, reversible AI cohort gate.
   - Approval needed: source changes, AI runtime key/cohort handling, telemetry persistence, billing or upgrade copy.

5. Provider Transition board v1.
   - Linked spec: [[product/PROVIDER_TRANSITION_WORKSPACE]]
   - Experience note: [[experience/PROVIDER_TRANSITION_EXPERIENCE]]
   - Scope: read-only board over existing MoveTask lanes/statuses/assignees/progress.
   - Approval needed: source changes, UI copy, any status mutation, any telemetry persistence.

6. Post-move monitoring surface.
   - Linked backlog: [[product/FEATURE_BACKLOG]]
   - Experience note: [[experience/POST_MOVE_MONITORING_EXPERIENCE]]
   - Scope: user-facing view over upcoming billing, contract-end, auto-renewal, and service obligations.
   - Approval needed: source changes, notification changes, telemetry persistence.

7. Proof packet preview.
   - Experience note: [[experience/EXPORT_PROOF_PACKET_EXPERIENCE]]
   - Scope: preview existing export/dossier capabilities as a move proof packet before generating sensitive output.
   - Approval needed: source changes, export copy, Pro-gated billing copy, telemetry persistence.

## Docs-Only Prep Tasks

These can be done before source implementation.

1. Draft a north-star event taxonomy.
   - Link: [[product/PRODUCT_NORTH_STAR]]
   - Output: event definitions for transition confirmed with proof, transition status changed, briefing generated, monitoring item resolved, and proof packet generated.

2. Draft privacy-safe telemetry rules.
   - Link: [[product/DATA_MOAT_MAP]]
   - Output: allowed fields, disallowed fields, consent rules, retention questions, and test requirements.

3. Draft experiment one-pagers for the top three experiments.
   - Links: [[experiments/EXPERIMENT_BACKLOG]], [[experience/EXPERIENCE_BACKLOG]]
   - Output: hypothesis, audience, metric, guardrail, rollout, rollback, and approval gates.

4. Draft product copy guardrails.
   - Links: [[product/AI_MOVE_BRIEFING_SPEC]], [[product/PROVIDER_TRANSITION_WORKSPACE]], [[product/PRICING_AND_PACKAGING]]
   - Output: allowed/blocked copy for AI, provider transition, proof packets, and subscription claims.

5. Draft UX Judge review packet.
   - Links: [[experience/FRICTION_LOG]], [[experience/AHA_MOMENT_MAP]], [[experience/PRICING_UPGRADE_EXPERIENCE]], [[experience/TRUST_AND_SAFETY_EXPERIENCE]]
   - Output: top friction, top aha moments, upgrade moments, first three experiments, and rejected/deferred ideas.

6. Claude Strategy Compression review.
   - Links: [[vision/VISION_MASTER_PLAN]], [[vision/VISION_DECISION_SUMMARY]], [[vision/90_180_365_DAY_PLAN]]
   - Output: one 30-day lane, one 90-day lane, parked/deferred ideas, and public-source claims requiring spot-check.

7. Choose one growth/vision lane to execute first.
   - Candidate lanes: USPS OAuth hygiene plus COA anti-scam guide; free-tool MVP; consented transition-outcome graph plus 5-state rules schema.
   - Output: human-selected lane and explicit approval boundary.

8. Codex implementation spec for the selected lane.
   - Output: docs-only PRD, source files to inspect later, acceptance criteria, tests, privacy/compliance guardrails, and rollback plan.
   - Stop before source-code changes.

## Claude Product Judge Queue

Ask Claude Product Judge to review:

- Whether AI Briefing hardening or Provider Transition board should be the first approved source-code task.
- Which claims are safe for public-facing product copy today.
- Whether post-move monitoring should ship before or after the Provider Transition board.
- What proof artifact should count toward the north-star metric.

## Claude UX Judge Queue

Ask Claude UX Judge to review:

- Whether the first-session experience should lead with AI Briefing, Provider Transition setup, or service import/add.
- Which friction points most threaten activation, retention, trust, and willingness to pay.
- Which paid moments feel natural versus premature.
- Which UX experiments can be implemented without increasing privacy, billing, AI, or provider-automation risk.

## Claude Strategy Compression Queue

Ask Claude Strategy Compression to review:

- Which one growth/vision lane should execute first.
- Whether the vision should prioritize Individual paywall, free tool to account-save, broadband referral, post-move monitoring, or transition-outcome graph.
- Which Claude-reported public-source facts need immediate independent spot-check.
- Which ideas should be rejected, narrowed, or parked for 180+ days.

## Blocked Until Verified

- Partner-facing workspace.
- SEO-first strategy.
- Live provider account-change integrations.
- Official partnership claims.
- Customer demand, revenue, traffic, conversion, churn, or LTV claims.
- Rules content publication without source review.
- Referral, affiliate, or partner click-outs without disclosure/compliance review.
- Public use of Claude-reported source facts without independent spot-check.

## First Vision Implementation-Spec Candidates

1. USPS OAuth hygiene audit plus USPS COA anti-scam guide page.
2. Free-tool MVP using already-wired data, such as flood-zone or internet-at-new-address.
3. Consented transition-outcome event taxonomy plus small move-rules dataset schema.

## Recommended Next Codex Task

Prepare a **Claude Strategy Compression review packet** from [[vision/VISION_DECISION_SUMMARY]], then ask the human to choose one growth/vision lane before any application source-code work.

## Deferred / Do Last

- **Experiment 1 UI QA (Codex runs it from the UI).** Per human decision (2026-06-15), this is parked to run **LAST**, after other Phase-1 work. Codex executes the manual-UI QA matrix and records real results. Plan + matrix + ready execution steps: [[experiments/QA_EXP1_COMMAND_CENTER_DEPENDABILITY]] ("Execution plan" section). Test-only; flag stays `control` in prod; no runtime-source/telemetry/billing change; record BLOCKED honestly; write a `…-exp1-qa-results` handoff.
