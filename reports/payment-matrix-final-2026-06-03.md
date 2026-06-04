# LocateFlow Payment Matrix Final - 2026-06-03

## Scope

Verified paid web billing behavior against the DigitalOcean QA/staging service using Stripe test-mode prices. No production Stripe charge, production subscription mutation, Play rollout, App Store rollout, or secret rotation was performed.

## Environment

- QA/staging base URL: `https://locateflow-staging-owew7.ondigitalocean.app`
- Stripe mode: test mode
- Runtime catalog: Individual, Family, and Pro monthly/yearly test prices present
- Matrix summary: `C:\Users\Kutay\AppData\Local\Temp\locateflow-plan-matrix-v6-20260603-231015.json`
- Matrix log: `C:\Users\Kutay\AppData\Local\Temp\locateflow-plan-matrix-v6-20260603-231015.jsonl`

## Checkout Coverage

- Individual Monthly checkout succeeded and activated Individual Monthly.
- Individual Annual checkout succeeded with the annual trial path and activated Individual Annual.
- Family Monthly checkout succeeded and activated Family Monthly.
- Family Annual checkout succeeded and activated Family Annual.
- Pro Monthly checkout succeeded and activated Pro Monthly.
- Pro Annual checkout succeeded and activated Pro Annual.
- Checkout cancel reset/recovery behavior passed.
- Declined initial payment no longer opens a paid grace entitlement; it persists inactive `UNPAID`.
- Duplicate checkout for an already-active paid subscription is blocked.
- Terms acceptance is enforced server-side before paid plan/cycle mutation.
- Invalid paid plan input returns a client error.
- Store-managed active subscription blocks web Stripe checkout.

## Plan-Change Matrix

Full matrix result: 36 transitions / 36 passed.

- Immediate changes passed: 15.
- Scheduled reductions passed: 15.
- Same-plan/same-cycle no-op rejections passed: 6.
- All six source states were covered:
  - Individual Monthly
  - Individual Annual
  - Family Monthly
  - Family Annual
  - Pro Monthly
  - Pro Annual
- All six target states were covered for each source.

## Fixes Verified By The Matrix

- Stripe subscription period extraction now handles newer item-level period fields.
- Declined initial Checkout now maps to inactive unpaid entitlement.
- Stripe subscription schedule create/retrieve/update/release calls use the flexible-billing preview API version per request.
- The wider Stripe client remains pinned to the existing stable API version to avoid unnecessary checkout/webhook churn.

## Cleanup

- Matrix-created Stripe test-mode subscriptions: 36.
- Cleanup marked those 36 test-mode subscriptions `cancel_at_period_end`.
- The final QA account readback ended as active Stripe-managed Pro annual with `CANCEL_AT_PERIOD_END` and entitlement active until the paid period end.

## Remaining Payment Gaps

- Live production Stripe charges were intentionally skipped by safety rule.
- Pending downgrade web banner and admin pending-state visual confirmation still require Chrome reconnection or manual UI inspection; backend/API pending state is proven by the matrix.
