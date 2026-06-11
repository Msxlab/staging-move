# Mobile Settings And More Audit

Scope: right-bottom More tab, Settings index, and every Settings sub-route found in code.

## Route Map

| Screen | Route | Observed wiring |
| --- | --- | --- |
| More tab | `app/(tabs)/more.tsx` | Settings links include profile, notifications, subscription, connections, address changes, privacy. Source: `apps/mobile/app/(tabs)/more.tsx:88-95`. |
| Settings index | `app/settings/index.tsx` | Links profile, notifications, privacy, subscription, connections, address changes, workspace, export. Source: `apps/mobile/app/settings/index.tsx:50-58`. |
| 2FA | `app/settings/two-factor.tsx` | Not shown directly on Settings index; reachable from Privacy. Source: `apps/mobile/app/settings/privacy.tsx:385-399`. |
| Delete account | `app/settings/delete-account.tsx` | Reachable from Privacy, not from Settings index. |

## Privacy And 2FA

Status: partially good, with important gaps.

- Good: Privacy loads `/api/auth/security`, shows email/password/MFA badges, password setup/reset link, linked methods, sessions, revoke other sessions. Sources: `apps/mobile/app/settings/privacy.tsx:320-414`, `apps/web/src/app/api/auth/security/route.ts:130-143`.
- Good: Mobile 2FA screen calls `/api/auth/mfa/setup`, `/api/auth/mfa/confirm`, and `/api/auth/mfa/disable`. Sources: `apps/mobile/app/settings/two-factor.tsx:67-125`, `apps/web/src/app/api/auth/mfa/setup/route.ts:84-90`.
- Hata/UX: 2FA button is disabled when `hasPasswordLogin` is false. That is logically valid, but the 2FA route itself only says "Set a password first"; it does not provide the password setup email action on the same screen. Source: `apps/mobile/app/settings/two-factor.tsx:222-246`.
- Eksik: Mobile sign-in cannot submit backup codes. Backend accepts `backupCode`, but mobile only posts `mfaCode`. Backup codes are 8 hex chars. Sources: `apps/mobile/app/(auth)/sign-in.tsx:92-108`, `apps/web/src/lib/password-login.ts:29-34`, `apps/web/src/lib/totp.ts:122-135`.
- Eksik: After 2FA is enabled, mobile "manage" only disables 2FA. There is no backup-code regeneration or backup-code status. Web privacy has the same basic enable/disable shape, so this is product-level parity gap, not only mobile. Source: `apps/mobile/app/settings/two-factor.tsx:140-170`.

## Subscription

Status: backend/shared model is complete; mobile visibility can mislead.

- Family and Pro are included in `BILLING_PLAN_ORDER`, mobile `PLANS`, native plan keys, and IAP product response types. Sources: `packages/shared/src/billing.ts:7-14`, `apps/mobile/app/settings/subscription.tsx:125-128`.
- Backend IAP product endpoint supports Family/Pro monthly/yearly SKU runtime config. Source: `apps/web/src/app/api/mobile/iap/products/route.ts:33-44`, `apps/web/src/app/api/mobile/iap/products/route.ts:47-80`.
- Mobile maps purchases for Individual, Family, and Pro through `mapProductIdToPlan`. Source: `apps/web/src/lib/iap-common.ts:263-294`.
- Mantik hatasi: On native platforms with mobile store purchases enabled, Family/Pro cards are shown only when that plan is current or has a configured native SKU. Source: `apps/mobile/src/lib/subscription-visible-plans.ts:16-20`.
- UX risk: If IAP is disabled, cards may render read-only; if IAP is enabled but Family/Pro SKU is missing, Family/Pro can disappear. Source: `apps/mobile/app/settings/subscription.tsx:876-913`.
- Web parity: Web pricing and subscription change paths include Family/Pro and return `PLAN_NOT_AVAILABLE` only when Stripe price IDs are missing. Sources: `apps/web/src/components/settings/plan-change-section.tsx:8-10`, `apps/web/src/app/api/subscription/change-plan/route.ts:215-254`.

## Connections

Status: mobile is not plan-aware enough.

- Hata/Mantik: Mobile hardcodes `AVAILABLE_CONNECTORS` to USPS and shows a Connect button. Source: `apps/mobile/app/settings/connections.tsx:28-30`, `apps/mobile/app/settings/connections.tsx:148-176`.
- Server: OAuth initiate blocks when feature flag is off, connector is not configured, or user lacks API connector entitlement. Source: `apps/web/src/app/api/partner-consents/oauth/initiate/route.ts:31-35`.
- Entitlement detail: API connectors require active access, Pro feature flag, and annual billing unless manual/admin override. Source: `apps/web/src/lib/connector-oauth.ts:49-56`.
- Web parity: Web settings uses `/api/connectors/catalog`, reads mode and `entitlement.apiSync`, and shows Connect only for `API_SYNC && apiSyncEntitled`; otherwise it shows guided/coming-soon/Pro annual copy. Sources: `apps/web/src/app/api/connectors/catalog/route.ts:124-167`, `apps/web/src/app/(app)/settings/connections/page.tsx:243-273`.
- Recommendation: mobile should consume `/api/connectors/catalog` instead of hardcoding USPS and should show "Pro annual", "Guided update", or "Coming soon" before opening browser.

## Address Changes

Status: mostly read-only OK, but can confuse non-Pro users.

- Mobile fetches `/api/connectors/changes` and shows history. Source: `apps/mobile/app/settings/address-changes.tsx:54`.
- The history endpoint is not itself plan-gated. That is fine for read-only history, but the empty state implies changes appear when providers are connected. Since API connections are Pro annual only, mobile should explain plan/config requirements if no connectors are available.

## Workspace

Status: management exists; creation is web-only/missing on mobile.

- Mobile loads `/api/workspaces`, then members, managed sync, and invitations. Source: `apps/mobile/app/settings/workspace.tsx:101-108`.
- Mobile supports role changes, remove, transfer, leave, invite, cancel invite, and managed sync for existing workspace. Source: `apps/mobile/app/settings/workspace.tsx:129-270`.
- Eksik: If no workspace exists, mobile only says Family/Pro can create one and opens web pricing. It does not call POST `/api/workspaces`. Source: `apps/mobile/app/settings/workspace.tsx:292-315`.
- Server requires Family or Pro for workspace creation. Source: `apps/web/src/app/api/workspaces/route.ts:50-58`.

## Export

Status: export works for password-backed users; step-up parity is incomplete.

- Mobile posts `confirmPassword` only. Source: `apps/mobile/app/settings/export.tsx:66-73`.
- Mobile disables every export button unless `confirmPassword` has a value. Source: `apps/mobile/app/settings/export.tsx:184-189`.
- Server supports `confirmPassword`, `mfaCode`, or `backupCode`; OAuth-only users with no password/MFA get `STEP_UP_METHOD_UNAVAILABLE`. Source: `apps/web/src/app/api/export/route.ts:93-118`, `apps/web/src/lib/user-step-up.ts:46-80`.
- Good: mobile handles `UPGRADE_REQUIRED` for Pro tax export and routes to subscription. Source: `apps/mobile/app/settings/export.tsx:74-88`.
- Gap: mobile has no MFA/backup-code step-up input, so users who prefer/need MFA step-up cannot export from mobile.

## Delete Account

Status: dangerous action is protected; MFA parity is incomplete.

- Good: OAuth-only users can delete with typed phrase and `confirmAccountDeletion`, which server only honors if account truly has no password and no MFA. Sources: `apps/mobile/app/settings/delete-account.tsx:63-72`, `apps/web/src/lib/user-step-up.ts:82-92`.
- Eksik: If account has MFA enabled, server accepts `mfaCode`/`backupCode`; mobile delete does not show those fields and sends only password unless OAuth-only. Sources: `apps/web/src/app/api/account/delete/route.ts:88-118`, `apps/mobile/app/settings/delete-account.tsx:149-166`.
- UX bug: On delete failure, mobile replaces server reason with generic network error. Source: `apps/mobile/app/settings/delete-account.tsx:76-79`.

## Profile

Status: basic save is wired, but there are clear UX/data gaps.

- Hata: Mobile requires both first and last name, but only first name label shows `*`. Sources: `apps/mobile/app/settings/profile.tsx:108-109`, `apps/mobile/app/settings/profile.tsx:202-211`.
- Eksik: Shared profile schema and API support `isMilitary`, but mobile profile screen does not expose it. Sources: `apps/web/src/lib/validators.ts:5-21`, `apps/web/src/app/api/profile/route.ts:213-254`.
- Minor UX: sensitive consent failure in mobile can surface a privacy load failure style message instead of a consent-specific message.

## Notifications

Status: basic preference save is wired.

- Mobile loads and saves `/api/notifications/preferences`. Source: `apps/mobile/app/settings/notifications.tsx:51-80`.
- UX issue: If push registration fails, mobile shows generic network error even for permission/device registration failure. Source: `apps/mobile/app/settings/notifications.tsx:64-73`.
- Missing nuance: Disabling all push toggles updates preferences but does not unregister the push token locally. Server preferences should stop sends, but device registration state remains.

