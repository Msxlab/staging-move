-- Track deferred Stripe billing interval changes, such as annual plans
-- scheduled to renew monthly at the already-paid period end.
ALTER TABLE `Subscription`
  ADD COLUMN `stripeSubscriptionScheduleId` VARCHAR(191) NULL,
  ADD COLUMN `pendingBillingInterval` VARCHAR(20) NULL,
  ADD COLUMN `pendingBillingIntervalEffectiveAt` DATETIME(3) NULL;

CREATE INDEX `Subscription_stripeSubscriptionScheduleId_idx`
  ON `Subscription`(`stripeSubscriptionScheduleId`);

CREATE INDEX `Subscription_pendingBillingIntervalEffectiveAt_idx`
  ON `Subscription`(`pendingBillingIntervalEffectiveAt`);
