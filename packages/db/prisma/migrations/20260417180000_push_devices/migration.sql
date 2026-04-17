-- F.8: push notifications — per-device Expo push tokens
CREATE TABLE `PushDevice` (
  `id` VARCHAR(30) NOT NULL,
  `userId` VARCHAR(30) NOT NULL,
  `token` VARCHAR(255) NOT NULL,
  `platform` VARCHAR(10) NOT NULL,
  `deviceName` VARCHAR(100) NULL,
  `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `PushDevice_token_key`(`token`),
  INDEX `PushDevice_userId_idx`(`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `PushDevice`
  ADD CONSTRAINT `PushDevice_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
