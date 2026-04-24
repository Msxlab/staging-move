-- Current-product move task tracking.
-- Tasks are manual LocateFlow guidance and local state tracking only.

CREATE TABLE `MoveTask` (
  `id` VARCHAR(30) NOT NULL,
  `userId` VARCHAR(30) NOT NULL,
  `movingPlanId` VARCHAR(30) NOT NULL,
  `serviceId` VARCHAR(30) NULL,
  `originAddressId` VARCHAR(30) NULL,
  `destinationAddressId` VARCHAR(30) NULL,
  `providerId` VARCHAR(30) NULL,
  `destinationProviderId` VARCHAR(30) NULL,
  `actionType` VARCHAR(40) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'SUGGESTED',
  `source` VARCHAR(20) NOT NULL DEFAULT 'CLASSIFIER',
  `title` VARCHAR(200) NOT NULL,
  `description` TEXT NULL,
  `reason` TEXT NULL,
  `caveats` JSON NULL,
  `confidence` VARCHAR(20) NOT NULL DEFAULT 'UNVERIFIED',
  `dueDate` DATETIME(3) NULL,
  `acceptedAt` DATETIME(3) NULL,
  `completedAt` DATETIME(3) NULL,
  `dismissedAt` DATETIME(3) NULL,
  `reopenedAt` DATETIME(3) NULL,
  `completedByUserId` VARCHAR(30) NULL,
  `lastStatusChangedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `localEffect` JSON NULL,
  `metadata` JSON NULL,
  `idempotencyKey` VARCHAR(191) NULL,
  `notes` TEXT NULL,
  `deletedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `MoveTask_userId_idempotencyKey_key` (`userId`, `idempotencyKey`),
  INDEX `MoveTask_userId_idx` (`userId`),
  INDEX `MoveTask_movingPlanId_idx` (`movingPlanId`),
  INDEX `MoveTask_status_idx` (`status`),
  INDEX `MoveTask_actionType_idx` (`actionType`),
  INDEX `MoveTask_dueDate_idx` (`dueDate`),
  INDEX `MoveTask_serviceId_idx` (`serviceId`),
  INDEX `MoveTask_providerId_idx` (`providerId`),
  INDEX `MoveTask_destinationProviderId_idx` (`destinationProviderId`),
  INDEX `MoveTask_deletedAt_idx` (`deletedAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `MoveTask_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `MoveTask_movingPlanId_fkey`
    FOREIGN KEY (`movingPlanId`) REFERENCES `MovingPlan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `MoveTask_serviceId_fkey`
    FOREIGN KEY (`serviceId`) REFERENCES `Service`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `MoveTask_originAddressId_fkey`
    FOREIGN KEY (`originAddressId`) REFERENCES `Address`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `MoveTask_destinationAddressId_fkey`
    FOREIGN KEY (`destinationAddressId`) REFERENCES `Address`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `MoveTask_providerId_fkey`
    FOREIGN KEY (`providerId`) REFERENCES `ServiceProvider`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `MoveTask_destinationProviderId_fkey`
    FOREIGN KEY (`destinationProviderId`) REFERENCES `ServiceProvider`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
