# QA — Experiment 1: Command Center Dependability + De-noise

## Canonical execution results - 2026-06-16

- Tester: Codex.
- Scope: Phase-1 experiments 1-3, including control, variant, and flag-off regression checks.
- Method: attempted real Chromium UI first, then used automated-render/helper verification because the local authenticated UI path was blocked.
- Evidence: `apps/web/test-results/**`, `apps/web/src/app/phase1-ui-qa.test.tsx`, existing telemetry tests under `apps/web/src/lib`, `apps/web/src/app/api/tracking/event`, and `packages/shared/src`.
- Environment: Node `v24.13.0`, pnpm `9.15.0`; repo engine warning expects Node `22.x`.
- Real UI status: BLOCKED for authenticated dashboard, moving-plan, onboarding, and mobile device rows. Existing public Playwright smoke run started the dev server but failed 6/9 tests before authenticated experiment coverage could run.
- The original planning matrix below is preserved for context; the tables in this section are the executed QA record.

### Flag-toggle method verified

| Surface | Control / flag off | Variant / flag on | Notes |
|---|---|---|---|
| Web | Missing `FeatureFlag` row, `enabled=false`, or unmatched targeting | Local/staging `FeatureFlag` row with `enabled=true` and matching target, commonly `targetType="ALL"` for local QA | Resolved by `apps/web/src/lib/feature-flags.ts`; cache TTL is 60s unless invalidated. Never enable `ux_*` flags in production for this QA. |
| Mobile briefing | `EXPO_PUBLIC_UX_AI_BRIEFING_EXPERIENCE_V1` unset or non-variant value | `EXPO_PUBLIC_UX_AI_BRIEFING_EXPERIENCE_V1=variant` or `on/true/1/enabled/v1/treatment` | No emulator/device was available in this run. |
| Mobile onboarding | `EXPO_PUBLIC_UX_ONBOARDING_TEASER_V1` unset or non-variant value | `EXPO_PUBLIC_UX_ONBOARDING_TEASER_V1=variant` or `on/true/1/enabled/v1/treatment` | No emulator/device was available in this run. |
| Mobile trust copy | No verified mobile wiring found for `ux_trust_copy_v1` in the requested files | N/A | Trust-copy experiment is verified on web moving-plan render path only. |

### Experiment 1 row results

| Row | Result | Observation |
|---|---|---|
| W1 | PASS automated-render; BLOCKED real UI | `deriveBriefingState` returns hidden in control and rule-based fallback in variant for `configured:false`. Authenticated browser UI unavailable. |
| W2 | PASS automated-helper; BLOCKED real UI | Malformed/keyless-equivalent paths resolve to fallback in variant and hidden in control. Browser network 5xx/malformed mock was not run. |
| W3 | PASS automated-render; BLOCKED real UI | Gated free/Individual state renders teaser in both variants with `/pricing` CTA and existing unlock copy. |
| W4 | PASS automated-helper; BLOCKED real UI | Real briefing content remains full briefing in both variants. Paid local AI-key UI was not run. |
| W5 | PASS automated-helper; BLOCKED real UI | Dismissal is stage-scoped in variant: same stage stays hidden, changed stage re-shows. |
| W6 | PASS automated-helper; BLOCKED real UI | First-session variant order pins Command Center, Next Critical Actions, and Briefing; details widgets are demoted. |
| W7 | PASS automated-helper; BLOCKED real UI | Saved widget preferences disable the forced first-session details layout. Returning-user browser account was unavailable. |
| W8 | PASS automated-helper; BLOCKED real UI | Deep-link helper routes category actions to `/services/new?category=...` and plan actions to `/moving`; browser clicks were not run. |
| M1 | PASS automated-helper; BLOCKED device UI | Mobile helper ignores one-time install dismissal in variant and preserves it in control. No emulator/device available. |
| M2 | PASS automated-helper; BLOCKED device UI | Mobile keyless variant returns fallback state; control returns hidden/null. |
| M3 | PASS automated-helper; BLOCKED device UI | Mobile gated free state returns teaser/unentitled state. |
| M4 | BLOCKED device UI | `FreeMoveUpsellCard` visual hero was not verified on a device/emulator. |
| M5 | PARTIAL automated-helper; BLOCKED device UI | Stage-scoped dismissal helper was verified; mobile end-to-end stage-change behavior was not device-tested. |
| R1 | PASS automated-helper; BLOCKED real UI | Control preserves hidden keyless behavior and current web widget order. |
| R2 | PASS automated-helper; BLOCKED device UI | Control preserves mobile one-time install dismissal behavior. |

### Experiment 2 row results

| Row | Result | Observation |
|---|---|---|
| T1 guided action trust copy | PASS automated-render; BLOCKED real UI | Stop/start/transfer/cancel/update show "LocateFlow only" and provider-unchanged treatment after done or dismissed in variant. |
| T2 verified integration exception | PASS automated-render; BLOCKED real UI | Verified live-integration shape with `localOnly:false` does not render the unchanged guarantee. |
| T3 briefing provenance/footer | PASS existing component tests; BLOCKED real UI | Focused tests verify provenance/footer render in AI and rule-based states. |
| T4 telemetry props | PASS automated-helper/route tests; BLOCKED browser network | `trust_copy_shown` metadata is closed/coarse and routed through consent-gated tracking tests. |

### Experiment 3 row results

| Row | Result | Observation |
|---|---|---|
| O1 paid + destination/date variant | PASS automated-helper; BLOCKED real UI | Variant helper shows teaser for premium users with destination/date; primary action is `create_plan`. |
| O2 free + destination/date variant | PASS automated-helper/source guard; BLOCKED real UI | Free users still get `complete_without_plan`; source guard confirms the free branch precedes moving-plan persistence. |
| O3 no destination/date | PASS automated-helper; BLOCKED real UI | No teaser when destination/date data is absent. |
| O4 control behavior | PASS automated-helper; BLOCKED real UI | Control preserves paid straight-to-plan and free teaser behavior. |
| O5 telemetry props | PASS automated-helper/route tests; BLOCKED browser network | `onboarding_teaser_viewed` uses only closed/coarse metadata. |

### Guardrail confirmations from this run

| Guardrail | Status | Evidence |
|---|---|---|
| FREE paywall stays closed in onboarding variant | PASS automated-helper/source guard; browser network BLOCKED | `phase1-ui-qa.test.tsx` asserts the free teaser branch occurs before `saveMovingPlan()`. No `/api/moving` network capture was possible. |
| Briefing never shows an empty slot in variant | PASS automated-helper | `phase1-ui-qa.test.tsx` verifies fallback/teaser/full briefing states. |
| Trust copy appears for guided actions and not verified integrations | PASS automated-render | `phase1-ui-qa.test.tsx` and trust-copy tests cover action types and integration exception. |
| Telemetry consent off prevents writes | PASS automated-route tests; browser network BLOCKED | `apps/web/src/app/api/tracking/event/route.test.ts` covers consent-gated event persistence. |
| Telemetry props are closed/coarse and no PII | PASS automated-helper/tests | `packages/shared/src/phase1-experiment-analytics.test.ts`, `apps/web/src/lib/analytics.test.ts`, and QA test cover allowlist stripping. |
| No AI key/runtime, billing copy, schema, migration, deploy, push, or dependency change in this QA task | PASS | This run added one QA test file and docs/handoff only. |

### Sign-off - 2026-06-16

- Tester: Codex.
- Build/commit: local dirty worktree on branch `codex/phase1-telemetry-persistence`.
- Web result: automated-render/helper PASS; real authenticated UI BLOCKED.
- Mobile result: automated-helper PARTIAL; device/emulator UI BLOCKED.
- Regression flag off: automated-helper PASS; real UI/device BLOCKED.
- Decision: keep production flags off. Before staging promotion, run real UI QA with seeded accounts and fix or bypass the current public Playwright harness blockers.

Backlinks: [[02_ACTIVE_EXPERIMENTS]], [[01_ACTIVE_STRATEGY]], [[00_PRODUCT_BRAIN_DASHBOARD]]
Source: [[handoffs/2026-06-15-180707-command-center-dependability-running]], [[handoffs/2026-06-15-150958-claude-ux-judge]]
Status: **DEFERRED — run LAST** (human decision 2026-06-15: do this after other Phase-1 work) · executed by **Codex from the UI** · flag default = `control` (OFF) · do **not** enable outside local/staging · see "Execution plan" at the bottom

> Purpose: verify the flagged changes in the UI before enabling `ux_ai_briefing_experience_v1` anywhere real. Expected results below are derived from reading the implementation (`packages/shared/src/ux-experiments.ts`, `move-briefing-card.tsx` `deriveBriefingState`, `dashboard-ux-experiment.ts`, mobile `ai-briefing-experience.ts`). They are **not yet UI-confirmed** — fill in Result/Notes while testing.

## How to enable the flag (local/staging only)
- Flag: `ux_ai_briefing_experience_v1`. Resolver (`resolveUxAiBriefingExperienceVariant`) treats `variant` / `treatment` / `v1` / `on` / `true` / `1` / `enabled` / boolean `true` as **variant**; anything else (incl. unset) = **control**.
- Test both states: **control** (flag off / unset) = current production behavior; **variant** = new behavior.
- Guardrail recheck while testing: AI key/runtime unchanged, telemetry uses the existing consent-gated `trackEvent` -> `/api/tracking/event` -> `UserEvent` pipeline only, no billing/upgrade copy change, no new route/schema.

## Briefing-state matrix (the core change)
`deriveBriefingState(json, variant)` — what the briefing slot resolves to per API response:

| API response condition | control | variant |
|---|---|---|
| `configured !== true` (no AI key) | **hidden** (slot empty) | **rule-based fallback** (slot filled) |
| fetch error / malformed / `briefing` not a string | **hidden** | **rule-based fallback** |
| `entitled:false` or `upgradeRequired:true` (FREE/Individual gate) | **teaser** (blurred + `/pricing`) | **teaser** (same) |
| `configured:true` + real `briefing` string | **briefing** (full, deep-link actions) | **briefing** (same) |

Key idea to confirm: **in variant the intelligence slot is never empty** — it's fallback, teaser, or full briefing, never hidden.

## Web test cases
| # | Scenario | Setup | Expected (control) | Expected (variant) | Result | Notes |
|---|---|---|---|---|---|---|
| W1 | Keyless / not configured | AI key unset OR API `configured:false` | Card hidden, dashboard otherwise normal | Card shows **rule-based fallback** prose + deterministic deep-link rows; never empty | ☐ pass ☐ fail | |
| W2 | Fetch failure / malformed response | Force `/api/onboarding/briefing` to 5xx or bad JSON (devtools) | Card hidden | Card shows fallback; no error/blank slot; no 5xx surfaced to user | ☐ pass ☐ fail | |
| W3 | Gated free/Individual | Sign in as FREE/Individual with AI configured | Blurred **teaser** + "Unlock with Family" → `/pricing` | Same teaser + `/pricing` (unchanged) | ☐ pass ☐ fail | |
| W4 | Paid + AI content | Family/Pro + `ANTHROPIC_API_KEY` set | Full briefing + ≤3 deep-link actions route correctly | Same | ☐ pass ☐ fail | |
| W5 | Dismiss → re-show by stage | Dismiss the card, then change move stage (e.g. add move date / pass a milestone) | Prior dismissal behavior | Card **re-appears** on stage change (stage-scoped dismiss) | ☐ pass ☐ fail | |
| W6 | First-session order (new user, no saved widget prefs) | Fresh account, no dashboard customization | Current widget order | **Command Center + Next Critical Actions + Briefing pinned on top**; route map / budget / Home Dossier demoted to a "details" section | ☐ pass ☐ fail | |
| W7 | Returning user with saved widget prefs | Existing user who reordered/collapsed widgets | Saved layout preserved | Saved layout **preserved** (no forced reorder) | ☐ pass ☐ fail | |
| W8 | Deep-link actions correctness | From any briefing/fallback row, tap each action | Routes to services / category-service-add / plan / state-rules correctly | Same (actions are deterministic, server-derived) | ☐ pass ☐ fail | |

## Mobile test cases
| # | Scenario | Setup | Expected (control) | Expected (variant) | Result | Notes |
|---|---|---|---|---|---|---|
| M1 | One-time install hide | Dismiss briefing day 1, kill app, relaunch | Briefing **stays hidden** (one-time per install) | Briefing **still renders** (one-time hide ignored); fallback/teaser as applicable | ☐ pass ☐ fail | |
| M2 | Keyless / fetch-fail | AI unconfigured or fetch error | Slot empty/hidden | **Fallback** rendered, slot not empty | ☐ pass ☐ fail | |
| M3 | Gated free user | FREE plan | Teaser/unlock CTA | Same teaser/unlock CTA | ☐ pass ☐ fail | |
| M4 | Free hero intact | FREE plan, no move plan | `FreeMoveUpsellCard` hero | `FreeMoveUpsellCard` hero (unchanged) | ☐ pass ☐ fail | |
| M5 | Dismiss → re-show by stage | Dismiss, then change move stage | Prior behavior | Re-shows on stage change | ☐ pass ☐ fail | |

## Flag-OFF regression (must pass before trusting the experiment)
| # | Scenario | Expected | Result | Notes |
|---|---|---|---|---|
| R1 | Flag unset, web | Byte-for-byte current behavior (hidden when keyless, current widget order) | ☐ pass ☐ fail | |
| R2 | Flag unset, mobile | Current one-time-install behavior preserved | ☐ pass ☐ fail | |

## Guardrail confirmations (verify during QA)
- [ ] No AI key prompt / no AI behavior change when toggling the flag (briefing still uses rule-based fallback when key absent).
- [ ] Telemetry network behavior verified with existing consent-gated route only; no PostHog install or telemetry config change.
- [ ] No billing/upgrade copy change — teaser + `/pricing` identical to today.
- [ ] No new route / no schema error in console.

## Before promoting beyond local/staging
- [ ] Run full type + test gates, not just touched files: `pnpm verify:typecheck` and web/admin/mobile test suites; consider Playwright on the dashboard.
- [ ] Note env mismatch: repo wants Node `22.x`; the implementation env reported `v24.13.0` — confirm CI uses 22.x.
- [ ] Branch/commit: work currently sits in the worktree (Codex couldn't write `.git` refs) — branch + commit before promoting.
- [ ] Telemetry is now wired through the existing consent-gated pipeline only; before promotion, verify real browser network behavior with seeded local/staging users.

## Sign-off
- Tester: ______  Date: ______  Build/commit: ______
- Web result: ☐ pass ☐ fail   Mobile result: ☐ pass ☐ fail   Regression (flag off): ☐ pass ☐ fail
- Decision: ☐ keep flag off ☐ enable in staging only ☐ needs fixes (list in Notes)

## Execution plan (DEFERRED — Codex runs this from the UI, LAST)

Run only after other Phase-1 work; test-only (no app runtime/source change, no deploy/push/migration, flag never enabled in prod, no telemetry config change, no billing copy change, no AI key committed). Test files (Playwright/RTL) may be added.

1. **Find flag wiring (read-only):** `packages/shared/src/ux-experiments.ts` (`resolveUxAiBriefingExperienceVariant`), `apps/web/src/app/(app)/dashboard/{page.tsx,dashboard-ux-experiment.ts,dashboard-client.tsx}`, `move-briefing-card.tsx`, `apps/mobile/src/lib/ai-briefing-experience.ts`. Determine the supported local way to set the flag `control` vs `variant` — do not hack runtime logic to force states.
2. **Run the UI:** prefer real UI — start the web dev server and drive the dashboard with the repo's Playwright e2e (apps/web). Exercise web W1–W8, mobile M1–M5 (emulator/simulator if available), and flag-OFF regression R1–R2, toggling `control` vs `variant`.
3. **Simulate states honestly:** keyless = no AI key / API `configured:false`; fetch-fail = network mock / forced 5xx/bad-JSON; gated = FREE/Individual seeded account; paid+AI = Family/Pro with a LOCAL test key only. If data is missing → mark the row **BLOCKED** with reason; never guess pass.
4. **Record in this note:** fill each row Result (☐pass/☐fail) + one-line observation; tick Guardrail confirmations only if verified in the network tab/UI; save screenshots (e.g. `apps/web/playwright-report`) and reference paths; complete Sign-off (tester=Codex). Bugs → record in Notes + handoff, do NOT fix here (separate approval).
5. **Handoff:** write `docs/ai/handoffs/<timestamp>-exp1-qa-results.md` with pass/fail/blocked counts, bugs, the exact flag-toggle method, commands + Node version, evidence location, and recommendation (keep flag off / staging-only / needs fixes). List any test files added. Confirm the guardrails above held. Then stop for human review.

If no live browser/emulator is available: fall back to render-level tests (RTL/Playwright component) covering the same matrix, **label them as automated-render verification (not manual UI)**, and mark genuinely device-only checks BLOCKED.
