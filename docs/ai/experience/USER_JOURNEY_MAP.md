# User Journey Map

## Current verified experience

- The verified Product Brain identifies the primary segment as the household move-organizer managing a multi-provider and/or state-to-state move.
- Web and mobile both have onboarding, dashboard, addresses, services, moving plans, move tasks, provider recommendations, notifications, subscription, export, and invitation surfaces.
- The web dashboard loads addresses, services, moving plans, profile data, active move progress, upcoming bills, dossier, route map, spending, and the AI Move Briefing card.
- Onboarding exists on web and mobile. Web onboarding has coaching copy and a Pro showcase rather than a payment step; mobile onboarding can complete without a paid plan and route to dashboard or subscription.
- Adding services can start from addresses, recommendations, category deep links, and custom providers; service-add copy explicitly says listed providers are manual tracking only and do not update external accounts.
- Moving plan detail currently shows generated move tasks, task status, action type labels, assignment controls, recommendations, vehicle check helpers, and mover suggestions gating.

## User goal

The user wants one calm place to know what has to happen before, during, and after a move, without having to remember every provider, bill, rule, task, and proof need.

## Emotional job

The user wants to stop feeling that something expensive or annoying is being forgotten.

## Current friction

- The product has many useful surfaces, but the journey can feel like addresses, services, moving plans, tasks, dossier, bills, exports, and subscription are separate areas rather than one guided command center.
- The fastest path to value may depend on the user knowing to add an address, add services, create a moving plan, generate tasks, then notice the briefing.
- The first truly intelligent moment may arrive too late if the user has to enter multiple records before seeing the system synthesize what matters.
- The Provider Transition Workspace is not yet a dedicated board; transition tasks are visible in the moving plan but not grouped into stop/start/transfer/update/cancel lanes.
- Post-move value exists in reminders, notifications, upcoming bills, contract reminders, and digests, but it is not yet packaged as "what LocateFlow does after move day."

## Aha opportunity

The first aha should be: "LocateFlow looked at my address, services, and move plan and told me exactly what to handle next."

Fastest path to value:

1. Create account.
2. Add current or destination address.
3. Add one high-stakes service or provider.
4. Create a moving plan.
5. See AI Move Briefing plus top three next actions.

## Revenue opportunity

The natural paid moment is when the user sees a personalized briefing or transition board that is clearly based on their own move data, then understands Family/Pro unlocks the intelligence, assignment, proof, and monitoring layers.

## Data moat opportunity

Consented, coarse events can record the journey from first address to service to move plan to generated task to confirmed transition, without storing raw address or provider account data as product-intelligence signals.

## Hypotheses

- Hypothesis: a guided "complete your first transition" path will activate faster than a generic dashboard of widgets.
- Hypothesis: the first address plus one service is enough to show a meaningful mini-briefing or readiness score.
- Hypothesis: the transition board should become the main move screen once a moving plan exists.

## Recommended experiments

- Prototype a docs-only "fastest path to first briefing" journey with exact screens and data requirements.
- Test a first-run dashboard checklist that points users to add address -> add service -> create plan -> view briefing.
- Test an empty dashboard hero that explains "Add one service and one move date to get your first briefing."

## Possible Codex implementation tasks

- After approval, add a first-run checklist that tracks first address, first service, first moving plan, first generated task, and first briefing.
- After approval, make the dashboard briefing card explain why it is waiting when inputs are missing.
- After approval, add event instrumentation for `first_address_added`, `first_service_added`, `first_plan_created`, `first_tasks_generated`, and `first_briefing_seen`.
