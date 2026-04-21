-- Soft-delete generalization + optimistic locking + DataConsent model.
-- Safe to run on an existing database: all new columns are nullable or have
-- defaults, and DataConsent is a net-new table.

-- ============ Soft-delete ============
ALTER TABLE `User` ADD COLUMN `deletedAt` DATETIME(3) NULL;
CREATE INDEX `User_deletedAt_idx` ON `User`(`deletedAt`);

ALTER TABLE `Task` ADD COLUMN `deletedAt` DATETIME(3) NULL;
CREATE INDEX `Task_deletedAt_idx` ON `Task`(`deletedAt`);

ALTER TABLE `Budget` ADD COLUMN `deletedAt` DATETIME(3) NULL;
CREATE INDEX `Budget_deletedAt_idx` ON `Budget`(`deletedAt`);

ALTER TABLE `ServiceProvider` ADD COLUMN `deletedAt` DATETIME(3) NULL;
CREATE INDEX `ServiceProvider_deletedAt_idx` ON `ServiceProvider`(`deletedAt`);

ALTER TABLE `ProviderReview` ADD COLUMN `deletedAt` DATETIME(3) NULL;
CREATE INDEX `ProviderReview_deletedAt_idx` ON `ProviderReview`(`deletedAt`);

-- ============ Optimistic locking ============
ALTER TABLE `ServiceProvider` ADD COLUMN `version` INT NOT NULL DEFAULT 1;
ALTER TABLE `MovingPlan` ADD COLUMN `version` INT NOT NULL DEFAULT 1;
ALTER TABLE `Subscription` ADD COLUMN `version` INT NOT NULL DEFAULT 1;

-- ============ DataConsent ============
CREATE TABLE `DataConsent` (
  `id`        VARCHAR(30)  NOT NULL,
  `userId`    VARCHAR(30)  NOT NULL,
  `category`  VARCHAR(20)  NOT NULL,
  `granted`   BOOLEAN      NOT NULL,
  `version`   VARCHAR(20)  NOT NULL,
  `ipAddress` VARCHAR(45)  NULL,
  `userAgent` VARCHAR(500) NULL,
  `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `DataConsent_userId_category_createdAt_idx` (`userId`, `category`, `createdAt`),
  INDEX `DataConsent_category_idx` (`category`),
  CONSTRAINT `DataConsent_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
