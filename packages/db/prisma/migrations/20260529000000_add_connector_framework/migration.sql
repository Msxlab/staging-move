-- Connector framework (Faz 2, flag-gated). Additive only — three new tables,
-- one FK to User and one self-FK; no existing table is altered. Inert until
-- FEATURE_API_CONNECTORS is enabled and a ConnectorConfig row is turned on.

CREATE TABLE `PartnerConsent` (
  `id` VARCHAR(30) NOT NULL,
  `userId` VARCHAR(30) NOT NULL,
  `connectorKey` VARCHAR(40) NOT NULL,
  `scopesJson` TEXT NOT NULL,
  `status` VARCHAR(20) NOT NULL,
  `revocationReason` VARCHAR(40) NULL,
  `grantedAt` DATETIME(3) NOT NULL,
  `revokedAt` DATETIME(3) NULL,
  `expiresAt` DATETIME(3) NULL,
  `tokenEncrypted` TEXT NULL,
  `tokenExpiresAt` DATETIME(3) NULL,
  `consentSnapshotJson` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  INDEX `PartnerConsent_userId_status_idx` (`userId`, `status`),
  INDEX `PartnerConsent_connectorKey_status_idx` (`connectorKey`, `status`),
  INDEX `PartnerConsent_status_expiresAt_idx` (`status`, `expiresAt`),
  CONSTRAINT `PartnerConsent_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ConnectorConfig` (
  `id` VARCHAR(30) NOT NULL,
  `connectorKey` VARCHAR(40) NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT false,
  `rolloutPercent` INTEGER NOT NULL DEFAULT 0,
  `circuitState` VARCHAR(20) NOT NULL DEFAULT 'CLOSED',
  `stage` VARCHAR(20) NOT NULL DEFAULT 'SHADOW',
  `version` VARCHAR(20) NOT NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `ConnectorConfig_connectorKey_key` (`connectorKey`),
  INDEX `ConnectorConfig_enabled_idx` (`enabled`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ConnectorDispatch` (
  `id` VARCHAR(30) NOT NULL,
  `connectorKey` VARCHAR(40) NOT NULL,
  `userId` VARCHAR(30) NOT NULL,
  `consentId` VARCHAR(30) NULL,
  `eventId` VARCHAR(30) NULL,
  `serviceId` VARCHAR(30) NULL,
  `idempotencyKey` VARCHAR(120) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
  `attemptCount` INTEGER NOT NULL DEFAULT 0,
  `lastErrorCode` VARCHAR(30) NULL,
  `confirmationEncrypted` TEXT NULL,
  `resultMetadataJson` TEXT NULL,
  `nextRetryAt` DATETIME(3) NULL,
  `dispatchedAt` DATETIME(3) NULL,
  `confirmedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `ConnectorDispatch_idempotencyKey_key` (`idempotencyKey`),
  INDEX `ConnectorDispatch_connectorKey_status_idx` (`connectorKey`, `status`),
  INDEX `ConnectorDispatch_userId_idx` (`userId`),
  INDEX `ConnectorDispatch_status_nextRetryAt_idx` (`status`, `nextRetryAt`),
  INDEX `ConnectorDispatch_consentId_idx` (`consentId`),
  CONSTRAINT `ConnectorDispatch_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ConnectorDispatch_consentId_fkey`
    FOREIGN KEY (`consentId`) REFERENCES `PartnerConsent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
