-- SERVICE COST LOG (MONEY LAYER — per-MONTH realized actuals)
--
-- Additive & backward-compatible. It adds ONE new table and alters/drops no
-- existing column or row:
--
--   1. ServiceCostLog — one row per (service, month). `month` is the first day
--      of the month at 00:00:00 UTC; `amount` is the ACTUAL per-cycle amount the
--      user logged for THAT month (same cycle semantics as Service.monthlyCost /
--      Service.actualMonthlyCost). A @@unique([serviceId, month]) makes this the
--      upsert key for "Log Actual Costs".
--
--      Until now the only "actual" was the single Service.actualMonthlyCost
--      scalar, which got overwritten on every confirm. That made the budget
--      month-stepper an illusion: stepping to a past month still showed the one
--      current number. With a row per month, each month shows its own real
--      logged amount, and a line with no row for the viewed month is "estimate
--      only" (excluded from that month's realized-actual / savings totals) — so
--      savings can never be fabricated for an unreconciled month.
--
-- BACKFILL: every Service that already has a non-NULL actualMonthlyCost gets a
-- single ServiceCostLog row for the CURRENT month (UTC), preserving the existing
-- confirmed actual so it keeps showing on the current month. Computed from
-- UTC_TIMESTAMP() so the bucket matches the engine's UTC month math, and guarded
-- by NOT EXISTS so re-running (or a partially-applied migration) never
-- double-inserts. No existing data is changed; Service.actualMonthlyCost is left
-- in place as a legacy mirror.

-- CreateTable
CREATE TABLE `ServiceCostLog` (
    `id` VARCHAR(30) NOT NULL,
    `serviceId` VARCHAR(30) NOT NULL,
    `month` DATETIME(3) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ServiceCostLog_serviceId_idx`(`serviceId`),
    INDEX `ServiceCostLog_month_idx`(`month`),
    UNIQUE INDEX `ServiceCostLog_serviceId_month_key`(`serviceId`, `month`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ServiceCostLog` ADD CONSTRAINT `ServiceCostLog_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `Service`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: copy each existing Service.actualMonthlyCost into a current-month
-- ServiceCostLog row. We reuse the serviceId as the new row's id: it is already
-- unique and fits the VARCHAR(30) PK, there is exactly one backfill row per
-- service (the current month) on a brand-new table so it cannot collide, and the
-- UNIQUE(serviceId, month) plus NOT EXISTS guard make a re-apply a no-op.
-- `month` is the UTC first-of-month at 00:00:00.
INSERT INTO `ServiceCostLog` (`id`, `serviceId`, `month`, `amount`, `createdAt`, `updatedAt`)
SELECT
    `s`.`id` AS `id`,
    `s`.`id` AS `serviceId`,
    DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-01 00:00:00') AS `month`,
    `s`.`actualMonthlyCost` AS `amount`,
    UTC_TIMESTAMP(3) AS `createdAt`,
    UTC_TIMESTAMP(3) AS `updatedAt`
FROM `Service` AS `s`
WHERE `s`.`actualMonthlyCost` IS NOT NULL
  AND `s`.`deletedAt` IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM `ServiceCostLog` AS `existing`
      WHERE `existing`.`serviceId` = `s`.`id`
        AND `existing`.`month` = DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-01 00:00:00')
  );
