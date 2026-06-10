-- INSIGHTS / MOVERS FOUNDATION (IntegrationDailyStat + MovingCompany + SponsoredPlacement)
--
-- Additive & backward-compatible: adds THREE new tables, alters/drops nothing.
-- All three are deliberately FK-free (loose string refs only) so they stay
-- decoupled from the user/provider domain:
--
--   1. IntegrationDailyStat — one row per (UTC day, integration source) of
--      aggregated outcome counters for the external-data integrations (fcc,
--      electric, nri, radon, water, air, nws, briefing, dossier). Upserted by
--      fire-and-forget telemetry on the UNIQUE(day, source) key; statusCounts
--      is an open-ended JSON counter map ({"ok": n, "error": n, ...}).
--
--   2. MovingCompany — interstate household-goods movers from the public FMCSA
--      census, keyed by UNIQUE(usdotNumber) for importer upserts. Carriers that
--      drop out of the source flip active=false rather than being deleted.
--
--   3. SponsoredPlacement — admin-managed sponsored slot in a directory
--      listing; targetId loosely refs MovingCompany.id or ServiceProvider.id
--      per `kind`. Renders only while active AND within [startsAt, endsAt];
--      impressions/clicks are denormalized fire-and-forget counters.

-- CreateTable
CREATE TABLE `IntegrationDailyStat` (
    `id` VARCHAR(30) NOT NULL,
    `day` DATE NOT NULL,
    `source` VARCHAR(30) NOT NULL,
    `statusCounts` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `IntegrationDailyStat_source_day_idx`(`source`, `day`),
    UNIQUE INDEX `IntegrationDailyStat_day_source_key`(`day`, `source`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MovingCompany` (
    `id` VARCHAR(30) NOT NULL,
    `usdotNumber` INTEGER NOT NULL,
    `legalName` VARCHAR(255) NOT NULL,
    `dbaName` VARCHAR(255) NULL,
    `state` VARCHAR(2) NOT NULL,
    `city` VARCHAR(100) NULL,
    `phone` VARCHAR(30) NULL,
    `hhgAuthorization` BOOLEAN NOT NULL,
    `fleetSize` INTEGER NULL,
    `complaintCount2y` INTEGER NOT NULL DEFAULT 0,
    `safetyRating` VARCHAR(20) NULL,
    `dataAsOf` DATETIME(3) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MovingCompany_usdotNumber_key`(`usdotNumber`),
    INDEX `MovingCompany_state_idx`(`state`),
    INDEX `MovingCompany_state_city_idx`(`state`, `city`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SponsoredPlacement` (
    `id` VARCHAR(30) NOT NULL,
    `kind` VARCHAR(20) NOT NULL,
    `targetId` VARCHAR(30) NOT NULL,
    `label` VARCHAR(60) NOT NULL DEFAULT 'Sponsored',
    `categoryScope` VARCHAR(50) NULL,
    `stateScope` VARCHAR(2) NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NOT NULL,
    `active` BOOLEAN NOT NULL,
    `impressions` INTEGER NOT NULL DEFAULT 0,
    `clicks` INTEGER NOT NULL DEFAULT 0,
    `createdByAdminId` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SponsoredPlacement_kind_targetId_idx`(`kind`, `targetId`),
    INDEX `SponsoredPlacement_active_startsAt_endsAt_idx`(`active`, `startsAt`, `endsAt`),
    INDEX `SponsoredPlacement_stateScope_idx`(`stateScope`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
