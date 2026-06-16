# Provider Transition Experience

## Current verified experience

- The `MoveTask` model includes action type, status, assignee, origin/destination provider and address links, reason, caveats, and confidence.
- The moving plan detail page loads move tasks, generates suggested tasks, displays action type labels and status badges, supports complete/dismiss/reopen events, and supports assignment.
- Provider recommendations appear on the moving plan page at the moment of move intent and reuse the existing recommendations endpoint.
- Services/new supports category-aware deep links and explicitly says listed providers are manual tracking only and do not update external accounts.
- No dedicated Provider Transition board is verified yet.

## User goal

The user wants to understand what to stop, start, transfer, update, cancel, compare, or replace.

## Emotional job

The user wants to avoid the dread of forgetting a provider or accidentally paying for something after the move.

## Current friction

- Transition data exists, but tasks are still experienced as a checklist rather than a provider transition board.
- Action types may be visible as labels, but users need lanes, progress, assignees, and proof status to understand the whole transition.
- "Generate tasks" is useful, but the user may not understand which services drove the generated tasks.
- Without careful copy, users may assume LocateFlow performs provider changes automatically.

## Aha opportunity

The transition board should say: "Here are the providers to cancel, transfer, update, start, or compare. You take the action; LocateFlow tracks it."

## Revenue opportunity

Family/Pro value feels natural around household assignment, transition progress rollups, proof export, and high-confidence guidance. Pro can later own bulk/proof PDF workflows.

## Data moat opportunity

With consent, record coarse transition outcomes: provider category, state, action type, status progression, blocker category, confidence, proof generated, and whether the task came from user/manual/classifier context.

## Hypotheses

- Hypothesis: a read-only board over existing MoveTask data will create more value than adding new automation.
- Hypothesis: users will pay for clarity and proof before they trust automation.
- Hypothesis: the first interactive update should be manual status/proof capture, not connector execution.

## Recommended experiments

- Build a design-only board map grouping existing action types into lanes.
- Test read-only transition board against the current moving-plan checklist.
- Test copy variants for "guided - you take the action" vs "track provider changes."

## Possible Codex implementation tasks

- After approval, add a read-only Provider Transition board over existing `MoveTask` data.
- After approval, add tests for action-type-to-lane mapping, empty state, status display, and workspace scoping.
- After approval, add copy assertions that block auto-sync, verified sync, and partner-offer language.
