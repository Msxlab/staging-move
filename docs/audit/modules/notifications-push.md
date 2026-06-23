# Module Audit: Notifications & Push

> READ-ONLY audit. Evidence cited to source. Paths relative to repo root
> (`staging-move/`). Doc/comment claims are treated as hints only and
> independently verified against code.

## 1. Module Summary

LocateFlow has three notification surfaces that share one preference store:

- **In-app feed** — `Notification` rows written by `createInAppNotification`
  (`apps/web/src/lib/in-app-notifications.ts`), read by
  `GET /api/notifications/feed`, rendered by the header `NotificationCenter`
  and the `(app)/notifications` page.
- **Email** — Resend, via `lib/email-service.ts` (out of strict scope but the
  reminder crons and digest call into it; opt-out gating verified here).
- **Push** — Expo push (`exp.host/--/api/v2/push/send`) via
  `sendNotification`/`sendPush` (`apps/web/src/lib/notifications.ts`), targeting
  `PushDevice` rows registered from the mobile app
  (`apps/mobile/src/lib/push.ts`) through `POST /api/push/register`.

Delivery is driven by per-item daily reminder crons (move/task/bill/
bill-overdue/contract) plus a flag-gated **daily-digest** rollup
(`lib/daily-digest.ts` + `api/cron/daily-digest`), a **move-week-alerts**
weather push, **lifecycle-nudges**, and a generic **scheduled-delivery** queue
worker. Preferences live in `NotificationPreference` keyed
`@@unique([userId, channel, type])`; resolution logic is in
`lib/notification-preferences.ts`. Email unsubscribe uses HMAC tokens
(`lib/unsubscribe.ts`) + `processUnsubscribe` (`lib/unsubscribe-actions.ts`).

Overall the feed authz is correct (per-user scoping + ownership check on
mark-read), push registration is authed + rate-limited, and the per-item crons
consistently gate both channels on preferences. The notable gaps are in the
generic **scheduled-delivery** broadcast worker (no preference/opt-out gate on
its email/push fan-out), a redundant double-PATCH on the notifications page, and
some reliability/idempotency edges.

## 2. Related Files

- `apps/web/src/lib/notifications.ts` — `sendNotification` / `sendPush` / `sendSms`, Expo fan-out, channel routing, invalid-token pruning.
- `apps/web/src/lib/in-app-notifications.ts` — `createInAppNotification` (atomic dedupe).
- `apps/web/src/lib/notification-feed-client.ts` — `notificationPatchRequestInit()` helper.
- `apps/web/src/lib/notification-preferences.ts` — definitions, `buildWebNotificationSettings`, `isWebNotificationEnabled`, `isPushTypeEnabled`.
- `apps/web/src/lib/daily-digest.ts` — `collectDailyDigests`, `buildPushSummary`, `digestDedupeKey`.
- `apps/web/src/lib/daily-digest-config.ts` — `isDailyDigestEnabled` (runtime flag, fail-closed).
- `apps/web/src/lib/reminder-timezone.ts` — tz-aware day/hour math, `isReminderDeliveryHour`, `nextBillingOccurrence`.
- `apps/web/src/lib/unsubscribe.ts`, `apps/web/src/lib/unsubscribe-actions.ts` — token + opt-out persistence.
- `apps/web/src/lib/resend-webhook.ts` — bounce/complaint signature verify (feeds opt-out).
- `apps/web/src/app/api/notifications/feed/route.ts`, `.../feed/[id]/route.ts` — feed read + mark-read.
- `apps/web/src/app/api/notifications/route.ts` (web prefs), `.../notifications/preferences/route.ts` (mobile prefs).
- `apps/web/src/app/api/push/register/route.ts` — device register/unregister.
- `apps/web/src/app/api/cron/{daily-digest,task-reminders,bill-reminders,bill-overdue,contract-reminders,move-reminders,move-week-alerts,lifecycle-nudges,scheduled-delivery}/route.ts`.
- `apps/web/src/components/layout/notification-center.tsx`, `apps/web/src/app/(app)/notifications/page.tsx`, `apps/web/src/app/(app)/settings/notifications/page.tsx`.
- `apps/mobile/src/lib/push.ts`, `apps/mobile/app/settings/notifications.tsx`, `apps/mobile/src/components/onboarding/NotificationPrimingCard.tsx`.
- `apps/admin/src/app/api/notifications/route.ts`, `apps/admin/src/lib/notify-dispatch.ts` — admin broadcast (feeds the queue/worker).
- `packages/db/prisma/schema.prisma` — `Notification`, `NotificationPreference`, `PushDevice`, `NotificationQueue`.

## 3. Related Routes / Screens

- Web: `/(app)/notifications` (full feed), header `NotificationCenter` dropdown, `/(app)/settings/notifications` (email prefs + config), `/unsubscribe` (page; API handled separately).
- Mobile: `app/settings/notifications.tsx`, onboarding priming card, `app/notifications/index.tsx` (referenced by web page comment for REMINDER_TYPES parity).
- Admin: `(admin)/notifications` client + send route.

## 4. Related APIs

| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET | `/api/notifications/feed` | `requireDbUserId` | paginated feed + counts |
| PATCH | `/api/notifications/feed?action=read-all` | `requireDbUserId` | mark all read |
| PATCH | `/api/notifications/feed/[id]` | `requireDbUserId` + ownership | mark one read |
| GET/POST | `/api/notifications` | `requireDbUserId` | web email prefs/config |
| GET/PUT | `/api/notifications/preferences` | `requireDbUserId` | mobile prefs (EMAIL+PUSH) |
| POST/DELETE | `/api/push/register` | `requireDbUserId` + rate limit | device token register/unregister |
| POST/GET | `/api/unsubscribe` | HMAC token (no session) | one-click / form unsubscribe |
| GET/POST | `/api/cron/*` | `guardCronRequest` (CRON_SECRET) | reminder fan-out |
| POST | admin `/api/notifications` | admin RBAC + step-up | broadcast / direct send |

## 5. Related Components

- `NotificationCenter` (header dropdown), `NotificationsPage` (full feed), settings page (web), mobile `settings/notifications`, `NotificationPrimingCard` (soft-prompt), admin `notifications-client`. Feed icon/tone mapping duplicated between `notification-center.tsx` (`notificationPresentation`) and `(app)/notifications/page.tsx` (`presentationFor`).

## 6. Related State / Hooks / Stores

- Client-only React state in `NotificationCenter` / `NotificationsPage` (`notifications`, `unreadCount`, `loading`, `filter`, optimistic mark-read). No global store. No polling/websocket — feed refetched on mount and on dropdown open.
- Mobile: `registrationInFlight` module singleton + `AsyncStorage` soft-prompt decision in `push.ts`.

## 7. Related Database / Models

- `Notification` — `@@unique([userId, channel, dedupeKey])` (atomic in-app dedupe; NULL dedupeKey distinct in MySQL). Indexes on `(userId,read)`, `(userId,type)`, `(sendAt,sent)`, `(channel)`. `metadata` is JSON text.
- `NotificationPreference` — `@@unique([userId, channel, type])`. `channel` VarChar(20), `type` VarChar(30) (unconstrained — free-form types like `LIFECYCLE` valid without migration), `frequency` VarChar(20).
- `PushDevice` — `token @unique`, `@@index([userId])`, `onDelete: Cascade`. No `dedupeKey`. `platform` VarChar(10).
- `NotificationQueue` — `userId?`, `broadcast`, `sendAt`, `sent`, `error`, `createdBy`. Drained by scheduled-delivery worker.

## 8. Impact Map

- **UI:** header bell + full feed + settings (web/mobile). Optimistic mark-read; filters (all/unread/reminders/workspace).
- **API:** feed read/patch, prefs (two shapes), push register, unsubscribe.
- **DB:** 4 models above; reminder crons read `Service`/`MoveTask`/`MovingPlan` + prefs.
- **Auth:** all user endpoints `requireDbUserId`; crons CRON_SECRET; unsubscribe HMAC; admin RBAC+step-up.
- **Admin:** broadcast send writes feed rows + fans out email/push; respects only MARKETING/PROMO opt-out by design.
- **Mobile:** Expo token registration, Android channels (`default`/`billing`/`move-alerts`/`marketing`), soft-prompt.
- **Notifications/Integrations:** Expo push API, Resend (+ Svix webhook for bounce/complaint → opt-out).
- **Analytics/SEO:** N/A for SEO. Cron responses return counters (no PII beyond user ids in error strings — see finding 09).
- **Tests:** feed auth, push register, unsubscribe token; many cron tests exist. Gaps noted in §17.

## 9. Buttons / Actions / Functions

**Bell toggle (`NotificationCenter.toggleOpen`)** — header. Opens dropdown, refetches feed. Loading state shown; no error toast (silent empty on failure). No disabled state needed. Permission: server-scoped. Edge: refetch on every open (no cache) — minor redundant calls.

**Mark one read (dropdown `markRead`, page `markRead`)** — optimistic update then PATCH. Dropdown version: single PATCH, errors swallowed (`.catch(()=>{})`), no rollback. Page version (`(app)/notifications/page.tsx:112-125`): **fires TWO PATCH requests** for the same id — an inline `fetch(...)` then a second via `notificationPatchRequestInit()`; only the second result drives error handling/rollback. Loading: none per-row. Permission: server ownership check (`feed/[id]`). Edge: double-click is idempotent server-side; double-request is wasteful (finding 04).

**Mark all read (`markAllRead`)** — optimistic, PATCH `?action=read-all`, toast on success/failure (page) or silent (dropdown). Disabled while `markingAll` (page) — correct. Permission: server-scoped `updateMany where userId`. Edge: not rate-limited (finding 08).

**Save preferences (settings page)** — POST `/api/notifications`. Server upserts only boolean keys present; config keys normalized. Loading (`saving`), toast feedback. Permission: `requireDbUserId`. Edge: web UI cannot toggle PUSH at all (PUSH prefs only settable via mobile PUT) — by design but see finding 07.

**Push register (mobile `registerForPushNotifications`)** — soft-prompt gate → OS permission → Expo token → POST. `registrationInFlight` dedupes concurrent calls. Errors swallowed → returns false. Permission: bearer/cookie `requireDbUserId`, rate-limited 20/60s. Edge: token reassigned to current user on conflict (documented; finding 06).

**Unsubscribe (one-click / form)** — `POST /api/unsubscribe`, HMAC token = proof, no session. Rate-limited 60/60s. Flips EMAIL channel rows only. Edge: does not affect PUSH (finding 07).

**Send broadcast (admin)** — RBAC + password step-up for EMAIL/PUSH, href sanitized, dedupe window, audience cap. Honors MARKETING/PROMO opt-out only (operational types bypass by design).

## 10. UI/UX Audit

- **Redundant network call on row mark-read** (page). Evidence: `(app)/notifications/page.tsx:112-125`. Two PATCHes per row. Impact: wasted requests, confusing error semantics (first call's failure is ignored). Recommendation: keep one PATCH; use the helper once. Priority: Medium.
- **Silent failure in header dropdown.** Evidence: `notification-center.tsx:133-137` `.catch(()=>{})` with no rollback; `fetchFeed` catch resets to empty. Impact: a transient feed error shows "all caught up" (looks like zero notifications, not an error). Recommendation: distinguish error vs empty; offer retry. Priority: Medium.
- **No realtime / polling.** Feed only refreshes on mount + dropdown open. Impact: unread badge can be stale for a long session. Recommendation: lightweight poll or revalidate on focus. Priority: Low.
- **Duplicate presentation mapping** between dropdown and page (different type buckets). Impact: drift risk (e.g. `CONNECTOR_ACTION_NEEDED` styled in page, not dropdown). Recommendation: extract shared map. Priority: Low.
- **Empty/loading/dark theme** all handled via tokens (`text-foreground/*`, `bg-tone-*`); responsive widths (`w-80 sm:w-96`, `max-w-2xl`). No obvious contrast/responsive defects found.

## 11. Logic Audit

- **Digest ↔ per-item parity** is the central invariant: `lib/daily-digest.ts` re-derives the same due-today set with the same lead-day arrays and the same pref gates as the per-item crons; per-item crons suppress email/push when `isDailyDigestEnabled()` but still write the in-app feed (`task-reminders/route.ts:139,172,212`). Flag read once per run; fail-closed default OFF (`daily-digest-config.ts:30-41`). Idempotency via per-(entity|user)-per-local-day dedupe keys. This is coherent.
- **Hard-deadline escalation is NOT suppressed by the digest** (`task-reminders/route.ts:229-316`) and the digest deliberately does not model it — so it always sends per-item. Correct by design, but the escalation push is gated only by the broad `TASK_REMINDER` PUSH pref, not a deadline-specific one (acceptable).
- **`bill-reminders` section ordering** in `daily-digest.ts:334-346` checks preferences *before* `isReminderDeliveryHour`, whereas other sections check the hour first. Functionally equivalent (both must pass) but inconsistent; a refactor risk.
- **`isPushTypeEnabled` defaults ON** (`notification-preferences.ts:154-164`): with no explicit `PUSH` row, push is allowed. Intentional (freshly-registered device gets pushes), but means a web-only user with a registered device cannot mute push from the web UI (no PUSH toggles on web — finding 07).
- **Race:** in-app dedupe is atomic (unique constraint). Push/email dedupe relies on `EmailLog`/dedupeKey suffixes; concurrent cron runs are made safe by the in-app row being created first (`move-week-alerts/route.ts:204` only pushes when the in-app row was newly created). For `task-reminders`, push fires inside `if (mirrored)` — same guard. Good.
- **Stale flag at config-flip seam:** documented as no-op via dedupe keys; plausible from code.

## 12. Reverse Logic Audit

- **Unauthorized user:** feed/prefs/push all `requireDbUserId`; `apiGateErrorResponse` maps to 401 (verified by `feed/route.test.ts`). Unsubscribe requires valid HMAC. Good.
- **Empty data:** feed empty-state rendered; crons skip users with nothing to deliver.
- **API error:** feed GET → 500 JSON; client shows empty (see finding). Cron per-item try/catch isolates failures.
- **Slow network / double-click:** mark-read optimistic + idempotent server. Push register dedupes in-flight. Mark-all not rate-limited (finding 08).
- **Direct route access (IDOR):** `feed/[id]` checks `notification.userId !== userId` → 404 (`feed/[id]/route.ts:14-17`). Feed list scoped by `userId`. Push unregister scoped `where: { userId, token }`. No IDOR found on user endpoints.
- **Mobile viewport / dark theme:** token-based; fine.
- **Role change / token expiry:** session resolved per request via `requireDbUserId`; expiry → 401.
- **Direct push-token abuse:** see finding 06.

## 13. Security Audit

### notifications-push-01 — Scheduled-delivery worker fans out push/email with NO preference or opt-out gate
- **Severity:** Medium (latent; High if scheduled broadcasts are enabled)
- **Affected Area:** `apps/web/src/app/api/cron/scheduled-delivery/route.ts` (`deliverToUser`, lines 111-137) → `sendNotification` (`lib/notifications.ts:31`, `sendPush`/`sendEmailNotification` have no internal pref check).
- **Evidence:** `deliverToUser` calls `sendNotification({ type: channel === "PUSH"/"EMAIL" })` for every targeted user with no `isPushTypeEnabled` / `isEmailTypeOptedOut` check. For a `broadcast` queue row it pages the **entire user table** (`deliverClaimedRow:81-99`) and pushes/emails all of them. Contrast: the per-item crons all pre-gate (`task-reminders:163`, `move-week-alerts:141`), and the *immediate* admin path gates MARKETING/PROMO via `dispatchPushBatch`/`dispatchEmailBatch` + `fetchOptOutSet` (`apps/admin/src/lib/notify-dispatch.ts:18-31`). The queue worker has no equivalent.
- **Risk:** A scheduled or broadcast notification delivered through the queue ignores user opt-outs and per-type push preferences — a CAN-SPAM / consent exposure and a deliverability risk.
- **Defensive Abuse Scenario (high-level):** An operator (or any code path) that enqueues a future-dated/broadcast `NotificationQueue` row of a marketing- or reminder-class type reaches users who explicitly opted out, because the drain path never consults their preferences.
- **Reachability today:** the only `notificationQueue.create` in app code (`apps/admin/.../notifications/route.ts:341`) writes `sent: true` (a ledger row), and admin advertises `schedulingEnabled: false`. So the un-gated broadcast path is **currently latent** — it activates the moment any `sent:false` (especially `broadcast:true`) row is created, which is exactly the "scheduled delivery" the worker was built to enable.
- **Prevention:** in `deliverToUser`, before EMAIL/PUSH fan-out, consult `isEmailTypeOptedOut` / `isPushTypeEnabled` (and the master `NOTIFICATION_PUSH_ENABLED`) by row `type`, mirroring `fetchOptOutSet`'s operational-vs-promotional policy.
- **Detection:** add a counter for "suppressed by preference" in the worker summary; alert if a broadcast delivered to opted-out users.
- **Analysis (root cause):** the worker was added to "close the gap" of unfired scheduled rows but reused the raw `sendNotification` primitive (which is preference-agnostic by contract) instead of the admin `dispatch*Batch` helpers that carry the opt-out policy.
- **Recommendation:** route queue fan-out through preference-aware helpers; add tests asserting opted-out users are skipped.
- **Tests To Add:** broadcast row with one opted-out user → that user receives no push/email but does receive the IN_APP row.

### notifications-push-02 — Push device token is the sole identity; registration reassigns on any login
- **Severity:** Low ([needs verification] of token entropy assumptions)
- **Affected Area:** `apps/web/src/app/api/push/register/route.ts:44-48`, `PushDevice.token @unique`.
- **Evidence:** `upsert where:{token}` reassigns `userId` to whoever is authenticated when a matching token is posted. This is intentional for shared/hand-me-down devices (documented `route.ts:39-43`, tested). The risk surface is that a caller who can supply an arbitrary 10–255 char string as `token` could (a) overwrite another user's device row's owner (DoS: the legit owner stops receiving push; the attacker, now owner, receives nothing useful since Expo validates the token), or (b) pre-register a guessed token. Mitigated by: auth required, rate limit 20/60s, and Expo tokens being long opaque values (`ExponentPushToken[...]`).
- **Risk:** Targeted push DoS / token squatting if an Expo token leaks (tokens are not secret to the holder).
- **Defensive Abuse Scenario:** An attacker who learns victim B's Expo token registers it under their own account, silently detaching B's device from B's notifications.
- **Prevention:** treat the token as low-trust; consider validating the token format (`ExponentPushToken[...]` / `ExpoPushToken[...]`) and/or binding reassignment to a device attestation. At minimum, audit-log ownership transfers.
- **Detection:** log/alert when an upsert changes an existing row's `userId`.
- **Analysis:** by-design reassignment trades a theoretical squatting risk for shared-device UX; acceptable but undocumented as a risk.
- **Recommendation:** add format validation + transfer audit logging.
- **Tests To Add:** reassignment emits an audit event; malformed token rejected.

### notifications-push-03 — Feed payload returns full `metadata` JSON to the client
- **Severity:** Low
- **Affected Area:** `apps/web/src/app/api/notifications/feed/route.ts:14-19` returns `prisma.notification.findMany(...)` with no `select`, so `metadata` (JSON text containing internal ids like `taskId`, `movingPlanId`, `queueId`, `dedupeKey`) is serialized to the client.
- **Evidence:** model `metadata String? @db.Text`; writers stuff internal ids (e.g. `in-app-notifications.ts:18-25`, cron metadata blocks).
- **Risk:** Minor internal-id disclosure of the user's *own* resources (not cross-tenant). Low sensitivity but unnecessary surface.
- **Defensive Abuse Scenario:** Information leak only — a user can enumerate their own internal entity ids; no cross-user exposure since rows are `where:{userId}`.
- **Prevention:** add an explicit `select` excluding `metadata` (and `dedupeKey`) from the feed response.
- **Detection:** response-shape test.
- **Analysis:** convenience `findMany` without projection.
- **Recommendation:** project only fields the UI uses (`id,type,title,body,href,icon,read,createdAt`).
- **Tests To Add:** feed response omits `metadata`/`dedupeKey`.

### Other security checks (no finding)
- **CSRF:** mutations require JSON content-type + `X-Requested-With` (comment `notification-center.tsx:130-137`); middleware enforces (consistent with the helper). [needs verification of middleware, out of module scope].
- **XSS:** feed renders `title`/`body` as text (React-escaped); `href` rendered via `<Link>` and sanitized at the admin write boundary (`admin .../notifications/route.ts:59-67`, tested for `javascript:`). Push body strips HTML (`notifications.ts:189-197`).
- **SSRF/injection:** Expo URL is constant; Prisma parameterized.
- **Secrets:** unsubscribe HMAC uses `EMAIL_UNSUBSCRIBE_SECRET` or `USER_JWT_SECRET` (≥32 chars enforced); resend webhook uses Svix HMAC + 5-min replay window. No secrets logged.

## 14. Performance Audit

- **Digest preference fetch** is batched/cached (`daily-digest.ts:178-189` `prefsFor`), avoiding N+1 across sections. Good.
- **Feed:** three parallel queries (findMany+2 counts) with proper indexes (`(userId,read)`). Page size capped 50. Fine.
- **`bill-reminders`/`bill-overdue`/`contract` sections scan all matching services then filter in JS by tz/lead-day** — bounded by `take` (500/1000) and `monthlyCost>0`/`isActive`. Acceptable; could miss items beyond `take` at very large scale ([needs verification] of audience size — reliability finding 11).
- **Broadcast worker** pages users in `BROADCAST_USER_PAGE` (2000) and pushes per-user sequentially — for a large audience this is slow and serial (no batching of Expo sends in the worker path, unlike admin `dispatchPushBatch`). Performance/reliability concern (finding 01 remediation should reuse the batched helper).
- **No client-side cache / dedupe** on feed open (minor redundant fetch).

## 15. Reliability Audit

### notifications-push-08 — Mark-all-read has no rate limit; feed mutations unbounded
- **Severity:** Low. Evidence: `feed/route.ts` PATCH has no `rateLimit` (push register does). Impact: cheap abuse vector (repeated `updateMany`). Recommendation: add a modest per-user rate limit.

### notifications-push-09 — User ids embedded in cron error strings / logs
- **Severity:** Low. Evidence: `daily-digest/route.ts:118-120`, `task-reminders:225`, etc. push `user ${id}` into `errors[]` returned in the JSON response and logs. Impact: user-id (not PII) exposure in cron responses/logs; acceptable but noisy. Recommendation: keep ids out of returned payloads; log internally only.

### notifications-push-10 — Scheduled-delivery records "No channel delivered" as failure for legitimately-suppressed sends
- **Severity:** Low. Evidence: `scheduled-delivery/route.ts:181-189` marks `error: "No channel delivered"` when push is disabled / no email — conflating "intentionally skipped" with "error". With finding 01's gating added, opted-out users would inflate this. Recommendation: distinguish suppressed vs failed.

- **Error boundaries / retry:** cron per-item try/catch isolates failures (good); claimed queue rows are never re-delivered (at-most-once, documented). No client error boundary around feed (silent empty).
- **Offline/slow:** optimistic UI; mobile push best-effort.
- **Transaction consistency:** in-app dedupe atomic; queue claim atomic (`updateMany where sent:false`). Push invalid-token pruning deletes by token set (`notifications.ts:155-159`).
- **Monitoring:** cron returns counters; logger used in scheduled-delivery only.

## 16. Dead Code / Cleanup

- `lib/notifications.ts:199-205` documents removal of `processReminders()` — confirmed no caller remains (grep). Informational only.
- **Duplicate presentation mapping** (dropdown vs page) — see §10; candidate for shared util. [confirmed duplicated, both live].
- `notificationPatchRequestInit()` helper exists but the page *also* hand-rolls the same PATCH inline (`(app)/notifications/page.tsx:113-117`) before calling the helper — the inline copy is redundant (finding 04).
- No abandoned routes found; all web pref keys are surfaced in the settings UI (verified: `connectorActionNeeded`, `workspaceMembership`, `lifecycleNudge` all rendered).

## 17. Tests

**Existing:** `api/notifications/feed/route.test.ts` (401 handling), `feed/[id]/route.test.ts`, `api/notifications/route.test.ts`, `push/register/route.test.ts` (register/reassign/409/unregister-scoping/rate-limit), `lib/unsubscribe.test.ts`, many cron `route.test.ts` (incl. `move-week-alerts`), admin `notifications/route.test.ts` (step-up, href XSS, dedupe).

**Missing / suggested:**
- **scheduled-delivery preference gating** (finding 01) — broadcast skips opted-out users; integration test of the queue→deliver path.
- **feed IDOR** — explicit test that another user's notification id returns 404 on PATCH.
- **digest parity** — property/integration test that the digest set equals the union of per-item cron matches for a fixture user (the core invariant; currently relies on hand-kept byte-identical arrays).
- **`isPushTypeEnabled` default-on** edge — no PUSH row ⇒ allowed; explicit `enabled:false` ⇒ blocked.
- **feed response shape** — omits `metadata`/`dedupeKey` (finding 03).
- **timezone correctness** — `reminder-timezone.ts` DST-seam and far-zone cases (unit).

## 18. Findings Summary

| ID | Severity | Category | Finding | Impact | Recommendation | Files |
|---|---|---|---|---|---|---|
| notifications-push-01 | Medium | Security | Scheduled-delivery worker fans out email/push with no preference/opt-out gate | Opt-outs ignored on queue/broadcast sends (latent until scheduled broadcasts enabled) | Gate fan-out via preference-aware helpers | `api/cron/scheduled-delivery/route.ts`, `lib/notifications.ts`, `admin .../notify-dispatch.ts` |
| notifications-push-04 | Medium | Performance | Notifications page sends two PATCH requests per row mark-read | Redundant calls; first failure ignored | Single PATCH via helper | `(app)/notifications/page.tsx:112-125`, `lib/notification-feed-client.ts` |
| notifications-push-05 | Medium | UI/UX | Header dropdown treats feed error as empty ("all caught up") | Hides failures from user | Distinguish error vs empty + retry | `components/layout/notification-center.tsx:86-99,133-137` |
| notifications-push-02 | Low | Security | Push token = sole identity; reassigned on any login, no transfer audit/format check | Targeted push detach if token leaks | Validate token format + audit transfers | `api/push/register/route.ts:44-48` |
| notifications-push-03 | Low | Data | Feed returns full `metadata` JSON (internal ids) | Minor own-data id disclosure | Add explicit `select` | `api/notifications/feed/route.ts:14-19` |
| notifications-push-07 | Low | Logic | Web users cannot mute PUSH (no web PUSH toggle; email unsubscribe doesn't touch PUSH) | Web-registered devices can't be silenced from web | Add PUSH toggles or bridge unsubscribe→PUSH | `api/notifications/route.ts`, `notification-preferences.ts:154-164`, `unsubscribe.ts:96-100` |
| notifications-push-08 | Low | Reliability | Feed mark-read/mark-all not rate-limited | Cheap abuse vector | Add per-user limit | `api/notifications/feed/route.ts` |
| notifications-push-09 | Low | Reliability | User ids in cron error payloads/logs | Id exposure in responses | Keep ids server-side only | `api/cron/*/route.ts` |
| notifications-push-10 | Low | Reliability | "No channel delivered" recorded as failure for legit suppression | Misleading error metric | Separate suppressed vs failed | `api/cron/scheduled-delivery/route.ts:181-189` |
| notifications-push-06 | Info | Architecture | Duplicate feed presentation mapping (dropdown vs page) | Drift risk | Extract shared map | `notification-center.tsx`, `(app)/notifications/page.tsx` |

## 19. Module TODO

- [ ] **(Medium) Gate scheduled-delivery fan-out on preferences/opt-out.** Reason: queue/broadcast path bypasses consent (finding 01). Files: `api/cron/scheduled-delivery/route.ts`, reuse `admin .../notify-dispatch.ts` policy or add web equivalents. Deps: define operational-vs-promotional type policy. Complexity: med. Risk: med (delivery behavior change).
- [ ] **(Medium) Remove the duplicate PATCH in page mark-read.** Reason: redundant call + ignored first error (finding 04). Files: `(app)/notifications/page.tsx`. Deps: none. Complexity: low. Risk: low.
- [ ] **(Medium) Surface feed-fetch errors in the dropdown.** Reason: errors masquerade as empty (finding 05). Files: `notification-center.tsx`. Deps: none. Complexity: low. Risk: low.
- [ ] **(Low) Validate push token format + audit ownership transfers.** Files: `api/push/register/route.ts`. Complexity: low. Risk: low.
- [ ] **(Low) Project feed response (drop `metadata`/`dedupeKey`).** Files: `api/notifications/feed/route.ts`. Complexity: low. Risk: low.
- [ ] **(Low) Provide a PUSH mute path for web users or bridge email unsubscribe to PUSH.** Files: `api/notifications/route.ts`, settings page. Complexity: med. Risk: low.
- [ ] **(Low) Rate-limit feed mutations.** Files: `api/notifications/feed/route.ts`. Complexity: low. Risk: low.
- [ ] **(Low) Keep user ids out of cron response payloads.** Files: `api/cron/*`. Complexity: low. Risk: low.
- [ ] **(Info) Extract shared notification presentation map.** Files: `notification-center.tsx`, `(app)/notifications/page.tsx`. Complexity: low. Risk: low.
- [ ] **(Test) Add digest↔per-item parity + scheduled-delivery preference + feed IDOR tests.** Complexity: med. Risk: low.
