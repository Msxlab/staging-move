# Flow Audit: Notification / Email / Digest

Area slug: `notification-email-digest`
Scope: domain event -> in-app notification + email -> unsubscribe -> daily digest -> push.
Evidence is source code only. Paths are relative to repo root (`staging-move/`).

---

## 1. Flow Summary & actors

**Actors**
- End user (web/mobile): receives in-app feed entries, transactional + reminder emails, and Expo push. Manages preferences (`/api/notifications`, `/api/notifications/preferences`) and opts out (`/unsubscribe`, `/api/unsubscribe`).
- Cron scheduler (Ofelia / DO job runner): authenticated by `CRON_SECRET` via `guardCronRequest`. Drives the per-item reminder crons and the daily-digest rollup.
- Resend (email provider): sends emails; posts bounce/complaint webhooks to `/api/webhooks/resend`.
- Expo push service: `https://exp.host/--/api/v2/push/send`.
- Admin: enqueues `NotificationQueue` rows (direct + broadcast) drained by `scheduled-delivery`.

**Core modules**
- `apps/web/src/lib/notifications.ts` — channel dispatcher (`sendNotification`): EMAIL via Resend, PUSH via Expo, SMS fail-closed.
- `apps/web/src/lib/in-app-notifications.ts` — `createInAppNotification` (durable feed row, atomic dedupe).
- `apps/web/src/lib/email-service.ts` — `sendLoggedEmail` (EmailLog + dedupe + kill switch), all per-type email senders, `sendDailyDigestEmail`.
- `apps/web/src/lib/email.ts` (+ `@locateflow/shared`) — templating, sanitization, unsubscribe footer/headers.
- `apps/web/src/lib/daily-digest.ts` — `collectDailyDigests` (re-derives the per-item due-today set), `buildPushSummary`, `digestDedupeKey`.
- `apps/web/src/lib/unsubscribe.ts` / `unsubscribe-actions.ts` — HMAC token, `processUnsubscribe`, opt-out gates (`isEmailTypeOptedOut`).
- `apps/web/src/lib/notification-preferences.ts` — per-type EMAIL/PUSH preference resolution.
- Routes: `api/cron/{bill-reminders,task-reminders,bill-overdue,move-reminders,contract-reminders,daily-digest,move-week-alerts,scheduled-delivery,lifecycle-nudges}`, `api/notifications/**`, `api/push/register`, `api/unsubscribe`, `api/webhooks/resend`.

---

## 2. Step-by-step trace

### A. Domain event -> in-app + email/push (reminder cron path)
Trigger: cron tick (GET) hits e.g. `api/cron/bill-reminders/route.ts`.
1. **Auth**: `guardCronRequest(req, "bill-reminders")` → `verifyInternalAuth` (CRON_SECRET) + per-route rate limit (`cron-guard.ts`).
2. **Query** (`prisma.service.findMany`): scoped `isActive`, `monthlyCost>0`, `user.deletedAt: null`; soft-delete extension also injects `Service.deletedAt: null` (db.ts / soft-delete.ts).
3. **Prefs**: `notificationPreference.findMany` grouped per user; `buildWebNotificationSettings` resolves `emailEnabled && billReminder` (email) and `isPushTypeEnabled(...,"BILL_REMINDER")` (push).
4. **Delivery-hour gate**: `isReminderDeliveryHour(now, tz)` (reminder-timezone.ts) — only the per-zone ~8am UTC run acts.
5. **Ownership gate**: `digestOwnsSend = await isDailyDigestEnabled()` (daily-digest-config.ts). When ON, the cron writes the IN_APP feed row but **suppresses** its own email + push.
6. **In-app**: `createInAppNotification` with `dedupeKey = cron:bill-reminder:{svcId}:{date}:{lead}` → `prisma.notification.create`, `channel:"IN_APP"`, atomic `@@unique([userId,channel,dedupeKey])`.
7. **Email**: `sendBillReminderEmail` (re-checks `isEmailTypeOptedOut(...,"REMINDER")`, renders DB template or inline, appends unsubscribe footer/headers) → `sendLoggedEmail` (EmailLog PENDING→SENT/FAILED/SKIPPED, `EmailLog.dedupeKey @unique`) → `sendEmailWithResult` (Resend).
8. **Push**: `sendNotification({type:"PUSH"})` → `notifications.ts` checks `NOTIFICATION_PUSH_ENABLED==="true"`, loads `pushDevice` rows, POSTs Expo batch; prunes `DeviceNotRegistered` tokens.
9. **Logs/analytics**: cron returns counts JSON; EmailLog row is the email audit trail; `processUnsubscribe` writes `AuditLog`.

### B. Daily digest rollup
Trigger: `api/cron/daily-digest/route.ts` (GET/POST).
1. `guardCronRequest`; `if (!isDailyDigestEnabled()) return skipped` (no-op when OFF).
2. `collectDailyDigests(now)` re-derives the exact per-item set across 5 sections, each mirroring its source cron's WHERE/lead-days/tz match/pref gates; builds `emailSections` (email-gated) + `pushKinds` (push-gated) + `matchedCounts`.
3. Per user: one `sendDailyDigestEmail` (when `emailSections.length>0`) with `dedupeKey = cron:daily-digest:{userId}:{localDay}`; one push via `sendNotification` with `dedupeKey = ...:push`.
4. Idempotency: `EmailLog.dedupeKey @unique` (email) and the in-flow push dedupe key; collectDailyDigests' local-hour gate means only the user's zone-run produces their digest.

### C. Unsubscribe
- Email body link → `/unsubscribe?t=token[&k=kind]` page (`app/unsubscribe/page.tsx`): verifies HMAC token, renders **confirm** step (no mutation on GET), shows email-on-file.
- Confirm POST → `api/unsubscribe/route.ts`: rate-limited (60/min by IP), parses token + kind, `processUnsubscribe` upserts `NotificationPreference` rows `enabled:false` per `notificationTypesForKind`, writes AuditLog, 303 back to page `done=1`.
- RFC 8058 one-click: `List-Unsubscribe`/`List-Unsubscribe-Post` headers target `/api/unsubscribe` POST directly.

### D. Resend bounce/complaint webhook
`api/webhooks/resend/route.ts`: body-size cap → `RESEND_WEBHOOK_SECRET` required → `verifyResendSignature` (Svix HMAC, 5-min replay window) → only `email.bounced`/`email.complained` act → resolve user by email (soft-delete extension hides deleted) → `processUnsubscribe({kind:"all", source})` → stamp `EmailLog.status="BOUNCED"` by `providerMessageId`.

### E. Push registration
`api/push/register/route.ts`: `requireDbUserId` auth, rate-limited, zod-validated, `pushDevice.upsert` by unique `token` (re-assigns device to current user). DELETE scoped by `{userId, token}`.

---

## 3. Happy-path correctness

Confirmed correct:
- **No double-send across digest/per-item crons**: per-item crons gate email+push on `!digestOwnsSend` while always writing the IN_APP feed (`bill-reminders` L140/L158, `task-reminders` L172/L212). `collectDailyDigests` mirrors each section's queries and gates, so the rollup contains exactly what the per-item crons would have emailed.
- **Per-channel preference independence**: email uses `emailEnabled && <type>`; push uses `isPushTypeEnabled` (own-type only). Digest honors both independently (`daily-digest.ts` L218-245 etc.).
- **Idempotency**: `EmailLog.dedupeKey @unique` + `Notification @@unique([userId,channel,dedupeKey])` + `:push` suffix prevent duplicate email/feed/push within a key.
- **Email HTML safety**: variable values escaped (`escapeTemplateHtml`), final render sanitized (`sharedSanitizeEmailHtml/Subject`); digest item label/detail escaped, `href` resolved to absolute and escaped (`sendDailyDigestEmail` L1873-1878).
- **Template fallback**: DB template preferred, inline fallback when missing/inactive/empty; `logUnavailableTemplateEmail` records a FAILED row.
- **IDOR on feed**: `api/notifications/feed/[id]` checks `notification.userId !== userId` before mutating; feed list/PATCH scoped by `userId`.

---

## 4. Edge cases & reverse-logic

| Concern | Behavior | Verdict |
|---|---|---|
| Auth/role on crons | `guardCronRequest` (CRON_SECRET) on all; user APIs use `requireDbUserId` | OK |
| Empty/invalid input | digest skips empty sections (`sendDailyDigestEmail` L1848); push register zod `.strict()`; prefs route validates channel/type/freq enums | OK |
| Network failure (Expo) | per-batch `response.ok` check + `continue`; non-ok logs but doesn't mark sent; returns `successCount>0` | OK |
| Network failure (Resend) | `sendLoggedEmail` records FAILED, `retryAvailable:true`; FAILED rows re-claimable on dedupe re-send | OK |
| Double-submit / idempotency | dedupe keys per entity/day; one-click + page form both idempotent (`processUnsubscribe` upsert) | OK |
| Token expiry | **Unsubscribe HMAC token has NO expiry** and binds only `userId` (`unsubscribe.ts` L40-45) | FINDING (`-02`) |
| Partial failure (digest) | per-user try/catch; email and push dedupe independently → if email sent but push throws, retry re-sends push-only (push dedupe still gates) | OK |
| Race conditions | in-app create relies on unique constraint to lose race gracefully; scheduled-delivery claims row before side effect | OK |
| Stale data (config flip seam) | `isDailyDigestEnabled` read once/run; per-day dedupe keys make a flip-seam a no-op | OK |
| Transient bounce treated as permanent | `email.bounced` (any) → `kind:"all"` opt-out, no soft/hard distinction, no re-subscribe | FINDING (`-01`) |
| Deep-link GET to `/unsubscribe` | no mutation on GET (confirm step) — scanner-safe | OK |
| Direct POST `/api/unsubscribe` | token is proof of consent; rate-limited 60/min/IP | OK (Info `-05`) |

---

## 5. Security review of the flow

- **AuthZ at each step**: cron routes gated by `verifyInternalAuth`; user routes by `requireDbUserId`; webhook by Svix signature. Adequate.
- **IDOR / workspace scoping**: feed and push routes scope by `userId`. Notifications are per-user (not workspace) so no cross-workspace leak in this flow. OK.
- **Unsubscribe token**: HMAC-SHA256 over `userId` with `EMAIL_UNSUBSCRIBE_SECRET` or **fallback to `USER_JWT_SECRET`**. No expiry, no per-email binding. Token-holder can (a) re-opt-out forever and (b) read the **current email-on-file** via the unsubscribe page indefinitely. Forgery requires the secret. See `-02`, `-03`.
- **Validation**: push token length-bounded zod; prefs enums validated; resend body size-capped; digest text escaped.
- **Rate limiting**: present on `/api/unsubscribe`, `/api/push/register`, crons. **Absent** on `/api/notifications/feed` GET, `/api/notifications` GET/POST, `/api/notifications/preferences` (auth-gated, low risk).
- **Secrets/PII**: `RESEND_WEBHOOK_SECRET` resolved via runtime config (not in `.env.example`); EmailLog metadata allow-lists safe keys and strips `password|token|otp|secret|jwt|cookie`. Email-on-file rendered to any token holder (`-03`).
- **Opt-out enforcement on broadcast/scheduled delivery**: `scheduled-delivery`'s `deliverToUser` fans EMAIL/PUSH via `sendNotification` with **no `isEmailTypeOptedOut`/`isPushTypeEnabled` check** at delivery time. See `-04`.

---

## 6. Reliability

- **Retry**: EmailLog FAILED/SKIPPED rows are re-claimable (`sendLoggedEmail` L237-254); kill-switch SKIPPED rows resend once switch lifts. Good.
- **Transaction consistency**: in-app create + email + push are sequential, not transactional; each is independently idempotent via dedupe key, so partial failure self-heals on the next tick. Acceptable for this flow.
- **Partial-failure recovery**: digest per-user try/catch; per-item cron per-row try/catch. Good.
- **Loading/empty/error UX**: digest never sends empty (`sections.filter`); unsubscribe page renders invalid-token, account-not-found, confirm, and done states.
- **Push channel master gate**: `NOTIFICATION_PUSH_ENABLED!=="true"` makes ALL push a silent no-op (`notifications.ts` L81). Documented in `env-catalog.ts`/`runtime-config.ts` but **not in `.env.example`** — operators may not realize push is off by default. See `-06`.

---

## 7. Cross-module impact

- **Auth/JWT**: unsubscribe secret falls back to `USER_JWT_SECRET`; rotating JWT secret silently invalidates every outstanding unsubscribe link (and vice-versa they share a trust root). Coupling worth noting.
- **Billing**: subscription/payment emails (`sendSubscription*`, `sendPaymentFailedEmail`) flow through `sendLoggedEmail`; not opt-out-gated (transactional) — correct.
- **Admin**: admin enqueues `NotificationQueue`; delivery worker (`scheduled-delivery`) is the only place a broadcast EMAIL/PUSH is sent, and it does not re-check opt-out (`-04`).
- **Mobile**: `pushDevice` tokens registered from mobile; `pushChannelId` routes Android importance channels; mobile prefs route (`/api/notifications/preferences`) writes the same `NotificationPreference` rows the crons read.
- **Data retention / soft delete**: all reminder queries guard `user.deletedAt: null` + extension; resend webhook treats deleted users as unknown recipients.

---

## 8. Findings Summary

| ID | Sev | Cat | Finding | Impact | Recommendation | Files |
|---|---|---|---|---|---|---|
| notification-email-digest-01 | Medium | Reliability | Resend `email.bounced` (any) triggers `kind:"all"` permanent opt-out; no soft/hard-bounce distinction, no re-subscribe path | A transient bounce (full mailbox, greylisting) permanently disables ALL reminder+marketing+lifecycle email for a paying user; they silently stop getting bill/move/contract reminders | Distinguish hard vs soft/transient bounce types from the Resend payload; only hard-bounce/complaint should suppress; consider suppressing a narrower kind and/or an admin re-enable | apps/web/src/app/api/webhooks/resend/route.ts:104-105; apps/web/src/lib/unsubscribe-actions.ts:18-69 |
| notification-email-digest-02 | Medium | Security | Unsubscribe HMAC token has no expiry and binds only `userId`; secret falls back to `USER_JWT_SECRET` | A leaked/forwarded marketing-email link lets the holder re-opt the user out indefinitely; only secret rotation revokes, which also invalidates every other link and is coupled to JWT auth | Add an issued-at/expiry component to the token (or bind to a per-user salt that can be rotated); prefer a dedicated `EMAIL_UNSUBSCRIBE_SECRET` and document it as required | apps/web/src/lib/unsubscribe.ts:19-67; apps/web/src/lib/email-service.ts:155-176 |
| notification-email-digest-03 | Low | Security | `/unsubscribe` page renders the account's current email-on-file to any holder of a valid (non-expiring) token | A forwarded/leaked email link discloses the recipient's current email address indefinitely (PII), even after address changes | Mask the email (e.g. `j•••@d•••.com`) on the confirm/done view, or require the token to encode the email it was issued for | apps/web/src/app/unsubscribe/page.tsx:66-98,138-141 |
| notification-email-digest-04 | Medium | Logic | `scheduled-delivery` broadcast/queue worker fans out EMAIL/PUSH via `sendNotification` with no `isEmailTypeOptedOut`/`isPushTypeEnabled` check at delivery time | A broadcast/scheduled MARKETING/PROMO message reaches users who opted out of email/push (CAN-SPAM / opt-out-bypass exposure) unless the admin enqueue path filters — which is not enforced here | In `deliverToUser`, before EMAIL/PUSH fan-out, consult `isEmailTypeOptedOut`/`isPushTypeEnabled` by the row's class for promotional types; keep operational/transactional types exempt | apps/web/src/app/api/cron/scheduled-delivery/route.ts:111-137; apps/web/src/lib/notifications.ts:31-68 |
| notification-email-digest-05 | Info | Security | `POST /api/unsubscribe` one-click is unauthenticated, rate-limited by IP only (60/min) | Acceptable per RFC 8058 (token is consent), but a single IP could probe tokens at 60/min; HMAC forgery is the real barrier | Consider lowering the one-click limit or keying it partly on token; acceptable as-is | apps/web/src/app/api/unsubscribe/route.ts:25-31 |
| notification-email-digest-06 | Low | Reliability | Push channel is fully gated behind undocumented (in `.env.example`) `NOTIFICATION_PUSH_ENABLED`; default off = silent no-op | Operators who don't know the flag see all push silently skipped (returns `false`/skip) with only a `console.warn` | Document `NOTIFICATION_PUSH_ENABLED` (and `RESEND_WEBHOOK_SECRET`, `DAILY_DIGEST_ENABLED`) in `.env.example`; surface a startup/health warning when push is requested but disabled | apps/web/src/lib/notifications.ts:80-90; .env.example |
| notification-email-digest-07 | Info | Logic | Hard-deadline escalation tier in task-reminders is intentionally NOT modeled by the digest and intentionally NOT suppressed by `digestOwnsSend` | Correct by design (legally-critical nudge keeps sending per-item even with digest on); flagged for reviewer awareness that digest parity is soft-due-only | None required; keep the comment/behavior; ensure future digest changes preserve this exemption | apps/web/src/app/api/cron/task-reminders/route.ts:132-139,229-316; apps/web/src/lib/daily-digest.ts:249-309 |
| notification-email-digest-08 | Info | Architecture | In-app feed read APIs (`/api/notifications`, `/api/notifications/feed`, `/preferences`) have no rate limit | Auth-gated and cheap; low abuse surface, but unbounded paginated counts per request | Optional: add a light per-user rate limit consistent with other read APIs | apps/web/src/app/api/notifications/feed/route.ts:6-35; apps/web/src/app/api/notifications/route.ts |

---

## 9. Flow TODO

1. Split bounce handling by Resend bounce subtype (hard vs soft) before suppressing; add an admin re-enable for false suppressions (`-01`).
2. Add expiry/rotation-friendly salt to unsubscribe tokens and a dedicated documented secret (`-02`).
3. Mask email-on-file in the unsubscribe UI (`-03`).
4. Enforce opt-out at the broadcast/scheduled delivery worker for promotional classes (`-04`).
5. Document `NOTIFICATION_PUSH_ENABLED`, `RESEND_WEBHOOK_SECRET`, `DAILY_DIGEST_ENABLED` in `.env.example` and add a health signal when push is requested-but-disabled (`-06`).
