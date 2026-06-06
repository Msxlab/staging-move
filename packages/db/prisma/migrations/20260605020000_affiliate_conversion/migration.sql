-- Affiliate conversion / revenue layer. Additive only: one new table plus one
-- composite index on AffiliateClick for windowed dashboard aggregation. No
-- existing column is altered. Inert until a partner posts back a conversion.

CREATE INDEX `AffiliateClick_providerId_createdAt_idx` ON `AffiliateClick` (`providerId`, `createdAt`);

CREATE TABLE `AffiliateConversion` (
  `id` VARCHAR(30) NOT NULL,
  `affiliateClickId` VARCHAR(30) NULL,
  `providerId` VARCHAR(30) NOT NULL,
  `network` VARCHAR(40) NOT NULL,
  `externalTransactionId` VARCHAR(191) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  `amountCents` INTEGER NOT NULL DEFAULT 0,
  `currency` VARCHAR(8) NOT NULL DEFAULT 'USD',
  `occurredAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `AffiliateConversion_network_externalTransactionId_key` (`network`, `externalTransactionId`),
  INDEX `AffiliateConversion_providerId_idx` (`providerId`),
  INDEX `AffiliateConversion_network_idx` (`network`),
  INDEX `AffiliateConversion_status_idx` (`status`),
  INDEX `AffiliateConversion_occurredAt_idx` (`occurredAt`),
  CONSTRAINT `AffiliateConversion_affiliateClickId_fkey`
    FOREIGN KEY (`affiliateClickId`) REFERENCES `AffiliateClick`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `AffiliateConversion_providerId_fkey`
    FOREIGN KEY (`providerId`) REFERENCES `ServiceProvider`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
