# Adversarial Verification — moving-tasks-01

**Finding:** CLASSIFIER move tasks are never pruned when a service is removed or not regenerated
**Original severity:** High · **Category:** Reverse Logic
**Verdict:** CONFIRMED (core defect real; one secondary sub-claim overstated) · **Adjusted severity:** Medium

## What the claim asserts
`syncSuggestedMoveTasks` only upserts tasks for currently-tracked services; there is no pass that
soft-deletes open CLASSIFIER tasks that were not regenerated this run. The only retire paths are
plan CANCEL and plan DELETE. Result: removing a service (or a re-classification that changes the
idempotency key) leaves stale/duplicate open tasks that keep firing email/push/in-app reminders via
the `task-reminders` cron.

## Code I read and what it proves

### 1. The sync loop only ever upserts for currently-tracked services — never prunes
`apps/web/src/lib/move-task-generation.ts`
- `buildMoveTransitionContext` (lines 72-98) loads `existingServices` via
  `activeTrackedServiceWhereForScope(...)`. `transitionPlans` (lines 165-196) is `existingServices.map(...)`.
- `syncSuggestedMoveTasks` (lines 547-631) iterates **only** `context.transitionPlans` and upserts
  one CLASSIFIER row per currently-tracked service, then `persistChecklistTasks` for checklist items.
- A grep of the whole file for `updateMany|deleteMany|deletedAt: new Date|status: "DISMISSED"` returns
  **no matches**. Every `deletedAt` occurrence (lines 103, 450, 566) is a read-side `deletedAt: null`
  filter, never a write that retires a task. There is no "tasks not seen this run" pruning pass.

### 2. "Active tracked" excludes a removed service
`apps/web/src/lib/service-active.ts:11-19` — `ACTIVE_TRACKED_SERVICE_WHERE` requires
`deletedAt: null, isActive: true, deactivatedAt: null` and a non-cancel `migrationAction`. A
soft-deleted/deactivated/removed service therefore drops out of `existingServices`, so no
`transitionPlan` is produced for it, so its previously-created CLASSIFIER task is **never revisited**
and never retired.

### 3. The service DELETE handler does no move-task cleanup
`apps/web/src/app/api/services/[id]/route.ts:260-294` — DELETE soft-deletes the service
(`deletedAt`, `isActive: false`, `deactivatedAt`) and writes an audit log. It does **not** call any
move-task sync or pruning function. (Contrast PATCH at lines 233-240, which does call
`safeSyncMoveTasksForAddress` — but even that sync only iterates active services and so cannot retire
the now-removed service's task.)

### 4. The only retire paths are exactly the two named
`apps/web/src/app/api/moving/[id]/route.ts:116-126` (plan CANCEL → `moveTask.updateMany` setting
`deletedAt` for `source: "CLASSIFIER"`) and DELETE at lines 168+ (plan delete cascade). No per-service
retirement exists anywhere.

### 5. The cron keeps firing the orphaned task
`apps/web/src/app/api/cron/task-reminders/route.ts:86-97` selects tasks by `deletedAt: null`,
`status notIn [COMPLETED, DISMISSED]`, `user.deletedAt: null`, `movingPlan.deletedAt: null`. It has
**no** reference to `serviceId` or the linked service's active state (grep for `serviceId|service.`
returns no matches in the file). An orphaned open CLASSIFIER task therefore still matches and fires
email (line 173) + in-app (line 194) + push (line 213). `vercel.json:11-14` schedules this cron daily
at 08:00 UTC, so the impact recurs.

## Where the claim is overstated (the one refuted sub-point)
The claim's secondary mechanism — "classification changes to a different actionType, producing a new
idempotency key → accumulates **duplicate** tasks" — is mitigated for a same-service re-classification.
`move-task-generation.ts:559-571` is a serviceId backstop: when the idempotency-key lookup misses, it
`findFirst`s the prior open row by `(userId, movingPlanId, serviceId, source: "CLASSIFIER",
deletedAt: null, status notIn [COMPLETED, DISMISSED])` and updates it in place (lines 619-628). So an
actionType change on a still-tracked service re-keys the existing row rather than spawning a duplicate.
The "duplicate via re-key" half of the impact does not hold for same-service re-classification.

## Net assessment
The headline defect — open CLASSIFIER tasks for a **removed** service are never pruned and keep firing
reminders — is real and fully proven by source. The duplicate-accumulation sub-claim is partly
inaccurate. User-side mitigation exists: dismissing the task (status DISMISSED) is excluded by the cron
query, which stops the reminders. Blast radius is bounded to unwanted task reminders (no data loss, no
auth/security boundary crossed). Given the real but bounded impact plus the available user mitigation,
Medium is the defensible severity rather than High.

## Recommendation
On each `syncSuggestedMoveTasks` run, collect the set of idempotency keys / serviceIds produced this
run and soft-delete (set `deletedAt`) any open CLASSIFIER task for the plan whose service is no longer
in `existingServices` (i.e. a "retire not-regenerated" pass), mirroring the plan-CANCEL retire logic.
Additionally, have the service DELETE handler retire that service's open CLASSIFIER tasks directly.
