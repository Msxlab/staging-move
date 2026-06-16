# AI Move Briefing Experience

## Current verified experience

- Web dashboard renders `MoveBriefingCard`, which calls `POST /api/onboarding/briefing`, parses prose plus structured actions, and routes action rows to services, category-specific service creation, plan, or state rules.
- Mobile dashboard has a `MoveBriefingCard` that parses the same structured tail, renders top actions, supports teaser rows, and routes category/plan/state-rule/service actions.
- The API has auth, rate limit, entitlement gating, same-day cache, rule-based fallback, structured actions, non-PII coarse signals, and a daily AI generation cap.
- The web card has a Family/Pro teaser and links to `/pricing`; the mobile card has an unlock CTA.
- If briefing is unconfigured or fetch fails, the card hides or fails softly rather than blocking the dashboard.

## User goal

The user wants a short answer to "where do I stand and what should I do next?"

## Emotional job

The user wants confidence without reading a full checklist.

## Current friction

- On mobile, comments describe the briefing as a first-run welcome card rather than a persistent command surface; this may underuse the strongest intelligence moment.
- On web, the card is outside the widget stack, which helps visibility, but it can still disappear when unconfigured or dismissed.
- Users may not understand what inputs created the briefing or why it is trustworthy.
- Paid boundary exists, but the value must be concrete: "your top 3 next steps linked to the right screen."

## Aha opportunity

The briefing should become the user's daily "move standup": one summary, one risk, one next action, and one proof/monitoring reminder when available.

## Revenue opportunity

Family/Pro upgrade feels natural when the teaser names the exact paid value: personalized read on move status, top three next actions, fresh updates as the move progresses, household assignment context, and post-move monitoring.

## Data moat opportunity

Track consented, non-sensitive signals for briefing mode and outcomes: generated/rule-based/cached/gated, action clicked, action completed, and whether an action led to a transition status change.

## Hypotheses

- Hypothesis: the briefing should remain visible as a command-center surface until the user has completed core transition tasks.
- Hypothesis: explaining "built from your addresses, services, and move plan" increases trust and upgrade intent.
- Hypothesis: users will trust deterministic actions more if the app says the AI summary never performs provider changes.

## Recommended experiments

- Test persistent briefing vs one-time briefing on mobile.
- Test a "why this briefing" disclosure showing data sources in non-PII terms.
- Test an upgrade teaser that shows locked action rows before asking for Family/Pro.

## Possible Codex implementation tasks

- After approval, add a briefing source explainer.
- After approval, add telemetry buckets for briefing visible, teaser visible, action clicked, and action completed.
- After approval, test persistent mobile briefing by move stage while preserving dismiss controls.
