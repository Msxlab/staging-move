-- User-created local provider records.
-- These are private user records for manual tracking, not global provider catalog entries.

CREATE TABLE `UserCustomProvider` (
  `id` VARCHAR(30) NOT NULL,
  `userId` VARCHAR(30) NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `category` VARCHAR(50) NOT NULL,
  `description` TEXT NULL,
  `website` VARCHAR(500) NULL,
  `phone` VARCHAR(30) NULL,
  `email` VARCHAR(191) NULL,
  `addressLine1` VARCHAR(200) NULL,
  `addressLine2` VARCHAR(200) NULL,
  `city` VARCHAR(100) NULL,
  `state` VARCHAR(2) NULL,
  `zipCode` VARCHAR(10) NULL,
  `notes` TEXT NULL,
  `providerType` VARCHAR(40) NOT NULL DEFAULT 'OTHER',
  `trustStatus` VARCHAR(40) NOT NULL DEFAULT 'USER_CUSTOM',
  `adminReviewStatus` VARCHAR(40) NOT NULL DEFAULT 'NOT_REVIEWED',
  `linkedServiceProviderId` VARCHAR(30) NULL,
  `deletedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `UserCustomProvider_userId_idx` (`userId`),
  INDEX `UserCustomProvider_category_idx` (`category`),
  INDEX `UserCustomProvider_providerType_idx` (`providerType`),
  INDEX `UserCustomProvider_adminReviewStatus_idx` (`adminReviewStatus`),
  INDEX `UserCustomProvider_linkedServiceProviderId_idx` (`linkedServiceProviderId`),
  INDEX `UserCustomProvider_deletedAt_idx` (`deletedAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `UserCustomProvider_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `UserCustomProvider_linkedServiceProviderId_fkey`
    FOREIGN KEY (`linkedServiceProviderId`) REFERENCES `ServiceProvider`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Service`
  ADD COLUMN `customProviderId` VARCHAR(30) NULL;

CREATE INDEX `Service_customProviderId_idx`
  ON `Service`(`customProviderId`);

ALTER TABLE `Service`
  ADD CONSTRAINT `Service_customProviderId_fkey`
    FOREIGN KEY (`customProviderId`) REFERENCES `UserCustomProvider`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `MoveTask`
  ADD COLUMN `customProviderId` VARCHAR(30) NULL;

CREATE INDEX `MoveTask_customProviderId_idx`
  ON `MoveTask`(`customProviderId`);

ALTER TABLE `MoveTask`
  ADD CONSTRAINT `MoveTask_customProviderId_fkey`
    FOREIGN KEY (`customProviderId`) REFERENCES `UserCustomProvider`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
