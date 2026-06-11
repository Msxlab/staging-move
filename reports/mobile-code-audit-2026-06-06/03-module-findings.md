# Mobile Module Findings

Scope: key mobile modules, with web/admin parity notes where relevant.

## Main Tabs

| Module | Mobile finding | Web/Admin parity | Type |
| --- | --- | --- | --- |
| Dashboard | Not deeply entitlement-gated from the sampled Settings audit; no critical Settings blocker found. | N/A in this pass. | Low risk |
| Addresses | POST is server-gated by plan. Mobile shows raw error only. Mobile address type options are richer than web. | Server allows same enum; web new page only shows HOME/WORK/VACATION. | UX/Mismatch |
| Moving | Server gates plan creation and destination address creation. Mobile shows raw alert on API error. | Server has setup-grace and address-limit logic. | UX/Mismatch |
| Services | Server gates service limits. Browse mode drops per-provider error details and only shows failed count. Manual mode can create custom provider then delete it if service creation fails. | Server returns entitlement details, but mobile does not preserve them. | UX/Hata risk |
| More | Links many settings modules. Two-factor is only discoverable through Privacy, not top-level Settings/More. | Web privacy has 2FA controls inline. | Discoverability |

## Addresses

Sources:

- Mobile submit: `apps/mobile/app/addresses/new.tsx:96-115`.
- Server gate: `apps/web/src/app/api/addresses/route.ts:80-82`.
- Plan limit: `apps/web/src/lib/plan-limits.ts:190-219`.
- Mobile address types: `apps/mobile/app/addresses/new.tsx:48-55`.
- Web new address types: `apps/web/src/app/(app)/addresses/new/page.tsx:23-25`.
- Validator supports full mobile set: `apps/web/src/lib/validators.ts:36-47`.

Findings:

- Server correctly enforces plan limits.
- Mobile does not preflight remaining address count and does not show upgrade CTA.
- Mobile and web present different address type sets; server supports mobile's larger set, so this is not a backend error, but it is cross-platform UX mismatch.
- Family+ `addressLabels` entitlement has no obvious mobile UI/gate beyond existing type/nickname.

## Services And Custom Providers

Sources:

- Mobile browse batch save: `apps/mobile/app/services/new.tsx:256-286`.
- Mobile manual provider/service save: `apps/mobile/app/services/new.tsx:310-355`.
- Custom providers entry Add button: `apps/mobile/app/custom-providers/index.tsx:94-99`.
- Server service limit: `apps/web/src/lib/plan-limits.ts:228-258`.
- Server custom provider limit/setup grace: `apps/web/src/lib/plan-limits.ts:324-345`.
- Server custom provider route gate: `apps/web/src/app/api/custom-providers/route.ts:123-125`.

Findings:

- Server gates service and custom provider creation.
- Mobile browse save loses detailed error reason; users only see failed count.
- Mobile manual flow creates a custom provider first. If service creation fails due service limit, mobile attempts cleanup with delete. That is reasonable, but any delete failure leaves orphaned custom provider.
- Custom provider Add has no upfront plan/limit state. Free users may enter a form and only later hit backend gate.
- Manual connectors are allowed for Individual/Family/Pro in shared matrix, not Free. During setup grace, custom providers can be allowed up to setup limit. Mobile does not explain this distinction.

## Moving

Sources:

- Mobile create call: `apps/mobile/app/moving/new.tsx:255-260`.
- Server moving gate: `apps/web/src/app/api/moving/route.ts:83-90`.
- Plan moving logic: `apps/web/src/lib/plan-limits.ts:263-299`.

Findings:

- Server allows setup-grace first move and gates inactive/expired plans.
- Mobile shows raw API error. It does not distinguish moving-plan limit vs destination address limit vs subscription inactive.
- If destination mode creates a new address, the user may perceive the moving form as broken even though the actual failure is address quota.

## Budget

Sources:

- Mobile preflight: `apps/mobile/app/budget/new.tsx:54-74`.
- Mobile save gate handling: `apps/mobile/app/budget/new.tsx:123-135`.

Findings:

- This is one of the better mobile gates. It preflights `/api/profile` and turns `SUBSCRIPTION_REQUIRED` into inline subscription-required state.
- It should be used as a pattern for addresses/services/moving/custom providers.

## Connections And Address Changes

Sources:

- Mobile hardcoded connectors: `apps/mobile/app/settings/connections.tsx:28-30`.
- Mobile open OAuth: `apps/mobile/app/settings/connections.tsx:59-68`.
- Mobile available UI: `apps/mobile/app/settings/connections.tsx:148-176`.
- Server OAuth entitlement: `apps/web/src/app/api/partner-consents/oauth/initiate/route.ts:31-35`.
- Connector catalog: `apps/web/src/app/api/connectors/catalog/route.ts:124-167`.
- Web settings catalog behavior: `apps/web/src/app/(app)/settings/connections/page.tsx:63-71`, `apps/web/src/app/(app)/settings/connections/page.tsx:243-273`.

Findings:

- Mobile should not show Connect for all users.
- Family has manual connectors but no API connector entitlement, so Family users should not see USPS API connect as if available.
- Pro monthly users also may not be entitled because API connectors require annual Pro unless admin override.
- Address changes history is OK as read-only, but empty text should align with actual connector availability.

## Workspace

Sources:

- Mobile load/detail/invite/manage: `apps/mobile/app/settings/workspace.tsx:87-108`, `apps/mobile/app/settings/workspace.tsx:129-270`.
- Mobile empty state: `apps/mobile/app/settings/workspace.tsx:292-315`.
- Server create gate: `apps/web/src/app/api/workspaces/route.ts:50-58`.
- Server invite seat gate: `apps/web/src/app/api/workspaces/[id]/invitations/route.ts:96-123`.

Findings:

- Existing workspace management is broad on mobile.
- Creation is missing on mobile; Family/Pro users without an existing workspace are pushed to web pricing.
- Seat limits are enforced server-side: Family 6, Pro 10.
- Mobile should show owner plan, seat usage, and exact upgrade/seat-full messages instead of raw alerts.

## Security, Export, Delete

Sources:

- 2FA setup/confirm/disable: `apps/mobile/app/settings/two-factor.tsx:67-125`.
- Login MFA challenge: `apps/mobile/app/(auth)/sign-in.tsx:92-108`.
- Server login accepts backup code: `apps/web/src/lib/password-login.ts:29-34`, `apps/web/src/lib/password-login.ts:202-210`.
- Export mobile password-only: `apps/mobile/app/settings/export.tsx:66-88`, `apps/mobile/app/settings/export.tsx:156-188`.
- Export server step-up and Pro tax gate: `apps/web/src/app/api/export/route.ts:93-139`.
- Delete mobile payload: `apps/mobile/app/settings/delete-account.tsx:50-79`.
- Delete server MFA/backup support: `apps/web/src/app/api/account/delete/route.ts:88-118`.

Findings:

- 2FA itself is not absent. It is wired and can enable/disable for password-backed accounts.
- Mobile sign-in cannot use backup codes even though setup shows backup codes. This is a real recovery issue.
- Mobile export cannot use MFA/backup code step-up and disables all export buttons unless password exists.
- Mobile delete uses OAuth-only bypass correctly when no password and no MFA, but it does not show MFA/backup inputs for MFA-enabled users.
- Delete error handling hides server reason behind generic network error.

## Profile And Notifications

Sources:

- Profile required names: `apps/mobile/app/settings/profile.tsx:108-109`.
- Profile labels: `apps/mobile/app/settings/profile.tsx:202-211`.
- Shared profile schema: `apps/web/src/lib/validators.ts:5-21`.
- Profile API sensitive fields: `apps/web/src/app/api/profile/route.ts:213-254`.
- Notifications save: `apps/mobile/app/settings/notifications.tsx:64-80`.

Findings:

- Last name required marker is missing in UI.
- `isMilitary` is accepted by schema/API but not exposed on mobile profile.
- Notification push registration failure uses generic network error.
- Disabling push preferences does not unregister token locally, though server preferences should stop notification sends.

## Admin Notes

Sources:

- Admin subscription colors/filter: `apps/admin/src/app/(admin)/subscriptions/subscriptions-client.tsx:45-49`, `apps/admin/src/app/(admin)/subscriptions/subscriptions-client.tsx:238-239`.
- Admin subscription API includes `premiumGrantedBy`, `premiumUntil`, access type, provider. Source: `apps/admin/src/app/api/subscriptions/route.ts:37-56`.
- Admin user detail grant plan state/payload: `apps/admin/src/app/(admin)/users/[id]/user-detail-client.tsx:121-123`, `apps/admin/src/app/(admin)/users/[id]/user-detail-client.tsx:424-432`.
- Admin settings grant route stores provider `ADMIN` and premium grant metadata. Source: `apps/admin/src/app/api/settings/route.ts:465-624`.

Findings:

- Family/Pro are visible in admin subscription list/filter surfaces.
- Admin manual grant flow can target plan through `grantPlan`; default is Individual.
- This supports the conclusion that Family is present in system data paths. The bigger problem is mobile visibility and entitlement UX.

