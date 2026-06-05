-- ConnectorFallbackAction (Faz 2 connector network). Additive only: one new
-- config table (no FK, no existing column touched). DB-backed guided/fallback
-- actions layer OVER the in-code defaults, so an empty table keeps the shipped
-- behavior. Inert until a row is added and the resolver reads it.

CREATE TABLE `ConnectorFallbackAction` (
  `id` VARCHAR(30) NOT NULL,
  `actionKey` VARCHAR(80) NOT NULL,
  `connectorKey` VARCHAR(40) NOT NULL,
  `type` VARCHAR(20) NOT NULL DEFAULT 'DEEP_LINK',
  `label` VARCHAR(120) NOT NULL,
  `helperText` TEXT NOT NULL,
  `urlTemplate` TEXT NULL,
  `locale` VARCHAR(10) NOT NULL DEFAULT 'en',
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `ConnectorFallbackAction_actionKey_key` (`actionKey`),
  INDEX `ConnectorFallbackAction_connectorKey_idx` (`connectorKey`),
  INDEX `ConnectorFallbackAction_enabled_idx` (`enabled`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
