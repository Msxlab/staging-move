# Current Product Readiness Epic Manual QA

Use this checklist before opening or merging the current-product readiness epic. The expected result in every scenario is manual LocateFlow guidance, local task tracking, and listed/unverified provider posture unless source-backed validation exists.

## Web Provider And Custom Provider

- Provider list shows listed/unverified provider labels and availability caveats.
- Provider detail says adding a provider is manual tracking only.
- Provider detail does not claim official partnership, guaranteed availability, or automatic account updates.
- Add service with a listed provider creates a local service record.
- Add custom/local provider creates a private user provider record.
- Custom provider copy says user-added/private/manual tracking only.
- Custom provider can be attached to a service.
- Editing or deleting a custom provider does not affect other users.

## Mobile Provider And Custom Provider

- Provider list/card/detail shows the same trust and coverage meaning as web.
- Mobile does not hide caveats because of screen size.
- Add service with a listed provider remains local tracking.
- Add custom/local provider creates a private user provider record.
- Custom provider labels stay user-added and unverified.

## Move Tasks

- Create a moving plan with origin and destination addresses.
- Add origin services.
- Generate move tasks on web moving detail.
- Generate move tasks on mobile moving detail.
- Suggested tasks can be accepted.
- Accepted/open tasks can be completed locally.
- Completion asks for confirmation before applying local effects.
- Tasks can be dismissed.
- Completed or dismissed tasks can be reopened.
- Regenerating tasks does not duplicate completed or dismissed tasks without material input changes.
- Task caveats explain that LocateFlow does not update provider accounts.

## Required Scenario Matrix

PSE&G New Jersey to Texas:

- Old PSE&G electric service gets stop/close guidance.
- Destination electric task is start, shop, or find replacement depending on candidates.
- The UI never claims PSE&G can transfer to Texas.
- Caveat says confirm with the official provider or state marketplace.

PSE&G New Jersey to New Jersey same-state:

- Strong exact/prefix coverage can produce transfer or verify guidance.
- State-level-only coverage produces verify availability.
- Same-state alone does not imply guaranteed transfer.

Texas electric with many candidates:

- Task is compare/shop providers.
- Recommendation reasons show coverage confidence and manual confirmation.

Municipal or co-op single candidate:

- Task is start destination service with caveat.
- Candidate is shown as listed/unverified unless source-backed validation exists.

No electric candidate:

- Task is find replacement.
- Guidance points to official-source manual research.

Same-state weak coverage:

- Task is verify availability.
- No guaranteed address availability copy appears.

Internet/cable address-check-required:

- Task is verify availability.
- National listing does not outrank higher-confidence local candidate.

Bank or credit card interstate move:

- Task is update address.
- No provider switch is suggested by default.

Insurance interstate move:

- Task is insurance requote or update policy address.
- No external policy update is implied.

DMV and voter update:

- Task is government update.
- State-rule text is guidance, not legal advice.

Local dentist move:

- User-created dentist can be attached to service.
- Task is update address, no action, or find replacement depending on context.
- Provider remains private/user-added.

Local gym move:

- Task is cancel/close or find replacement when moving away.
- Completing cancel/close only changes LocateFlow local service state.

## Admin Governance

- Provider Governance page loads.
- Provider Quality Queue shows missing logo, missing phone, generic description, marketing language, suspicious category, and unknown source warnings.
- Coverage Gap Queue shows critical missing or broad-only state/category coverage.
- Duplicate Review Queue shows duplicate-domain buckets.
- Missing Contact Queue shows missing contact data.
- Broad Coverage Review Queue shows state-level utility, national/federal, and address-check-required records.
- Source Validation Backlog shows source-needed items.
- User-Created Provider Review Queue shows custom providers.
- Admin can mark reviewed, dismiss/reopen warnings, flag needs review, reject, mark promotion candidate, and link to global provider where allowed.
- Admin actions are permission-gated and audited.
- Admin cannot create official/verified claims without source-backed workflow.

## Admin User, Moving, And Support Context

- Admin user detail shows services, custom providers, moving plans, move tasks, and low-confidence warnings.
- Admin moving list shows same-state/interstate context, open task counts, and sample task context.
- Support ticket detail shows user move context, services, custom providers, and task summaries.
- Support copy does not imply contractual SLA, external automation, or provider account updates.
- Subscription context remains read-only; no refund/cancel/grace actions are added.

## Reports And Docs

- `pnpm audit:providers` completes.
- `pnpm audit:providers:coverage` completes.
- `pnpm audit:providers:state-completeness` completes.
- `pnpm audit:providers:readiness` completes and regenerates provider readiness reports.
- Generated provider reports are reviewed for missing logos, missing phones, broad coverage, duplicate domains, generic descriptions, marketing language, and state/category gaps.
- Logo/contact strategy says no random logo scraping and no partnership implication.

## Unsafe Claim Sweep

Search changed web, mobile, admin, shared, and docs files for:

- verified
- official
- guaranteed
- available at your address
- partner
- automatic address change
- connector
- linked account
- account update
- transfer completed
- provider account updated
- external update completed

Any matches must be caveats, guardrails, future-only statuses, or explicit negative statements.
