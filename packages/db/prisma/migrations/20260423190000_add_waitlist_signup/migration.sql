-- CreateTable
CREATE TABLE `WaitlistSignup` (
    `id` VARCHAR(30) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `target` VARCHAR(30) NOT NULL,
    `source` VARCHAR(60) NULL,
    `note` TEXT NULL,
    `ipHash` VARCHAR(64) NULL,
    `userAgent` VARCHAR(500) NULL,
    `locale` VARCHAR(10) NULL,
    `userId` VARCHAR(30) NULL,
    `notifiedAt` DATETIME(3) NULL,
    `convertedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WaitlistSignup_target_createdAt_idx`(`target`, `createdAt`),
    INDEX `WaitlistSignup_userId_idx`(`userId`),
    UNIQUE INDEX `WaitlistSignup_email_target_key`(`email`, `target`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
