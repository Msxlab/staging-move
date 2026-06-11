# Stripe Raw Card Test-Mode Notification Audit - 2026-06-05

Scope: investigate Stripe's first-time notification that a full card number was passed to the Stripe API in test mode. No live payment, refund, key change, raw-card setting change, or production mutation was performed.

## Notification

- Stripe request id: `req_AtwErJxlvzLZOo`
- Stripe message class: full card number passed directly to the API in test mode.

## Dashboard Verification

Checked in the Stripe Dashboard using the request id.

- Mode: test / sandbox.
- Time: June 3, 2026, 9:22:51 PM EDT.
- Endpoint: `POST /v1/payment_methods`.
- Status: `402 ERR`.
- User agent: `node`.
- API version shown by Stripe: `2026-04-22.dahlia`.
- Request body shape: `type=card` with `card[number]` masked by Stripe to last4 `4242`.
- Stripe rejected the request before creating a usable PaymentMethod.

Evidence screenshot:

- `C:\Users\Kutay\AppData\Local\Temp\locateflow-stripe-request-req_AtwErJxlvzLZOo-20260605.png`

## Local Source Check

Repository-wide current-code scan found no committed full test card number or raw-card Stripe API path:

- No `4242424242424242`.
- No `card[number]`.
- No `payment_method_data[card]`.
- No raw `cardNumber` payment collection path in app code.

The live web checkout path uses Stripe Checkout Sessions:

- `apps/web/src/app/api/stripe/checkout/route.ts` creates `stripe.checkout.sessions.create(...)`.
- `apps/web/src/components/marketing/embedded-checkout-card.tsx` uses Stripe's embedded checkout provider with a Stripe-provided `clientSecret`.
- Customer creation stores only email and metadata; it does not attach raw card details.

The current Stripe matrix QA script uses a Stripe test token, not a raw card number:

- `scripts/stripe-live-plan-matrix.cjs` uses `source: "tok_visa"`.
- The script now has destructive-action guards: refuses production-looking URLs by default, requires acknowledgement, and is dry-run unless `--apply` is passed.

## Root Cause

The request came from a transient Node-based QA attempt, not from the production web/mobile/admin app flow.

Local VS Code/Codex logs show the matching failure at the same time:

- Error path: `stripe /payment_methods 402`.
- Stack: `stripePost ([stdin])` -> `createStripeSource ([stdin])`.
- This indicates a temporary stdin Node script attempted to create a test PaymentMethod using raw card data. Stripe blocked it.

## Impact

- No live charge was made.
- No production customer payment flow is affected.
- No evidence of raw card collection in current app code.
- No need to enable Stripe raw card data APIs.
- No secret rotation is indicated by this finding.

## Required Practice Going Forward

- Keep customer payment collection on Stripe Checkout / Stripe.js / Payment Element.
- For direct test scripts, use Stripe test tokens/payment methods such as `tok_visa` or `pm_card_visa`; do not pass card numbers.
- Do not enable raw card data APIs in Stripe integration settings.
- If this request is discussed with Stripe Support, provide the request id `req_AtwErJxlvzLZOo`.

## Verdict

This was a blocked test-mode QA mistake from a temporary Node script. The current production integration remains aligned with Stripe's recommended hosted/embedded Checkout pattern.
