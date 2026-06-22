# Module Audit: Moving & Move Tasks

> Read-only audit. Evidence cites source paths relative to repo root. Items that could not be confirmed from code are marked **[needs verification]**.

## 1. Module Summary

The Moving & Move Tasks module turns a user's `MovingPlan` (origin + destination address + move date) into a personalized, persisted set of `MoveTask` rows that drive the move checklist UI, reminder crons, in-app feed, and (optionally) affiliate offers. It has two task sources:

- **CLASSIFIER tasks** — derived from the user's tracked `Service` rows at the origin address. `classifyMoveServiceTransition` (`packages/shared/src/move-transition-classifier.ts`) deterministically picks an action (STOP/START/TRANSFER/VERIFY/SHOP/FIND_REPLACEMENT/UPDATE_ADDRESS/GOVERNMENT_UPDATE/INSURANCE_REQUOTE/MAIL_FORWARDING/CANCEL_OR_CLOSE/NO_ACTION) per service, using destination provider coverage confidence.
- **CHECKLIST tasks** — derived from the personalized relocation checklist (`packages/shared/src/relocation-checklist.ts`, `SERVICE_PRIORITY_MAP`), persisted as `source = "CHECKLIST"` rows so even movers tracking zero services get legally-required reminders (USPS, IRS 8822, USCIS AR-11, DMV, school, PCS).

Generation/sync lives in `apps/web/src/lib/move-task-generation.ts` (`syncSuggestedMoveTasks`) and `move-task-sync.ts` (batch wrappers). Completion side-effects (creating/closing local `Service` rows) live in `move-task-local-effects.ts`. The lifecycle state machine is `packages/shared/src/move-task-lifecycle.ts`. The HTTP surface is `apps/web/src/app/api/move-tasks/route.ts` (GET/POST/PATCH), `api/moving/route.ts`, `api/moving/[id]/route.ts`, and `api/moving/migration/route.ts`. The web UI is `apps/web/src/app/(app)/moving/plan/[id]/moving-plan-detail-client.tsx`; the mobile screen is `apps/mobile/app/moving/[id].tsx`.

Everything is explicitly "manual guidance only — LocateFlow does not update provider accounts." Completion has only LOCAL effects.

## 2. Related Files

- `apps/web/src/lib/move-task-generation.ts` — context build, idempotency keys, due dates, classifier + checklist persistence (`syncSuggestedMoveTasks`).
- `apps/web/src/lib/move-task-sync.ts` — batch sync by plan ids / address; `safeSyncMoveTasksForAddress`.
- `apps/web/src/lib/move-task-local-effects.ts` — `completeMoveTaskWithLocalEffect` (transactional service create/close on COMPLETE).
- `apps/web/src/lib/checklist-template-map.ts` — category → checklist templateId map.
- `packages/shared/src/move-task-lifecycle.ts` — allowed transitions, `buildMoveTaskLifecyclePatch`.
- `packages/shared/src/move-task-local-effect.ts` — `parseMoveTaskLocalEffect`.
- `packages/shared/src/move-transition-classifier.ts` — `classifyMoveServiceTransition`.
- `packages/shared/src/provider-move-domain.ts` — enums, copy, coverage confidence ranking.
- `packages/shared/src/relocation-checklist.ts` — checklist + `buildChecklistTaskTemplates`, `composeChecklistTaskDescription`.
- `apps/web/src/app/api/move-tasks/route.ts` — GET/POST/PATCH.
- `apps/web/src/app/api/moving/route.ts`, `api/moving/[id]/route.ts`, `api/moving/migration/route.ts`.
- `apps/web/src/app/api/cron/task-reminders/route.ts`, `api/cron/move-reminders/route.ts` (consumers).
- `apps/web/src/app/(app)/moving/plan/[id]/moving-plan-detail-client.tsx` (web UI).
- `apps/mobile/app/moving/[id].tsx` (mobile UI).
- Tests: `apps/web/src/lib/move-task-generation.test.ts`, `apps/web/src/app/api/move-tasks/route.test.ts`.

## 3. Related Routes / Screens

- Web: `/(app)/moving` (list), `/(app)/moving/plan/[id]` (detail + checklist), `/moving/[id]` redirect alias.
- Mobile: `app/moving/[id].tsx`, `app/(tabs)/index.tsx` (UpNext surfacing tasks).
- Dashboard: `dashboard/up-next.tsx`, `dashboard/dashboard-client.tsx` consume `/api/move-tasks`.

## 4. Related APIs

- `GET /api/move-tasks?movingPlanId=&status=` — list scoped tasks + workspace member picker.
- `POST /api/move-tasks` `{ movingPlanId }` — generate/refresh tasks.
- `PATCH /api/move-tasks` `{ id, event?, notes?, assignedToUserId?, selected*ProviderId? }` — lifecycle + assignment.
- `GET/POST /api/moving`, `GET/PATCH/DELETE /api/moving/[id]` — plan CRUD (PATCH/POST trigger task sync).
- `GET /api/moving/migration?planId=` — per-service transition analysis (read-only, separate code path).

## 5. Related Components

- `MovingPlanDetailClient` (renders checklist, assignment picker, undo toasts).
- `MovingPlanRecommendations`, `MoversSection`, `ServiceQuoteForm`, `VehicleCheck`/`isVehicleRegistrationTask`, `AffiliateCtaButton`, `AffiliateDisclosure`.
- Mobile: `MoveProgressBar`, `Pill`, `VehicleCheckCard`, `StateRulesCard`, swipeable task rows.

## 6. Related State / Hooks / Stores

- Web client local state: `moveTasks`, `migration`, `assignOpen/assignBusy`, `taskBusy`, `showAllTasks` in `moving-plan-detail-client.tsx`. No global store; data fetched per render via `fetch`.
- `apps/web/src/hooks/use-moving-plan.ts` (plan hook).
- Mobile: `useDetailOfflineCache` for offline cache of plan/task detail.

## 7. Related Database / Models

- `MoveTask` (`packages/db/prisma/schema.prisma:939`): `userId`, `movingPlanId`, `serviceId?`, origin/destination address, `providerId?`, `destinationProviderId?`, `customProviderId?`, `assignedToUserId?`, `actionType`, `status`, `source`, `templateId?`, `idempotencyKey?`, `localEffect`/`metadata` JSON, lifecycle timestamps. **No `workspaceId` column** — workspace scoping is indirect via `movingPlan.workspaceId`. Unique constraint: `@@unique([userId, idempotencyKey])` (keyed on userId, not workspace).
- `MovingPlan`, `Service`, `Address`, `ServiceProvider`, `UserCustomProvider`, `Profile`, `StateRule`.

## 8. Impact Map

- **UI:** web checklist card + mobile move detail; dashboard UpNext.
- **API:** move-tasks + moving routes; migration route.
- **DB:** `MoveTask`, plus side-effecting `Service` create/close/transfer on COMPLETE.
- **Auth:** custom JWT via `requireDbUserId`/`requireAppMutationUser`; workspace RBAC via `assertWorkspaceAction` (`address.view/edit/create/delete`).
- **Admin:** admin moving-plans module reads MoveTask (out of scope here).
- **Mobile:** parity screen; offline cache.
- **Notifications:** `cron/task-reminders` (soft-due + hard-deadline escalation), in-app feed (`TASK_DUE`), push.
- **Integrations:** provider serviceability enrichment (FCC/electric) feeds candidate confidence; affiliate CTA.
- **Analytics:** `recordMoveTaskEvent` → `UserEvent`; `TRUST_COPY_SHOWN` phase-1 event; audit logs (`TASK_GENERATED`, `TASK_STATUS`, `TASK_ASSIGN`).
- **SEO:** N/A (authenticated app surface).
- **Tests:** two unit/route test files only.

## 9. Buttons / Actions / Functions

### "Generate checklist" / "Refresh checklist" (`generateMoveTasks`, web detail client)
- **Where:** plan detail checklist card. → `POST /api/move-tasks`.
- **Expected:** sync classifier + checklist tasks for the plan; toast count.
- **Actual:** matches. Sets `tasksLoading`, replaces task list, resets `showAllTasks`.
- **Loading:** yes (`tasksLoading`, button "Working...", disabled).
- **Disabled:** correct while loading.
- **Error:** toast on non-ok.
- **Success feedback:** toast `Generated N suggested tasks`.
- **Permission:** server enforces `address.edit` + `canGenerateMoveTasks` + rate limit 20/min.
- **Edge cases:** entitlement 403 surfaced as toast; near-term/back-dated move dates clamped server-side.

### "Done" (`handleCompleteMoveTask` → `updateMoveTask("COMPLETE")`)
- **Where:** active task row. → `PATCH` event COMPLETE.
- **Expected:** mark COMPLETED, run local service effects, show undo toast.
- **Actual:** matches; 5s undo toast triggers `REOPEN`.
- **Loading:** `taskBusy` spinner; **but** see Reverse-Logic — buttons are only `disabled={busy}` where `busy === taskBusy===task.id`; the row-level refetch re-enables.
- **Error/success:** toast both.
- **Permission:** server `address.edit`, entitlement, workspace ownership checks in `completeMoveTaskWithLocalEffect`.
- **Edge cases:** double-click race (see moving-tasks-03); reopened task's `completedAt` cleared by lifecycle patch (correct).

### "Skip" (`handleDismissMoveTask`), "Reopen" (`handleReopenMoveTask`)
- Lifecycle DISMISS / REOPEN; undo toast on skip. Server validates transition (`INVALID_MOVE_TASK_STATUS_TRANSITION` → 400). Correct.

### "Assign / Reassign / Unassign" (`assignMoveTask`)
- Multi-member workspace only (`assignmentEnabled`, 2+ ACTIVE members). Server validates assignee is ACTIVE member of the task's workspace; solo workspace rejects assignment with 400. Correct and well-guarded.

### Plan status buttons ("Start Moving", "Mark Complete") (`handleStatusChange`)
- → `PATCH /api/moving/[id]`. Server enforces `VALID_STATUS_TRANSITIONS`. On CANCELED, retires CLASSIFIER tasks; on COMPLETED, no re-sync. **Client optimistically sets status without awaiting/validating server success beyond `res.ok`** (`handleStatusChange` swallows errors silently) — see moving-tasks-07.

### "Delete Plan" (`handleDelete`)
- → `DELETE /api/moving/[id]`, soft-deletes plan + cascades soft-delete of its MoveTasks in one transaction. Two-step confirm. Correct.

## 10. UI/UX Audit

- **moving-tasks-U1 (Low, UI/UX):** `handleStatusChange` silently swallows all errors (`catch {}`) and optimistically flips the badge even though the server may have rejected the transition. Evidence: `moving-plan-detail-client.tsx:354-363`. Impact: badge can show IN_PROGRESS/COMPLETED while DB is unchanged; the checklist (which gates on status) then disagrees on next reload. Recommendation: surface a toast on failure and only update local state on `res.ok` with the returned plan.
- **moving-tasks-U2 (Low, UI/UX):** Assignment dropdown (`role="listbox"`) closes only via the toggle button; no outside-click / Escape handler and option buttons lack `role="option"`/`aria-selected`. Evidence: `moving-plan-detail-client.tsx:642-674`. Impact: minor a11y + UX papercut. Recommendation: add outside-click close, `role="option"`, `aria-selected`.
- **moving-tasks-U3 (Info, UI/UX):** Several task action labels are hardcoded English strings ("Done", "Skip", "Reopen", "Generate checklist", "Completed locally in LocateFlow") while the surrounding page uses `next-intl` (`useTranslations("moving")`). Evidence: `moving-plan-detail-client.tsx:498-507, 685-702, 252`. Impact: untranslated in es-US locale despite locale support elsewhere. Recommendation: route through i18n keys.
- **Theme:** Uses tone-* design tokens and `text-foreground`/`bg-foreground/5` throughout; no hardcoded hex in the task card — light/dark safe. The progress bar, badges, and assignee avatar all use tokenized colors. OK.
- **Responsive:** Grid `grid-cols-1 sm:grid-cols-2`, flex-wrap on action rows; task rows stack on mobile (`flex-col lg:flex-row`). OK.

## 11. Logic Audit

**Expected flow:** plan create/update → `syncMoveTasksForPlans` → `syncSuggestedMoveTasks` builds context (services at origin, destination candidates), classifies each service, upserts CLASSIFIER tasks idempotently, then persists CHECKLIST tasks (skipping template ids already covered by a classifier task). Reminders read open tasks by `dueDate`. Completion runs local service effects in a transaction.

Findings:

- **moving-tasks-01 (High, Reverse Logic):** **Re-generation / reverse-logic gap on CLASSIFIER tasks when a service is removed or its category/route changes.** `syncSuggestedMoveTasks` only ever *upserts* tasks for currently-tracked services; it never retires CLASSIFIER tasks whose underlying service no longer exists or whose classification changed (a different `actionType` produces a *new* idempotency key, so the stale task is left behind, not updated). Evidence: `move-task-generation.ts:547-631` — the loop creates/updates by key but there is no pass that soft-deletes prior CLASSIFIER tasks for this plan that were not regenerated this run. The only retire path is plan CANCEL (`api/moving/[id]/route.ts:116-126`) and plan DELETE. Impact: a user who deletes a service, or whose move route changes (different `toState` ⇒ different idempotency-key suffix `:FROM:TO`), accumulates stale/duplicate suggested tasks that keep firing reminders. Recommendation: after sync, soft-delete open CLASSIFIER tasks for the plan not in the regenerated key set (a "reconcile/prune" pass), as the CANCEL path already does conceptually.

- **moving-tasks-02 (Medium, Logic):** **Route change (`toState`) orphans both classifier and checklist tasks via the state-suffixed idempotency key.** `buildMoveTaskIdempotencyKey` and `buildChecklistTaskIdempotencyKey` append `:fromState:toState` (`move-task-generation.ts:285-296, 315-327`). If the user edits the destination address to a new state (allowed via address edit / re-pick), the next sync produces *new* keys and *new* rows; the old-state tasks remain open (the checklist backstop `findFirst` by `(templateId, source)` partially mitigates checklist dupes — `move-task-generation.ts:443-454` — but classifier tasks have no such backstop). Impact: duplicate checklist/classifier tasks and reminders after a destination change. Recommendation: include destination change handling in the prune pass (moving-tasks-01), or anchor classifier idempotency on `(plan, service, category)` rather than route, retiring on route change.

- **moving-tasks-03 (Medium, Reliability):** **No status guard inside the COMPLETE transaction → concurrent double-complete can double-run side effects.** `completeMoveTaskWithLocalEffect` reads the task *outside* the transaction (`move-task-local-effects.ts:62-101`), computes the lifecycle patch (which only throws for an already-terminal status), then inside `$transaction` creates/closes services and updates the task — but the service create/close steps re-query `tx.service.findFirst` for the *moving plan's* service only by id/scope without a "task still open" guard, and the `tx.moveTask.update` has no `where: { status: <prevStatus> }` optimistic check. Evidence: `move-task-local-effects.ts:115-248`. Impact: two near-simultaneous COMPLETE requests (double-click before the row-refetch disables the button; the button is only disabled by per-row `busy` which is cleared on each refetch) can both pass the pre-transaction check; the destination-service `findFirst` dedupe (lines 144-153, 192-201) reduces but does not eliminate a race window (both read "not exists" before either commits), risking a duplicate destination `Service`. Recommendation: add an optimistic `where: { id, status: { notIn: ["COMPLETED","DISMISSED"] } }` (or `updateMany` count check) gating the side effects inside the transaction, and rely on a DB unique constraint for the destination service.

- **moving-tasks-04 (Medium, Logic):** **Reminder cron is NOT entitlement-gated, so a user who lapses to free still gets task reminders that the app forbids them to view/manage.** `canGenerateMoveTasks` blocks free users at GET/POST/PATCH (`api/move-tasks/route.ts:150,278`; `plan-limits.ts:413-433`), but `cron/task-reminders/route.ts:86-120` selects open tasks purely by `dueDate`/`status` with no plan/entitlement check. Impact: a lapsed user receives emails/push for tasks they can no longer open in-app (they hit a 403), an inconsistent and potentially annoying experience. Severity is Medium because it is reverse-logic/consistency, not a security issue. Recommendation: filter reminder candidates by the same entitlement (or by an `entitled` snapshot), or stop gating *viewing* of already-generated tasks.

- **moving-tasks-05 (Low, Logic):** `buildMoveTaskDueDate` uses `setHours(12,0,0,0)` in *server local* time (`atLocalNoon`, `move-task-generation.ts:238-265`) while reminder cron treats `dueDate` as UTC-midnight date-only (`cron/task-reminders/route.ts:38-43`, `formatDateOnlyUtc`). Classifier due dates are therefore stored at server-local-noon, not UTC-midnight like checklist due dates (`relocation-checklist.ts:195` uses `moveDateMs + offset*DAY_MS` with no noon shift). Impact: classifier vs checklist due dates can render/trigger on inconsistent day boundaries depending on server tz. **[needs verification]** — confirm server TZ is UTC in prod; if so the noon offset is harmless. Recommendation: normalize both to UTC-midnight.

- **Correct behaviors confirmed:** COMPLETED/DISMISSED tasks are never resurrected or clobbered on re-sync (`move-task-generation.ts:505-508, 614-617`); checklist persistence skips template ids already covered by a classifier task (`:432`, `:577`); lifecycle `REOPEN` clears stale `completedAt/dismissedAt` (`move-task-lifecycle.ts:79-87`); plan CANCEL retires CLASSIFIER tasks instead of regenerating (`api/moving/[id]/route.ts:116-126`).

## 12. Reverse Logic Audit

- **Unauthorized user:** `requireDbUserId`/`requireAppMutationUser` throw UNAUTHORIZED → 401. OK.
- **Empty data:** zero services still persists full checklist (quick-win fallback) (`move-task-generation.ts:633-642`); UI shows "No items yet" empty state. OK.
- **API error:** route catch blocks map known errors; generic 500 otherwise; client toasts. OK.
- **Slow network:** loading flags present; **double-click on Done** is the main gap (moving-tasks-03) — buttons disabled only per-row by `busy`, which clears on refetch.
- **Stale data:** moving-tasks-01/02 (orphaned tasks). Client always refetches after mutation; no cache invalidation problem on web.
- **Direct route access:** plan detail fetch 404 → redirect to `/moving` (`moving-plan-detail-client.tsx:313`). OK.
- **Mobile viewport / dark theme:** tokenized; OK.
- **Role change / token expiry:** workspace scope re-resolved per request; STALE_WORKSPACE_SELECTION mapped. OK.

## 13. Security Audit

### moving-tasks-06 (Medium, Security) — `/api/moving/migration` ignores workspace scoping (inconsistent authorization model)
- **Severity:** Medium.
- **Affected Area:** `apps/web/src/app/api/moving/migration/route.ts:31-99`.
- **Evidence:** The route never calls `resolveWorkspaceDataScope`/`assertWorkspaceAction`. It authorizes a plan with `if (!plan || plan.userId !== userId)` (`:66`) and loads services with `where: { userId, addressId, isActive: true }` (`:81-99`). Every other route in this module (`move-tasks`, `moving`, `moving/[id]`) authorizes via `resolveWorkspaceDataScope` + `assertWorkspaceAction("address.view/edit")` and scopes by `workspaceId`.
- **Risk:** In workspace (Family/Pro) mode, a member who is legitimately allowed to view a *workspace-owned* plan (the plan detail UI calls this endpoint — `moving-plan-detail-client.tsx:155`) is rejected because `plan.userId !== userId` when the plan was created by another member. Conversely, the migration analysis only ever reflects the *caller's own* services, not the workspace's, so the analysis surfaced to a member can silently diverge from the plan's actual tracked services. This is an authorization-model inconsistency (broken access for legitimate members + potentially confusing cross-member data view), not a classic IDOR leak.
- **Defensive Abuse Scenario (high-level):** A workspace member opens a shared plan's detail page; the migration card either errors out or shows analysis computed against the wrong user's services, undermining the move guidance the workspace relies on. Because authorization here is user-keyed rather than workspace-keyed, the route's behavior is not aligned with the documented multi-tenant model.
- **Prevention:** Adopt the same `resolveWorkspaceDataScope` + `assertScopedRecordAction(plan, scope, "address.view")` pattern as `moving/[id]`, and scope the `service.findMany` with `activeTrackedServiceWhereForScope` (as `move-task-generation.ts:72-76` already does).
- **Detection:** Add a test asserting a workspace member can fetch migration for a workspace-owned plan; add structured logging when `plan.userId !== userId` but the plan is workspace-owned.
- **Analysis (root cause):** Route predates / was not migrated to the workspace-data-scope helper used by the rest of the module.
- **Recommendation:** Migrate the migration route to workspace scoping; pass `planLimitScopeForDataScope(scope)` into `canGenerateMoveTasks` (currently called with no scope — `:49` — so a member's entitlement is evaluated against the member, not the workspace owner).
- **Tests To Add:** workspace-member-views-shared-plan migration; entitlement evaluated against owner.

### moving-tasks-08 (Low, Security) — Idempotency uniqueness keyed on `userId`, not workspace owner, with cross-user assignment
- **Severity:** Low.
- **Affected Area:** `MoveTask @@unique([userId, idempotencyKey])` (`schema.prisma:1008`); generation always writes `userId = plan.userId` (`move-task-generation.ts:46`, `:578`).
- **Evidence:** Tasks are owned by the *plan creator's* `userId`. In a workspace, all of a plan's tasks share the creator's `userId`; the unique constraint is therefore effectively per-plan-creator. `completeMoveTaskWithLocalEffect` is invoked with `existing.userId` (the owner) as the lookup key (`api/move-tasks/route.ts:339`), and records `completedByUserId = acting user`. This is internally consistent, but it means workspace data is keyed on an individual user rather than the workspace, so an owner leaving / being removed leaves task ownership semantics ambiguous.
- **Risk:** Not an exploit; a data-modeling fragility. If the plan creator's account is deleted (`User onDelete: Cascade` on MoveTask, `schema.prisma:943`) the entire workspace plan's tasks are deleted even though other members rely on them.
- **Prevention/Recommendation:** Consider a `workspaceId` column on `MoveTask` and a workspace-aware unique key, or document that plan-creator deletion intentionally cascades workspace tasks. **[needs verification]** of intended cascade semantics.
- **Detection:** Test member-removal / owner-deletion against workspace move tasks.
- **Tests To Add:** owner deletion vs. workspace task retention.

Other security checks:
- **Auth bypass / RBAC:** GET/POST/PATCH on move-tasks all require auth + `assertWorkspaceAction("address.view"/"address.edit")`; CHILD role limited to self (`move-tasks/route.ts:81-89`). OK.
- **IDOR:** move-tasks PATCH/GET scope by `moveTaskWhereForScope` + `assertWorkspaceAction(resourceUserId)`; `completeMoveTaskWithLocalEffect` re-checks service/address ownership (`move-task-local-effects.ts:80-94`). Assignment target validated as ACTIVE workspace member. OK (migration route excepted — moving-tasks-06).
- **Injection:** all DB access via Prisma parameterized queries; JSON parsed defensively (`safeParseJSON`). OK.
- **XSS:** task `title`/`description` rendered as React text nodes (escaped); description includes provider-derived strings but no `dangerouslySetInnerHTML` in the task card. OK.
- **CSRF:** state-changing routes are JSON `fetch` with `credentials: same-origin`; rely on JWT cookie + same-origin. **[needs verification]** whether a CSRF token / SameSite cookie is enforced globally (out of module scope).
- **Sensitive-data leak / PII logging:** `recordMoveTaskEvent` stores `JSON.stringify(metadata)` with task ids only; `console.error` logs include `movingPlanId`/`addressId` (ids, not PII). `metadata.transitionPlan` persisted on the task includes provider names/categories (not secrets). OK.
- **Rate limiting:** POST 20/min, PATCH 60/min, migration 30/min, moving create 10/min. Present.
- **Exposed secrets / SSRF / file upload / unsafe redirect:** none in module.

## 14. Performance Audit

- **moving-tasks-09 (Medium, Performance):** O(services × providers) classification with a 1000-provider catalog scan per sync, *plus* network-bound serviceability enrichment per generation. `buildMoveTransitionContext` loads up to 1000 destination providers (`move-task-generation.ts:100-117`) and calls `enrichProviderServiceability` (FCC/electric lookups) on every POST and on every plan create/update sync. Impact: generation latency and external-API cost scale with catalog size and run on every moveDate edit. Recommendation: cache enrichment per (plan, destination) and/or only enrich the top-N candidates actually surfaced.
- **moving-tasks-10 (Low, Performance):** `syncSuggestedMoveTasks` issues per-task sequential `findUnique`/`findFirst` + `create`/`update` in a loop (`move-task-generation.ts:547-631`, `430-525`) — N round-trips per plan, no batching/transaction. For a mover with many services + full checklist this is dozens of sequential queries. Recommendation: batch existing-task lookups (one `findMany` keyed by idempotencyKey set) and use `createMany`/transaction.
- **Client:** web detail refetches the entire task list after every mutation (`fetchMoveTasks` in each handler) rather than patching local state — extra GETs but correctness-safe. Migration + tasks + state-rules fetched on mount (3 requests); acceptable. No pagination on tasks (capped `take: 200/500`).

## 15. Reliability Audit

- **Error boundary:** route-level try/catch with typed mappings; client toasts. No React error boundary around the checklist card specifically. **[needs verification]** of app-level boundary.
- **Retry:** none on client fetches; reminder cron dedupe keys make re-runs idempotent (`cron/task-reminders/route.ts:167,257`).
- **Offline/slow:** mobile uses `useDetailOfflineCache`; web has none.
- **Transaction consistency:** COMPLETE side effects + task update are in one `$transaction` (good); plan DELETE + task soft-delete in one transaction (good). Gap: no optimistic status guard (moving-tasks-03).
- **Partial failure:** `syncMoveTasksForPlans` catches per-plan and records `failedPlanIds` but the POST route ignores that array (uses `syncSuggestedMoveTasks` directly and surfaces thrown errors) — acceptable.
- **Empty/loading state:** present.
- **Monitoring/logging:** `console.error` only; no structured metric on generation failures. Recommendation: emit a counter on sync failure.

## 16. Dead Code / Cleanup

- `generateTaskTemplates` / `generateChecklist` / `getPhaseContextForAI` in `relocation-checklist.ts` — `buildChecklistTaskTemplates` is the path used by persistence; `generateChecklist`/`generateTaskTemplates` appear to serve the client display/AI context. **[needs verification]** whether `generateTaskTemplates` (the backward-compat wrapper, `:450-466`) still has live callers; if not, it is dead.
- `safeParseJSON` is defined both in `move-task-generation.ts:24-35` and `api/moving/migration/route.ts:300-306` (duplicate). Minor; consolidate into shared util.
- `MoveTaskLocalEffect` parsing helper `parseMoveTaskLocalEffect` is used in local-effects; OK.
- No confirmed dead routes/components in module.

## 17. Tests

**Existing:** `move-task-generation.test.ts` (idempotency keys, due dates, title, checklist profile, serviceability confidence) and `move-tasks/route.test.ts` (entitlement gates, destinationProvider include contract). Lifecycle (`move-task-lifecycle.ts`), classifier (`move-transition-classifier.ts`), and `completeMoveTaskWithLocalEffect` have **no dedicated tests**.

**Missing / suggested:**
- Unit: `classifyMoveServiceTransition` per category branch (utility start/stop, insurance, government, mail-forwarding USPS vs carrier, custom healthcare, transit NO_ACTION).
- Unit: `buildMoveTaskLifecyclePatch` valid/invalid transitions and REOPEN clearing terminal timestamps.
- Integration: re-sync does not duplicate / does not clobber COMPLETED/DISMISSED; **orphan/prune behavior after a service is removed or route changes** (covers moving-tasks-01/02).
- Integration: `completeMoveTaskWithLocalEffect` creates destination service once under concurrent COMPLETE (moving-tasks-03); ownership-mismatch rejection.
- Integration: workspace member views migration for a shared plan (moving-tasks-06).
- e2e: generate → complete (undo) → reopen flow; assignment in multi-member workspace.

## 18. Findings Summary

| ID | Severity | Category | Finding | Impact | Recommendation | Files |
|----|----------|----------|---------|--------|----------------|-------|
| moving-tasks-01 | High | Reverse Logic | CLASSIFIER tasks not pruned when service removed / not regenerated | Stale tasks keep firing reminders | Add post-sync prune of open CLASSIFIER tasks not in regenerated key set | `move-task-generation.ts:547-631` |
| moving-tasks-02 | Medium | Logic | Route (toState) change spawns new-key duplicate tasks | Duplicate tasks/reminders after destination change | Anchor classifier key on (plan,service,category) or prune on route change | `move-task-generation.ts:285-327,443-454` |
| moving-tasks-03 | Medium | Reliability | No optimistic status guard inside COMPLETE transaction | Concurrent double-complete can double-create destination service | Add `where status notIn terminal` guard + DB unique constraint | `move-task-local-effects.ts:115-248` |
| moving-tasks-04 | Medium | Logic | Reminder cron not entitlement-gated | Lapsed/free users get reminders for tasks they can't open (403) | Filter reminders by entitlement or allow viewing | `cron/task-reminders/route.ts:86-120` |
| moving-tasks-06 | Medium | Security | Migration route ignores workspace scoping; entitlement unscoped | Members blocked from / shown wrong data for shared plans | Use resolveWorkspaceDataScope + scoped service query + scoped entitlement | `api/moving/migration/route.ts:31-99` |
| moving-tasks-05 | Low | Logic | Classifier due dates at server-local-noon vs UTC-midnight elsewhere | Day-boundary drift in reminders if server tz ≠ UTC | Normalize to UTC-midnight | `move-task-generation.ts:238-265` |
| moving-tasks-07 | Low | UI/UX | `handleStatusChange` swallows errors, optimistic badge | Badge can desync from DB | Toast on failure; update only on res.ok | `moving-plan-detail-client.tsx:354-363` |
| moving-tasks-08 | Low | Security | Idempotency/ownership keyed on plan-creator userId; cascade delete | Owner deletion cascades workspace tasks; modeling fragility | Consider workspaceId column / document cascade | `schema.prisma:943,1008` |
| moving-tasks-09 | Medium | Performance | 1000-provider scan + serviceability enrichment per sync | Latency + external API cost on every sync | Cache enrichment / enrich top-N only | `move-task-generation.ts:100-122` |
| moving-tasks-10 | Low | Performance | Per-task sequential queries in sync loop | N round-trips per plan | Batch lookups + createMany/transaction | `move-task-generation.ts:430-631` |
| moving-tasks-U2 | Low | Accessibility | Assign dropdown lacks outside-click/role=option/aria-selected | Minor a11y/UX | Add ARIA + outside-click close | `moving-plan-detail-client.tsx:642-674` |
| moving-tasks-U3 | Info | UI/UX | Hardcoded English task action strings bypass i18n | Untranslated for es-US | Route through next-intl | `moving-plan-detail-client.tsx:252,498-507,685-702` |
| moving-tasks-T1 | Low | Test | No tests for lifecycle, classifier, complete-with-effects, prune | Regressions ship silently | Add unit/integration tests (§17) | `move-task-*.ts` |

## 19. Module TODO

- [ ] **moving-tasks-01 (High)** Prune stale CLASSIFIER tasks after sync. Reason: orphaned tasks fire reminders. Related: `move-task-generation.ts`, `move-task-sync.ts`. Fix: after building the regenerated key set, soft-delete open CLASSIFIER tasks for the plan not in that set. Dependencies: reminder cron behavior. Complexity: med. Risk: med (must not delete user-completed/edited tasks).
- [ ] **moving-tasks-02 (Medium)** Handle destination-state change. Reason: new-key duplicates. Related: idempotency key builders. Fix: prune-on-route-change or re-anchor key. Complexity: med. Risk: med.
- [ ] **moving-tasks-03 (Medium)** Add optimistic status guard + DB unique constraint to COMPLETE. Reason: concurrent double-complete. Related: `move-task-local-effects.ts`, schema. Fix: gate side effects with `updateMany where status notIn terminal` count; unique index on destination service. Complexity: med. Risk: med.
- [ ] **moving-tasks-04 (Medium)** Gate reminder cron by entitlement (or relax view gate). Reason: consistency. Related: `cron/task-reminders/route.ts`, `plan-limits.ts`. Fix: join entitlement snapshot into candidate query. Complexity: med. Risk: low.
- [ ] **moving-tasks-06 (Medium)** Migrate migration route to workspace scope + scoped entitlement. Reason: broken member access / inconsistent auth. Related: `api/moving/migration/route.ts`. Fix: `resolveWorkspaceDataScope` + `assertScopedRecordAction` + `activeTrackedServiceWhereForScope` + `planLimitScopeForDataScope`. Complexity: low. Risk: low.
- [ ] **moving-tasks-09 (Medium)** Cache/limit provider enrichment per sync. Reason: latency/cost. Related: `move-task-generation.ts`, `provider-serviceability.ts`. Fix: enrich top-N or memoize per (plan,dest). Complexity: med. Risk: med.
- [ ] **moving-tasks-05/07/08/10/U2/U3/T1 (Low/Info)** UTC-normalize due dates; toast on status failure; document/adjust ownership cascade; batch sync queries; a11y on assign dropdown; i18n hardcoded strings; add tests. Complexity: low–med. Risk: low.
