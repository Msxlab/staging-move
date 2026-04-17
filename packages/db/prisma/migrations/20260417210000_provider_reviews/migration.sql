-- PR-C: Per-user provider ratings, with upsert via unique (userId, providerId).
-- Each row is one user's single rating for one provider. Aggregate columns
-- (`ServiceProvider.avgRating`, `ServiceProvider.reviewCount`) are refreshed
-- by the reviews endpoint after each upsert.
CREATE TABLE `ProviderReview` (
  `id` VARCHAR(30) NOT NULL,
  `userId` VARCHAR(30) NOT NULL,
  `providerId` VARCHAR(30) NOT NULL,
  `rating` INT NOT NULL,
  `comment` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `ProviderReview_userId_providerId_key` (`userId`, `providerId`),
  INDEX `ProviderReview_providerId_idx` (`providerId`),
  INDEX `ProviderReview_userId_idx` (`userId`),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ProviderReview`
  ADD CONSTRAINT `ProviderReview_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ProviderReview`
  ADD CONSTRAINT `ProviderReview_providerId_fkey`
  FOREIGN KEY (`providerId`) REFERENCES `ServiceProvider`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
