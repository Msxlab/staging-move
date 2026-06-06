-- AlterTable: add a normalized dedupe key for in-app notifications
ALTER TABLE `Notification`
    ADD COLUMN `dedupeKey` VARCHAR(191) NULL;

-- CreateIndex: atomic dedupe — one keyed notification per (user, channel, key).
-- NULL dedupeKey rows stay distinct in MySQL, so un-keyed notifications are
-- never collapsed.
CREATE UNIQUE INDEX `Notification_userId_channel_dedupeKey_key`
    ON `Notification`(`userId`, `channel`, `dedupeKey`);
