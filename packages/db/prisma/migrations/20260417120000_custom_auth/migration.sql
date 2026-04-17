-- Phase D: Clerk → custom JWT auth.
--
-- * User.clerkId  → DROP (replaced by UserLoginSession + OAuthAccount)
-- * User.passwordHash, emailVerifiedAt, mfaEnabled, mfaSecret, mfaBackupCodes,
--   imageUrl                                              → ADD
-- * Create OAuthAccount         (Google/Apple linkage)
-- * Create UserLoginSession     (JWT-tracked sessions)
-- * Create PasswordResetToken   (1-hour tokens)
-- * Create EmailVerificationToken (24-hour tokens)
--
-- DATA LOSS: dropping `clerkId` breaks the link to Clerk users. Since the
-- product has only test users before rollout, this is acceptable.

-- ── 1) Drop clerkId column ─────────────────────────────────────
-- Drop its unique index and the column itself.
ALTER TABLE `User` DROP INDEX `User_clerkId_key`;
ALTER TABLE `User` DROP INDEX `User_clerkId_idx`;
ALTER TABLE `User` DROP COLUMN `clerkId`;

-- ── 2) Add new columns to User ─────────────────────────────────
ALTER TABLE `User`
  ADD COLUMN `imageUrl` VARCHAR(500) NULL,
  ADD COLUMN `passwordHash` VARCHAR(255) NULL,
  ADD COLUMN `emailVerifiedAt` DATETIME(3) NULL,
  ADD COLUMN `mfaEnabled` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `mfaSecret` TEXT NULL,
  ADD COLUMN `mfaBackupCodes` TEXT NULL;

-- ── 3) OAuthAccount ────────────────────────────────────────────
CREATE TABLE `OAuthAccount` (
  `id`          VARCHAR(30) NOT NULL,
  `userId`      VARCHAR(30) NOT NULL,
  `provider`    VARCHAR(20) NOT NULL,
  `providerId`  VARCHAR(255) NOT NULL,
  `createdAt`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE INDEX `OAuthAccount_provider_providerId_key` (`provider`, `providerId`),
  INDEX `OAuthAccount_userId_idx` (`userId`),
  CONSTRAINT `OAuthAccount_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 4) UserLoginSession ────────────────────────────────────────
CREATE TABLE `UserLoginSession` (
  `id`           VARCHAR(30) NOT NULL,
  `userId`       VARCHAR(30) NOT NULL,
  `tokenHash`    VARCHAR(64) NOT NULL,
  `ipAddress`    VARCHAR(45) NULL,
  `userAgent`    VARCHAR(500) NULL,
  `browser`      VARCHAR(50) NULL,
  `os`           VARCHAR(50) NULL,
  `deviceType`   VARCHAR(30) NULL,
  `isActive`     BOOLEAN NOT NULL DEFAULT true,
  `expiresAt`    DATETIME(3) NOT NULL,
  `lastActivity` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE INDEX `UserLoginSession_tokenHash_key` (`tokenHash`),
  INDEX `UserLoginSession_userId_idx` (`userId`),
  INDEX `UserLoginSession_tokenHash_idx` (`tokenHash`),
  INDEX `UserLoginSession_expiresAt_idx` (`expiresAt`),
  CONSTRAINT `UserLoginSession_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 5) PasswordResetToken ──────────────────────────────────────
CREATE TABLE `PasswordResetToken` (
  `id`        VARCHAR(30) NOT NULL,
  `userId`    VARCHAR(30) NOT NULL,
  `tokenHash` VARCHAR(64) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `usedAt`    DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE INDEX `PasswordResetToken_tokenHash_key` (`tokenHash`),
  INDEX `PasswordResetToken_userId_idx` (`userId`),
  INDEX `PasswordResetToken_expiresAt_idx` (`expiresAt`),
  CONSTRAINT `PasswordResetToken_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 6) EmailVerificationToken ──────────────────────────────────
CREATE TABLE `EmailVerificationToken` (
  `id`          VARCHAR(30) NOT NULL,
  `userId`      VARCHAR(30) NOT NULL,
  `email`       VARCHAR(191) NOT NULL,
  `tokenHash`   VARCHAR(64) NOT NULL,
  `expiresAt`   DATETIME(3) NOT NULL,
  `consumedAt`  DATETIME(3) NULL,
  `createdAt`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE INDEX `EmailVerificationToken_tokenHash_key` (`tokenHash`),
  INDEX `EmailVerificationToken_userId_idx` (`userId`),
  INDEX `EmailVerificationToken_expiresAt_idx` (`expiresAt`),
  CONSTRAINT `EmailVerificationToken_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
