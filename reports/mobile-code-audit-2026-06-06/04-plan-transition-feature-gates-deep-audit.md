# Mobile/Web/Admin Plan Transition and Feature Gate Deep Audit

Date: 2026-06-06
Scope: code-only audit of Free, Individual, Family, and Pro behavior across mobile, web, admin, Stripe, mobile IAP, and feature gates.
Method: direct code inspection only. Existing markdown reports or memory files were not used as evidence.

## Canonical Plan Definitions

- Paid plans are `INDIVIDUAL`, `FAMILY`, and `PRO`. Source: `packages/shared/src/billing.ts:10`.
- Billing copy claims:
  - Individual: Document storage. Source: `packages/shared/src/billing.ts:84`.
  - Family: Shared services with "who pays, who uses" and Family budget view. Sources: `packages/shared/src/billing.ts:103-104`.
  - Pro: Address labels and unlimited move history. Sources: `packages/shared/src/billing.ts:124`, `packages/shared/src/billing.ts:128`.
- Runtime entitlement matrix:
  - Pro: 10 seats, API connectors, manual connectors, partner hub, address labels, advanced export.
  - Family: 6 seats, manual connectors, address labels, no API connectors, no partner hub, no advanced export.
  - Individual: 1 seat, manual connectors only.
  - Free trial: 1 seat, no manual/API connectors.
  Source: `packages/shared/src/workspace-entitlements.ts:26-29`.

## Transition Matrix

| Transition | Web behavior | Mobile behavior | Admin behavior | Audit result |
| --- | --- | --- | --- | --- |
| Free -> Individual | Stripe checkout path. Individual supports monthly/yearly and campaign/trial handling. | Native IAP if mobile store purchases are enabled and SKU exists; otherwise web fallback/manage link. | User detail grant supports Individual; settings grant supports only Individual. | Mostly implemented. |
| Free -> Family/Pro | Family/Pro checkout path exists, but only works if Stripe price IDs are configured; otherwise `PLAN_NOT_AVAILABLE`. Source: `apps/web/src/app/api/stripe/checkout/route.ts:177-183`. | Family/Pro native products are supported by the IAP config resolver, but plan cards are hidden when native purchases are enabled and no SKU is configured. Source: `apps/mobile/src/lib/subscription-visible-plans.ts:3-20`. | User detail grant supports Family/Pro, but settings `grant_premium` schema still only accepts Individual. Sources: `apps/admin/src/app/(admin)/users/[id]/user-detail-client.tsx:72-76`, `apps/admin/src/app/api/settings/route.ts:39-46`. | Family can disappear from mobile; admin has conflicting grant paths. |
| Individual -> Family/Pro | `change-plan` handles paid target plans. Higher tier upgrade is immediate. Source: `apps/web/src/app/api/subscription/change-plan/route.ts:398-399`. | Native IAP can purchase Family/Pro if own subscription is not managed elsewhere and SKU exists. Stripe checkout/change endpoints block mobile client calls. Source: `apps/web/src/lib/mobile-external-billing-guard.ts:3-13`. | Direct plan change is possible, but only changing `plan` does not necessarily create a valid entitlement unless premium/status/provider fields are also correct. Source: `apps/admin/src/app/api/users/[id]/route.ts:1031-1091`. | Implemented, but admin direct plan edit is risky. |
| Family -> Pro | Web `change-plan` treats this as upgrade, immediate. | Native IAP possible if Pro SKU exists; otherwise card/web path behavior depends on platform/config. | Manual grant supports Pro in user detail. | Mostly implemented. |
| Pro -> Family/Individual | Lower tier change is scheduled at current period end and writes `pendingPlan`. Source: `apps/web/src/app/api/subscription/change-plan/route.ts:347-390`. | Store-managed downgrade must happen in App Store/Play billing. In-app manage opens native subscription settings. Source: `apps/mobile/app/settings/subscription.tsx:687-688`. | Admin subscription action can cancel/resume renewal but does not perform equivalent scheduled plan downgrade. | Web implemented, but pending-state cleanup has bugs. |
| Family -> Individual | Scheduled downgrade at period end on web. Seat overflow is reconciled by some provider paths, but not admin direct plan edit. | Store downgrade external. | Admin direct edit can change plan without seat reconciliation. | Seat cleanup gap on admin direct edits. |
| Paid -> Free | No `change-plan` target for Free. The app uses cancel trial/renewal and keeps access until trial/period end. Source: `apps/web/src/app/api/subscription/actions/route.ts:27-66`. | Store-managed cancellation is external; Stripe-managed opens web billing/settings. | Admin can cancel trial/renewal. | Correct product shape, but pending scheduled changes are not cleared on cancel. |
| Monthly -> Yearly | Immediate in `change-plan`/`switch-cycle` logic. | Store cycle change external/native. | No full equivalent in admin direct plan edit. | Web ok. |
| Yearly -> Monthly | Scheduled at period end. Source: `apps/web/src/app/api/subscription/switch-cycle/route.ts:387-431`. | Store cycle change external/native. | No full equivalent in admin direct plan edit. | Web ok, same pending cleanup risks. |

## High-Risk Findings

### P1: Scheduled downgrade state can survive later immediate changes or cancellation

`change-plan` writes `pendingPlan`, `pendingBillingInterval`, and `stripeSubscriptionScheduleId` for scheduled lower-tier changes. The immediate apply path clears `pendingBillingInterval` and schedule id, but does not clear `pendingPlan`. Sources: `apps/web/src/app/api/subscription/change-plan/route.ts:141-143`, `apps/web/src/app/api/subscription/change-plan/route.ts:347-390`.

Cancel/resume actions set Stripe `cancel_at_period_end` and local `cancelAtPeriodEnd`, but they do not release an attached subscription schedule and do not clear `pendingPlan`/`pendingBillingInterval`. Sources: `apps/web/src/app/api/subscription/actions/route.ts:90-161`, `apps/admin/src/app/api/users/[id]/subscription-actions/route.ts:235-295`.

Impact: a user can schedule Pro -> Individual, then upgrade/change/cancel, and the UI/database can still show a scheduled downgrade that may no longer match Stripe. This affects web subscription UI, admin support, and mobile "managed elsewhere" messaging.

### P1: Family/Pro can be hidden on mobile instead of shown as unavailable/web-managed

Mobile supports paid native keys for Individual, Family, and Pro. Source: `apps/mobile/app/settings/subscription.tsx:128`. It resolves Family/Pro product IDs from IAP product response. Source: `apps/mobile/app/settings/subscription.tsx:304-306`.

But `shouldShowMobileSubscriptionPlan` hides Family/Pro on native store platforms when mobile purchases are enabled and no SKU exists unless it is the current plan. Source: `apps/mobile/src/lib/subscription-visible-plans.ts:3-20`.

Impact: "Family package not visible" is explainable from code. If App Store/Play Family SKU is missing or disabled, the Family card is not shown, so users do not see a web-only Family/Pro path even though the subscription screen later has a web pricing branch.

### P1: Billing copy and entitlement matrix disagree on address labels

Billing copy presents "Address labels" as a Pro feature. Source: `packages/shared/src/billing.ts:124`. The entitlement matrix enables `addressLabels` for Family too. Source: `packages/shared/src/workspace-entitlements.ts:27`.

Search found `addressLabels` used in the entitlement matrix/tests/copy, but not as an actual gate for an address-label feature. Impact: either Family silently gets a Pro-marketed feature, or the feature is not implemented anywhere. Both are plan-parity problems.

### P1: Free users can create manual/custom providers even though Free entitlement says no manual connectors

The entitlement matrix says Free has `manualConnectors: false`. Source: `packages/shared/src/workspace-entitlements.ts:29`. Custom-provider creation calls `canCreateCustomProvider`. Source: `apps/web/src/app/api/custom-providers/route.ts:123`.

`canCreateCustomProvider` allows any active plan and does not check `planFeatures(...).manualConnectors`. Source: `apps/web/src/lib/plan-limits.ts:324`. Impact: manual/custom providers are effectively not gated by the plan matrix.

### P1: "Unlimited move history" is not Pro-only

Pro copy claims unlimited move history. Source: `packages/shared/src/billing.ts:128`. `canCreateMovingPlan` allows every active plan to create moving plans and only blocks inactive/setup-grace users. Source: `apps/web/src/lib/plan-limits.ts:266`.

Impact: Pro's unlimited move-history claim is not enforced as a differentiator. Either lower plans should have caps or Pro copy should change.

### P1: Document storage is promised but there is no real storage module/model

Individual copy includes "Document storage". Source: `packages/shared/src/billing.ts:84`. Code has a passive `documentUploadSchema` and a service detail type/render slot for `documents`. Sources: `apps/web/src/lib/validators.ts:180-190`, `apps/web/src/app/(app)/services/[id]/page.tsx:33`, `apps/web/src/app/(app)/services/[id]/page.tsx:208-214`.

The service API inspected does not include a documents relation, and the Prisma schema scan found no `Document` model. Impact: Document storage appears to be a promised but unimplemented feature.

### P1: Web plan-change UI does not use inherited entitlement correctly

Mobile subscription code now has explicit inherited entitlement handling and hides purchase options for inherited Family/Pro members. Sources: `apps/mobile/app/settings/subscription.tsx:412-453`, `apps/mobile/app/settings/subscription.tsx:487-506`.

The web plan-change component fetches `/api/profile` and derives current plan from the user's own subscription row, not the inherited workspace entitlement. Impact: inherited Family/Pro members can be shown Free/upgrade controls even though access comes from the owner plan.

## Medium-Risk Findings

### P2: Admin has two conflicting manual grant models

User detail UI supports granting Individual, Family, and Pro. Source: `apps/admin/src/app/(admin)/users/[id]/user-detail-client.tsx:72-76`. Admin settings `grant_premium` still validates `plan` as only `INDIVIDUAL`, with a stale comment saying Family is not real. Source: `apps/admin/src/app/api/settings/route.ts:39-46`.

Impact: two admin surfaces can produce different results for the same support operation.

### P2: Admin direct plan edits do not reconcile workspace seats

Provider-driven flows call seat reconciliation after IAP or workspace entitlement changes, but the admin user update route directly updates/creates `subscription` and there is no `reconcileSeatsForOwner` call in that route. Sources: `apps/admin/src/app/api/users/[id]/route.ts:1031-1091`.

Impact: downgrading a Family/Pro owner to Individual/Free from admin can leave excess workspace members active until another reconciliation path runs.

### P2: Reminders are productized as Individual but look available broadly

Individual billing copy includes bill and renewal reminders. Code paths for notification preferences and bill/task/move/contract reminder cron jobs do not show a plan-feature gate in the inspected reminder routes. Sources include `apps/web/src/app/api/notifications/route.ts:64-118`, `apps/web/src/app/api/cron/bill-reminders/route.ts:17-167`.

Impact: reminders may be available to Free users even if product copy says Individual. This can be a product decision, but then the billing copy is misleading.

### P2: Family "who pays/who uses" is not represented as service data

Family copy promises shared services with "who pays, who uses". Source: `packages/shared/src/billing.ts:103`. The schema/routes inspected show workspace-scoped services and custom providers, but no service-level payer/consumer fields matching that claim.

Impact: Family sharing exists through workspace scope, but the advertised payer/user assignment is not implemented.

### P2: Mobile export only offers password step-up

Server export accepts `confirmPassword`, `mfaCode`, or `backupCode`. Sources: `apps/web/src/app/api/export/route.ts:16`, `apps/web/src/app/api/export/route.ts:95-97`, `apps/web/src/app/api/export/pdf/route.ts:99-101`. Mobile export sends only `confirmPassword` and disables export without it. Sources: `apps/mobile/app/settings/export.tsx:50-72`, `apps/mobile/app/settings/export.tsx:157-188`.

Impact: OAuth-only users or users who prefer MFA/backup-code step-up cannot export from mobile even though the backend supports it.

### P2: Mobile workspace can manage an existing workspace but cannot create one

Mobile workspace screen lists workspaces, members, invitations, managed sync, transfer, remove, and leave operations. Sources: `apps/mobile/app/settings/workspace.tsx:101`, `apps/mobile/app/settings/workspace.tsx:129-270`.

When no workspace exists, it tells the user to see Family/Pro on the web. Sources: `apps/mobile/app/settings/workspace.tsx:292-315`. No mobile workspace creation POST was found in the screen.

Impact: Family/Pro mobile users can end up with no way to create the workspace from mobile.

### P2: Store-managed Family/Pro manage fallback can open Individual SKU

Mobile billing management opens native subscription settings with `subscription.billingProductId || currentPlanStoreSku || monthlySku || yearlySku`. Source: `apps/mobile/app/settings/subscription.tsx:687-688`. `monthlySku`/`yearlySku` are Individual fallbacks. Source: `apps/mobile/app/settings/subscription.tsx:307-308`.

Impact: if a Family/Pro store subscription is missing `billingProductId` and the current plan SKU cannot resolve, the native manage call can be seeded with an Individual product ID.

### P3: Family/Pro checkout update can show stale local plan during pending checkout

Family/Pro checkout create path writes `plan`, but update path for an existing subscription row writes status/billing metadata without setting `plan`. Sources: `apps/web/src/app/api/stripe/checkout/route.ts:192`, `apps/web/src/app/api/stripe/checkout/route.ts:217-228`.

Impact: before webhook activation, an existing Free/Individual row in `PENDING_CHECKOUT` can still show the old plan locally.

## Current Code Note

The current code already contains several relevant fixes/guards. Relevant to this audit:

- Mobile sign-in now maps a 6-digit MFA entry to `mfaCode` and non-6-digit input to `backupCode`. Source: `apps/mobile/app/(auth)/sign-in.tsx:99-103`.
- Mobile two-factor now treats only `res.data?.success === true` as success. Source: `apps/mobile/app/settings/two-factor.tsx:90`, `apps/mobile/app/settings/two-factor.tsx:110`.
- Mobile subscription now handles inherited entitlement and hides purchase options for inherited Family/Pro members. Sources: `apps/mobile/app/settings/subscription.tsx:412-453`, `apps/mobile/app/settings/subscription.tsx:487-506`.

These app code paths were inspected only; this audit pass did not edit app code.
