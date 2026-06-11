# Plan And Entitlement Parity

Scope: Free/Individual/Family/Pro behavior across shared packages, mobile, web, and admin.

## Canonical Plan Data

Shared billing includes all four plans:

- `FREE_TRIAL`
- `INDIVIDUAL`
- `FAMILY`
- `PRO`

Source: `packages/shared/src/billing.ts:7-14`.

Backend limit matrix:

| Plan | Max addresses | Max services |
| --- | ---: | ---: |
| FREE_TRIAL | 2 | 10 |
| INDIVIDUAL | 10 | 100 |
| FAMILY | 17 | 250 |
| PRO | 25 | 1000 |

Source: `apps/web/src/lib/plan-limits.ts:22-37`.

Feature matrix:

| Plan | Seats | API connectors | Manual connectors | Partner Hub | Address labels | Advanced export |
| --- | ---: | --- | --- | --- | --- | --- |
| FREE_TRIAL | 1 | No | No | No | No | No |
| INDIVIDUAL | 1 | No | Yes | No | No | No |
| FAMILY | 6 | No | Yes | No | Yes | No |
| PRO | 10 | Yes | Yes | Yes | Yes | Yes |

Source: `packages/shared/src/workspace-entitlements.ts:25-29`.

## Does Pro Cover Family?

Technically yes for the shared feature booleans and limits visible in code:

- Pro has higher seat limit than Family.
- Pro has `manualConnectors: true`.
- Pro has `addressLabels: true`.
- Pro has all Pro-only flags: `apiConnectors`, `partnerHub`, `advancedExport`.

Nuance: API connectors require more than just plan `PRO`; server also requires active access and annual billing unless manual/admin override. Source: `apps/web/src/lib/connector-oauth.ts:49-56`.

## Family Visibility

Family is present in:

- Shared billing definitions. Source: `packages/shared/src/billing.ts:89-109`.
- Mobile paid native plan key list. Source: `apps/mobile/app/settings/subscription.tsx:125-128`.
- Mobile IAP product response type. Source: `apps/mobile/app/settings/subscription.tsx:100-116`.
- Mobile IAP product endpoint runtime keys. Source: `apps/web/src/app/api/mobile/iap/products/route.ts:35-44`.
- IAP receipt/product mapping. Source: `apps/web/src/lib/iap-common.ts:273-278`.
- Web pricing/subscription change tiers. Source: `apps/web/src/components/settings/plan-change-section.tsx:8-10`.
- Admin subscriptions filter/list colors. Source: `apps/admin/src/app/(admin)/subscriptions/subscriptions-client.tsx:45-49`, `apps/admin/src/app/(admin)/subscriptions/subscriptions-client.tsx:238-239`.
- Admin user detail manual grant selector. Source: `apps/admin/src/app/(admin)/users/[id]/user-detail-client.tsx:121-123`, `apps/admin/src/app/(admin)/users/[id]/user-detail-client.tsx:424-432`.

Main mobile hiding rule:

```ts
if (!isNativeStorePlatform) return true;
if (planKey !== "INDIVIDUAL" && planKey !== "FAMILY" && planKey !== "PRO") return true;
if (!mobileStorePurchasesEnabled) return true;
if (planKey === "INDIVIDUAL") return true;
return planKey === currentPlanKey || hasConfiguredNativeSku;
```

Source: `apps/mobile/src/lib/subscription-visible-plans.ts:16-20`.

Interpretation:

- Web or non-native: Family/Pro can show.
- Native with IAP disabled: Family/Pro can show read-only.
- Native with IAP enabled and no Family/Pro SKU: Family/Pro is hidden unless already current.
- Native with IAP enabled and Family/Pro SKU configured/available: Family/Pro can show and purchase path can work.

## Mobile vs Web vs Admin Parity

| Area | Mobile | Web | Admin | Finding |
| --- | --- | --- | --- | --- |
| Pricing/subscription | Uses shared plan definitions and native SKU logic. Family/Pro can be filtered out. | Shows Individual/Family/Pro and uses Stripe checkout/change-plan. | Lists/filter Family/Pro; user detail can grant plan. | Mobile is the weakest visibility layer. |
| API connectors | Hardcoded USPS connect button. | Uses connector catalog mode + entitlement. | Connector admin pages/config exist. | Mobile can show doomed connect path for non-Pro annual users. |
| Workspace | Can manage existing workspaces. No create flow. | POST `/api/workspaces` creates Family/Pro workspace. | Workspace inspection/admin tools exist by module. | Family/Pro creation is not mobile-native. |
| Export | Password-only UI, tax export upgrade alert. | Server supports richer step-up; web export page likely closer but should be checked separately before release. | N/A for user export. | Mobile does not expose MFA/backup-code step-up. |
| Addresses/services/moving | Server gates writes; mobile shows raw/generic errors. | Web forms can show richer page-level errors. | User detail exposes related records. | Mobile needs entitlement-aware errors/upsells. |

## Codes And Metadata Lost On Mobile

The API client preserves only `error` and optional `code` for non-2xx responses:

Source: `packages/shared/src/api-client.ts:119-126`.

Server entitlement responses can include richer fields such as:

- `upgradeRequired`
- `current`
- `limit`
- `entitlementCode`

Because mobile drops those fields, screens cannot show precise messages like "2 of 2 addresses used" unless each screen separately preflights or API client returns the full error body.

## Recommended Fix Order

1. Make mobile subscription visibility explicit for Family/Pro. If Family/Pro cannot be purchased in-app, still show read-only cards with "Manage on web" or "Not available in this build", instead of hiding them when SKU is missing.
2. Use `/api/connectors/catalog` in mobile Connections and render mode/entitlement before opening OAuth.
3. Extend shared API error shape to preserve entitlement metadata, then update mobile address/service/moving/custom provider screens to show upgrade/limit UI.
4. Add backup-code and MFA step-up fields to mobile sign-in/export/delete flows.
5. Decide whether Family+ `addressLabels` is a real shipped feature; if yes, implement or gate it. If no, remove/rename the entitlement to avoid false plan promises.

