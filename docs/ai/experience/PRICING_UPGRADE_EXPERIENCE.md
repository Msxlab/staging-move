# Pricing Upgrade Experience

## Current verified experience

- Shared billing configuration defines Free, Individual, Family, and Pro plan capabilities.
- Entitlements gate features including AI Move Briefing, Home Dossier, dossier PDF, advanced export, seats, and other premium surfaces.
- Web subscription management supports Stripe checkout and customer portal flows.
- Mobile subscription settings support native IAP product lookup and store purchase availability, with some Family/Pro paths routed to web.
- The AI Move Briefing API can return upgrade-required states, and dashboard briefing UI includes paid-plan teaser behavior.

## User goal

Understand why upgrading matters at the exact moment LocateFlow can save time, reduce risk, or produce proof.

## Emotional job

Turn "another subscription wall" into "this unlocks the thing I need to finish this move with confidence."

## Current friction

- Upgrade moments are distributed across briefing, dossier, export, subscription, mobile, and dashboard surfaces.
- Pricing may be understood as a feature list before users feel the operational value of a saved transition, a briefing, or a proof packet.
- Web Stripe and mobile IAP paths create a product-design need for clear platform-specific upgrade expectations.
- There is no verified conversion evidence in this workflow.

## Aha opportunity

"I saw the next best action, the blocked transition, or the proof packet, and the upgrade made obvious sense."

The best upgrade experience should follow value preview, not precede value discovery.

## Revenue opportunity

- AI Move Briefing as the first paid intelligence preview.
- Provider Transition Workspace as the ongoing operational reason to stay paid through the move.
- Post-move monitoring as retention beyond move day.
- Proof packet generation as an urgent Pro upgrade moment.
- Household invite limits as a Family upgrade moment.

## Data moat opportunity

- Consented, coarse signals: upgrade trigger surface, feature gate viewed, plan selected, teaser clicked, post-upgrade feature used.
- Do not log raw addresses, provider account details, payment details, names, emails, phone numbers, or sensitive export contents as product-intelligence signals.

## Hypotheses

- Hypothesis: upgrade conversion improves when the paywall is attached to AI Briefing, proof packet, or blocked provider transition value.
- Hypothesis: Family upgrades are strongest at invite and assignment moments.
- Hypothesis: Pro upgrades are strongest at export/proof and advanced monitoring moments.

## Recommended experiments

1. Pricing moment map across AI Briefing, Provider Transition, proof packet, household invite, and monitoring.
2. Upgrade teaser copy test that frames outcomes rather than feature names.
3. Free preview of a limited AI briefing with paid action details gated.

## Possible Codex implementation tasks

- Draft an upgrade-moment matrix linking entitlement gates to user jobs and emotional jobs.
- Draft privacy-safe pricing event taxonomy for teaser viewed, upgrade started, checkout completed, and feature used after upgrade.
- Prepare a source-change task plan for one upgrade teaser improvement, then stop for human approval.
