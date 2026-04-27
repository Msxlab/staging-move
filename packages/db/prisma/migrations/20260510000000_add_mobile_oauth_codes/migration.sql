CREATE TABLE `MobileOAuthCode` (
  `id` VARCHAR(30) NOT NULL,
  `userId` VARCHAR(30) NOT NULL,
  `codeHash` VARCHAR(64) NOT NULL,
  `provider` VARCHAR(20) NOT NULL,
  `redirectUri` VARCHAR(500) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `usedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE INDEX `MobileOAuthCode_codeHash_key` (`codeHash`),
  INDEX `MobileOAuthCode_userId_idx` (`userId`),
  INDEX `MobileOAuthCode_expiresAt_idx` (`expiresAt`),
  INDEX `MobileOAuthCode_usedAt_idx` (`usedAt`),
  CONSTRAINT `MobileOAuthCode_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
