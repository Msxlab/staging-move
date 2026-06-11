# Mobile Code Audit - Executive Summary

Date: 2026-06-06

Scope: code-only audit of `apps/mobile`, with parity checks against `apps/web`, `apps/admin`, and shared packages. Existing `.md` reports were not used as source material. No code was deleted, changed, or committed.

## Overall Result

The mobile app has most Settings routes wired, including a real `/settings/two-factor` screen. The core plan gates are enforced on the web API side, so the backend generally protects Free, Individual, Family, and Pro limits. The weak area is mobile UX/parity: mobile often does not preflight entitlement, does not use richer server metadata, and sometimes exposes actions that later fail in a raw web/API path.

Family exists in shared billing, web pricing, web subscription management, mobile subscription config, IAP backend config, and admin list/grant flows. If Family is not visible in the mobile app, the most likely code reason is mobile native plan visibility filtering when store purchases are enabled but Family SKU is not configured or available.

## Highest Priority Findings

| Priority | Area | Type | Finding |
| --- | --- | --- | --- |
| P1 | Subscription | Eksik/Mantik | Family/Pro can be hidden on native mobile when IAP is enabled but Family/Pro native SKU is missing. Source: `apps/mobile/src/lib/subscription-visible-plans.ts:16-20`, `apps/mobile/app/settings/subscription.tsx:478-493`. |
| P1 | Connections | Yanlis/Mantik | Mobile hardcodes USPS as available for everyone, then opens OAuth initiate. Server only allows API sync for entitled Pro annual/admin override, so Free/Individual/Family can hit a 403/503 in web view. Sources: `apps/mobile/app/settings/connections.tsx:28-30`, `apps/web/src/app/api/partner-consents/oauth/initiate/route.ts:31-35`. |
| P1 | 2FA/Login | Eksik | Mobile 2FA setup/disable exists, but sign-in only submits `mfaCode`. Backend supports `backupCode`; 8-char backup codes cannot be used from mobile sign-in. Sources: `apps/mobile/app/(auth)/sign-in.tsx:92-108`, `apps/web/src/lib/password-login.ts:29-34`, `apps/web/src/lib/totp.ts:122-135`. |
| P1 | Export/Delete Step-up | Eksik | Backend export/delete supports password, MFA code, and backup code; mobile export/delete surfaces mostly password-only flows. OAuth-only or MFA-first users can be blocked or get unclear errors. Sources: `apps/mobile/app/settings/export.tsx:66-88`, `apps/mobile/app/settings/delete-account.tsx:50-79`, `apps/web/src/lib/user-step-up.ts:46-80`. |
| P1 | Plan Limits | Eksik/UX | Address, service, moving, and custom-provider write gates are enforced server-side, but mobile mostly shows raw `res.error` or drops details. Mobile API client also drops `current`, `limit`, `upgradeRequired`, and `entitlementCode`. Sources: `packages/shared/src/api-client.ts:119-126`, `apps/web/src/lib/api-gates.ts`, `apps/mobile/app/services/new.tsx:270-286`. |
| P2 | Workspace | Eksik | Mobile can manage existing workspaces but does not create Family/Pro workspaces; empty state sends user to web pricing. Sources: `apps/mobile/app/settings/workspace.tsx:292-315`, `apps/web/src/app/api/workspaces/route.ts:50-58`. |
| P2 | Profile | Hata/UX | Last name is required by mobile validation, but the label does not show `*`. Mobile profile also omits `isMilitary`, which the shared profile schema and API support. Sources: `apps/mobile/app/settings/profile.tsx:108-109`, `apps/mobile/app/settings/profile.tsx:202-211`, `apps/web/src/lib/validators.ts:5-21`. |
| P2 | Address Labels | Eksik/Mantik | Shared entitlement matrix says Family+ has `addressLabels`, but mobile has no visible Family-gated address-label feature beyond ordinary address type/nickname fields. Source: `packages/shared/src/workspace-entitlements.ts:25-29`, `apps/mobile/app/addresses/new.tsx:48-55`. |

## Plan Matrix Observed In Code

| Plan | Seats | Addresses | Services | Manual providers | API connectors | Address labels | Advanced export |
| --- | ---: | ---: | ---: | --- | --- | --- | --- |
| Free / Free Trial | 1 | 2 | 10 | No | No | No | No |
| Individual | 1 | 10 | 100 | Yes | No | No | No |
| Family | 6 | 17 | 250 | Yes | No | Yes | No |
| Pro | 10 | 25 | 1000 | Yes | Yes | Yes | Yes |

Sources: `apps/web/src/lib/plan-limits.ts:22-37`, `packages/shared/src/workspace-entitlements.ts:25-29`.

## Short Answer To The User's Examples

- "Family paket goremedim": Family is in code, but mobile can hide it on native builds if IAP is enabled and Family native SKU is not configured/available.
- "Pro her seyi kapsiyor mu": In the technical entitlement matrix, Pro includes manual providers, address labels, higher seats, API connectors, partner hub, and advanced export. API connector access additionally requires annual Pro unless admin-granted.
- "Two factor auth calismiyor/tiklanmiyor": The route exists. It is disabled for OAuth-only accounts until a password exists; mobile setup/disable is present. Missing pieces are backup-code login, backup-code/2FA step-up for export/delete, and a clearer set-password path from the 2FA screen.
- "Paketlere uyum sagliyor mu": Backend gates mostly comply. Mobile presentation is inconsistent and often not plan-aware before the user taps.

