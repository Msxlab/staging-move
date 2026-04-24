-- Current-product provider governance issue tracking.
-- These issues support quality queues and source-review backlog only.

CREATE TABLE `ProviderGovernanceIssue` (
  `id` VARCHAR(30) NOT NULL,
  `providerId` VARCHAR(30) NULL,
  `customProviderId` VARCHAR(30) NULL,
  `issueType` VARCHAR(60) NOT NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'OPEN',
  `severity` VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
  `title` VARCHAR(200) NOT NULL,
  `description` TEXT NULL,
  `metadata` JSON NULL,
  `reviewedByAdminId` VARCHAR(30) NULL,
  `reviewedAt` DATETIME(3) NULL,
  `dismissedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `ProviderGovernanceIssue_providerId_idx` (`providerId`),
  INDEX `ProviderGovernanceIssue_customProviderId_idx` (`customProviderId`),
  INDEX `ProviderGovernanceIssue_issueType_idx` (`issueType`),
  INDEX `ProviderGovernanceIssue_status_idx` (`status`),
  INDEX `ProviderGovernanceIssue_severity_idx` (`severity`),
  INDEX `ProviderGovernanceIssue_reviewedByAdminId_idx` (`reviewedByAdminId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ProviderGovernanceIssue_providerId_fkey`
    FOREIGN KEY (`providerId`) REFERENCES `ServiceProvider`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ProviderGovernanceIssue_customProviderId_fkey`
    FOREIGN KEY (`customProviderId`) REFERENCES `UserCustomProvider`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ProviderGovernanceIssue_reviewedByAdminId_fkey`
    FOREIGN KEY (`reviewedByAdminId`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
