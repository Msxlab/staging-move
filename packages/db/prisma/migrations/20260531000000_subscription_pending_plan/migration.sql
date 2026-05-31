-- Persist the pending TARGET PLAN of a scheduled (deferred) downgrade so the
-- app/UI can show which tier the subscription will drop to at period end.
-- Previously only the pending billing interval was stored, so a tier downgrade
-- (e.g. PRO -> FAMILY) had no locally-recorded target after a reload.
ALTER TABLE `Subscription` ADD COLUMN `pendingPlan` VARCHAR(20) NULL;
