-- RECOMMENDATION FEEDBACK (per-user dismiss / not-relevant / snooze)
--
-- Additive & backward-compatible: adds ONE new table, alters/drops nothing.
-- One active row per (user, provider). The recommendations engine loads the
-- user's active feedback (permanent, or SNOOZE whose `until` is in the future)
-- and excludes those providers so it stops re-surfacing what the user rejected.

-- CreateTable
CREATE TABLE `RecommendationFeedback` (
    `id` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `providerId` VARCHAR(30) NOT NULL,
    `action` VARCHAR(20) NOT NULL,
    `until` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RecommendationFeedback_userId_idx`(`userId`),
    UNIQUE INDEX `RecommendationFeedback_userId_providerId_key`(`userId`, `providerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RecommendationFeedback` ADD CONSTRAINT `RecommendationFeedback_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RecommendationFeedback` ADD CONSTRAINT `RecommendationFeedback_providerId_fkey` FOREIGN KEY (`providerId`) REFERENCES `ServiceProvider`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
