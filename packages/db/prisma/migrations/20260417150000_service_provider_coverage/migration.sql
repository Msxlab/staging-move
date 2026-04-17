-- CreateTable
CREATE TABLE `ServiceProviderCoverage` (
    `id` VARCHAR(30) NOT NULL,
    `providerId` VARCHAR(30) NOT NULL,
    `state` VARCHAR(2) NULL,
    `zipPrefix` VARCHAR(5) NULL,
    `zipExact` VARCHAR(10) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ServiceProviderCoverage_state_zipPrefix_idx`(`state`, `zipPrefix`),
    INDEX `ServiceProviderCoverage_zipExact_idx`(`zipExact`),
    INDEX `ServiceProviderCoverage_providerId_idx`(`providerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ServiceProviderCoverage` ADD CONSTRAINT `ServiceProviderCoverage_providerId_fkey` FOREIGN KEY (`providerId`) REFERENCES `ServiceProvider`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
