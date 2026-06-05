-- Affiliate revenue layer (Layer 1). Additive only: three nullable/defaulted
-- columns on ServiceProvider plus one new attribution table. No existing column
-- is altered or backfilled. Inert until a provider has affiliateActive=true and
-- a valid https affiliateUrl.

ALTER TABLE `ServiceProvider`
  ADD COLUMN `affiliateUrl` VARCHAR(500) NULL,
  ADD COLUMN `affiliateNetwork` VARCHAR(40) NULL,
  ADD COLUMN `affiliateActive` BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE `AffiliateClick` (
  `id` VARCHAR(30) NOT NULL,
  `userId` VARCHAR(30) NOT NULL,
  `providerId` VARCHAR(30) NOT NULL,
  `addressId` VARCHAR(30) NULL,
  `source` VARCHAR(40) NOT NULL,
  `network` VARCHAR(40) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `AffiliateClick_providerId_idx` (`providerId`),
  INDEX `AffiliateClick_userId_idx` (`userId`),
  INDEX `AffiliateClick_createdAt_idx` (`createdAt`),
  CONSTRAINT `AffiliateClick_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `AffiliateClick_providerId_fkey`
    FOREIGN KEY (`providerId`) REFERENCES `ServiceProvider`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
