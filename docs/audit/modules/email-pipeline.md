# Module Audit: Email Pipeline

> READ-ONLY audit. Evidence = source code only. Paths are relative to repo root
> `staging-move/`. Line numbers cited where practical.

## 1. Module Summary

The Email Pipeline is the single outbound-mail subsystem for the web app. It has
three layers:

1. **Transport** (`apps/web/src/lib/email.ts`) — wraps the Resend SDK, resolves
   config from runtime config, enforces the `KILL_OUTBOUND_EMAIL` operator kill
   switch, redacts secrets from error strings, builds the branded HTML shell
   (`renderLocateFlowEmail`), and exposes per-type content builders
   (verification, password reset, subscription, payment-failed, reminders,
   digests, security notices).
2. **Orchestration** (`apps/web/src/lib/email-service.ts`, ~1934 lines) — logs
   every send to `EmailLog`, supports dedupe keys, renders DB-backed
   `EmailTemplate` rows with `{{var}}` substitution, gates marketing/reminder
   sends on `NotificationPreference` opt-outs, and appends RFC 8058 unsubscribe
   footers/headers. ~25 `sendXxxEmail` functions live here.
3. **Inbound + compliance** — the Resend bounce/complaint webhook
   (`apps/web/src/app/api/webhooks/resend/route.ts` + `lib/resend-webhook.ts`),
   the unsubscribe token + actions (`lib/unsubscribe.ts`,
   `lib/unsubscribe-actions.ts`), the unsubscribe API
   (`app/api/unsubscribe/route.ts`) and page (`app/unsubscribe/page.tsx`), and
   the admin-authored template sanitizer (`packages/shared/src/email-html-sanitizer.ts`).

Overall the module is unusually well-built for security: Svix signature
verification with timestamp tolerance, HMAC unsubscribe tokens with
`timingSafeEqual`, GET-never-mutates unsubscribe confirm flow, defense-in-depth
HTML sanitization on both write and render, secret redaction in logs, and a
kill switch. Findings are mostly Medium/Low refinements rather than gaping holes.

## 2. Related Files

- `apps/web/src/lib/email.ts` — transport + content builders + HTML shell.
- `apps/web/src/lib/email-service.ts` — logging, templating, opt-out gating, senders.
- `apps/web/src/lib/resend-webhook.ts` — Svix signature verify + recipient extract.
- `apps/web/src/lib/unsubscribe.ts` — HMAC token sign/verify, kind mapping, URL build.
- `apps/web/src/lib/unsubscribe-actions.ts` — `processUnsubscribe`, opt-out reads.
- `apps/web/src/lib/billing-email-utils.ts` — date/plan formatting, `fireAndLogEmail`.
- `apps/web/src/lib/admin-digest-config.ts` — operator config for admin digest.
- `packages/shared/src/email-html-sanitizer.ts` — shared sanitizer (rendered + admin).
- `apps/admin/src/lib/email-template-sanitizer.ts` — duplicate sanitizer in admin app.
- `apps/web/src/app/api/webhooks/resend/route.ts` — bounce/complaint webhook.
- `apps/web/src/app/api/unsubscribe/route.ts` — POST one-click + confirm, GET status.
- `apps/web/src/app/unsubscribe/page.tsx` — public confirm + done landing.
- `apps/admin/src/app/api/email-templates/route.ts` — admin template CRUD (sanitize-on-write).
- `apps/admin/src/app/(admin)/email-templates/email-templates-client.tsx` — admin UI + iframe preview.
- `apps/web/src/lib/kill-switches.ts` — `isOutboundEmailKilled`.
- `packages/db/prisma/schema.prisma` — `EmailTemplate` (1539), `EmailLog` (1564), `NotificationPreference` (1459).

## 3. Related Routes / Screens

- `GET/POST /api/unsubscribe` — one-click + confirm-form unsubscribe.
- `GET /unsubscribe` — public confirm/done page (no auth, token-gated).
- `POST /api/webhooks/resend` — Resend bounce/complaint ingestion.
- Admin `(admin)/email-templates` — template management + preview (admin RBAC + step-up).
- Cron routes that fan out emails (callers): `api/cron/{bill-reminders,bill-overdue,contract-reminders,task-reminders,daily-digest,weekly-digest,move-reminders,trial-check,monthly-report,lifecycle-nudges,...}` — out of deep scope but they drive volume.

## 4. Related APIs

- `/api/unsubscribe` (POST/GET) — see above.
- `/api/webhooks/resend` (POST) — see above.
- `/api/email-templates` (admin GET/POST/PUT/DELETE) — template CRUD; step-up + MFA gated.
- Senders are invoked server-side by auth routes (register, password reset, MFA,
  OAuth link), Stripe/IAP webhooks, workspace mutations, support tickets, and crons.

## 5. Related Components

- `apps/admin/.../email-templates-client.tsx` — admin template editor; renders the
  stored `body` into an `<iframe srcDoc={preview.body}>` (line 169). Subject and
  log fields render as React text (auto-escaped).
- `app/unsubscribe/page.tsx` — server component, `Shell` + lucide icons. No client JS.
- Email HTML is not a React component tree; it is string-built in `email.ts`.

## 6. Related State / Hooks / Stores

- No client store. Server-only. State is persisted in `EmailLog`,
  `NotificationPreference`, `EmailTemplate`, and `AuditLog`.
- In-process singletons: `_resend`/`_resendApiKey` cache in `email.ts` (rebuilt on key change).

## 7. Related Database / Models

- `EmailTemplate` (schema 1539): `slug` unique, `subject` VarChar(200), `body` LongText,
  `category`, `isActive`, `isDefault`. Sanitized on write by admin route.
- `EmailLog` (schema 1564): `dedupeKey` unique VarChar(191), `providerMessageId`,
  `to` VarChar(191), `subject` VarChar(200), `status` (PENDING/SENT/FAILED/BOUNCED/SKIPPED),
  `error` Text, `metadata` Text(JSON). Note: `status` is free-form varchar; the code
  writes `SKIPPED` (kill switch) which is documented but not in the schema comment enum list.
- `NotificationPreference` (schema 1459): `(userId, channel, type)` unique; opt-out rows.
- `AuditLog`: `EMAIL_UNSUBSCRIBE` action written by `processUnsubscribe`.

## 8. Impact Map

- **UI**: unsubscribe page (light/dark via tokens); admin template editor + iframe preview.
- **API**: `/api/unsubscribe`, `/api/webhooks/resend`, admin `/api/email-templates`.
- **DB**: `EmailLog`, `EmailTemplate`, `NotificationPreference`, `AuditLog`.
- **Auth**: password reset / verification / MFA / OAuth-link / deletion emails carry
  auth-critical links; security-class emails are never opt-out-able.
- **Admin**: template CRUD (step-up + MFA), email-health metrics from `EmailLog`.
- **Mobile**: IAP billing emails reuse the same senders (billing-email-utils `fireAndLogEmail`).
- **Notifications**: opt-out shares `NotificationPreference` with in-app notifications.
- **Integrations**: Resend (send + webhook), Stripe/Apple/Google (trigger billing emails).
- **Analytics**: `EmailLog` status counts feed admin email-health; bounce metric depends
  on the webhook writing `BOUNCED`.
- **SEO**: `/unsubscribe` is `force-dynamic`, not indexed; N/A otherwise.
- **Tests**: dedicated tests exist for sanitizer, webhook, unsubscribe, email, email-service.

## 9. Buttons / Actions / Functions

For each user-facing action / key function:

### "Confirm unsubscribe" button (`app/unsubscribe/page.tsx:103`)
- **Where**: public confirm step.
- **Expected**: POST `t`,`k`,`redirect=1` to `/api/unsubscribe`; opt out; 303 to `?done=1`.
- **Actual**: matches. GET never mutates (doc + code confirm).
- **Loading state**: none (native form submit, full-page nav). Acceptable but no
  disabled/spinner; double-submit is harmless because `processUnsubscribe` is idempotent.
- **Disabled state**: N/A.
- **Error state**: API returns 400 "Invalid or expired unsubscribe link" / 404
  "Account not found" as plain text — the user lands on a raw error page, not the styled Shell (UI-01).
- **Success feedback**: styled "You're unsubscribed" done view. Good.
- **Permission check**: none required by design — HMAC token is the consent proof.
- **Edge cases**: kind param echoed into redirect; soft-deleted user → 404.

### One-click unsubscribe (RFC 8058, `/api/unsubscribe` POST)
- **Expected**: mail client POSTs `List-Unsubscribe=One-Click`; opt out all/kind; 200 "Unsubscribed".
- **Actual**: matches. Rate-limited 60/60s per key. Token verified via HMAC.
- **Edge case**: `wantsRedirect` suppressed for one-click; plain-text contract preserved.

### `sendEmailWithResult` (`email.ts:169`)
- **Expected**: kill-switch → config validate → body validate → Resend send → result.
- **Actual**: matches. Returns structured result; never throws to caller.
- **Error state**: errors redacted (`safeEmailError`) and capped at 500 chars.
- **Edge case**: no API key in non-prod → logs `[EMAIL-DEV]` and returns success=true (no send).

### `sendLoggedEmail` (`email-service.ts:192`)
- **Expected**: create PENDING `EmailLog`, send, update to SENT/FAILED/SKIPPED.
- **Actual**: matches; dedupeKey unique-constraint path re-claims FAILED/SKIPPED rows atomically.
- **Edge case**: log-update failure is swallowed (logged) — a sent email can have a stale
  PENDING row if the post-send update throws (REL-01).

### `processUnsubscribe` (`unsubscribe-actions.ts:18`)
- **Expected**: upsert opt-out prefs per type, write audit. Idempotent.
- **Actual**: matches; audit failure swallowed by design.

### Resend webhook `POST` (`webhooks/resend/route.ts:33`)
- **Expected**: size cap → secret present → verify sig → parse → suppress on bounce/complaint.
- **Actual**: matches. Emits `WEBHOOK_SIG_FAILURE` security event on bad sig (401).
- **Edge case**: no idempotency store (SEC-04); `BOUNCED` write is best-effort.

## 10. UI/UX Audit

- **UI-01 (Low)** — Unsubscribe API error responses are raw `text/plain` ("Invalid or
  expired unsubscribe link", "Account not found"), so a user who clicks a stale link and
  submits the confirm form sees an unstyled browser page instead of the branded `Shell`
  with a "manage preferences" path. Evidence: `app/api/unsubscribe/route.ts:66,76`.
  Recommendation: on the confirm-form path (`redirect=1`), 303 back to `/unsubscribe`
  with an error flag and render the styled invalid/not-found states the page already has.
- **UI-02 (Info)** — Unsubscribe page exposes the full `user.email` on file to anyone
  holding the token (`page.tsx:97,140`). This is intended (token = control of mailbox)
  but means a leaked/forwarded link discloses the address. Acceptable; note for awareness.
- **Theme**: page uses semantic tokens (`bg-background`, `text-foreground`, `bg-card/85`),
  so light/dark both work. Email HTML has explicit manual dark-mode CSS
  (`email.ts:428-446`) plus `[data-ogsc]` for Outlook — solid.
- **Responsive**: email shell is a 600px max-width table layout (mobile-safe); page is
  `max-w-md` centered. Fine.
- **Accessibility**: email logo has `alt="LocateFlow"`; icons in page use `aria-hidden`;
  preheader hidden text present. The confirm form button is a real `<button type=submit>`.
  Good. Minor: error plain-text pages have no landmark/heading (tied to UI-01).

## 11. Logic Audit

- **Expected flow**: caller → opt-out gate (marketing/reminder) → resolve template or
  inline content → append unsubscribe footer → `sendLoggedEmail` → `sendEmailWithResult`.
- **Opt-out gating** is consistent: each reminder/marketing sender calls
  `isEmailTypeOptedOut` and the unsubscribe kind mapping folds `LIFECYCLE` into both
  `reminder` and `all` (`unsubscribe.ts:96-100`) — correct CAN-SPAM behavior.
- **LOG-01 (Medium) — opt-out gate is bypassed for security-class kinds, but
  `weekly-digest`/`monthly-report` are gated on `MARKETING` while their unsubscribe link
  is built with kind `marketing`** — consistent. However `daily-digest` and reminder
  senders gate on `REMINDER` but the one-click `List-Unsubscribe` they emit also targets
  `reminder` — also consistent. No mismatch found here; flow is coherent. (Resolved on review.)
- **LOG-02 (Medium) — `renderTemplate` subject substitution is NOT HTML-escaped**
  (`email-service.ts:380`: `subject = subject.replace(pattern, value)` uses raw `value`,
  while the body uses `escaped`). Subjects are plain text in mail clients so this is not
  an email-XSS vector, and the admin panel renders the subject as React text (escaped).
  The residual risk is header/structure injection: `sanitizeEmailSubject` (run after, at
  `email-service.ts:390`) strips CR/LF and control chars, which closes header injection.
  Net: low real risk but the asymmetry (raw value in subject vs escaped in body) is a
  latent footgun if a future caller renders the subject as HTML. Recommend escaping the
  subject substitution too, or documenting why it is raw.
- **Race conditions**: dedupe re-claim uses `updateMany ... where status IN (FAILED,
  SKIPPED)` returning `count` — an atomic claim that prevents two concurrent retries from
  both sending. Good. The initial create→send→update is not transactional, so a crash
  between send and update leaves a PENDING row for a delivered email (see REL-01).
- **Stale cache**: `_resend` SDK client is cached by API key and rebuilt on change — safe.
- **`htmlToPlainText`** strips script/style and linkifies anchors; adequate for the text part.

## 12. Reverse Logic Audit

- **Unauthorized user**: unsubscribe + webhook intentionally need no session; both are
  gated by HMAC token / Svix signature respectively. Admin template CRUD requires
  ADMIN role + password + MFA step-up (`email-templates/route.ts:181,221,275,339`).
- **Empty data**: `sendDailyDigestEmail` filters empty sections and returns false if none
  (`email-service.ts:1848-1849`) — no empty digests. `detailTable` hides empty rows.
- **API error**: Resend errors are caught, redacted, logged FAILED, and surfaced as a
  retryable `EmailLog` row. Webhook returns 503 if secret missing (fail-closed), 401 on
  bad signature, 400 on bad JSON, 413 on oversize.
- **Slow network / double-click**: native form submit; idempotent opt-out; dedupeKey
  guards re-sends.
- **Stale data**: a stale unsubscribe token stays valid until the secret rotates (by
  design — rotation is the revocation story, `unsubscribe.ts:5-8`). A user who
  re-subscribes via settings can be re-opted-out by an old link (acceptable, expected).
- **Direct route access**: GET `/api/unsubscribe` only returns `{valid}` JSON, never
  mutates. GET `/unsubscribe` confirm step never mutates. Good link-scanner safety.
- **Mobile viewport / dark theme**: covered (section 10).
- **Role change / token expiry**: unsubscribe tokens never expire (no exp claim) —
  see SEC-02. Resend webhook rejects events older than 300s (`resend-webhook.ts:22,50`).

## 13. Security Audit

### SEC-01 (Medium) — Unsubscribe token has no expiry and no `kind` binding; one leaked link is a permanent cross-category opt-out primitive
- **Severity**: Medium
- **Affected Area**: `lib/unsubscribe.ts` (sign/verify), `/api/unsubscribe`, `/unsubscribe`.
- **Evidence**: `signUnsubscribeToken` = `${userId}.${HMAC(userId)}` with no timestamp /
  expiry (`unsubscribe.ts:40-45`); `verifyUnsubscribeToken` only checks the HMAC
  (`unsubscribe.ts:47-67`). The token is bound to `userId` only — kind comes from the
  URL `k` param and is attacker-mutable, and `parseUnsubscribeKind` defaults unknown to
  `all` (`unsubscribe.ts:79-82`). Tokens are reused across all future emails by design
  (`email-service.ts:154-176`).
- **Risk**: anyone who obtains a user's unsubscribe link (forwarded email, proxy log,
  referer leak, shared screenshot) can POST it with `k` omitted to opt the user out of
  ALL marketing + reminder + lifecycle email permanently — including bill/contract/move
  reminders the user may rely on. Because the token never expires, the capability is
  durable until the global secret is rotated (which would break every user's link).
- **Defensive Abuse Scenario (high-level)**: an adversary harvesting one-click
  `List-Unsubscribe` URLs from a forwarded newsletter replays them with a widened `k`
  to suppress reminder-class mail for targeted users, causing missed bill/move reminders.
- **Prevention**: include an issued-at/expiry in the signed payload (e.g.
  `userId.exp.sig`) and reject expired tokens; optionally bind `kind` into the signature
  so the category can't be widened from the URL.
- **Detection**: `AuditLog` records `EMAIL_UNSUBSCRIBE` with source; alert on a single IP
  unsubscribing many distinct users, or on `all` opt-outs from non-`one_click` sources.
- **Analysis (root cause)**: deliberate design trade (no DB lookup, simple revocation),
  but it sacrifices expiry and kind integrity. Reasonable for marketing but the same
  token also silences reminder-class mail.
- **Recommendation**: add token expiry; consider per-kind signing or at least clamp the
  URL `k` so it can only NARROW, never widen, the signed scope.
- **Tests To Add**: token-expiry boundary; widened-`k` cannot exceed signed scope;
  tampered userId/sig rejected (last two already covered by `unsubscribe.test.ts`).

### SEC-02 (Medium) — Unsubscribe token secret silently falls back to `USER_JWT_SECRET`
- **Severity**: Medium
- **Affected Area**: `lib/unsubscribe.ts:19-25` (`getSecret`).
- **Evidence**: if `EMAIL_UNSUBSCRIBE_SECRET` is unset/<32 chars it uses `USER_JWT_SECRET`.
  `.env.example:200` ships `EMAIL_UNSUBSCRIBE_SECRET=""` (empty), so default deployments
  reuse the JWT signing secret for unsubscribe HMACs.
- **Risk**: secret reuse couples two trust domains. Any future bug that leaks or
  log-exposes the unsubscribe HMAC material, or a weak/rotated unsubscribe secret, now
  touches the session-JWT secret. Conversely, rotating the JWT secret (e.g. after an auth
  incident) silently invalidates every outstanding unsubscribe link.
- **Defensive Abuse Scenario (high-level)**: cross-purpose key reuse — a weakness or
  oracle in one subsystem becomes leverage against the other.
- **Prevention**: require a dedicated `EMAIL_UNSUBSCRIBE_SECRET` in production; fail
  closed (or warn loudly) if only the JWT secret is available in a production-like runtime.
- **Detection**: production-readiness check asserting `EMAIL_UNSUBSCRIBE_SECRET` is set
  and distinct from `USER_JWT_SECRET`.
- **Analysis (root cause)**: dev-convenience fallback leaking into prod via empty default.
- **Recommendation**: keep the fallback for dev only; gate it on a non-production runtime.
- **Tests To Add**: assert fallback is refused in production-like env.

### SEC-03 (Low/Medium) — Resend webhook secret and `EMAIL_REPLY_TO` are undocumented in `.env.example`
- **Severity**: Low (config/availability, defensive)
- **Affected Area**: `webhooks/resend/route.ts:39`, `email.ts:104`, root `.env.example`.
- **Evidence**: `RESEND_WEBHOOK_SECRET` is read but absent from `.env.example`; the route
  returns 503 and logs an error if unset (fail-closed). `EMAIL_REPLY_TO` is referenced in
  `resolveEmailConfig` (`email.ts:104,128`) but not in `.env.example`.
- **Risk**: an operator who never sets `RESEND_WEBHOOK_SECRET` gets a permanently
  non-functional bounce/complaint pipeline — bounces never suppress, hard-bounce
  addresses keep getting mailed (deliverability + CAN-SPAM exposure), and the admin
  "bounced" metric stays 0. Because it is undocumented, the failure is silent.
- **Defensive Abuse Scenario (high-level)**: N/A (operational); the risk is degraded
  suppression hygiene, not direct attack.
- **Prevention / Recommendation**: add `RESEND_WEBHOOK_SECRET` and `EMAIL_REPLY_TO` to
  `.env.example` and to the env-catalog / production-readiness checks.
- **Detection**: synthetic-monitor or readiness check that asserts the webhook secret is
  configured in production.
- **Tests To Add**: env-catalog completeness test covering these keys.

### SEC-04 (Low) — Resend webhook has no idempotency/replay store (relies on 5-minute timestamp tolerance only)
- **Severity**: Low
- **Affected Area**: `webhooks/resend/route.ts`, `resend-webhook.ts`.
- **Evidence**: unlike the Stripe/Apple/Google webhooks (which use
  `ProcessedWebhookEvent`), the Resend route does not record `svix-id` to dedupe replays.
  Replay protection is solely the `TIMESTAMP_TOLERANCE_SECONDS = 300` window
  (`resend-webhook.ts:22,49-52`).
- **Risk**: a captured, validly-signed bounce/complaint event can be replayed within 5
  minutes. The underlying op (`processUnsubscribe`) is idempotent, so the practical impact
  is limited to duplicate `AuditLog`/`updateMany` writes and a possible repeated `BOUNCED`
  overwrite — low.
- **Defensive Abuse Scenario (high-level)**: within-window replay to generate audit noise
  or repeatedly re-mark a row BOUNCED.
- **Prevention / Recommendation**: persist `svix-id` (already captured as `correlationId`)
  to `ProcessedWebhookEvent` and short-circuit duplicates, matching the other webhooks.
- **Detection**: count of webhook events with duplicate `svix-id`.
- **Tests To Add**: replay of the same signed body within tolerance is a no-op.

### SEC-05 (Low) — Hand-rolled email HTML sanitizer is a non-DOM tokenizer; defense-in-depth only
- **Severity**: Low (mitigated)
- **Affected Area**: `packages/shared/src/email-html-sanitizer.ts` (and the duplicate in
  `apps/admin/src/lib/email-template-sanitizer.ts`).
- **Evidence**: the sanitizer is a custom streaming tokenizer; its own header comment
  admits it "does NOT cover every edge case that a real DOM-based sanitizer would (e.g.
  crafted CDATA sections, pathological mismatched tags)" (lines 29-33). It is applied at
  write (`email-templates/route.ts:240-241,311-312`) AND at render
  (`email-service.ts:390-391`), and template variable values are HTML-escaped before
  substitution (`email-service.ts:378-381`).
- **Risk**: the only untrusted-author surface is the admin template body, which is rendered
  into an `<iframe srcDoc>` in the admin preview (`email-templates-client.tsx:169`). A
  sanitizer bypass would be stored-XSS against the OPERATOR's browser. The input is gated
  by ADMIN role + password + MFA step-up + audit, and end-user variable values are escaped,
  so the realistic blast radius is small. Still, a bespoke sanitizer is harder to trust than
  a vetted library.
- **Defensive Abuse Scenario (high-level)**: a malicious or compromised admin crafts a
  body that survives tokenization (e.g. via mismatched-tag / CDATA edge cases) to run
  script in another operator's preview iframe.
- **Prevention / Recommendation**: sandbox the preview iframe (`sandbox` attribute without
  `allow-scripts`), and/or replace the tokenizer with a maintained sanitizer
  (DOMPurify/sanitize-html) shared between web and admin. De-duplicate the two copies.
- **Detection**: CSP report-only on the admin preview origin.
- **Tests To Add**: bypass corpus (mismatched tags, CDATA, `<svg>` self-close, mXSS
  vectors) asserting no executable output. Some coverage exists in the sanitizer tests.

### SEC-06 (Info) — Recipient suppression keyed on webhook-supplied `to`, fully trust-gated by Svix signature
- **Severity**: Info
- **Affected Area**: `webhooks/resend/route.ts:88-105`, `resend-webhook.ts:104-111`.
- **Evidence**: `extractRecipientEmail` reads `event.data.email`/`to` and the route
  suppresses that user. There is no secondary check that the address was one we actually
  sent to, but the entire payload is gated by Svix HMAC verification, so the trust boundary
  is Resend's signing key.
- **Risk**: only a holder of `RESEND_WEBHOOK_SECRET` (i.e. Resend) can craft a suppression.
  No user-facing abuse path. Documented for completeness.
- **Recommendation**: optionally cross-check the recipient against a recent `EmailLog`
  before suppressing, to reduce blast radius if the webhook secret is ever leaked.

### Positive security observations (no finding)
- Svix signature verification with `timingSafeEqual`, multi-key rotation support, base64
  key decode, and timestamp tolerance (`resend-webhook.ts`).
- Secret redaction in all email error strings (`email.ts:148-167`) including a generic
  32+ char token scrub.
- GET-never-mutates unsubscribe design defeats link-scanner auto-opt-out.
- Body size cap + `content-length` precheck on the webhook (`route.ts:31-47`).
- `KILL_OUTBOUND_EMAIL` kill switch checked before config resolution.
- `buildEmailMetadata` allowlists metadata keys and drops any key matching
  `password|token|otp|secret|jwt|cookie` (`email-service.ts:68,122-132`) — PII/secret
  logging hardening. `EmailLog.to` stores the raw address (necessary), admin panel masks it.

## 14. Performance Audit

- **PERF-01 (Low)** — Each marketing/reminder send does up to several sequential awaits:
  opt-out lookup, `resolveAppUrl` (runtime-config read), `renderTemplate` (DB
  `findUnique` + possibly a localized lookup), then `sendLoggedEmail` (create + update).
  For high-volume crons this is N round-trips per recipient with no batching/caching of
  `resolveAppUrl`/template rows across a run. Evidence: e.g. `sendBillReminderEmail`
  (`email-service.ts:885,888,913,930,935`). Recommendation: cache app URL and active
  template rows per cron invocation.
- **PERF-02 (Info)** — `resolveLocalizedSlug` adds an extra `emailTemplate.findUnique`
  for every non-English send (`email-service.ts:355`). Minor; English path is unaffected.
- No N+1 in a single send; the Resend client is reused. No client bundle impact (server-only).
- Webhook hashes at most 16KB (capped), so signature verification cost is bounded.

## 15. Reliability Audit

- **REL-01 (Medium)** — Non-transactional send→log-update: in `sendLoggedEmail` the
  post-send `emailLog.update` is wrapped in try/catch that only logs on failure
  (`email-service.ts:280-296`). If the process dies or the update throws after Resend
  accepted the message, the row stays `PENDING` forever while the email was delivered. The
  dedupe re-claim only re-claims `FAILED`/`SKIPPED`, not `PENDING`, so a stuck PENDING is
  never retried (good — avoids double-send) but is also never reconciled to SENT, skewing
  email-health metrics and `providerMessageId` linkage (so a later bounce can't match it).
  Recommendation: a reconciliation cron that ages out stale PENDING rows, or store the
  provider id before marking, and surface PENDING-age in admin health.
- **REL-02 (Low)** — `BOUNCED` status write is best-effort and only matches by
  `providerMessageId` (`webhooks/resend/route.ts:112-121`). If the send row never got its
  `providerMessageId` persisted (see REL-01) or the send used the dev no-key path, the
  bounce metric silently misses. Acceptable but worth noting.
- **Partial failure**: billing/IAP callers use `fireAndLogEmail` (fire-and-forget,
  swallow + optional Sentry warn) so an email failure never breaks the webhook/mutation
  (`billing-email-utils.ts:33-44`). Good isolation.
- **Monitoring/logging**: `WEBHOOK_SIG_FAILURE` security event on bad signatures; `[EMAIL]`
  console namespaces; Sentry capture in `fireAndLogEmail` for billing/subscription paths.
- **Offline/slow**: webhook is synchronous; no retry queue on send, but `EmailLog` FAILED
  rows are retryable via dedupeKey re-claim on the next trigger.

## 16. Dead Code / Cleanup

- **DEAD-01 (Low)** — The email HTML sanitizer is duplicated verbatim between
  `packages/shared/src/email-html-sanitizer.ts` and
  `apps/admin/src/lib/email-template-sanitizer.ts` (byte-for-byte identical bodies). The
  admin route imports the local copy; the web render path imports the shared one. Drift
  risk: a fix to one won't reach the other. Recommendation: admin should import the shared
  package's `sanitizeEmailHtml`. [confirmed duplicate by reading both files]
- `weeklyDigestHtml`/`weeklyDigestText` and the inline `billReminderHtml`/`contractReminderHtml`
  builders are still referenced by their senders as fallbacks — NOT dead. [verified via callers]
- No other unused exports confirmed; senders are invoked by crons/webhooks outside scope.
  Items not exhaustively traced are left unflagged rather than asserted unused.

## 17. Tests

- **Existing**: `resend-webhook.test.ts`, `unsubscribe.test.ts`,
  `api/unsubscribe/route.test.ts`, `app/unsubscribe/page.test.tsx`,
  `lib/__tests__/email.test.ts`, `email-service.test.ts`,
  `packages/shared/.../email-html-sanitizer.test.ts`, admin `email-template-sanitizer.test.ts`.
- **Missing / suggested**:
  - Unit: token expiry (after SEC-01 fix); `k` cannot widen signed scope; production
    fallback-secret refusal (SEC-02).
  - Integration: webhook replay within tolerance is a no-op (SEC-04); bounce updates
    `EmailLog.status=BOUNCED` by `providerMessageId`; stale PENDING reconciliation (REL-01).
  - Integration: dedupeKey re-claim concurrency (only one of two parallel retries sends).
  - e2e: one-click `List-Unsubscribe` POST opts out; GET `/unsubscribe` never mutates;
    confirm-form error path renders styled state (UI-01).
  - Sanitizer bypass corpus expansion (SEC-05).

## 18. Findings Summary

| ID | Severity | Category | Finding | Impact | Recommendation | Files |
|----|----------|----------|---------|--------|----------------|-------|
| email-pipeline-01 | Medium | Security | Unsubscribe token has no expiry and `kind` is attacker-mutable (defaults to `all`) | Leaked one-click link permanently opts a user out of all marketing+reminder mail | Add expiry to signed payload; clamp `k` so it can only narrow signed scope | lib/unsubscribe.ts; app/api/unsubscribe/route.ts |
| email-pipeline-02 | Medium | Security | Unsubscribe HMAC secret falls back to `USER_JWT_SECRET`; `.env.example` ships it empty | Cross-domain secret reuse; rotating JWT secret breaks all unsubscribe links | Require dedicated secret in production; gate fallback to dev only | lib/unsubscribe.ts; .env.example |
| email-pipeline-03 | Medium | Reliability | Send→log-update is non-transactional; delivered mail can stay `PENDING` and is never reconciled | Skewed email-health metrics; bounce can't match by providerMessageId | Persist provider id before marking; reconcile stale PENDING via cron | lib/email-service.ts:280-296 |
| email-pipeline-04 | Medium | Logic | `renderTemplate` substitutes raw (unescaped) value into subject while body is escaped | Latent footgun if a future caller HTML-renders the subject; header injection closed by later sanitize | Escape subject substitution too, or document the asymmetry | lib/email-service.ts:374-391 |
| email-pipeline-05 | Low | Security | Resend webhook secret + `EMAIL_REPLY_TO` undocumented in `.env.example`; webhook fails closed (503) | Silent permanent loss of bounce/complaint suppression and bounce metric | Add keys to .env.example + readiness checks | webhooks/resend/route.ts:39; email.ts:104; .env.example |
| email-pipeline-06 | Low | Security | Resend webhook lacks idempotency store; only 300s timestamp tolerance prevents replay | Within-window replay creates audit noise / repeated BOUNCED writes (op is idempotent) | Record svix-id in ProcessedWebhookEvent like other webhooks | webhooks/resend/route.ts; resend-webhook.ts |
| email-pipeline-07 | Low | Security | Bespoke non-DOM HTML sanitizer; preview iframe not sandboxed | Sanitizer bypass = stored-XSS vs operator (admin-gated, vars escaped) | Sandbox preview iframe; adopt vetted sanitizer; de-dupe copies | packages/shared/src/email-html-sanitizer.ts; admin email-templates-client.tsx:169 |
| email-pipeline-08 | Low | Reliability | `BOUNCED` write only matches by providerMessageId, best-effort | Bounce metric misses sends with no persisted provider id | Fallback match by recent EmailLog to recipient | webhooks/resend/route.ts:112-121 |
| email-pipeline-09 | Low | Dead Code | Email sanitizer duplicated verbatim in shared + admin | Fix drift; a patch to one misses the other | Admin imports shared sanitizer | apps/admin/src/lib/email-template-sanitizer.ts; packages/shared/src/email-html-sanitizer.ts |
| email-pipeline-10 | Low | UI/UX | Unsubscribe API errors return raw plain text, not the styled page | Stale-link click shows unbranded error page | 303 to /unsubscribe error state on confirm-form path | app/api/unsubscribe/route.ts:66,76 |
| email-pipeline-11 | Low | Performance | Per-recipient sends repeat app-URL + template DB reads with no per-run caching | Extra DB round-trips on high-volume crons | Cache app URL + active templates per cron run | lib/email-service.ts (reminder/digest senders) |
| email-pipeline-12 | Info | Security | Webhook suppresses recipient from payload `to` without cross-checking EmailLog (Svix-gated) | None unless webhook secret leaks | Optional: cross-check recipient against recent sends | webhooks/resend/route.ts:88-105 |

## 19. Module TODO

- [ ] **email-pipeline-01** Add expiry + scope clamp to unsubscribe tokens — Severity Medium.
  Reason: durable, scope-wideable opt-out primitive from any leaked link. Files:
  `lib/unsubscribe.ts`, `app/api/unsubscribe/route.ts`, `lib/email-service.ts`
  (token build). Suggested fix: sign `userId.exp` and bind/clamp kind; reject expired.
  Dependencies: token format is backward-incompatible — support old+new during rollout.
  Complexity: med. Risk of change: med (breaks outstanding links if not staged).
- [ ] **email-pipeline-02** Require dedicated `EMAIL_UNSUBSCRIBE_SECRET` in production —
  Severity Medium. Reason: JWT-secret reuse couples auth + email domains. Files:
  `lib/unsubscribe.ts`, `.env.example`, production-readiness check. Suggested fix: gate the
  JWT fallback to non-production runtime. Dependencies: ops must set the new secret first.
  Complexity: low. Risk: med (misconfig fails sends if enforced without provisioning).
- [ ] **email-pipeline-03** Reconcile stale PENDING `EmailLog` rows / persist provider id
  pre-mark — Severity Medium. Files: `lib/email-service.ts`, new reconcile cron. Complexity:
  med. Risk: low.
- [ ] **email-pipeline-04** Escape the subject variable substitution in `renderTemplate`
  (or document why raw) — Severity Medium. Files: `lib/email-service.ts:374-391`.
  Complexity: low. Risk: low.
- [ ] **email-pipeline-05** Document `RESEND_WEBHOOK_SECRET` + `EMAIL_REPLY_TO` in
  `.env.example` and readiness checks — Severity Low. Files: `.env.example`, env-catalog.
  Complexity: low. Risk: low.
- [ ] **email-pipeline-06** Add svix-id idempotency to the Resend webhook — Severity Low.
  Files: `webhooks/resend/route.ts`, `webhook-idempotency.ts`. Complexity: low. Risk: low.
- [ ] **email-pipeline-07** Sandbox admin template preview iframe + adopt/dedupe a vetted
  sanitizer — Severity Low. Files: admin client + both sanitizers. Complexity: med. Risk: med.
- [ ] **email-pipeline-08** Bounce-metric fallback match — Severity Low. Files:
  `webhooks/resend/route.ts`. Complexity: low. Risk: low.
- [ ] **email-pipeline-09** De-duplicate the sanitizer (admin imports shared) — Severity Low.
  Files: admin sanitizer + import sites. Complexity: low. Risk: low.
- [ ] **email-pipeline-10** Styled error states on the unsubscribe confirm-form path —
  Severity Low. Files: `app/api/unsubscribe/route.ts`, `app/unsubscribe/page.tsx`.
  Complexity: low. Risk: low.
- [ ] **email-pipeline-11** Per-cron caching of app URL + active templates — Severity Low.
  Files: `lib/email-service.ts`, cron callers. Complexity: med. Risk: low.
