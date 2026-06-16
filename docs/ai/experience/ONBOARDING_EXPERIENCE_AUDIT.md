# Onboarding Experience Audit

## Current verified experience

- Web onboarding exists with coach copy, CTA tests, and a Pro showcase that is not a payment step.
- Mobile onboarding includes address/move context, notification priming, and a no-dead-end path to dashboard or subscription.
- Legal consent is required before registration/onboarding continue.
- Dashboard empty states can send non-premium users to subscription instead of a dead-end moving-plan route.
- Onboarding progress APIs and tests exist.

## User goal

The user wants to set up enough move context to get help quickly without feeling interrogated.

## Emotional job

The user wants reassurance that the app is asking for information because it will reduce work later.

## Current friction

- The onboarding path can collect useful context, but the value payoff needs to be immediate and visible.
- Users may not know which input unlocks the first useful insight: address, service, moving date, provider, or household member.
- If the AI briefing hides when unconfigured or gated, onboarding may end without a clear "this is thinking for me" moment.
- Pro showcase can be useful, but the first paid pitch should not interrupt the user's first setup win.

## Aha opportunity

Onboarding should end with a concrete preview: "Based on what you entered, here are the first three things LocateFlow can watch or organize for you."

## Revenue opportunity

The natural upgrade moment is after the user has entered enough context to see a specific locked briefing, dossier, assignment, or proof packet preview, not before they understand the core record-keeping value.

## Data moat opportunity

Track coarse onboarding milestones: housing type bucket, move timing bucket, service category selected, plan created, notification opt-in, and whether the user reached first briefing.

## Hypotheses

- Hypothesis: requiring one address plus one service before showing a command-center preview will improve activation.
- Hypothesis: a "why this matters" coach message beside each onboarding step lowers abandonment.
- Hypothesis: onboarding should avoid payment until after the first intelligence preview.

## Recommended experiments

- Test a four-step "get your first briefing" path: address, service, move date, briefing.
- Test a progress indicator that names the payoff: "2 steps until your move briefing."
- Test routing after onboarding directly to the relevant dashboard insight instead of a generic dashboard top.

## Possible Codex implementation tasks

- After approval, add onboarding step completion events and a first-briefing funnel report.
- After approval, add a post-onboarding redirect target that opens the briefing or first move plan when available.
- After approval, add copy tests for coach text that explains why each field matters.
