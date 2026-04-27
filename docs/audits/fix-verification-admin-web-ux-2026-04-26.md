# Admin/Web UX Security Audit Fix Verification - 2026-04-26

## Summary

Reviewed the two read-only audit inputs from `docs/audits/full-system-audit-2026-04-26/04-admin-panel-security-ux.md` and `docs/audits/full-system-audit-2026-04-26/05-user-web-ui-ux.md` against current `move-main/main`.

- Findings reviewed: 46
- Confirmed and fixed or partially fixed in this branch: 21
- Already fixed in current code: 6
- Stale in current product surface: 1
- False positive / intentionally acceptable: 3
- Deferred: 15
- Schema migrations added: no

## Validation Matrix

| Finding ID | Audit title | Current status | Evidence in current code | Fix decision | Files touched | Tests added | Launch relevance |
|---|---|---|---|---|---|---|---|
| F-ADM-001 | `/api/users/[id]` returns `passwordHash` | CONFIRMED | Detail route already stripped `passwordHash`, but the users list API used unrestricted `include` and detail token selects exposed token row IDs. | Restricted users list to explicit safe `select`; removed token IDs from detail selects; kept boolean `hasPasswordLogin`. | `apps/admin/src/app/api/users/route.ts`, `apps/admin/src/app/api/users/[id]/route.ts` | `apps/admin/src/app/api/users/[id]/route.test.ts` | Critical privacy/security |
| F-ADM-002 | Backup import does not bind to creator/admin context | CONFIRMED | Import is `SUPER_ADMIN` and non-dry-run requires password/signature, but archive creator binding needs archive/schema policy. Dry-run was not audit-logged. | Added audit log for dry-run attempts; deferred creator binding to `dr-and-alerts` / backup archive metadata branch. | `apps/admin/src/app/api/backup/import/route.ts` | Covered by existing backup route tests plus typecheck | Critical DR governance |
| F-ADM-003 | Stripe IDs unmasked in subscription detail | CONFIRMED | Subscription detail rendered full Stripe customer/subscription IDs. | Masked Stripe IDs by default with shared helper. | `apps/admin/src/app/(admin)/subscriptions/page.tsx`, `apps/admin/src/lib/privacy.ts` | `apps/admin/src/lib/privacy.test.ts` | High privacy |
| F-ADM-004 | Browser `window.prompt()` for password confirm | CONFIRMED | Users and providers delete flows used `window.prompt()` for admin password entry. | Replaced with password confirmation modal; input is `type=password`, autocomplete off, cancelable, local state cleared on close. | `apps/admin/src/components/password-confirm-modal.tsx`, users/providers pages | `apps/admin/src/app/destructive-actions.test.ts` | High security/UX |
| F-ADM-005 | No rate limit on admin API mutation routes | DEFERRED | Broad mutation-rate limiting spans bulk delete, imports, MFA and settings routes. | Deferred to `admin-sensitive-actions-and-exports`; needs route-wide policy without high-cost Redis patterns. | None | None | High abuse protection |
| F-ADM-006 | Session not revoked on role demotion | ALREADY_FIXED | `apps/admin/src/app/api/team/[id]/route.ts` invalidates active `adminSession` rows on sensitive role/status changes. | No change. | None | Existing branch coverage | High access control |
| F-ADM-007 | Email visible in dashboard recent-users widget | CONFIRMED | Dashboard rendered full user email in recent users/upcoming moves. | Masked list-view emails. | `apps/admin/src/app/(admin)/page.tsx`, `apps/admin/src/lib/privacy.ts` | `apps/admin/src/lib/privacy.test.ts` | Medium privacy |
| F-ADM-008 | Email visible in billing dashboard tables | CONFIRMED | Billing/subscription list views rendered full emails. | Masked list-view emails; detail/support pages retain necessary full data where current product expects it. | `apps/admin/src/app/(admin)/billing/page.tsx`, `apps/admin/src/app/(admin)/subscriptions/page.tsx` | `apps/admin/src/lib/privacy.test.ts` | Medium privacy |
| F-ADM-009 | Sidebar hardcoded `pl-64`; not collapsible | DEFERRED | Admin layout still uses fixed sidebar spacing. | Deferred to `admin-responsive-layout`; larger layout change than this branch. | None | None | Medium UX |
| F-ADM-010 | Pagination `perPage` parsed before clamp | CONFIRMED | Users/providers/subscriptions/logs/moving/notifications/login-history parsed raw pagination. | Added shared clamp helper; normal admin list APIs clamp min 1 / max 100. Provider grouped catalog remains intentionally capped separately at 2000 for category view. | Admin API list routes, `apps/admin/src/lib/pagination.ts` | `apps/admin/src/lib/pagination.test.ts` | Medium stability |
| F-ADM-011 | Provider/state-rules delete missing type-to-confirm | CONFIRMED | State-rule delete used browser confirm; provider delete had prompt/password flow. | Added state-rule type-to-confirm modal and provider password modal. | `apps/admin/src/app/(admin)/state-rules/page.tsx`, `apps/admin/src/app/(admin)/providers/page.tsx` | `apps/admin/src/app/destructive-actions.test.ts` | Medium destructive-action safety |
| F-ADM-012 | Feature flag toggles lack confirmation for >10% rollouts | DEFERRED | Feature flag UI is writable and lacks rollout confirmation. | Deferred to `admin-sensitive-actions-and-exports`; needs targeted UX around rollout semantics. | None | None | Medium release safety |
| F-ADM-013 | CSV import lacks file size + MIME validation | CONFIRMED | Provider import read the full file before validation and API accepted rows without file metadata. | Added 5 MB client/server validation and CSV MIME/extension checks. | `apps/admin/src/app/(admin)/providers/page.tsx`, `apps/admin/src/app/api/providers/route.ts`, `apps/admin/src/lib/privacy.ts` | `apps/admin/src/lib/privacy.test.ts` | Medium abuse/stability |
| F-ADM-014 | Tickets read requires ADMIN role | DEFERRED | Current tickets route intentionally requires `ADMIN`. Moderator triage is product-policy dependent. | Deferred to product decision branch; no role relaxation here. | None | None | Medium support policy |
| F-ADM-015 | Bulk delete does not skip users with PROCESSING GDPRRequest | CONFIRMED | Bulk delete treated pending/processing as a generic existing request. | Explicitly skips `PROCESSING`, returns skipped count/reason, and audits skipped reason. | `apps/admin/src/app/api/users/route.ts` | `apps/admin/src/app/api/users/route.test.ts` | Medium GDPR safety |
| F-ADM-016 | CSV exports have no audit log row | DEFERRED | Several exports remain client-side. | Deferred to `admin-sensitive-actions-and-exports`; needs server export endpoints/audit events. | None | None | Medium privacy/audit |
| F-ADM-017 | Audit log rows include full IP | DEFERRED | Many audit writers still store raw `x-forwarded-for`. | Deferred to `admin-sensitive-actions-and-exports` or `admin-ip-minimization`; cross-cutting helper and retention policy needed. | None | None | Medium privacy |
| F-ADM-018 | Help-center articles not versioned | DEFERRED | Current help-center schema/content flow does not model article versions. | Deferred to `help-center-versioning`; schema/product scope. | None | None | Medium content governance |
| F-ADM-019 | Waitlist invite has no email validation | STALE | Current waitlist admin API exposes GET/PATCH status handling; no invite/remove/import email flow exists on this branch. | No change. | None | None | Medium if future invite flow returns |
| F-ADM-020 | Provider quality review not audit-logged | ALREADY_FIXED | `apps/admin/src/app/api/provider-governance/route.ts` writes `AdminAuditLog` for review actions. | No change. | None | Existing route behavior | Medium governance |
| F-ADM-021 | Dashboard `force-dynamic`; cache 60s | FALSE_POSITIVE | Dashboard contains live health/session/billing metrics and is explicitly dynamic. | No change without measurement. | None | None | Low performance polish |
| F-ADM-022 | Hardcoded chart colors may fail dark-mode contrast | FALSE_POSITIVE | No concrete broken chart/contrast issue found in current touched dashboard/billing surfaces. | No change; revisit with screenshots if measured. | None | None | Low polish |
| F-ADM-023 | Tag filter uses `contains: tags`; restrict input | CONFIRMED | Provider API accepted raw tag filter text. | Trimmed and length-capped tag filter. Full tag parser can follow if needed. | `apps/admin/src/app/api/providers/route.ts` | Typecheck | Low input hardening |
| F-ADM-024 | Team page SUPER_ADMIN-only behavior should be documented | ALREADY_FIXED | Team routes/pages already require `SUPER_ADMIN`. | Captured here; no code change. | None | None | Low docs |
| F-ADM-025 | `requirePasswordConfirm` window not audit-logged itself | CONFIRMED | Browser prompt was the weak UX surface; API delete/import operations already audit their actions. | Removed prompt for user/provider destructive flows; no password value is logged. | Password modal and destructive pages | `apps/admin/src/app/destructive-actions.test.ts` | Low audit hygiene |
| F-ADM-026 | Impersonate route audit log | ALREADY_FIXED | User impersonation route writes `IMPERSONATION_START` AdminAuditLog and user notification. | No change. | None | Existing behavior | Low support audit |
| F-UX-001 | Dead redirect to `/login` | CONFIRMED | Provider detail catch redirected to `/login`, but web sign-in route is `/sign-in`. | Redirects to `/sign-in?redirect=/providers/{id}` using safe encoded redirect. | `apps/web/src/app/(app)/providers/[id]/page.tsx` | `apps/web/src/lib/safe-redirect.test.ts`, `apps/web/src/lib/oauth.test.ts` | Critical private beta blocker |
| F-UX-002 | FAQ content fully hardcoded English | DEFERRED | FAQ page remains hardcoded content. | Deferred to `web-i18n-content`; broad content migration. | None | None | High i18n |
| F-UX-003 | Sign-in/Sign-up fallback errors hardcoded English | CONFIRMED | Sign-in/up had English OAuth/legal fallback strings. | Replaced high-visibility fallback strings with existing/new i18n keys. | Sign-in/up pages, en/es messages | Web typecheck | High i18n |
| F-UX-004 | PDF export only renders light theme | CONFIRMED | PDF generator is print/light-oriented. | Kept print-friendly behavior and added user-facing copy. | `apps/web/src/app/(app)/settings/export/page.tsx` | Typecheck | High expectation setting |
| F-UX-005 | Hardcoded English in onboarding | DEFERRED | Onboarding still has broad English content. | Deferred full extraction to `web-i18n-content`; fixed alert semantics/accessibility only. | `apps/web/src/app/onboarding/page.tsx` | Typecheck | Medium i18n |
| F-UX-006 | Hardcoded English in Settings, Help, Offline, NotFound | DEFERRED | Multiple broad content surfaces remain hardcoded. | Deferred to `web-i18n-content`. | None | None | Medium i18n |
| F-UX-007 | `window.alert` for legal acceptance gate | ALREADY_FIXED | Current onboarding uses inline error state rather than `window.alert`. | Strengthened inline alert with `role=alert` and semantic tokens. | `apps/web/src/app/onboarding/page.tsx` | Typecheck | Medium accessibility |
| F-UX-008 | Theme toggle / language selector labels not translated | CONFIRMED | Theme/language components used literal English labels. | Wired labels/aria labels to `next-intl` keys. | `apps/web/src/components/theme-toggle.tsx`, `apps/web/src/components/language-selector.tsx` | Typecheck | Medium i18n/accessibility |
| F-UX-009 | Service worker logout cache wipe is best-effort silent | ALREADY_FIXED | Current service worker bypasses auth APIs, avoids HTML caching, and logout clears caches via app hook. | No change. | None | Existing service-worker cache tests | Medium auth UX |
| F-UX-010 | Sign-in redirect param accepts any path under `/` | CONFIRMED | Sign-in and OAuth redirect normalization accepted any single-slash path. | Added allowlisted app redirect validator; rejects `//`, `/api`, auth paths, unsupported paths and control chars. | `apps/web/src/lib/safe-redirect.ts`, `apps/web/src/app/sign-in/page.tsx`, `apps/web/src/lib/oauth.ts` | `apps/web/src/lib/safe-redirect.test.ts`, `apps/web/src/lib/oauth.test.ts` | Medium security |
| F-UX-011 | Plain alert/error colors hardcoded | CONFIRMED | Onboarding alert used red utility colors. | Switched to semantic destructive tokens and `role=alert`. | `apps/web/src/app/onboarding/page.tsx` | Typecheck | Medium dark-mode/accessibility |
| F-UX-012 | Address validation error messages hardcoded | DEFERRED | Address/onboarding validation copy remains broad and English. | Deferred to `web-i18n-content`. | None | None | Medium i18n |
| F-UX-013 | Service-save toast errors fall back to English | DEFERRED | Service-save fallback copy requires separate service-form audit. | Deferred to `web-i18n-content`. | None | None | Medium i18n |
| F-UX-014 | Spanish messages incomplete | DEFERRED | Added only keys required by touched sign-up fallbacks. Full parity still needs a missing-key report. | Deferred to `web-i18n-content`; no machine translation sweep. | en/es messages | Web typecheck | Medium i18n |
| F-UX-015 | Hardcoded sign-in subtitle | CONFIRMED | Sign-in page used a literal subtitle. | Replaced with `auth.signIn_subtitle`. | `apps/web/src/app/sign-in/page.tsx` | Typecheck | Low i18n |
| F-UX-016 | Legal Disclaimer link label hardcoded | CONFIRMED | Sign-in/up footer labels were literal English. | Uses `legal.disclaimer_title`. | Sign-in/up pages | Typecheck | Low i18n |
| F-UX-017 | Support link label hardcoded | CONFIRMED | Sign-in/up footer labels used literal "Support". | Uses `common.contact`. | Sign-in/up pages | Typecheck | Low i18n |
| F-UX-018 | MFA code input visual styling assumes monospace | FALSE_POSITIVE | Monospace input is intentional for one-time-code readability; no Android regression verified in code. | No change; keep in manual QA. | None | None | Low mobile polish |
| F-UX-019 | Logout redirects to `/`; prefer signed-out copy | DEFERRED | Logout/auth security was handled in prior branch; adding signed-out confirmation copy is product UX scope. | Deferred; no auth flow change here. | None | None | Low UX |
| F-UX-020 | Settings export lacks `aria-describedby` for inputs | DEFERRED | Export page has broader accessibility/content issues beyond the print-friendly copy. | Deferred to web accessibility pass. | None | None | Low accessibility |

## Fixed Findings

- Admin privacy: password/hash exposure on list/detail surfaces, token row IDs, masked emails, masked Stripe IDs.
- Admin destructive actions: replaced password prompts with a modal and added state-rule type-to-confirm.
- Admin list stability: pagination clamps for common list APIs.
- Admin import safety: CSV size/MIME validation and dry-run backup import audit logging.
- GDPR delete queue: bulk delete skips `PROCESSING` requests with explicit skipped reason.
- Web auth UX: fixed `/login` dead redirect and added allowlisted redirect validation.
- Web i18n/a11y polish: translated high-visibility sign-in/up labels, theme/language labels, and onboarding alert semantics.

## Deferred Findings

- `admin-sensitive-actions-and-exports`: route-wide admin mutation rate limits, feature flag rollout confirmation, server-side export audit logs, IP minimization.
- `dr-and-alerts`: backup archive creator/admin binding and restore policy metadata.
- `admin-responsive-layout`: collapsible/responsive admin sidebar.
- `help-center-versioning`: help article versioning.
- `web-i18n-content`: FAQ, onboarding, settings/help/offline/not-found, address/service validation copy, Spanish parity report.
- Web accessibility pass: export-page ARIA refinements and mobile/MFA visual QA.

## Remaining Risks

- Some admin export flows remain client-side and unaudited.
- Full IP minimization needs a shared audit writer update and retention policy.
- Full i18n parity is intentionally deferred to avoid a broad content migration in this branch.
