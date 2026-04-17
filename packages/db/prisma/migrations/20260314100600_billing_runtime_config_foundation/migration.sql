-- AlterTable
ALTER TABLE `Subscription` ADD COLUMN `appStoreEnvironment` VARCHAR(30) NULL,
    ADD COLUMN `billingProductId` VARCHAR(191) NULL,
    ADD COLUMN `currentPeriodEndsAt` DATETIME(3) NULL,
    ADD COLUMN `gracePeriodEndsAt` DATETIME(3) NULL,
    ADD COLUMN `lastSyncedAt` DATETIME(3) NULL,
    ADD COLUMN `lastValidatedAt` DATETIME(3) NULL,
    ADD COLUMN `latestTransactionId` VARCHAR(191) NULL,
    ADD COLUMN `originalTransactionId` VARCHAR(191) NULL,
    ADD COLUMN `platform` VARCHAR(20) NULL,
    ADD COLUMN `provider` VARCHAR(30) NOT NULL DEFAULT 'TRIAL',
    ADD COLUMN `purchaseToken` TEXT NULL;

-- CreateTable
CREATE TABLE `RuntimeConfigEntry` (
    `id` VARCHAR(30) NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `label` VARCHAR(120) NOT NULL,
    `description` VARCHAR(500) NULL,
    `scope` VARCHAR(20) NOT NULL DEFAULT 'GLOBAL',
    `category` VARCHAR(30) NOT NULL,
    `isSecret` BOOLEAN NOT NULL DEFAULT true,
    `valueEncrypted` TEXT NULL,
    `valuePlain` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `source` VARCHAR(20) NOT NULL DEFAULT 'ENV',
    `lastValidatedAt` DATETIME(3) NULL,
    `lastValidationStatus` VARCHAR(20) NULL,
    `rotationNotes` TEXT NULL,
    `updatedByAdminId` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `RuntimeConfigEntry_key_key`(`key`),
    INDEX `RuntimeConfigEntry_scope_category_idx`(`scope`, `category`),
    INDEX `RuntimeConfigEntry_isActive_idx`(`isActive`),
    INDEX `RuntimeConfigEntry_source_idx`(`source`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Subscription_originalTransactionId_key` ON `Subscription`(`originalTransactionId`);

-- CreateIndex
CREATE INDEX `Subscription_provider_status_idx` ON `Subscription`(`provider`, `status`);

-- CreateIndex
CREATE INDEX `Subscription_platform_provider_idx` ON `Subscription`(`platform`, `provider`);

-- CreateIndex
CREATE INDEX `Subscription_billingProductId_idx` ON `Subscription`(`billingProductId`);

-- CreateIndex
CREATE INDEX `Subscription_currentPeriodEndsAt_idx` ON `Subscription`(`currentPeriodEndsAt`);

-- AddForeignKey
ALTER TABLE `RuntimeConfigEntry` ADD CONSTRAINT `RuntimeConfigEntry_updatedByAdminId_fkey` FOREIGN KEY (`updatedByAdminId`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;