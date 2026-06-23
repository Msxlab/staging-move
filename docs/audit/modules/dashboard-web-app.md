# Module Audit: Consumer Dashboard / Account (web app)

> READ-ONLY audit. Evidence cited from source only. Paths are relative to repo root
> `apps/web/...` unless noted. Items that could not be fully confirmed from code are
> marked **[needs verification]**.

## 1. Module Summary

The consumer-facing authenticated web surface under the `(app)` route group:
the dashboard, settings hub (profile, privacy/security, export, notifications,
connections, workspace, subscription, address-changes), support tickets,
notifications inbox, and the account-deletion / data-export / user-preferences
flows. Auth is custom JWT (`requireDbUserId` / `getUserSession` from
`@/lib/user-auth`). Multi-tenant data isolation is via workspace scope
(`resolveWorkspaceDataScope`), but several account-level routes (export,
account-deletion, tickets, preferences) operate on the raw `userId` only.

The module is broadly well-built: account deletion is GDPR-aware with a grace
window + restore token, step-up verification gates export/delete, IDOR checks
exist on tickets, and CSV-injection is mitigated on export. The notable problems
are **consistency** ones: two different delete UIs with divergent step-up
handling (one is broken for MFA users), OAuth-only users are blocked from data
export, and several client error paths swallow HTTP errors as "success".

## 2. Related Files

UI / pages:
- `src/app/(app)/layout.tsx`, `src/app/(app)/error.tsx`, `src/app/(app)/not-found.tsx`
- `src/app/(app)/dashboard/page.tsx`, `dashboard/dashboard-client.tsx`, `dashboard/move-command-center.tsx`, `dashboard/up-next.tsx`
- `src/app/(app)/settings/page.tsx` and `settings/{profile,privacy,export,notifications,connections,subscription,workspace,address-changes}/page.tsx`
- `src/app/(app)/support/page.tsx`, `support/[id]/page.tsx`
- `src/app/(app)/notifications/page.tsx`
- `src/app/account/delete/page.tsx` (public marketing/instructions page)
- `src/components/settings/delete-account-dialog.tsx`, `components/settings/ui-preferences-card.tsx`, `components/settings/appearance-card.tsx`

Libs:
- `src/lib/account-deletion.ts`, `src/lib/user-preferences.ts`, `src/lib/user-security-audit.ts`
- `src/lib/request-entitlements.ts`, `src/lib/user-step-up.ts`, `src/lib/workspace-data-scope.ts`
- `src/lib/auth.ts` → `src/lib/user-auth.ts` (`requireDbUserId`)

APIs:
- `src/app/api/account/delete/route.ts`, `api/account/restore/route.ts`
- `src/app/api/profile/route.ts`
- `src/app/api/export/route.ts`, `api/export/pdf/route.ts`
- `src/app/api/tickets/route.ts`, `api/tickets/[id]/route.ts`
- `src/app/api/user/preferences/route.ts`, `api/user/locale/route.ts`
- `src/app/api/help/route.ts`, `api/help/feedback/route.ts`
- `src/app/api/notifications/feed/route.ts`

## 3. Related Routes / Screens

`/dashboard`, `/settings`, `/settings/profile`, `/settings/privacy`,
`/settings/export`, `/settings/notifications`, `/settings/connections`,
`/settings/subscription`, `/settings/workspace`, `/settings/address-changes`,
`/support`, `/support/[id]`, `/notifications`, public `/account/delete`.

## 4. Related APIs

- Account: `POST /api/account/delete`, `GET /api/account/restore`
- Profile: `GET|POST /api/profile`
- Export: `POST /api/export`, `POST /api/export/pdf` (both GET → 403 step-up)
- Tickets: `GET|POST /api/tickets`, `GET|POST|PATCH /api/tickets/[id]`
- Prefs: `GET|PATCH|PUT /api/user/preferences`, `GET|POST /api/user/locale`
- Help: `GET /api/help`, `POST /api/help/feedback`
- Notifications: `GET|PATCH /api/notifications/feed`, `PATCH /api/notifications/feed/[id]`

## 5. Related Components

`AppShell` (layout), `DashboardSkeleton`/`loading-state`, dashboard widgets
(`StatsCard`, `UpcomingBills`, `BudgetDonut`, `MonthlySpark`, `MilestoneTimeline`,
`RouteMapCard`, `HomeDossier`, `MoveCommandCenter`, `MoveBriefingCard`,
`HouseholdActivationCard`, `UpNext`), `DeleteAccountDialog`, `PasswordInput`,
`UIPreferencesCard`, `AppearanceCard`, dnd-kit sortable widgets.

## 6. Related State / Hooks / Stores

Local component state (`useState`/`useEffect`) per page. `useCurrentUser`
(privacy page), `useLocale`/`useTranslations` (next-intl). Dashboard widget
prefs persisted server-side via `PUT /api/user/preferences` and hydrated in the
RSC `dashboard/page.tsx` via `loadUserPreferences`. No global store in scope.

## 7. Related Database / Models

`User`, `Profile`, `Subscription`, `Address`, `Service`, `Budget`, `MovingPlan`,
`MoveTask`, `UserCustomProvider`, `UserEvent` (legal consent / analytics),
`DataConsent`, `SupportTicket`, `TicketMessage`, `Notification`,
`NotificationPreference`, `PushDevice`, `UserSession`, `GDPRRequest`,
`WaitlistSignup`, `NotificationQueue`, `Workspace`/`WorkspaceMember`/`WorkspaceInvitation`,
`AuditLog`, `HelpArticle`.

## 8. Impact Map

- **UI**: dashboard widgets, settings hub, support modal/thread, notifications inbox.
- **API**: account/profile/export/tickets/preferences/notifications routes above.
- **DB**: cascade-heavy account deletion (`account-deletion.ts`) touching ~all user-owned tables; profile upsert; preferences JSON column.
- **Auth**: step-up (`verifyUserStepUp`) for export + delete; session destroy on delete/password change.
- **Admin**: support tickets shared with admin (internal notes filtered); GDPRRequest processed by admin + data-retention cron.
- **Mobile**: account-deletion `confirmAccountDeletion` bypass exists explicitly for Apple/Play OAuth-only in-app deletion; tickets `platform: MOBILE`.
- **Notifications**: deletion notifies inherited workspace owner; ticket-created email; account-deletion email + restore link.
- **Integrations**: Stripe subscription cancel/pause on delete/restore.
- **Analytics**: `UserEvent`/`UserSession` exported; legal-consent events read for onboarding state.
- **SEO**: `(app)` is auth-gated, non-indexed; public `/account/delete` has metadata.
- **Tests**: dashboard markup-contract + ux-experiment tests, providers/services client tests; no tests for delete/export/tickets routes found in scope.

## 9. Buttons / Actions / Functions

### Delete account — inline `/settings/page.tsx` `handleDeleteAccount`
- **Where**: main settings Danger Zone.
- **Expected**: collect DELETE + password (or OAuth-only confirm) and POST `/api/account/delete`, log out, redirect.
- **Actual**: sends only `confirmText` + (`confirmPassword` | `confirmAccountDeletion`). **Never sends `mfaCode`/`backupCode`.**
- **Loading**: yes (`deleting`). **Disabled**: yes (`confirmText !== "DELETE"` etc.). **Error**: toast, returns to confirm. **Success**: toast + redirect.
- **Permission**: server step-up. **Edge case**: for an **MFA-enabled** user the server returns `STEP_UP_REQUIRED`; this UI has **no MFA input**, so deletion is impossible from `/settings` (see DASHBOARD-WEB-APP-01).

### Delete account — `DeleteAccountDialog` (privacy page)
- Correctly conditions on `hasPasswordLogin` + `mfaEnabled`, reveals MFA field, and reacts to `STEP_UP_REQUIRED` by setting `mfaRequired`. This is the correct implementation; the inline `/settings` one duplicates and diverges from it (see DASHBOARD-WEB-APP-08).

### Data export — `/settings/export` `handleExport` / `handlePdfReport` / `handleFullAccountPdf` / `handleTaxPdf`
- **Expected**: POST `/api/export` (or `/export/pdf`) with step-up; download blob.
- **Actual**: always sends `confirmPassword: exportPassword`; **all buttons disabled when `!exportPassword`.** OAuth-only users have no password → cannot fill it → cannot export (see DASHBOARD-WEB-APP-02).
- **Loading/disabled/error/success**: all present (per-button spinner, toast on `error`).

### Profile save — `/settings/profile` `handleSave` → `POST /api/profile`
- **Expected**: validate names client-side, optionally grant SENSITIVE consent if `hasDisability`, upsert.
- **Actual**: works; **non-atomic** — server updates `User.firstName/lastName` first, then upserts `Profile`; if the profile upsert throws, the name change is already committed (see DASHBOARD-WEB-APP-06). Consent is only auto-requested for `hasDisability`, not for the other sensitive flags the server enforces (`isMilitary`, `isImmigrant`, `immigrationStatus`) — but the profile UI doesn't expose those, so it's latent.
- **Loading/disabled/error/success**: present.

### Support: create ticket / reply / close
- IDOR-guarded server-side (`ticket.userId !== userId` → 404). Rate-limited. Close adds SYSTEM message. Reply blocked on CLOSED. Good.

### Preferences toggles (`showBudget`, dashboard widget order/visibility/collapsed)
- `PATCH`/`PUT /api/user/preferences`, rate-limited, zod-validated, graceful schema-compat fallback. Persist is fire-and-forget (`.catch(()=>{})`) — silent on failure (minor).

### Notifications: mark read / mark all read
- Optimistic update then server PATCH; reverts + toast on failure. Good. Inbox only fetches first page (no "load more").

## 10. UI/UX Audit

- **Two delete entry points, different behavior** (`/settings` inline vs privacy `DeleteAccountDialog`). Inconsistent and one is broken (DASHBOARD-WEB-APP-01/08). *Priority: High.*
- **Export blocked for OAuth-only** with no explanatory copy — the password field just sits empty and every button is disabled, giving no hint why (DASHBOARD-WEB-APP-02). *Priority: High.*
- **Notifications inbox has no pagination control** — `GET /api/notifications/feed` defaults to 20 and the page never requests more, so older notifications are unreachable from the UI even though the API supports `page`/`limit` (`notifications/page.tsx` `fetchFeed`). *Priority: Medium.*
- **Profile email field** correctly disabled with "Managed by authentication provider" copy. Good.
- **Dark theme / responsive**: pages consistently use semantic tokens (`bg-card`, `text-foreground`, `border-border`, `tone-*`) and `sm:`/`md:` breakpoints; modals use `max-h-[calc(100vh-2rem)] overflow-y-auto`. No raw hex spotted in scope. Looks theme-safe. *Priority: Info.*
- **Support thread date** hard-codes `en-US` locale (`support/[id]/page.tsx` lines 134/169-170) while the list page localizes — minor i18n inconsistency. *Priority: Low.*
- **Accessibility**: support create modal has `role="dialog" aria-modal aria-labelledby`; icons mostly `aria-hidden`. The notifications inbox filter group has `role="group"`/`aria-pressed`. The settings delete `<input>` for "Type DELETE" has a `<label>` not associated via `htmlFor`/`id` (`settings/page.tsx` ~306-313). *Priority: Low.*

## 11. Logic Audit

- **Dashboard data load** (`dashboard-client.tsx` ~374-390) uses `Promise.allSettled` and tolerates rejections, BUT each fetch is `.then(r => r.json())` **without checking `r.ok`** — an HTTP 401/500 (which returns a JSON `{error}` body) resolves as `fulfilled`, so `failedApis` stays empty and the dashboard silently renders empty state instead of an error (DASHBOARD-WEB-APP-04). Same pattern in `support/page.tsx` `fetchTickets`, `support/[id]` `fetchTicket`, profile-export address prefetch.
- **Active-plan selection** correctly prefers `IN_PROGRESS` then `PLANNING`, never terminal plans — good defensive logic.
- **Account deletion** logic is robust: grace window, restore token bound to `(userId, requestId)` via HMAC + `timingSafeEqual`, `rawPrisma` used to bypass soft-delete for true erasure, FK-ordering of MovingPlan/Workspace deletes documented, residual PII scrub of `GDPRRequest`, and force-erase after N Stripe-cancel attempts so GDPR Art. 17 is never wedged. Strong.
- **State mismatch**: `dashboard/page.tsx` calls `getUserSession()` **twice** (once in `loadWidgetPrefs`, once in the page body) — redundant but harmless.

## 12. Reverse Logic Audit

- **Unauthorized user**: `(app)/layout.tsx` gate redirects to `/sign-in`; APIs throw `UNAUTHORIZED`→401. OK.
- **Account deleted mid-session**: layout catches `ACCOUNT_DELETED` → `/sign-in?error=account-unavailable`. OK.
- **API error**: client error swallowing (DASHBOARD-WEB-APP-04) means 500s show empty UI, not an error.
- **Double-click**: delete/export/ticket buttons disable on submit; preferences persist is idempotent. OK.
- **Direct route access**: IDOR on `GET /api/tickets/[id]` and PDF address export both filter by `userId` → 404 on mismatch. OK.
- **Token expiry**: gate + `apiGateErrorResponse` handle expiry centrally.
- **MFA user on `/settings` delete**: dead-ends (DASHBOARD-WEB-APP-01).
- **OAuth-only user on export**: dead-ends (DASHBOARD-WEB-APP-02).
- **Role change (workspace CHILD)**: export filters by raw `userId` (self-only), profile counts apply `childSelfOnly` — no cross-member leak observed.

## 13. Security Audit

### DASHBOARD-WEB-APP-03 — Data export filtered by raw `userId`, ignoring workspace scope (completeness, not leak)
- **Severity**: Low. **Affected area**: `POST /api/export`, `POST /api/export/pdf`.
- **Evidence**: every `findMany` in `api/export/route.ts` uses `where: { userId, deletedAt: null }`; `export/pdf` likewise. No `resolveWorkspaceDataScope`.
- **Risk**: a workspace OWNER exporting "full" gets only rows they personally created, not workspace-shared records — and a member never gets the shared workspace data. This is **more** restrictive than a leak (no cross-tenant exposure), but produces an **incomplete GDPR Art. 15 export** in workspace mode.
- **Defensive abuse scenario**: none (it under-shares). Risk is compliance/UX completeness, not exposure.
- **Prevention**: decide intended scope and apply `scopedRecordWhere` consistently (with `childSelfOnly` for CHILD) so the export matches what the user sees in-app.
- **Detection**: compare export row counts vs dashboard counts for a multi-member workspace.
- **Analysis (root cause)**: export predates / wasn't migrated to the workspace-scope helper used by `/api/profile`.
- **Recommendation**: align export scoping with `workspace-data-scope`; document intended behavior.
- **Tests to add**: export integration test for OWNER + CHILD in a shared workspace asserting expected row visibility.

### DASHBOARD-WEB-APP-02 — OAuth-only users cannot export their data (step-up unsatisfiable)
- **Severity**: Medium. **Affected area**: `POST /api/export`, `POST /api/export/pdf`, `/settings/export`.
- **Evidence**: both routes call `verifyUserStepUp({ confirmPassword, mfaCode, backupCode })` **without** the `confirmAccountDeletion` bypass. In `user-step-up.ts`, a user with `!passwordHash && !mfaEnabled` returns `STEP_UP_METHOD_UNAVAILABLE` (lines 124-130). The export UI additionally disables all buttons when `!exportPassword` (`export/page.tsx` `disabled={... || !exportPassword}`).
- **Risk**: OAuth-only (Google/Apple) consumers — explicitly a supported sign-up path — are blocked from GDPR Art. 15 data portability with the unhelpful error "Set a password or enable MFA before exporting data."
- **Defensive abuse scenario**: not an attacker scenario; it's a denial-of-legitimate-access / compliance gap.
- **Prevention**: allow an authenticated-session bypass for read-only export of one's own data (the bearer token already proves identity), or surface a clear "set a password to export" CTA instead of a dead button.
- **Detection**: audit logs `EXPORT_BLOCK` with `code: STEP_UP_METHOD_UNAVAILABLE` for users with no password.
- **Analysis (root cause)**: the delete flow got an OAuth-only carve-out; export did not.
- **Recommendation**: mirror the delete-flow carve-out (or a lighter session re-confirm) for export, and update the export UI to explain/enable the OAuth-only path.
- **Tests to add**: export route test for an OAuth-only user asserting a non-`METHOD_UNAVAILABLE` outcome (or an explicit, documented 403 with actionable copy).

### Notes (no defect, recorded as verified-good controls)
- **IDOR**: `GET/POST/PATCH /api/tickets/[id]` and `export/pdf` address path enforce `userId` ownership.
- **CSV injection**: `api/export/route.ts` `safeCsvValue` prefixes `=+-@` cells. Good.
- **Step-up**: MFA users cannot satisfy step-up with password alone (`user-step-up.ts` 51-59). Backup codes are single-use via conditional `updateMany` (race-safe). Good.
- **Restore token**: HMAC + `timingSafeEqual`, length-checked, bound to `(userId,requestId)`; min secret length enforced. Good.
- **PII in export**: account numbers/phone/username masked, email partially masked, encrypted `notes` require explicit `includeNotes`. Addresses (street/zip) are exported in clear, which is correct for the user's own GDPR export.
- **Rate limiting**: present on delete, export, tickets, preferences, locale, help feedback.
- **PII logging**: deletion logs use `requestId/userId`, not plaintext email, in the error paths reviewed.

## 14. Performance Audit

- Dashboard fires 4 parallel fetches up front (good) plus follow-up move-task/state-rule fetches; no obvious N+1 in client. `/api/profile` runs 7 parallel queries via `Promise.all` (acceptable).
- **No `r.ok` short-circuit** means failed responses still parse JSON — negligible cost but masks errors (see DASHBOARD-WEB-APP-04).
- Export `full` pulls many tables sequentially in `if` blocks (not parallelized) and caps analytics to 500 sessions / 1000 events — bounded, acceptable.
- Notifications inbox loads 20 rows; fine.
- Dashboard widget DnD uses dnd-kit; persistence debounced only implicitly (one PATCH per drag end). Acceptable.
- *Priority: Info.*

## 15. Reliability Audit

- **Error boundary**: `(app)/error.tsx` present (generic retry). Good.
- **Client error swallowing**: DASHBOARD-WEB-APP-04 — HTTP errors treated as empty success on dashboard/support/profile-export prefetch reduces observability and shows misleading empty states. *Medium.*
- **Partial-failure on profile save**: name persisted even if profile upsert fails (DASHBOARD-WEB-APP-06). *Medium.*
- **Account deletion** has retry/idempotency, grace window, force-erase, and best-effort notifications that never block erasure. Strong.
- **Preferences** degrade gracefully when DB columns are missing (`db-schema-compat`).
- **Monitoring**: security events + audit logs emitted on delete/export. Notifications/preferences persist failures are silent.

## 16. Dead Code / Cleanup

- `src/lib/user-security-audit.ts` exports `recordUserSecurityAudit`; **[needs verification]** whether any in-scope route still calls it (none of the audited routes do — they call `createAuditLog` directly). Confirm callers before removing.
- The inline delete flow in `/settings/page.tsx` duplicates `DeleteAccountDialog`; consolidating would remove duplicate, divergent logic (DASHBOARD-WEB-APP-08).
- No clearly-abandoned pages found in scope.

## 17. Tests

- **Existing**: `dashboard/dashboard-markup-contract.test.ts`, `dashboard/dashboard-ux-experiment.test.ts`, `dashboard/move-command-center.test.tsx`, providers/services client tests, address-format test. No route-level tests for delete/export/tickets/preferences found in scope.
- **Missing / suggested**:
  - Unit: `verifyUserStepUp` matrix (password-only vs MFA vs OAuth-only) for export *and* delete.
  - Integration: `/api/account/delete` MFA path returns `STEP_UP_REQUIRED` and the UI surfaces an MFA field (guards DASHBOARD-WEB-APP-01).
  - Integration: `/api/export` for OAuth-only user (guards DASHBOARD-WEB-APP-02).
  - Integration: ticket IDOR (other user's ticket → 404).
  - Integration: profile save atomicity (profile failure must not leave name changed) (DASHBOARD-WEB-APP-06).
  - E2E: delete from `/settings` vs `/settings/privacy` produce identical outcomes.

## 18. Findings Summary

| ID | Severity | Category | Finding | Impact | Recommendation | Files |
|----|----------|----------|---------|--------|----------------|-------|
| DASHBOARD-WEB-APP-01 | High | Logic | Inline `/settings` delete never sends MFA code; MFA users get `STEP_UP_REQUIRED` and a dead-end | MFA users cannot delete account from main settings | Collect MFA in the inline flow or route it through `DeleteAccountDialog` | `settings/page.tsx`, `api/account/delete/route.ts`, `lib/user-step-up.ts` |
| DASHBOARD-WEB-APP-02 | Medium | Security | OAuth-only users cannot export data (step-up `METHOD_UNAVAILABLE`; export UI disabled w/o password) | GDPR Art. 15 portability blocked for Google/Apple users | Add authenticated-session export path or clear CTA; mirror delete-flow carve-out | `api/export/route.ts`, `api/export/pdf/route.ts`, `settings/export/page.tsx`, `lib/user-step-up.ts` |
| DASHBOARD-WEB-APP-04 | Medium | Reliability | Client fetches use `.then(r=>r.json())` without `r.ok`; HTTP errors render as empty success | Misleading empty states; masked 401/500; no error toast | Check `res.ok` before parse; show error state | `dashboard/dashboard-client.tsx`, `support/page.tsx`, `support/[id]/page.tsx`, `settings/export/page.tsx` |
| DASHBOARD-WEB-APP-06 | Medium | Data | Profile POST updates `User` name then upserts `Profile` non-atomically | Name persists even if profile save fails (partial write) | Wrap both in a `prisma.$transaction` | `api/profile/route.ts` |
| DASHBOARD-WEB-APP-08 | Medium | Architecture | Two divergent account-delete UIs (inline vs dialog) | Duplicate logic; one is broken (Finding 01) | Consolidate on `DeleteAccountDialog` | `settings/page.tsx`, `components/settings/delete-account-dialog.tsx` |
| DASHBOARD-WEB-APP-03 | Low | Data | Export filters by raw `userId`, ignoring workspace scope | Incomplete export in workspace mode (no leak) | Apply `workspace-data-scope` consistently | `api/export/route.ts`, `api/export/pdf/route.ts` |
| DASHBOARD-WEB-APP-05 | Medium | UI/UX | Notifications inbox never paginates (only first 20 reachable) | Older notifications unreachable from UI | Add load-more/pagination using existing API params | `notifications/page.tsx`, `api/notifications/feed/route.ts` |
| DASHBOARD-WEB-APP-07 | Low | UI/UX | Support detail dates hard-coded `en-US`; settings delete `<label>` not linked to input | Minor i18n + a11y gaps | Localize dates; add `htmlFor`/`id` | `support/[id]/page.tsx`, `settings/page.tsx` |
| DASHBOARD-WEB-APP-09 | Low | Reliability | Preferences/widget persistence is fire-and-forget (`.catch(()=>{})`) | Silent loss of saved layout/toggle on failure | Surface a subtle failure toast / retry | `dashboard/dashboard-client.tsx`, `api/user/preferences/route.ts` |
| DASHBOARD-WEB-APP-10 | Info | Dead Code | `recordUserSecurityAudit` may be unused by in-scope routes | Cleanup opportunity | Confirm callers app-wide, then remove if unused | `lib/user-security-audit.ts` |

## 19. Module TODO

- [ ] **(High)** Fix MFA delete on `/settings`. Reason: MFA users cannot delete from main settings (DASHBOARD-WEB-APP-01). Files: `settings/page.tsx`. Fix: reuse `DeleteAccountDialog` (which already handles `STEP_UP_REQUIRED`→MFA). Dependencies: none. Complexity: low. Risk: low.
- [ ] **(Medium)** Enable export for OAuth-only users. Reason: portability blocked (DASHBOARD-WEB-APP-02). Files: `api/export/route.ts`, `api/export/pdf/route.ts`, `settings/export/page.tsx`, `lib/user-step-up.ts`. Fix: add a documented session-based bypass for own-data export or actionable UI. Dependencies: security review of bypass. Complexity: med. Risk: med (security-sensitive).
- [ ] **(Medium)** Check `res.ok` before `json()` across dashboard/support/export prefetch. Reason: masked errors (DASHBOARD-WEB-APP-04). Files: per table. Fix: reject non-ok, show error state. Dependencies: none. Complexity: low. Risk: low.
- [ ] **(Medium)** Make profile save atomic. Reason: partial write (DASHBOARD-WEB-APP-06). Files: `api/profile/route.ts`. Fix: `prisma.$transaction([userUpdate, profileUpsert])`. Dependencies: none. Complexity: low. Risk: low.
- [ ] **(Medium)** Consolidate delete UIs. Reason: duplicate/divergent (DASHBOARD-WEB-APP-08). Files: `settings/page.tsx`. Fix: drop inline flow, mount `DeleteAccountDialog`. Dependencies: Finding 01. Complexity: low. Risk: low.
- [ ] **(Medium)** Add notifications pagination. Reason: older items unreachable (DASHBOARD-WEB-APP-05). Files: `notifications/page.tsx`. Fix: load-more using `page`/`limit`. Dependencies: none. Complexity: low. Risk: low.
- [ ] **(Low)** Align export scope with workspace-data-scope. Reason: incomplete export (DASHBOARD-WEB-APP-03). Files: `api/export/route.ts`, `api/export/pdf/route.ts`. Complexity: med. Risk: med (data-shape change).
- [ ] **(Low)** Localize support dates; link delete label. (DASHBOARD-WEB-APP-07). Files: `support/[id]/page.tsx`, `settings/page.tsx`. Complexity: low. Risk: low.
- [ ] **(Low)** Surface preference-persist failures. (DASHBOARD-WEB-APP-09). Files: `dashboard/dashboard-client.tsx`. Complexity: low. Risk: low.
- [ ] **(Info)** Verify/remove `recordUserSecurityAudit` if unused. (DASHBOARD-WEB-APP-10). Files: `lib/user-security-audit.ts`. Complexity: low. Risk: low.
