CREATE TABLE `OAuthState` (
  `id` VARCHAR(30) NOT NULL,
  `provider` VARCHAR(20) NOT NULL,
  `stateHash` VARCHAR(64) NOT NULL,
  `nonceHash` VARCHAR(64) NOT NULL,
  `redirectUri` VARCHAR(500) NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `consumedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `OAuthState_stateHash_key`(`stateHash`),
  INDEX `OAuthState_provider_expiresAt_idx`(`provider`, `expiresAt`),
  INDEX `OAuthState_provider_consumedAt_idx`(`provider`, `consumedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
