# Move Task Support Runbook

Use this runbook when helping a user with move tasks, custom providers, and provider recommendations in the current LocateFlow product.

This runbook does not authorize provider connectors, external account updates, USPS connector behavior, partner APIs, paid-tier gating, or official provider verification claims.

## Product Truth

- Move tasks are LocateFlow workflow records.
- Completing a task can update LocateFlow local service state.
- Completing a task does not update an external provider account.
- Provider recommendations are listed/unverified unless source-backed validation exists.
- Custom providers are private user-created records by default.
- ZIP, state, and coverage rows are confidence signals, not proof of service at an address.

## Support Triage

1. Open the support ticket.
2. Review the user move context on the ticket detail page.
3. Open the user detail page if deeper service, custom provider, task, or subscription context is needed.
4. Review open, completed, dismissed, and low-confidence move tasks.
5. Review whether the service uses a listed provider, custom provider, or typed provider name.
6. Check task caveats before telling the user what the recommendation means.

## Explaining Task Status

- Suggested: LocateFlow generated this from current move context.
- Accepted: The user decided to track it.
- In progress: The task is being worked.
- Completed: The task is complete inside LocateFlow.
- Dismissed: The user chose not to track it.
- Reopened: The user brought it back after completion or dismissal.

Never describe a completed task as proof that a provider received an account update.

## Local Effects

Some completed tasks can update local service records:

- Stop service or cancel/close: local old service may be marked inactive.
- Start service, shop provider, or find replacement: destination service may be created or linked when a provider is selected.
- Transfer service: destination service may be created and old service may be marked inactive after user confirmation.
- Update address, government update, insurance requote, mail forwarding, verify availability: task status and notes are updated locally.

If a user says an external provider did not receive a change, explain that LocateFlow records and guides the workflow but does not perform external provider updates.

## Custom Providers

Users can add local providers such as a dentist, law office, physical therapy center, local gym, local utility, local daycare, doctor, veterinarian, storage facility, or parking provider.

Support posture:

- Treat custom providers as private user records.
- Do not expose one user's custom providers to another user.
- Do not tell the user a custom provider is verified.
- If a custom provider looks like a global catalog duplicate, flag it for admin governance review.
- Promotion to the global catalog requires source review and a separate product/data decision.

## Provider Recommendations

For address-sensitive categories such as utilities, internet/cable, trash, transit, tolls, housing services, and local memberships:

- Exact ZIP is stronger than ZIP prefix.
- ZIP prefix is stronger than state-level.
- State-level is stronger than national/federal only when no precise signal exists.
- Address-check-required providers need explicit user confirmation.
- Local high-confidence utilities should not be hidden by national brands.

Support should say "confirm with the official provider" rather than "this provider is available at your address."

## Examples

PSE&G New Jersey to Texas:

- Stop or close PSE&G at the old New Jersey address.
- Find/start Texas electric service.
- Compare providers if the destination market has multiple electric candidates.
- Confirm availability through the official provider or state marketplace.
- Do not say PSE&G can transfer to Texas unless source-backed coverage proves it.

Same-state utility move:

- Exact ZIP or mapped coverage can support transfer guidance with verification.
- State-level-only coverage should be treated as verify availability.
- No candidate means find replacement through official sources.

Internet/cable:

- Treat as address-sensitive.
- Require availability verification unless strong address-level evidence exists.
- Do not let national scope imply serviceability.

Bank or credit card:

- Usually update address.
- Do not suggest switching providers unless explicitly local-only.

Insurance interstate move:

- Requote or review policy for the destination state.
- No external policy update is performed by LocateFlow.

Local dentist or gym:

- Dentist, doctor, physical therapy, or legal provider may be update address, no action, or find replacement depending on the user's intent.
- Local gym is usually cancel/close or find replacement if the user moves away.

## Escalation

Escalate to provider governance when:

- A provider appears duplicated.
- Contact data is missing or wrong.
- A recommendation seems overbroad for the destination.
- A user-created provider may be a promotion candidate.
- A task is low-confidence because provider coverage is missing.
- State-rule guidance is missing or stale.

Escalate to product before:

- Adding official or verified labels.
- Promoting custom providers into the global catalog.
- Adding connector or external account update behavior.
- Adding financial admin actions.
- Making contractual support SLA promises.
