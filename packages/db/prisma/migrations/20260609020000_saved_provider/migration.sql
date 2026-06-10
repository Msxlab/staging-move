-- SAVED PROVIDER (per-user "save for later" shortlist)
--
-- Additive & backward-compatible: adds ONE new table, alters/drops nothing.
-- Replaces the client-only localStorage shortlist so saves survive device
-- switches. One row per (user, provider).

-- CreateTable
CREATE TABLE `SavedProvider` (
    `id` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `providerId` VARCHAR(30) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SavedProvider_userId_idx`(`userId`),
    UNIQUE INDEX `SavedProvider_userId_providerId_key`(`userId`, `providerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SavedProvider` ADD CONSTRAINT `SavedProvider_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SavedProvider` ADD CONSTRAINT `SavedProvider_providerId_fkey` FOREIGN KEY (`providerId`) REFERENCES `ServiceProvider`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
