# Move Rules Registry — MVP Spec

## Council-ingested framing

### Current verified product capability

- Verified substrate includes admin `StateRule` capability, public/admin state-rule routes, provider governance, runtime config, feature flags, exports/dossier patterns, and existing `MoveTask` reason/caveat/confidence fields.
- The Claude Product Strategy Council selected Move Rules Registry as a backbone to build alongside its first consumer, not as a standalone content project.
- The Council also identified a public state-rules read-contract issue: utility, insurance, and common-provider categories appear to need coverage in the public response and tests.
- Not verified: legal/jurisdiction rule content accuracy, official coverage for all states, customer demand, partner status, or a production AI rule summarizer.

### Hypotheses

- Hypothesis: a citation-bearing registry makes Risk Radar, AI Briefing, state requirements, and SEO tools more trustworthy.
- Hypothesis: users value rules only when they appear in context, such as "why this task exists" or "what this state requires."
- Hypothesis: editorial/source review, not code, is the hard part of scaling rules coverage.
- Hypothesis: rules should power guidance and proof, not legal advice or autonomous government/provider actions.

### Recommended next decisions

- Accepted MVP: build the structured `MoveRule` backbone alongside its first consumer, with citations, freshness, confidence, and versioning.
- Week-1 slice: add the additive registry mechanism, backfill from existing `StateRule` text, fix the public read contract for all categories, and render a read-only "State requirements" section.
- Require official or reviewed `sourceUrl` for any rule shown at medium-or-higher confidence.
- Keep AI summarization optional, display-only, and behind a kill switch; no AI-authored rules.
- Defer broad 50-state content creation until a source-review workflow and human approval exist.

### Open questions for Claude Product Review

- Which rule categories are safe enough for first launch without legal review?
- What source types count as official or trustworthy for DMV, voter, tax, utility, insurance, and common-provider categories?
- What confidence model should determine whether a rule appears in briefing, radar, SEO, and export surfaces?
- What governance workflow should exist before rules can be marketed externally?

### Possible Codex implementation tasks

- Draft an additive `MoveRule` schema and backfill plan for later human-approved implementation.
- Create route/test requirements for returning all public state-rule categories.
- Draft a "State requirements" UX spec with citations, last-verified dates, confidence, and legal-disclaimer guardrails.
- Add classifier-citation acceptance criteria for `MoveTask.reason`, `caveats`, and `confidence`.

## Detailed MVP spec from Council output

Build-ready v1. Grounded only in verified capability (real models/routes cited inline). Hypotheses are labeled `(hypothesis)`.

> **Verified substrate:** admin `StateRule` model + `/api/state-rules` (admin & public), provider governance, runtime config, feature flags. **Not verified:** any legal/jurisdiction rule *content*, any LLM integration (AI summarizer is greenfield), customer demand, partnerships.

---

## 1. Goal + activation moment

**Goal:** Turn the unstructured `StateRule` substrate into a structured, versioned, citation-bearing **Move Rules Registry**, so every jurisdiction obligation a mover sees (DMV, voter, tax, utility market, insurance) is a discrete rule with an official `sourceUrl`, an effective date, and a confidence — and so the existing move-task classifier can **cite** those rules instead of inferring them.

**Aha moment:** On a move plan, the user opens "What this state requires of you" and sees concrete, dated obligations for their destination state, **each with a Source link to an official page** and a "Last verified" date — and their auto-generated DMV/voter `MoveTask`s now show a *Why this task* line citing the exact rule, not a generic checklist entry.

---

## 2. In-scope v1 (each tied to a real route/model)

- **Structured rule rows.** Replace reliance on the six free-text columns of `StateRule` (`packages/db/prisma/schema.prisma:716` — `dmvRules`, `voterRegistration`, `utilityInfo`, `taxInfo`, `insuranceRules`, `commonProviders`) with discrete rows in a `MoveRule` table (§4), one per obligation, keyed by `stateCode` + `category`. Columns are **kept** and backfilled (additive migration — respects the runtime migration-coupling guardrail).
- **Citation + freshness per rule.** Each rule carries `sourceUrl`, `sourceType`, `lastVerifiedAt`, `confidence` — reuse `TASK_SOURCE_CONFIDENCE_LEVELS` from `packages/shared/src/provider-move-domain.ts:47`.
- **Admin authoring CRUD.** Extend the existing admin surface `apps/admin/src/app/api/state-rules/route.ts` (+ `[id]/route.ts`) to author rule rows. Keep the current gate verbatim: `requirePermission("state_rules", …)`, ADMIN-to-write, `requirePasswordConfirm` step-up (1h grace at `route.ts:11`), `AdminAuditLog` write on every mutation (`route.ts:63`).
- **Rule versioning (closes an audited gap).** The `08-state-rules` audit flags "Version/locking yok; iki admin ayni rule'u ezebilir." Add optimistic-lock `version` + `supersededById`; edits write a new revision and mark the prior superseded (never destructive delete).
- **Fixed public read contract.** Repair `apps/web/src/app/api/state-rules/route.ts`, which today returns only `dmvRules/voterRegistration/taxInfo` and **silently drops** `utilityInfo/insuranceRules/commonProviders` (confirmed in code + audit). v1 returns all public categories as structured rows with `sourceUrl` + `lastVerifiedAt`.
- **Classifier rule-citation.** The classifier in `packages/shared/src/provider-move-domain.ts` already emits `GOVERNMENT_UPDATE` / `INSURANCE_REQUOTE` actions (`MOVE_TRANSITION_ACTION_TYPES`) into persisted `MoveTask`s. v1 writes the matching `MoveRule.id` + `sourceUrl` into the **existing** `MoveTask.reason` / `caveats` / `confidence` fields (`schema.prisma:961-963`) — no MoveTask schema change.
- **Registry section on the plan/dossier surface.** Render destination-state rules reusing the dossier section pattern (graceful status unions, telemetry buckets, plan-gated teaser) from `apps/web/src/app/api/addresses/[id]/dossier/route.ts`.
- **Export inclusion.** Include the rules section in the existing `/api/export` + `/api/export/pdf` (auth + step-up gated, already emits audit events) and the address dossier PDF, behind the `dossierPdf` flag.

---

## 3. Explicit non-goals (v1 must NOT do)

- **No autonomous provider/government actions.** No DMV filing, no voter submission, no utility contact, no account linking. Rules are informational. Connectors stay a guarded framework with **no verified live integrations** — wire none.
- **No legal advice.** Rules are sourced operational summaries with a citation, never "you must" counsel. Every rule shows "Informational only — confirm at the official source" and links out. No interpretation of the user's personal legal situation.
- **No invented partnerships or "official" status.** A rule's `sourceType` (`STATE_GOV`/`PUC`/…) describes the *citation*, never implies LocateFlow has a partnership; do not reuse provider `OFFICIAL_PARTNER` trust language for rules.
- **No unverified AI claims.** The AI summarizer (§6) is greenfield — no LLM is integrated today. It may only compress an **existing cited rule row**; it must never assert a rule with no `MoveRule` source. No rule → "not available, check your state's official site."
- **No fabricated coverage/demand.** Never claim a state is "fully covered" or cite traffic/conversion. Unsourced categories render "unknown / not yet sourced."
- **No new legal content shipped as fact.** v1 ships the registry *mechanism* + backfill of existing text; it does not bulk-author new obligations without an official `sourceUrl`.

---

## 4. Data model / inputs

**Reuse (no schema change):**
- `StateRule` (`schema.prisma:716`) — kept; free-text columns are the v1 backfill source and fallback.
- `MoveTask.reason` / `caveats` / `confidence` (`schema.prisma:961-963`) — carry the cited rule reference.
- Enums + `TASK_SOURCE_CONFIDENCE_LEVELS` (`packages/shared/src/provider-move-domain.ts`).
- `AdminAuditLog`, `requirePermission`, `requirePasswordConfirm` (admin gate, already wired).
- `planFeatures()` (`packages/shared/src/workspace-entitlements.ts:62`) — entitlement (§7).
- `RuntimeConfigEntry` / `FeatureFlag` (`schema.prisma:1409/1617`) — kill-switches for the AI summarizer and the new public contract.

**NEW table — `MoveRule`** (unavoidable; the structured registry):
- `id`, `stateCode` (matches `StateRule.stateCode`), `category` (enum `DMV | VOTER | TAX | UTILITY_MARKET | INSURANCE | COMMON_PROVIDERS`), `title`, `body` (Text), `isPublic`.
- `sourceUrl` (**required** when `confidence >= MEDIUM`), `sourceType` (`STATE_GOV | FEDERAL_GOV | PUC | OTHER`), `lastVerifiedAt`, `confidence` (reuse `TASK_SOURCE_CONFIDENCE_LEVELS`).
- `version` (int), `supersededById` (self-FK, nullable), `effectiveFrom` (nullable), `createdByAdminId`, `updatedAt`.
- Indices: `@@index([stateCode, category])`, `@@unique([stateCode, category, version])`.
- Migration is **additive**: create table, backfill one row per non-null `StateRule` column (`confidence = UNVERIFIED`, no `sourceUrl`), leave columns as fallback.

**Inputs:** destination `stateCode` from `MovingPlan.toAddress.state`; the user's services/categories (to map rules → classifier tasks). No external network calls in v1 — sources are operator-curated URLs, not fetched.

---

## 5. Core UX flow

1. User opens a moving plan with a destination address (`MovingPlan` → `toAddress.state`).
2. Plan shows a **"State requirements"** section; client calls the fixed `GET /api/state-rules?state=XX`, now returning structured rows.
3. User sees rules grouped by category (DMV, Voter, Tax, Utility market, Insurance), each with a one-line summary, a **Source** link, and a "Last verified" date.
4. For DMV / voter / insurance categories matching the user's situation, classifier-generated `MoveTask`s show **"Why this task,"** citing the rule + source.
5. User taps a rule → detail with full `body`, source link, and the standing "Informational only — confirm at the official site" caveat.
6. (Paid) User exports the plan; the rules section is included in the PDF via the existing export / dossier-PDF path.
7. (Admin) Operator opens admin → State Rules → state → authors/edits a rule row (password step-up), sets `sourceUrl` + `confidence`; save creates a new `version`, supersedes the prior, writes `AdminAuditLog`.

---

## 6. AI feature — evidence-binding rule + guardrails

The only AI surface in v1 is an **optional rule summarizer** (greenfield; no LLM today — new build behind a flag). It does **not** generate rules.

**Evidence-binding rule (hard contract):**
- Input is a **single `MoveRule` row** (`body` + `sourceUrl`). Its only job: compress that row to one plain sentence.
- Every sentence must be derivable from that row's `body`; it must echo the row's `sourceUrl` verbatim as the citation.
- If a category has **no** `MoveRule` row, the summarizer is **not called** — UI shows "Not available for {state} — check your state's official site." Never invent a rule.
- Output inherits the source row's `confidence` and may only *lower* it, never raise it. Anything not in the row renders as "unknown."
- Mirrors the dossier's evidence-bound posture: cite a move fact (a curated, dated, sourced rule) or label it unknown.

**Safety guardrails:**
- Hard `FeatureFlag` + `RuntimeConfigEntry` kill-switch; off by default until verified.
- No personal/sensitive data in the prompt — rule `body` is jurisdiction-general; encrypted service fields stay role-redacted per the existing privacy posture.
- Deterministic fallback: if the LLM path is disabled or errors, render the raw `MoveRule.title` + `body` (correctness never degrades, only brevity).
- Standing legal disclaimer on every AI-summarized rule.
- Output is **display-only** — never written back as a `MoveRule` (no AI-authored rules).

---

## 7. Entitlement / packaging hook

Use `planFeatures(plan)` — `packages/shared/src/workspace-entitlements.ts:62`.

- **Free (FREE_TRIAL):** sees that destination-state requirements exist + a count, but bodies/sources are a teaser — mirror the `homeDossier:false` upgrade-teaser pattern (HTTP 200 + `upgradeRequired`, never 403).
- **Individual+ (`homeDossier:true`):** full structured rules, source links, classifier task citations.
- **AI rule summarizer:** gate on the existing **`aiBriefing`** flag (Family + Pro only; Individual/Free false) — same cost-control line as AI Move Briefing. Non-AI tiers always get the deterministic raw rule.
- **PDF export of rules:** gate on existing **`dossierPdf`** (Pro only), reusing the dossier-PDF check in `addresses/[id]/dossier/route.ts`.

No new entitlement flag in v1.

---

## 8. Acceptance criteria + guardrail metric

**Top 3 acceptance criteria:**
1. `GET /api/state-rules?state=XX` returns all six public categories as structured rows, each with `sourceUrl` (when `confidence >= MEDIUM`) and `lastVerifiedAt`; the three previously-dropped categories (`utilityInfo`, `insuranceRules`, `commonProviders`) are now present. Verified by updating `apps/web/src/app/api/state-rules/route.test.ts`.
2. A destination-state move plan generates at least the DMV + voter `MoveTask`s whose `reason`/`caveats` cite a real `MoveRule.id` + `sourceUrl`; a state with no rule rows falls back gracefully (no crash, "not available" caveat).
3. An admin rule edit creates a new `version`, marks the prior row superseded, writes an `AdminAuditLog` row, and requires password step-up — verified end-to-end; concurrent edit of the same row by two admins surfaces an optimistic-lock conflict instead of silent clobber.

**Guardrail metric:** **0** rules shown to users with `confidence >= MEDIUM` but a missing/non-official `sourceUrl` (uncited-rule rate = 0). Tracked via an admin report query + an integration-telemetry bucket on the public read path.

---

## 9. Smallest shippable slice (week 1)

1. Add the **`MoveRule`** table (additive migration) + the six-category enum; backfill rows from existing `StateRule` columns (one row per non-null column, `confidence = UNVERIFIED`, no `sourceUrl`).
2. Fix the public read contract: `GET /api/state-rules?state=XX` returns structured rows for **all** public categories (closes the dropped-fields bug), with `route.test.ts` updated.
3. Render a read-only **"State requirements"** section on the moving-plan page from those rows, with the standing "verify at source" caveat — no AI, no admin authoring UI yet.

Ships the registry mechanism + the user-visible read fix in one week, with zero connector work, zero AI, zero new legal content. Admin authoring/versioning (§2), classifier citation (§2), and the gated AI summarizer (§6) follow in later slices.
