# Final Mobile Audit Index

Date: 2026-06-06
Status: final local audit index for the current working tree.
Scope: mobile-first settings/subscription audit, cross-checked with web/admin/backend code.
Evidence rule: code-only. Existing markdown reports and memory files are not evidence for this final index.

## Reports in This Folder

- `00-executive-summary.md` - initial summary.
- `01-settings-more-audit.md` - initial More/settings route pass.
- `02-plan-entitlement-parity.md` - initial plan/entitlement pass.
- `03-module-findings.md` - initial module findings.
- `04-plan-transition-feature-gates-deep-audit.md` - authoritative deep pass for plan transitions and feature gates.
- `05-mobile-settings-module-deep-audit.md` - authoritative deep pass for mobile More/settings modules.
- `99-final-mobile-audit-index.md` - this final index and current top findings.

If an earlier report conflicts with `04` or `05`, treat `04`/`05` and this file as the current result for the working tree.

## Top Findings to Fix First

1. Family/Pro can be hidden in mobile subscription when native purchases are enabled but Family/Pro SKU is not configured. Source: `apps/mobile/src/lib/subscription-visible-plans.ts:3-20`.
2. Scheduled plan changes can leave stale `pendingPlan`/schedule state after immediate changes or cancel/resume renewal. Sources: `apps/web/src/app/api/subscription/change-plan/route.ts:141-143`, `apps/web/src/app/api/subscription/change-plan/route.ts:347-390`, `apps/web/src/app/api/subscription/actions/route.ts:90-161`.
3. Custom/manual providers are effectively available to any active plan even though Free has `manualConnectors: false`. Sources: `packages/shared/src/workspace-entitlements.ts:29`, `apps/web/src/lib/plan-limits.ts:324`.
4. Document storage is marketed under Individual but no real document model/API/storage flow was found. Sources: `packages/shared/src/billing.ts:84`, `apps/web/src/lib/validators.ts:180-190`, `apps/web/src/app/(app)/services/[id]/page.tsx:33`.
5. Pro "unlimited move history" is not a real differentiator because all active plans can create moving plans. Sources: `packages/shared/src/billing.ts:128`, `apps/web/src/lib/plan-limits.ts:266`.
6. Address labels are marketed as Pro, but the entitlement matrix grants them to Family too, and no actual address-label gate was found. Sources: `packages/shared/src/billing.ts:124`, `packages/shared/src/workspace-entitlements.ts:27`.
7. Mobile export only supports password step-up, while backend export supports password, MFA code, or backup code. Sources: `apps/mobile/app/settings/export.tsx:50-72`, `apps/web/src/app/api/export/route.ts:16`, `apps/web/src/app/api/export/route.ts:95-97`.
8. Mobile workspace screen can manage an existing workspace but cannot create one; no-workspace users are sent to web pricing. Source: `apps/mobile/app/settings/workspace.tsx:292-315`.
9. Admin grant/update paths are inconsistent: user detail supports Family/Pro, settings grant endpoint only supports Individual. Sources: `apps/admin/src/app/(admin)/users/[id]/user-detail-client.tsx:72-76`, `apps/admin/src/app/api/settings/route.ts:39-46`.
10. Admin direct plan downgrade does not reconcile Family/Pro workspace seat overflow. Source: `apps/admin/src/app/api/users/[id]/route.ts:1031-1091`.

## Two-Factor Current State

The current code already contains mobile fixes:

- Mobile two-factor confirm/disable checks `res.data?.success === true`. Sources: `apps/mobile/app/settings/two-factor.tsx:90`, `apps/mobile/app/settings/two-factor.tsx:110`.
- Mobile sign-in maps 6-digit input to `mfaCode` and other input to `backupCode`. Source: `apps/mobile/app/(auth)/sign-in.tsx:99-103`.

Remaining issue: the two-factor button is disabled for users without password login, which is logical but feels "not clickable" unless the UI routes the user into password setup. Source: `apps/mobile/app/settings/privacy.tsx:399`.

## Family Package Visibility Answer

Family is in the shared billing definitions and native mobile plan key list, so it is not absent from the codebase. Sources: `packages/shared/src/billing.ts:10`, `apps/mobile/app/settings/subscription.tsx:128`.

But Family can be hidden on mobile by the visibility helper when native store purchase mode is active and Family SKU is missing. Source: `apps/mobile/src/lib/subscription-visible-plans.ts:3-20`.

That matches the reported symptom: "Family package not visible" can happen from configuration/state, not because Family is entirely missing.

## Pro Coverage Answer

Pro is intended to include the broadest feature set in the entitlement matrix: API connectors, manual connectors, partner hub, address labels, advanced export, and 10 seats. Source: `packages/shared/src/workspace-entitlements.ts:26`.

But "Pro covers everything" is not fully true in product/code parity:

- Some Pro-marketed features are not implemented or not gated, such as address labels and unlimited move history.
- Some Individual/Family features are not complete, such as Document storage and Family who-pays/who-uses service assignment.
- Admin and mobile purchase paths can misrepresent inherited or unavailable plans.

## Local-Only / Commit Status

This audit created local markdown reports under `reports/mobile-code-audit-2026-06-06/`.

No commit was made.
No app code was intentionally edited by this audit pass.
No files were deleted.
