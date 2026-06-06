-- AddressChangeEvent (Faz 2 connector network). Additive only: one new table
-- (a single FK to User) plus one nullable FK column on ConnectorDispatch. No
-- existing column is altered or backfilled, so the new FK cannot violate on any
-- pre-existing row. Inert until FEATURE_API_CONNECTORS is enabled.

CREATE TABLE `AddressChangeEvent` (
  `id` VARCHAR(30) NOT NULL,
  `userId` VARCHAR(30) NOT NULL,
  `changeRef` VARCHAR(40) NOT NULL,
  `fromAddressId` VARCHAR(30) NULL,
  `toAddressId` VARCHAR(30) NOT NULL,
  `workspaceId` VARCHAR(30) NULL,
  `fullName` VARCHAR(200) NOT NULL,
  `effectiveDate` DATETIME(3) NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  `dispatchCount` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `AddressChangeEvent_changeRef_key` (`changeRef`),
  INDEX `AddressChangeEvent_userId_idx` (`userId`),
  INDEX `AddressChangeEvent_status_idx` (`status`),
  CONSTRAINT `AddressChangeEvent_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Link outbox rows to the event from now on. Nullable, and every existing row
-- stays NULL, so adding the constraint is safe on current data.
ALTER TABLE `ConnectorDispatch`
  ADD COLUMN `addressChangeEventId` VARCHAR(30) NULL,
  ADD INDEX `ConnectorDispatch_addressChangeEventId_idx` (`addressChangeEventId`),
  ADD CONSTRAINT `ConnectorDispatch_addressChangeEventId_fkey`
    FOREIGN KEY (`addressChangeEventId`) REFERENCES `AddressChangeEvent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
