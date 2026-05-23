-- Capture the reason a user gave when cancelling renewal / trial so the
-- product team can analyse churn drivers and target save-flow offers.
-- Both columns are nullable: existing rows have no reason recorded, and a
-- user can also dismiss the survey and proceed with the cancellation.
ALTER TABLE `Subscription`
  ADD COLUMN `cancelReason` VARCHAR(40) NULL,
  ADD COLUMN `cancelReasonComment` VARCHAR(500) NULL;

CREATE INDEX `Subscription_cancelReason_idx` ON `Subscription` (`cancelReason`);
