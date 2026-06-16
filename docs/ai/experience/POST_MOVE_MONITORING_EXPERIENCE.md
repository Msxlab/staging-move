# Post-Move Monitoring Experience

## Current verified experience

- The dashboard has an `UpcomingBills` card that fetches services and links upcoming bill rows to service detail pages.
- Cron routes and daily digest logic cover bill reminders, contract reminders, move reminders, task reminders, lifecycle nudges, daily digest, and weekly digest concepts.
- Contract reminders use 30/14/7/1-day windows and link back to services.
- Notification settings include bill reminders, task reminders, moving plan updates, weekly summary, lifecycle nudges, digest day, and reminder-days configuration.
- Notifications page has filters for all, unread, reminders, and workspace.

## User goal

The user wants the app to remain useful after move day by catching renewals, bills, contracts, and lingering tasks.

## Emotional job

The user wants to stop paying for forgotten services or missing contract windows.

## Current friction

- Monitoring exists technically through reminders and dashboard widgets, but it is not clearly packaged as a post-move surface.
- Upcoming bills are visible, but contract renewals, lifecycle nudges, and task reminders are split across notifications/digest paths.
- Users may not understand why they should return after the move is complete.
- The app should avoid overclaiming that it monitors external accounts; it monitors saved records and reminders.

## Aha opportunity

After move day, the app should show "What's coming next for this address" with upcoming bills, renewals, contracts, unresolved tasks, and saved-service review prompts.

## Revenue opportunity

Post-move monitoring can make Family/Pro feel ongoing rather than episodic, especially when bundled with briefing, transition board, and proof packet value.

## Data moat opportunity

With consent, track coarse outcomes from monitoring: reminder surfaced, service reviewed, contract renewed/cancelled/transferred, bill marked handled, and monitoring item resolved.

## Hypotheses

- Hypothesis: a single "What's coming" surface will increase D30/D60 retention more than separate notification feeds.
- Hypothesis: users will value post-move monitoring when it is framed around money saved and obligations avoided.
- Hypothesis: monitoring can be free at the basic level, with advanced intelligence/proof/export paid.

## Recommended experiments

- Create a docs-only "What's coming" surface spec using existing service/reminder primitives.
- Test a post-move dashboard card that links to service review and renewal decisions.
- Test a digest subject/copy framing around saved obligations rather than generic notifications.

## Possible Codex implementation tasks

- After approval, add a user-facing post-move monitoring card that reuses existing services/reminder date logic.
- After approval, add telemetry for monitoring item seen/resolved with consented coarse fields only.
- After approval, add empty states explaining what data is needed for monitoring.
