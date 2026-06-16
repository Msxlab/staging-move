# Claude Product Strategy Council — LocateFlow

Date: 2026-06-15
Roles: Product Explorer (broad) + Product Judge (selective). Method: read the full `docs/ai` product/growth/research/experiment layer + verified technical/audit memory, ran a 16-agent adversarial council (10 bet judges, 3 ranking lenses, 3 MVP drafters), then **independently verified the load-bearing source claims** before asserting them. No application source was modified. No secrets/PII read.

> **Headline reframe (verified against source):** LocateFlow is **further along than the product docs imply**. Three of the ten "bets" are not greenfield — they are **already in code** and merely need surfacing/hardening/monetizing:
> - **AI Move Briefing is shipped end-to-end** (`apps/web/src/app/api/onboarding/briefing/route.ts` + `apps/web/src/lib/onboarding-briefing.ts` + `components/dashboard/move-briefing-card.tsx` + mobile card + tests). It is evidence-bound, workspace-scoped, entitlement-gated via `planFeatures().aiBriefing` (Family/Pro), Anthropic-keyed (`getRuntimeConfigValue("ANTHROPIC_API_KEY")`, `claude-haiku-4-5`) with a **rule-based fallback** and a hard **3 generations/UTC-day** cap. The LLM prose path is dormant only when the key is unset.
> - **The Provider-Transition classifier is already a production data model.** `MoveTask` (schema lines 946–956, 993–1001) carries `actionType` (stop/start/transfer/update/cancel/compare/find-replacement), `status` (SUGGESTED→ACCEPTED→IN_PROGRESS→COMPLETED→DISMISSED→REOPENED), origin/destination provider+address links, `assignedToUserId`, and `reason/caveats/confidence` — with a live `/api/move-tasks` route.
> - **A deterministic risk engine already ships** in admin (`apps/admin/src/app/api/moving/at-risk/route.ts`, 4 signals) and a post-move **cron fleet** already runs (bill-reminders, bill-overdue, contract-reminders 30/14/7/1d, move-reminders, lifecycle-nudges, digests) over an address-linked `Service` model (`billingDay`, `contractEndDate`, `autoRenewal`, `monthlyCost`/`actualMonthlyCost`).
> - **Entitlement tiers are real and tested** (`packages/shared/src/workspace-entitlements.ts`): FREE_TRIAL / INDIVIDUAL / FAMILY / PRO; `aiBriefing` (Family+Pro), `homeDossier` (Individual+), `dossierPdf`+`advancedExport`+`partnerHub`+`moverSuggestions` (Pro). Billing rails: Stripe web (hardened) + mobile IAP (server-verified, prod flags ON).

> **Security note for the team:** one council subagent's output contained an injected *"skill-router / refactor the export module / use the Skill tool"* instruction that did **not** originate from the user. It was ignored. A repo grep for the signature returned nothing committed, so it was transient/out-of-scope, not a poisoned tracked file — but worth awareness that agent runs over this tree encountered an injection attempt.

---

## 1. Final product north star (one sentence)

**LocateFlow is the Address Life OS that gets every household through a move with nothing missed — turning each address transition into a tracked, proven, intelligently-guided outcome — and stays useful long after move day.**

North-star **metric:** *verified address transitions completed per active household* — where a "transition" is a provider/obligation moved from needs-action → confirmed-with-proof. It rewards Move Memory (it persists), Move Intelligence (it was guided), and Move Operations (it actually completed), and it structurally penalizes the episodic-move trap.

## 2. What LocateFlow is today (verified only)

A mature (160 web + 119 admin API routes, 67 migrations, 432 tests), multi-surface product — web (Next.js), admin control-plane, and mobile (Expo SDK 55, store IAP flags ON in prod) — with:
- **Move Memory (verified):** authenticated accounts; multi-member **workspaces** (roles OWNER/ADMIN/MEMBER/CHILD/VIEW_ONLY, seats, token-hashed invitations, OVERFLOW read-only, step-up auth); **addresses** (residence intervals), **services** (field-encrypted sensitive fields, role-redacted), **moving plans**, **move tasks** (with the transition classifier above), **budgets** + cost logs; an **address dossier + PDF** (`addresses/[id]/dossier` + `/pdf`) and a 14-type `/api/export` + `/api/export/pdf` (step-up gated, audited).
- **Move Intelligence (verified):** a **shipped AI Move Briefing** (evidence-bound, gated, Anthropic + rule-based fallback); a **deterministic risk engine** (`admin/.../moving/at-risk`, `lib/user-health.ts`); a **recommendation engine** (saved/compared providers, recommendation feedback, "essential setup categories"); a `StateRule` admin model + programmatic **SEO state/metro pages** (`/moving/[state]`, `/moving/[state]/[city]`) + `states/data.ts` (1,542 lines).
- **Move Operations (verified):** Stripe checkout/portal/webhooks (hardened) + server-verified mobile IAP; **entitlement tiers**; a hardened **cron fleet** (bill/contract/move reminders, digests, lifecycle nudges) with multi-channel delivery (in-app + email + mobile push); **connector framework** (guarded: consent, HTTPS allowlist, retries, idempotency, circuit breakers, fallback — but a **framework**, no live carrier integrations); admin governance, tickets/help-center, notifications.
- **Growth/partner plumbing exists in code (no live partners verified):** acquisition campaigns + public trial + redeem, sponsored placements, affiliate tracking/conversions/export, passwordless mover portal (v1/v2), public `movers/apply` (doc byte-sniff + FMCSA), blog/help/providers public SEO surfaces.

**NOT verified (treat as hypothesis):** customer demand, traffic, conversion, churn, LTV, actual prices, any live partnership or live provider account-change integration, keyword/SEO data, and whether `ANTHROPIC_API_KEY` is set in production.

## 3. What LocateFlow should become in 12 months

The **Move Command Center → Address Life OS**: the daily home surface is the **AI Briefing** (continuously reflecting move state, not a one-time welcome card); the operational core is the **Provider Transition board** over the existing `MoveTask` classifier; a **post-move monitoring layer** (cron fleet → user surface) keeps the relationship alive past move day; **Risk Radar** threads deterministic intelligence through both; **proof packets + dossier** are the high-margin Pro upsell; **household collaboration** is the retention multiplier; a **governed Move Rules Registry backbone** makes the intelligence trustworthy and powers the first SEO tool. Monetized as a single **Pro/Family** tier, **Stripe-web-primary**. The compounding **transition-outcome data graph** becomes the moat.

## 4. Best initial customer segment

**The household move-organizer running a multi-provider and/or state-to-state move** (renter or homeowner) — the single person who already tracks services/budget, owns the workspace, and feels both the transition pain (move day) and the billing/obligation pain (after). They are the single payer; do **not** anchor revenue on secondary household members or on B2B partners. Higher-WTP signals (from `CUSTOMER_JOBS`): more providers, children, vehicles, cross-state move.

## 5. Top 3 product bets, ranked

The judge panel scored AI Briefing highest (4.45), but **all three ranking lenses independently demoted it from #1** — because its revenue-bearing LLM path is dormant without a key and its standalone moment doesn't extract money at the point of pain. Synthesized ranking:

1. **AI Move Briefing — harden, deepen, flip the key (score 4.45, build-now).** It is the entitlement anchor (the `aiBriefing` paywall line *is* the Family/Pro story) and the daily surface every other feature reports into. Work = hardening + deepening the continuous-lifecycle briefing + enabling the key reversibly — not building. This is the spine.
2. **Provider Transition Workspace — surface the existing `MoveTask` classifier (score 4.10, build-now).** The **wallet-open moment** (the dread of stopping/starting six utilities). A thin view layer over data already in production; the spec'd spine of Pro/Family monetization; and it **generates the proprietary transition-outcome data** that makes the Briefing/Radar smarter. (Revenue Hawk's #1.)
3. **Post-move address obligation monitoring — package the cron fleet (score 3.95, build-now).** The **only** bet with a verified retention=5 and zero AI dependency; the structural answer to the episodic-move trap and what makes "Address Life OS" real. (Moat + Ship-Fast lenses' #1.)

> **Move Risk Radar (3.85, build-now)** is not a separate flagship — it is the intelligence substrate (the already-shipped deterministic engine) that threads through all three: it powers the Briefing's "what's risky/blocked" section and a user-facing radar tab. Bundle it, don't sell it alone.

These three are mutually reinforcing: Briefing is the surface → it shows Transition status + Monitoring alerts → both emit outcome data → Briefing/Radar get smarter.

## 6. Top 3 product ideas to avoid for now (unanimous across lenses)

1. **Partner-facing mover/provider workspace — PARK (2.15).** Zero verified partners, zero partner WTP, partner-tenant multi-tenancy is "designed, not built," `FEATURE_API_CONNECTORS` is default-OFF with only USPS registered, and the codebase's own strategy calls building this pre-partner "the most expensive mistake." Build only after ≥1 partner is actively distributing and asking for reporting/branding.
2. **SEO free tools as a *first* move — DEFER (2.75).** Channel demand entirely unverified, SEO compounds over months, tools are trivially cloneable, and it **depends on** a save-to-account artifact and a reviewed rules registry that should ship first. Strong as a fast-follow accelerant, wrong as a now-anchor.
3. **Move Rules Registry as a *standalone* build — DEFER content, build backbone later (2.85).** The plumbing is real, but the load-bearing cost is **sourced, dated, 50-state legal content** (editorial labor + liability), not code — and nobody pays for a rules table directly. Build the governed `MoveRule` backbone *alongside* the first consumer (Radar/Briefing) that needs structured rules.

## 7. Best revenue path

A single **Pro/Family** subscription, anchored by **AI Briefing + Provider Transition + post-move monitoring**, with **proof packets** as a high-margin episodic upsell — gated entirely by **existing** entitlement flags (`aiBriefing`, `advancedExport`, `dossierPdf`); no new billing plumbing. **Buyer = the single move-owner.** **Channel = Stripe web checkout/portal primary** (hardened: raw-body, signature, livemode, idempotency; supports seat-based workspace billing; avoids the 15–30% store tax on a high-intent recurring purchase). **Mobile IAP only for in-app impulse upgrades** (briefing/transition board on the home tab) — the prod EAS store flags are already ON and IAP is server-verified. Do **not** price on secondary-member conversion; Household is a tier *wrapper*, never the anchor.

## 8. Best data moat path

**The transition-outcome graph.** Every accepted/completed `MoveTask` (`actionType` stop/start/transfer/cancel + origin/destination provider-category + `confidence` + recommendation feedback) plus every post-move `Service` obligation correction (cancel/renew/transfer at billing/contract events) is a **consent-safe, no-raw-PII** signal: *"for a move from provider-category A → B in state X, here is the real task sequence, what got blocked, and what households actually did."* Coarsen to category + 2-letter state (the encrypted/role-redacted posture already removes PII), aggregate across workspaces, feed back into the recommendation engine and the Briefing/Radar "risky/blocked" signals. **The board UI is copyable; the outcome corpus is not** — and it is the part that survives past move day.

## 9. Best growth loop

**Household invites → transition assignments → second-member activation → next move-owner.** A paying move-owner assigns transition tasks (`assignedToUserId`, live in `/api/move-tasks`) to household members via token-hashed `WorkspaceInvitation`. Each invited member lands inside the product **mid-move, pre-qualified**, sees their own assigned utility transfers, and a meaningful fraction (partners, adult kids, roommates) are themselves near a move → they become the next Pro-buying move-owner who re-invites. Uses only verified surfaces (invites + assignment flow + seat limits). **Exports/dossier** are the shareable artifact that pulls landlords/co-tenants in as the second-order edge. SEO is a slower top-of-funnel feeder, not the engine.

## 10. MVP spec — AI Move Briefing (refine the shipped feature)

*(Grounded in the verified implementation; this is a harden-and-deepen spec, not a build-from-zero.)*

- **Goal / aha:** a paid mover reads a 2–3 sentence, honest "here's exactly where you stand + what to do next," generated only from their own move data, then taps one of ≤3 deep-linked next actions.
- **In-scope v1 (all VERIFIED routes/models):** `POST /api/onboarding/briefing` (auth + 10/60s rate-limit + force-dynamic); coarse non-PII signals via `buildBriefingSignals` from Profile/primary Address/active MovingPlan/tracked Service/SavedProvider; pending essentials via `getEssentialSetupCategories`; **LLM summary only** (`claude-haiku-4-5`, 12s timeout, 600 tokens, key from runtime config); deterministic, server-derived deep-linked actions via `buildBriefingActions`; `buildFallbackBriefing` on no-key/error/timeout/cap; gate `planFeatures().aiBriefing` (Family/Pro; others get HTTP-200 `upgradeRequired`); per-user/per-UTC-day cache + hard 3/day cap (Upstash); telemetry `recordIntegrationOutcome`.
- **Non-goals:** no autonomous actions (summarize + deep-link only); no legal/tax advice; no invented dates/providers/prices/stats; no PII to the LLM; LLM output display-only, never persisted, never drives a decision; no "autonomous AI" marketing.
- **Data model:** reuse-only, **zero new tables** in v1. A durable `MoveBriefing` table is NEW and explicitly deferred.
- **UX flow:** load → call endpoint → gates (auth→rate-limit→key→entitlement→scope) → gather signals → nothing pending = short reassuring card (no AI spend) → changed inputs within budget = one Haiku summary + parallel deterministic actions → render summary + ≤3 tappable rows → tap deep-links to the right screen → same-day unchanged = cache hit.
- **Evidence-binding rule:** *every claim must trace to a coarse signal the server actually passed; anything not given is unknown and omitted, never invented.* Structured actions are derived deterministically (not model output), so destinations stay honest even on fallback.
- **Entitlement hook:** `planFeatures(plan).aiBriefing`; config gate precedes plan gate; 3/day cap is spend control, not a tier line.
- **Acceptance:** (1) no PII in the Anthropic request body (coarse signals + 2-letter state only); (2) key-unset/error/cap → HTTP-200 rule-based briefing with deep-links, never 5xx, never invented facts; (3) Family/Pro get a briefing, Individual/Free-Trial get `upgradeRequired` (200), same-day unchanged = cache hit. **Guardrail metric:** AI generations per entitled user per UTC day ≤ 3 (hard); watch `generated:cached` ratio for spend spikes.
- **Smallest week-1 slice:** ship honest fallback + the four gates with the **AI call dark** (key intentionally unset); wire both cards + deep-links; then **flip the runtime key + 3/day cap in one reversible deploy** to enable the Haiku summary (fully reversible by unsetting the key). Deepening (continuous lifecycle briefing across move stages, "who owns what" household view) is the follow-on.

## 11. MVP spec — Provider Transition Workspace (authored by Council; the workflow drafter for this item was hijacked by the injection and discarded)

- **Goal / aha:** open one board and see every provider/service auto-classified into action lanes — Keep / Cancel / Switch / Transfer / Update / Needs-decision — with what's done vs pending, who owns it, and proof captured.
- **In-scope v1 (VERIFIED):** read + status-advance over `MoveTask` (`actionType` → lane; `status` lifecycle SUGGESTED→…→COMPLETED/DISMISSED/REOPENED) via the live `/api/move-tasks` route; origin/destination provider+address links; `assignedToUserId` household assignment (Family/Pro); "Switch/Find-replacement" lane deep-links into the recommendation engine + saved/compared providers; a **confirmation/proof note** per task (reuse the field-encrypted sensitive-field + role-redaction posture); progress rollup; export the board state via the existing dossier/export(+PDF) path.
- **Non-goals (hard copy guardrails):** **no autonomous provider/carrier account changes**; **no live connector calls in v1** (connectors are a guarded, default-off, USPS-only framework); no "auto-sync" / "Verified Sync" / marketplace / partner-offer claims; copy must say **"guided — you take the action."**
- **Data model:** reuse `MoveTask` + `Service` + `ServiceProvider` + `SavedProvider` + `Workspace`/members. Proof in v1 = an encrypted confirmation-number/notes value + the dossier snapshot (NOT a document vault). A dedicated `ProviderTransitionProof`/`Attachment` entity is **NEW** and deferred (no such model exists today).
- **UX flow:** plan → board with lanes → each card shows provider, action, status, assignee → advance status / add confirmation note → "switch" deep-links to recommendations → rollup ("9 of 14 handled").
- **Entitlement:** basic board = Individual+; multi-member assignment (2+ members) + proof export = Family/Pro; bulk + proof PDF = Pro (`dossierPdf`/`advancedExport`).
- **Acceptance:** (1) every existing `MoveTask` renders in the correct lane by `actionType` with correct status badge; (2) status advance persists + emits audit/telemetry; (3) VIEW_ONLY can't mutate, CHILD self-only, assignment validates membership. **Guardrail metric:** support tickets of the form "did it actually cancel my service?" must stay ≈0 (automation-confusion = copy failure).
- **Smallest week-1 slice:** read-only board grouping existing `MoveTask` rows by `actionType` lane with status badges; no new mutations beyond the existing status-advance.

## 12. MVP spec — Move Rules Registry (backbone, built alongside its first consumer)

- **Goal / aha:** turn the unstructured `StateRule` substrate into a structured, versioned, **citation-bearing** registry so each jurisdiction obligation (DMV, voter, tax, utility, insurance) is a discrete rule with an official `sourceUrl`, effective date, and confidence — and so the move-task classifier **cites** rules instead of inferring them ("Why this task" → links the exact rule).
- **In-scope v1 (VERIFIED substrate):** new structured `MoveRule` rows replacing reliance on the six free-text `StateRule` columns; per-rule citation + freshness; admin CRUD extending the existing `apps/admin/.../state-rules` route (which already has `requirePermission` + `requirePasswordConfirm` + `AdminAuditLog`); **fix the public `apps/web/.../state-rules` route bug** (it currently drops `utilityInfo`/`insuranceRules`/`commonProviders`); write citations into existing `MoveTask.reason/caveats/confidence`; dossier-pattern render + export inclusion.
- **Non-goals:** no autonomous gov/provider actions; no legal advice; no invented "official" status; no new legal content without a reviewed source; AI summarizer only compresses a cited row (display-only).
- **Data model:** reuse `StateRule`, `MoveTask` fields, admin gate, `planFeatures()`, runtime-config/feature-flags. One **NEW** table `MoveRule` (stateCode+category, title/body, sourceUrl/sourceType/lastVerifiedAt/confidence, version/supersededById); additive migration with backfill from `StateRule`.
- **AI evidence-binding:** summarizer input is a single `MoveRule` row; every sentence derivable from `body` + echoes `sourceUrl`; no row → not called ("check your state's official site"); confidence can only lower; flag kill-switch; deterministic raw-rule fallback.
- **Entitlement:** Free = teaser; Individual+ (`homeDossier`) = full rules; AI summarizer gated on existing `aiBriefing` (Family/Pro); PDF on `dossierPdf` (Pro). No new flag.
- **Acceptance:** (1) public route returns all six categories incl. the three formerly-dropped ones (+ updated `route.test.ts`); (2) DMV+voter MoveTasks cite a real `MoveRule.id`/`sourceUrl` with graceful no-rule fallback; (3) admin edit versions + supersedes + audits + step-up. **Guardrail metric:** 0 rules shown with `confidence ≥ MEDIUM` but missing/non-official `sourceUrl`.
- **Smallest week-1 slice:** add `MoveRule` table + backfill; **fix the public read contract** (close the dropped-fields bug) with tests; read-only "State requirements" section on the plan page (no AI, no admin UI yet).

## 13. 30-day roadmap (harden + surface what exists)

- **Wk 1–2 — AI Briefing:** ship honest fallback + 4 gates with AI dark; wire web+mobile cards + deep-links; then flip `ANTHROPIC_API_KEY` + 3/day cap in one reversible deploy. Define + instrument the **north-star event** (transition confirmed-with-proof). Add the Individual/Free **upgrade teaser** (entitlement already returns `upgradeRequired`).
- **Wk 2–3 — Provider Transition board v1:** read-only board over existing `MoveTask` `actionType`/`status`, lanes + status badges + manual advance + encrypted confirmation note. No connectors.
- **Wk 3–4 — Post-move monitoring surface v1:** a "what's coming" view over the cron-fleet reminders (contract-end, billing day, renewal) on the address-linked `Service` model; verify `NotificationPreference` coverage. Stand up the **consented, coarse, no-PII transition-outcome telemetry**.
- Throughout: instrument guardrails (support tickets, refunds, AI cost-cap ratio, automation-confusion).

## 14. 90-day roadmap

- **Month 2:** user-facing **Risk Radar** tab (extend `admin/.../moving/at-risk` engine; add budget-surprise signal from `ServiceCostLog` vs `Budget`) feeding the Briefing's risky/blocked section, entitlement-gated; **proof packet** generation as Pro upsell (reuse `/api/export` + dossier PDF); instrument + turn on the **household invite/assignment growth loop**.
- **Month 3:** **Move Rules Registry backbone** (`MoveRule` table + backfill, fix public-route bug, classifier cites rules) built alongside Radar/Briefing; **first SEO free tool** (state move-rules finder or address-change checklist) that saves into an account — only after rules content review; **data-moat v1**: first aggregate transition-outcome report feeding the recommendation engine.

## 15. Ten experiments, ranked by impact / effort / confidence

Scores 1–5 (Impact: value; Ease: 5 = least build; Confidence: grounded in verified capability). Rank = Impact + Ease + Confidence.

| # | Experiment | Impact | Ease | Conf | Rank score | Verdict |
|---|---|---|---|---|---|---|
| 1 | **Flip `ANTHROPIC_API_KEY` for a cohort** + measure activation/retention lift vs rule-based briefing | 5 | 5 | 5 | 15 | Run first (config flip, reversible) |
| 2 | **Post-move monitoring digest** ("save money" renewal/contract-end nudge) → D30/D60 retention past move day | 5 | 4 | 5 | 14 | Run |
| 3 | **Provider Transition board** (read-only over `MoveTask`) → move-window engagement + task-completion | 5 | 4 | 5 | 14 | Run |
| 4 | **Briefing paywall teaser** to Individual/Free → upgrade-click → Pro/Family conversion (Stripe web) | 5 | 5 | 3 | 13 | Run |
| 5 | **Household invite prompt** at task creation (2+ tasks) → invite→2nd-member activation→completion | 4 | 5 | 3 | 12 | Run |
| 6 | **Risk Radar tab** (deterministic 4 signals) + one-tap fix deep-links → risk-resolution rate | 4 | 3 | 5 | 12 | Run |
| 7 | **Proof packet** (landlord/insurance) Pro upsell → packet-generated→upgrade (episodic WTP) | 3 | 4 | 4 | 11 | Fast-follow |
| 8 | **Budget-surprise signal** (`ServiceCostLog` est-vs-actual) in radar/briefing → engagement | 3 | 4 | 4 | 11 | Fast-follow |
| 9 | **Address Timeline** view (assembly over address/move/audit) → post-move return visits + dossier export | 3 | 4 | 3 | 10 | Fast-follow |
| 10 | **State move-rules finder** free SEO tool (anon→save) → organic signups (gated on rules review) | 3 | 3 | 2 | 8 | Last (slow, low-confidence channel) |

Guardrails for every experiment: support tickets, refunds, privacy complaints, automation-confusion, AI cost cap. Each must declare verified capability + hypothesis + metric + audience + rollback.

## 16. Exact Codex prompts for the first 3 approved experiments

> These run in a **separate Codex implementation session** the user explicitly triggers. They reuse verified primitives, keep AI reversible, write tests, and touch no unrelated code. (This council pass modified no source.)

### Codex Prompt 1 — Experiment 1: AI Briefing hardening + reversible key flip + upgrade teaser
```
Repo: C:\Users\Windows\Documents\move-main\move-main (pnpm/turbo monorepo).
Context: The AI Move Briefing already exists end-to-end: apps/web/src/app/api/onboarding/briefing/route.ts,
apps/web/src/lib/onboarding-briefing.ts, components/dashboard/move-briefing-card.tsx, the mobile MoveBriefingCard,
entitlement planFeatures().aiBriefing (packages/shared/src/workspace-entitlements.ts), Anthropic key via
getRuntimeConfigValue("ANTHROPIC_API_KEY"), rule-based fallback, and a 3/UTC-day cap.
Goal: make this production-launch-ready WITHOUT enabling AI spend yet, then make enabling it a single reversible flip.
Tasks (scoped; do not touch unrelated routes):
1. Verify + test the four gates in order (auth → rate limit → key configured → planFeatures().aiBriefing → workspace scope)
   and that key-unset / API-error / cap-spent ALL return HTTP 200 with a rule-based briefing carrying deterministic
   deep-link actions — never 5xx, never an invented date/provider/price. Add/extend route.test.ts cases for each.
2. Add a privacy assertion test proving the Anthropic request body contains no PII (no name/street/full address/email/
   ZIP/phone/account id) — only coarse signals + 2-letter state.
3. Add the Individual/Free upgrade teaser: when the endpoint returns upgradeRequired (HTTP 200), the web + mobile cards
   render a non-blocking "Unlock AI Move Briefing (Pro/Family)" CTA that deep-links to the existing checkout/upgrade flow.
4. Add a feature-flag/runtime-config-driven cohort gate so the AI summary path can be enabled for a percentage of
   entitled users, defaulting OFF. Enabling = setting ANTHROPIC_API_KEY + the cohort flag; disabling = unsetting the key.
5. Emit/confirm telemetry distinguishing generated vs rule_based vs cached vs gated; add a dashboardable counter for
   AI generations per entitled user per UTC day (must stay ≤ 3).
Constraints: keep LLM output display-only (never persisted, never drives a decision); no new DB tables; no marketing
copy implying autonomous AI. Run only the briefing + entitlement tests you touch. Show diffs + test output. Do NOT set
any secret/key yourself.
```

### Codex Prompt 2 — Experiment 3: Provider Transition board v1 (read-only over MoveTask)
```
Repo: C:\Users\Windows\Documents\move-main\move-main
Context: MoveTask (packages/db/prisma/schema.prisma ~lines 946-1001) already carries actionType
(stop/start/transfer/update/cancel/compare/find-replacement), status (SUGGESTED→ACCEPTED→IN_PROGRESS→COMPLETED→
DISMISSED→REOPENED), origin/destination provider+address links, assignedToUserId, reason/caveats/confidence. A live
/api/move-tasks route + workspace data-scoping exist. Saved/compared providers + a recommendation engine exist.
Goal: ship a READ-ONLY Provider Transition board v1 over existing MoveTask data — no new mutations, no connectors.
Tasks:
1. Add a board view (web dashboard + mobile tab) that loads the user's MoveTasks (workspace-scoped) and groups them into
   lanes by actionType: Keep / Cancel / Switch / Transfer / Update / Needs-decision. Show provider, action, status badge,
   and assignee (assignedToUserId) per card.
2. The "Switch"/"Find-replacement" lane links each card into the existing recommendation/compare-providers surface.
3. Respect permissions exactly: VIEW_ONLY cannot mutate (board is read-only in v1 anyway), CHILD sees self-only, assignment
   reflects existing membership rules. Reuse the field-encrypted/role-redaction posture for any sensitive field shown.
4. Add a progress rollup ("N of M handled") from status.
5. Tests: every existing MoveTask renders in the correct lane by actionType with the correct status badge; scoping/permission
   tests; empty-state.
Hard copy guardrail: the UI must say "guided — you take the action." NO "auto-sync"/"Verified Sync"/marketplace/partner-offer
copy, and NO connector/provider account-change calls. Run only the move-task/board tests you touch. Show diffs + test output.
```

### Codex Prompt 3 — Experiment 2: Post-move obligation monitoring surface v1
```
Repo: C:\Users\Windows\Documents\move-main\move-main
Context: A hardened cron fleet already runs (apps/web/src/app/api/cron/{bill-reminders,bill-overdue,contract-reminders,
move-reminders,move-week-alerts,lifecycle-nudges,task-reminders,daily-digest,weekly-digest} — CRON_SECRET-guarded,
idempotent, timezone-aware, NotificationPreference-aware, multi-channel: in-app feed + email + mobile push). The Service
model is address-linked with billingDay, contractEndDate, autoRenewal, monthlyCost/actualMonthlyCost and scan indexes.
Goal: surface this existing monitoring as a user-facing "What's coming" view that makes the recurring value visible — the
retention layer that outlives move day. Do not change cron logic; build the read surface + a consented telemetry loop.
Tasks:
1. Add a "What's coming" view (web + mobile) listing upcoming obligations from the user's address-linked Service records:
   contract-end (30/14/7/1-day), billing day, auto-renewal — workspace-scoped, NotificationPreference-aware, reusing the
   same date logic the cron jobs use (extract a shared helper if needed; keep cron behavior identical).
2. Each item offers a deep-link to update/cancel/transfer that Service (reusing existing service routes) — guided, never
   autonomous.
3. Add consented, COARSE, no-PII telemetry of obligation outcomes (category + 2-letter state + action taken: kept/cancelled/
   transferred/renewed) behind explicit consent — no addresses, no confirmation numbers, nothing that leaves the
   encrypted/role-redacted boundary. This seeds the transition-outcome data moat.
4. Tests: view renders correct upcoming items per the cron date windows; permission/scoping; telemetry emits only coarse
   fields and only with consent.
Constraints: do not modify cron scheduling/guards; no new external integrations; reversible behind a feature flag. Run only
the tests you touch. Show diffs + test output.
```

## 17. Verification log + open evidence gaps

- **Independently verified by reading source:** briefing route + lib + cards + tests (AI Briefing shipped, gated, fallback, 3/day cap); `MoveTask` schema fields (`actionType`/`status`/`assignedToUserId`, lines 946–1001); `workspace-entitlements.ts` tier matrix + tests; admin `moving/at-risk` route + cron fleet + dossier/export routes (from the audit-pass file inventory). Counts (160/119/67/432) confirmed in the prior audit pass.
- **Still hypothesis (must validate before scaling):** all demand/traffic/conversion/churn/LTV; whether `ANTHROPIC_API_KEY` is set in prod; any live partnership or live provider account-change integration; SEO keyword demand; the editorial accuracy of 50-state rule content. Treat partner-facing and rules-content bets as gated on this evidence.
- **Bug surfaced for the backlog (not a strategy item):** the public `apps/web/.../state-rules` route appears to drop `utilityInfo`/`insuranceRules`/`commonProviders` — fold the fix into the Move Rules Registry MVP (item 12), with a test.
- **Security:** a prompt-injection ("skill-router / refactor the export module") reached one subagent's output; ignored; not found in the committed tree on grep. Worth team awareness for agent runs over this repo.
