# Aha Moment Map

## Current verified experience

- AI Move Briefing exists on web dashboard and mobile dashboard surfaces, with prose and up to three deep-linked next actions.
- Moving plan tasks can be generated from move/service context and include action types, statuses, assignment, caveats, confidence, and reason fields.
- The dashboard already shows "Next Critical Actions," moving progress, home dossier, upcoming bills, budget/spend, route map, services, and invitations.
- Dossier and export surfaces can create proof-like artifacts, including address dossier and PDF/report exports gated by plan.
- Notifications and cron reminders already support bill, contract, task, move, lifecycle, daily digest, and weekly digest concepts.

## User goal

The user wants the product to turn scattered move data into a simple statement of what matters now.

## Emotional job

The user wants relief: "I don't have to hold this all in my head."

## Current friction

- Aha moments are distributed across cards and pages rather than staged as a deliberate sequence.
- AI briefing can be dismissed or hidden when unconfigured, which may leave the first intelligent moment dependent on other widgets.
- Generated tasks currently appear as a checklist, not as an obvious transition story.
- Upcoming bills and contract reminders are useful, but the user may not understand them as the post-move retention promise.

## Aha opportunity

Top aha moments:

1. "Your move briefing" says exactly where the move stands and links to the next actions.
2. The transition board groups every service into stop/start/transfer/update/cancel.
3. Post-move monitoring says what bill or contract is coming up after move day.
4. Dossier/proof packet turns saved records into something shareable.
5. Household assignment turns a chaotic shared move into named responsibilities.

## Revenue opportunity

The best upgrade moment is immediately after a teaser demonstrates what the user would get with their own move data: briefing, transition status, proof packet, or household assignment.

## Data moat opportunity

Track which aha moments users act on: briefing action clicked, transition lane opened, reminder resolved, proof packet generated, household task assigned, and task confirmed with proof.

## Hypotheses

- Hypothesis: the strongest aha is the first transition board rollup, not the first checklist.
- Hypothesis: post-move monitoring is the aha that turns a move app into Address Life OS.
- Hypothesis: proof packets create trust faster than generic premium comparison tables.

## Recommended experiments

- Compare "first briefing" vs "first transition board" as the initial dashboard hero after onboarding.
- Show a "What changed because you added this service" explanation after first service creation.
- Add a docs-only storyboard for a three-aha onboarding: briefing, transition board, monitoring.

## Possible Codex implementation tasks

- After approval, add product events for `aha_briefing_seen`, `aha_transition_rollup_seen`, `aha_monitoring_seen`, and `aha_proof_packet_seen`.
- After approval, add small explanatory copy to the first generated task set.
- After approval, test dashboard ordering so the briefing and first next action remain above lower-signal widgets.
