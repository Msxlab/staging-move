-- MOVER SELF-SERVICE PORTAL v1 (MoverApplication + MoverDocument)
--
-- Additive & backward-compatible: adds TWO new tables, alters/drops nothing.
-- A moving company applies via the public portal, uploads proof documents, and
-- lands in an admin verification queue (PENDING -> IN_REVIEW -> APPROVED |
-- REJECTED | NEEDS_INFO). On approval the application is linked to a
-- MovingCompany row (loose string ref linkedMovingCompanyId — no FK, matching
-- the SponsoredPlacement decoupling). The only FK is MoverDocument ->
-- MoverApplication (ON DELETE CASCADE), so deleting an application removes its
-- uploaded-document metadata rows (the R2 objects are cleaned up separately).

-- CreateTable
CREATE TABLE `MoverApplication` (
    `id` VARCHAR(30) NOT NULL,
    `companyLegalName` VARCHAR(255) NOT NULL,
    `dbaName` VARCHAR(255) NULL,
    `usdotNumber` INTEGER NOT NULL,
    `mcNumber` VARCHAR(20) NULL,
    `contactName` VARCHAR(120) NOT NULL,
    `contactEmail` VARCHAR(191) NOT NULL,
    `contactPhone` VARCHAR(30) NULL,
    `website` VARCHAR(255) NULL,
    `serviceStates` VARCHAR(255) NOT NULL,
    `services` VARCHAR(255) NOT NULL,
    `fleetSize` INTEGER NULL,
    `yearsInBusiness` INTEGER NULL,
    `attestation` BOOLEAN NOT NULL DEFAULT false,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    `fmcsaAuthorityActive` BOOLEAN NULL,
    `fmcsaHhgAuthorized` BOOLEAN NULL,
    `fmcsaComplaintCount` INTEGER NULL,
    `fmcsaSafetyRating` VARCHAR(20) NULL,
    `fmcsaCheckedAt` DATETIME(3) NULL,
    `reviewNotes` TEXT NULL,
    `decisionMessage` TEXT NULL,
    `reviewedByAdminId` VARCHAR(30) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `linkedMovingCompanyId` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MoverApplication_status_idx`(`status`),
    INDEX `MoverApplication_usdotNumber_idx`(`usdotNumber`),
    INDEX `MoverApplication_contactEmail_idx`(`contactEmail`),
    INDEX `MoverApplication_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MoverDocument` (
    `id` VARCHAR(30) NOT NULL,
    `applicationId` VARCHAR(30) NOT NULL,
    `kind` VARCHAR(30) NOT NULL,
    `fileName` VARCHAR(255) NOT NULL,
    `objectKey` VARCHAR(400) NOT NULL,
    `contentType` VARCHAR(120) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MoverDocument_applicationId_idx`(`applicationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MoverDocument` ADD CONSTRAINT `MoverDocument_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `MoverApplication`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
