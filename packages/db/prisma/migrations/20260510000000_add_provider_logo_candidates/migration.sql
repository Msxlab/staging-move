-- Reviewable provider logo candidates. Candidates are created by ingest/upload
-- flows and only publish to ServiceProvider.logoUrl after admin approval.
CREATE TABLE `ProviderLogoCandidate` (
    `id` VARCHAR(30) NOT NULL,
    `providerId` VARCHAR(30) NOT NULL,
    `source` VARCHAR(30) NOT NULL,
    `sourceUrl` VARCHAR(1000) NULL,
    `publicUrl` VARCHAR(500) NOT NULL,
    `objectKey` VARCHAR(500) NOT NULL,
    `contentType` VARCHAR(100) NOT NULL,
    `contentHash` VARCHAR(64) NOT NULL,
    `bytes` INTEGER NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    `confidence` VARCHAR(20) NULL,
    `notes` TEXT NULL,
    `createdByAdminId` VARCHAR(30) NULL,
    `reviewedByAdminId` VARCHAR(30) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProviderLogoCandidate_objectKey_key` (`objectKey`),
    INDEX `ProviderLogoCandidate_providerId_idx` (`providerId`),
    INDEX `ProviderLogoCandidate_status_idx` (`status`),
    INDEX `ProviderLogoCandidate_providerId_status_idx` (`providerId`, `status`),
    INDEX `ProviderLogoCandidate_providerId_status_contentHash_idx` (`providerId`, `status`, `contentHash`),
    PRIMARY KEY (`id`),
    CONSTRAINT `ProviderLogoCandidate_providerId_fkey`
      FOREIGN KEY (`providerId`) REFERENCES `ServiceProvider`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
