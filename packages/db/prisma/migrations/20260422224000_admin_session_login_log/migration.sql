-- Add admin session and login audit tables.
-- These models exist in the Prisma schema, but older baseline deployments may
-- have marked migrations as applied before the tables were introduced.

CREATE TABLE IF NOT EXISTS `AdminSession` (
  `id` VARCHAR(30) NOT NULL,
  `adminUserId` VARCHAR(30) NOT NULL,
  `tokenHash` VARCHAR(64) NOT NULL,
  `ipAddress` VARCHAR(45) NULL,
  `userAgent` VARCHAR(500) NULL,
  `browser` VARCHAR(50) NULL,
  `os` VARCHAR(50) NULL,
  `deviceType` VARCHAR(20) NULL,
  `country` VARCHAR(50) NULL,
  `city` VARCHAR(100) NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `lastActivity` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expiresAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `AdminSession_adminUserId_idx` (`adminUserId` ASC),
  INDEX `AdminSession_tokenHash_idx` (`tokenHash` ASC),
  INDEX `AdminSession_isActive_idx` (`isActive` ASC),
  INDEX `AdminSession_expiresAt_idx` (`expiresAt` ASC),
  PRIMARY KEY (`id` ASC),
  CONSTRAINT `AdminSession_adminUserId_fkey`
    FOREIGN KEY (`adminUserId`) REFERENCES `AdminUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `AdminLoginLog` (
  `id` VARCHAR(30) NOT NULL,
  `adminUserId` VARCHAR(30) NULL,
  `email` VARCHAR(191) NOT NULL,
  `success` BOOLEAN NOT NULL DEFAULT false,
  `failReason` VARCHAR(50) NULL,
  `ipAddress` VARCHAR(45) NULL,
  `userAgent` VARCHAR(500) NULL,
  `browser` VARCHAR(50) NULL,
  `os` VARCHAR(50) NULL,
  `country` VARCHAR(50) NULL,
  `city` VARCHAR(100) NULL,
  `mfaUsed` BOOLEAN NOT NULL DEFAULT false,
  `mfaMethod` VARCHAR(20) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `AdminLoginLog_adminUserId_createdAt_idx` (`adminUserId` ASC, `createdAt` ASC),
  INDEX `AdminLoginLog_email_createdAt_idx` (`email` ASC, `createdAt` ASC),
  INDEX `AdminLoginLog_ipAddress_idx` (`ipAddress` ASC),
  INDEX `AdminLoginLog_success_idx` (`success` ASC),
  PRIMARY KEY (`id` ASC),
  CONSTRAINT `AdminLoginLog_adminUserId_fkey`
    FOREIGN KEY (`adminUserId`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
