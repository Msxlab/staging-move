-- AlterTable
ALTER TABLE `EmailLog`
    ADD COLUMN `dedupeKey` VARCHAR(191) NULL,
    ADD COLUMN `providerMessageId` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `EmailLog_dedupeKey_key` ON `EmailLog`(`dedupeKey`);

-- CreateIndex
CREATE INDEX `EmailLog_providerMessageId_idx` ON `EmailLog`(`providerMessageId`);
