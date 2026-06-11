# Mobile Settings and More Tab Module Deep Audit

Date: 2026-06-06
Scope: bottom-right mobile `More` tab, nested mobile settings pages, and their web/admin/backend dependencies.
Method: code-only audit. Existing markdown reports or memory files were not used as evidence.

## Route Inventory

The bottom-right mobile tab is `more`. It links to:

- Settings group: Profile, Notifications, Subscription, Connections, Address changes, Privacy, Settings. Sources: `apps/mobile/app/(tabs)/more.tsx:90-94`.
- More group: Budget, Providers, Custom Providers, Blog, Notifications feed, Support tickets, Help. Sources: `apps/mobile/app/(tabs)/more.tsx:102-107`.

Nested Settings index links to:

- Profile, Notifications, Privacy, Subscription, Connections, Address Changes, Workspace, Export. Source: `apps/mobile/app/settings/index.tsx:53-58`.

Result: the main settings routes exist, but Workspace and Export are one level deeper than the bottom-right More screen. This is a discoverability issue, not a missing route.

## Subscription

Status: high risk.

What works:

- Mobile defines paid native plan keys for Individual, Family, and Pro. Source: `apps/mobile/app/settings/subscription.tsx:128`.
- Mobile resolves configured native SKUs for all paid plans/cycles. Source: `apps/mobile/app/settings/subscription.tsx:304-306`.
- Mobile recognizes inherited workspace entitlement and blocks redundant native purchase for inherited Family/Pro members in the current working tree. Sources: `apps/mobile/app/settings/subscription.tsx:412-453`.
- Mobile external billing is intentionally blocked from Stripe checkout/change endpoints. Source: `apps/web/src/lib/mobile-external-billing-guard.ts:3-13`.

Problems:

- Family/Pro can vanish on native platforms if mobile purchases are enabled but Family/Pro SKU is missing. Source: `apps/mobile/src/lib/subscription-visible-plans.ts:3-20`.
- The web-only Family/Pro upgrade branch exists in the mobile subscription screen, but a hidden plan card means the user may never reach it. Source: `apps/mobile/app/settings/subscription.tsx:1139`.
- Store manage fallback can seed native settings with Individual SKU if Family/Pro product ID is missing. Source: `apps/mobile/app/settings/subscription.tsx:687-688`.

Recommended fix shape:

- Always show Family/Pro cards when the backend supports them, even if native SKU is missing. Mark them as "manage on web" or "not available in app" instead of hiding them.
- Remove Individual SKU fallback for Family/Pro manage calls; use no SKU or the resolved current-plan SKU only.

## Two-Factor Authentication

Status: partially working, with UX traps.

What works in the current working tree:

- Mobile privacy screen exposes a two-factor action and routes to `/settings/two-factor`. Source: `apps/mobile/app/settings/privacy.tsx:397`.
- The button is intentionally disabled when `hasPasswordLogin` is false. Source: `apps/mobile/app/settings/privacy.tsx:399`.
- Mobile two-factor setup/confirm/disable route exists. Confirm and disable now require `success === true` before showing success. Sources: `apps/mobile/app/settings/two-factor.tsx:88-110`.
- Backup codes are displayed after setup. Sources: `apps/mobile/app/settings/two-factor.tsx:186-194`.
- Mobile sign-in now supports backup-code entry by sending non-6-digit MFA input as `backupCode`. Source: `apps/mobile/app/(auth)/sign-in.tsx:99-103`.
- Backend login accepts either `mfaCode` or `backupCode`. Sources: `apps/web/src/lib/password-login.ts:32-33`, `apps/web/src/lib/password-login.ts:203-208`, `apps/web/src/lib/password-login.ts:246-266`.

Problems:

- Users without password login experience the two-factor button as "not clickable". The code explains why, but the mobile screen does not provide the password setup action on that same two-factor screen. Source: `apps/mobile/app/settings/privacy.tsx:387-399`.
- Mobile two-factor disable UX only sends `password`; web/admin step-up APIs elsewhere commonly support MFA/backup-code step-up. Source: `apps/mobile/app/settings/two-factor.tsx:105-110`.
- Web user sign-in still appears to only submit `mfaCode`, not `backupCode`, even though backend accepts both. Source: `apps/web/src/app/sign-in/page.tsx:56-107`.

Recommended fix shape:

- On mobile, when `hasPasswordLogin` is false, route to password setup/reset from the disabled two-factor area instead of leaving it as a dead control.
- Add explicit "Use backup code" UI on mobile and web sign-in rather than overloading one MFA input.
- Align disable/export/delete step-up UI with backend support for password, TOTP, and backup code.

## Privacy and Security

Status: medium risk.

What works:

- Privacy screen shows password/OAuth state and security status. Sources: `apps/mobile/app/settings/privacy.tsx:340-375`.
- Export and delete account actions are present from privacy. Sources: `apps/mobile/app/settings/privacy.tsx:212-219`, `apps/mobile/app/settings/privacy.tsx:526-527`.

Problems:

- Two-factor is disabled for OAuth-only/no-password accounts without a direct password setup handoff. Source: `apps/mobile/app/settings/privacy.tsx:387-399`.
- Export/delete flows on mobile are less capable than backend step-up support when MFA/backup code is available.

## Export

Status: medium risk.

What works:

- Mobile lists budget, subscription, tax/property, and full export options. Sources: `apps/mobile/app/settings/export.tsx:57-63`.
- Server gates Tax & Property export on Pro `advancedExport`. Sources: `apps/web/src/app/api/export/route.ts:123-138`, `apps/web/src/app/api/export/pdf/route.ts:147-157`.
- Server accepts password, TOTP, or backup-code step-up for export. Sources: `apps/web/src/app/api/export/route.ts:16`, `apps/web/src/app/api/export/route.ts:95-97`.

Problems:

- Mobile only sends `confirmPassword` and disables export unless password is filled. Sources: `apps/mobile/app/settings/export.tsx:50-72`, `apps/mobile/app/settings/export.tsx:157-188`.
- OAuth-only users and MFA-first users can be blocked on mobile even when the server could authorize them.

Recommended fix shape:

- Add MFA and backup-code fields or a shared mobile step-up component.
- Reuse that component for export, delete account, workspace transfer, and sensitive billing actions.

## Workspace and Family

Status: medium risk.

What works:

- Backend workspace creation is gated to Family/Pro. Source: `apps/web/src/app/api/workspaces/route.ts:55-59`.
- Mobile workspace screen can list workspaces, members, invitations, roles, managed sync, transfer ownership, remove, and leave. Sources: `apps/mobile/app/settings/workspace.tsx:101`, `apps/mobile/app/settings/workspace.tsx:129-270`.
- Family budget sharing is partially implemented by scoping budget ownership to the workspace owner. Sources: `apps/web/src/app/api/budget/route.ts:196-232`.

Problems:

- Mobile workspace screen does not create a workspace. If none exists, it sends users to web Family/Pro pricing. Source: `apps/mobile/app/settings/workspace.tsx:292-315`.
- Family advertised "who pays, who uses" is not represented in service data in inspected schema/routes.
- Admin direct plan downgrade does not reconcile active workspace seats. Source: `apps/admin/src/app/api/users/[id]/route.ts:1031-1091`.

Recommended fix shape:

- Add mobile workspace creation for Family/Pro owners.
- Add payer/user assignment fields or remove/soften that billing copy.
- Trigger `reconcileSeatsForOwner` after admin plan/status changes affecting seat limits.

## Connections and Address Changes

Status: medium risk.

What works:

- Pro API connector entitlement is centralized through `userHasApiConnectorEntitlement`. Source: `apps/web/src/lib/connector-oauth.ts:49-53`.
- Connector catalog downgrades API sync to guided update when API connectors are disabled/not entitled. Sources: `apps/web/src/app/api/connectors/catalog/route.ts:126-147`.
- Workspace sync requires owner API connector entitlement. Source: `apps/web/src/app/api/workspaces/[id]/sync/route.ts:44`.
- Address-change auto-sync uses owner entitlement in workspace scope. Source: `apps/web/src/app/api/addresses/[id]/route.ts:143-151`.

Problems:

- Entitlement matrix has a `partnerHub` flag, but inspected connector/address-change code keys off API connector entitlement, not `partnerHub`. Source: `packages/shared/src/workspace-entitlements.ts:26`.
- Family gets manual connectors but no API connectors; this is consistent with the matrix, but product copy should make the difference clear.

Recommended fix shape:

- Decide whether Partner Hub is a real feature flag or just marketing copy. If real, gate UI/routes by `partnerHub`; if not, remove the unused flag.

## Budget

Status: mostly working.

What works:

- Mobile checks `/api/profile` entitlement before allowing new budget work. Sources: `apps/mobile/app/budget/new.tsx:70-88`.
- Budget POST requires active premium access. Source: `apps/web/src/app/api/budget/route.ts:153-154`.
- Workspace permissions split budget view/manage. Sources: `packages/shared/src/permissions.ts:117-132`.
- Workspace budget ownership is tied to owner user ID. Source: `apps/web/src/app/api/budget/route.ts:196-232`.

Problems:

- Family budget view is only partially productized. It shares the budget by workspace owner, but there is no rich Family-specific allocation/role UI beyond permissions.

## Custom Providers

Status: high risk.

What works:

- More tab links to Custom Providers. Source: `apps/mobile/app/(tabs)/more.tsx:104`.
- Backend custom-provider creation checks `canCreateCustomProvider`. Source: `apps/web/src/app/api/custom-providers/route.ts:123`.

Problem:

- `canCreateCustomProvider` permits any active plan, while the entitlement matrix says Free has no manual connectors. Sources: `apps/web/src/lib/plan-limits.ts:324`, `packages/shared/src/workspace-entitlements.ts:29`.

Recommended fix shape:

- Enforce `planFeatures(userPlan.plan).manualConnectors` in `canCreateCustomProvider`, or change the plan matrix/copy to say custom/manual providers are available to Free.

## Documents

Status: high risk.

What exists:

- A document upload validator exists. Source: `apps/web/src/lib/validators.ts:180-190`.
- Service detail page type/render includes optional `documents`. Sources: `apps/web/src/app/(app)/services/[id]/page.tsx:33`, `apps/web/src/app/(app)/services/[id]/page.tsx:208-214`.

Problem:

- No actual document model/API/storage flow was found in the inspected code, while Individual copy promises Document storage. Source: `packages/shared/src/billing.ts:84`.

Recommended fix shape:

- Either implement document storage end-to-end or remove it from Individual marketing copy until complete.

## Notifications and Reminders

Status: medium risk.

What works:

- Notification settings route stores reminder preferences. Sources: `apps/web/src/app/api/notifications/route.ts:64-118`.
- Bill reminder cron exists. Source: `apps/web/src/app/api/cron/bill-reminders/route.ts:17-167`.

Problem:

- Reminder functionality appears not to be gated by Individual even though Individual billing copy calls out bill/renewal reminders as a paid feature.

Recommended fix shape:

- Either gate reminder prefs/cron delivery by paid plan or move reminders into Free copy as a baseline feature.

## Admin Cross-Check

Status: medium/high risk.

What works:

- Admin user detail plan options include Individual, Family, Pro. Sources: `apps/admin/src/app/(admin)/users/[id]/user-detail-client.tsx:789-791`.
- Manual grant UI supports Individual, Family, Pro. Source: `apps/admin/src/app/(admin)/users/[id]/user-detail-client.tsx:72-76`.
- User update API validates Family/Pro as subscription plan values. Source: `apps/admin/src/app/api/users/[id]/route.ts:20`.

Problems:

- Admin settings `grant_premium` endpoint only accepts Individual and has stale comments. Source: `apps/admin/src/app/api/settings/route.ts:39-46`.
- User detail "plan changed" operation sends only `{ plan: pendingPlan, ...stepUp }`. Source: `apps/admin/src/app/(admin)/users/[id]/user-detail-client.tsx:278-290`.
- Direct API update changes the subscription row but does not reconcile workspace seats. Source: `apps/admin/src/app/api/users/[id]/route.ts:1031-1091`.

Recommended fix shape:

- Make admin plan changes explicit: "change label only" versus "grant entitlement".
- Unify admin grant APIs so Family/Pro are treated the same everywhere.
- Reconcile seats after any admin plan/status downgrade from Family/Pro.

