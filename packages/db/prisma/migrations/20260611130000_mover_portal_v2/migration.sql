-- MOVER SELF-SERVICE PORTAL v2 (MoverPortalToken)
--
-- Additive: one new table for the magic-link portal "session" token. The token
-- plaintext is never stored — only its sha256 hash (UNIQUE for O(1) lookup).
-- FK to MovingCompany ON DELETE CASCADE so revoking/removing a listed company
-- drops its portal tokens. No change to existing tables.

-- CreateTable
CREATE TABLE `MoverPortalToken` (
    `id` VARCHAR(30) NOT NULL,
    `movingCompanyId` VARCHAR(30) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(64) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `lastUsedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `MoverPortalToken_tokenHash_key`(`tokenHash`),
    INDEX `MoverPortalToken_movingCompanyId_idx`(`movingCompanyId`),
    INDEX `MoverPortalToken_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MoverPortalToken` ADD CONSTRAINT `MoverPortalToken_movingCompanyId_fkey` FOREIGN KEY (`movingCompanyId`) REFERENCES `MovingCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
