# Adversarial Verification: account-deletion-export-04

**Finding:** CCPA Do-Not-Sell opt-out is recorded but never enforced (dead resolver)
**Original severity:** High
**Verdict:** CONFIRMED
**Adjusted severity:** High (unchanged)

## What the finding claims
`hasCcpaOptOut` / `hasCcpaOptOutServer` (`apps/web/src/lib/ccpa.ts:32-68`) are the only
opt-out enforcement helpers and are referenced by no business code. The opt-out is persisted
via `POST /api/consent/ccpa` (cookie + `DataConsent` row, category `DO_NOT_SELL`) but never
consulted on any sell/share surface, so a CPRA Do-Not-Sell/Share opt-out has no effect.

## What I verified in code

### 1. The resolver helpers exist and are the only enforcement path
`apps/web/src/lib/ccpa.ts:32-68` defines `hasCcpaOptOut(request, userId)` and
`hasCcpaOptOutServer(userId)`. Both resolve opt-out from (a) the `ccpa_opt_out=1` cookie and
(b) the latest `DataConsent` row with `category="DO_NOT_SELL", granted=true`. The file's own
header comment (`ccpa.ts:5-20`) states business code routing data to sell/share surfaces "must
call this helper FIRST and skip the transfer when it returns `true`."

### 2. No business code calls either helper
A monorepo-wide grep for `hasCcpaOptOut`, `@/lib/ccpa`, `lib/ccpa` returns only:
- the definitions themselves (`ccpa.ts:32,53`)
- a doc comment in `apps/web/src/app/api/consent/ccpa/route.ts:26-27` that says data-sharing
  logic "should call `hasCcpaOptOut()`" — aspirational, not an actual call
- documentation / audit `.md` files (not production code)

There is **no `import` of `@/lib/ccpa`** and **no invocation** of either function anywhere in
`apps/`. The helpers are dead with respect to enforcement.

### 3. The opt-out IS persisted (so the control is user-visible and promised)
`apps/web/src/app/api/consent/ccpa/route.ts:77-124` writes the decision to both a `DataConsent`
DO_NOT_SELL row (logged-in) and the `ccpa_opt_out` cookie. `CcpaOptOutControls`
(`apps/web/src/components/shared/ccpa-opt-out-controls.tsx`) and the
`/ccpa-privacy-notice` page expose the toggle to users. So the product makes a privacy promise
it does not technically enforce.

### 4. The sell/share surfaces contain no opt-out gate
- `apps/web/src/app/api/affiliate/click/route.ts:26-99` — records an outbound affiliate click
  and returns the affiliate URL; no ccpa/optOut check.
- `apps/web/src/app/api/sponsored/click/route.ts:12-25` — sponsored-placement click beacon;
  no opt-out check.
- `apps/web/src/app/api/cron/lead-dispatch/route.ts` → `apps/web/src/lib/leads/dispatch-leads.ts`
  — `drainLeadDispatches` decrypts consumer PII (name/email/phone) and **emails it to matched
  external partners** (`dispatch-leads.ts:206-224`). This is the clearest "share" of personal
  information and it performs no DO_NOT_SELL check anywhere.
- `apps/web/src/lib/leads/create-lead.ts:58-114` — fans a new lead out to matched partners
  (creates `LeadDispatch` rows); no opt-out check before matching/dispatch.
- `apps/web/src/app/api/affiliate/postback/[network]/route.ts:34-116` — records conversions;
  HMAC-authenticated S2S, no opt-out check (less clearly a "sale" surface).

## Why the verdict is CONFIRMED, not refuted
I specifically looked for the usual false-positive escape hatches: a guard in middleware, a
wrapper, or enforcement done elsewhere. None exists. `middleware.ts` only lists
`/ccpa-privacy-notice` and `/api/consent/ccpa` as routes — it does no DO_NOT_SELL gating. The
resolver is genuinely orphaned, and the lead-dispatch path proves real PII leaves the system to
third parties regardless of opt-out state.

## Severity assessment
Kept at **High**. The lead-dispatch pipeline transmits consumer PII to external partners and
honors no opt-out — a concrete CPRA "share" without effect, plus a user-facing privacy control
that is misleading. A reasonable argument exists that the affiliate/sponsored click routes may
not themselves constitute a third-party "sale" (they return a DB-stored URL and record an
internal click row), but that does not change the verdict because the lead pipeline alone
substantiates the gap. Not raised to Critical: the exposure is a compliance/privacy-control gap,
not an auth bypass or data-exfiltration vulnerability, and the volume depends on actual partner
data flows. [Legal classification of each flow as a CPRA "sale/share" is [needs verification] by
counsel, but the engineering fact — the opt-out is never enforced — is proven by code.]

## Recommendation
Wire `hasCcpaOptOut` / `hasCcpaOptOutServer` into every sell/share surface (gate
`createLead`/lead-dispatch on the lead owner's DO_NOT_SELL state, and gate affiliate/sponsored
click recording + any third-party tag firing), or formally document a CPRA exemption for flows
that are not sales/shares. At minimum, the lead-dispatch path should skip dispatch for an
opted-out user.

## Related files
- `apps/web/src/lib/ccpa.ts:32-68`
- `apps/web/src/app/api/consent/ccpa/route.ts:26-27,77-124`
- `apps/web/src/lib/leads/create-lead.ts:58-114`
- `apps/web/src/lib/leads/dispatch-leads.ts:206-224`
- `apps/web/src/app/api/affiliate/click/route.ts`
- `apps/web/src/app/api/sponsored/click/route.ts`
- `apps/web/src/app/api/affiliate/postback/[network]/route.ts`
- `apps/web/src/components/shared/ccpa-opt-out-controls.tsx`
