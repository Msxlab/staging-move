-- CreateTable
CREATE TABLE `AddressDataCacheEntry` (
    `id` VARCHAR(30) NOT NULL,
    `geoKey` VARCHAR(120) NOT NULL,
    `section` VARCHAR(24) NOT NULL,
    `status` VARCHAR(12) NOT NULL,
    `dataJson` TEXT NOT NULL,
    `fetchedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AddressDataCacheEntry_geoKey_key`(`geoKey`),
    INDEX `AddressDataCacheEntry_section_expiresAt_idx`(`section`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Lead` (
    `id` VARCHAR(30) NOT NULL,
    `category` VARCHAR(40) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `status` VARCHAR(24) NOT NULL DEFAULT 'NEW',
    `fromZip` VARCHAR(10) NULL,
    `toZip` VARCHAR(10) NULL,
    `fromState` VARCHAR(2) NULL,
    `toState` VARCHAR(2) NULL,
    `moveDate` DATETIME(3) NULL,
    `homeSize` VARCHAR(24) NULL,
    `payloadEncrypted` TEXT NOT NULL,
    `source` VARCHAR(60) NULL,
    `clickToken` VARCHAR(60) NULL,
    `matchedCount` INTEGER NOT NULL DEFAULT 0,
    `idempotencyKey` VARCHAR(120) NOT NULL,
    `ipHash` VARCHAR(64) NULL,
    `userAgent` VARCHAR(500) NULL,
    `locale` VARCHAR(10) NULL,
    `consentAcceptedAt` DATETIME(3) NULL,
    `consentIpHash` VARCHAR(64) NULL,
    `consentUserAgentHash` VARCHAR(64) NULL,
    `termsVersion` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Lead_idempotencyKey_key`(`idempotencyKey`),
    INDEX `Lead_category_status_idx`(`category`, `status`),
    INDEX `Lead_userId_idx`(`userId`),
    INDEX `Lead_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeadDispatch` (
    `id` VARCHAR(30) NOT NULL,
    `leadId` VARCHAR(30) NOT NULL,
    `partnerKind` VARCHAR(24) NOT NULL DEFAULT 'mover_application',
    `partnerId` VARCHAR(30) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
    `idempotencyKey` VARCHAR(120) NOT NULL,
    `attemptCount` INTEGER NOT NULL DEFAULT 0,
    `lastErrorCode` VARCHAR(30) NULL,
    `nextRetryAt` DATETIME(3) NULL,
    `sentAt` DATETIME(3) NULL,
    `cplCents` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LeadDispatch_idempotencyKey_key`(`idempotencyKey`),
    INDEX `LeadDispatch_status_nextRetryAt_idx`(`status`, `nextRetryAt`),
    INDEX `LeadDispatch_leadId_idx`(`leadId`),
    INDEX `LeadDispatch_partnerKind_partnerId_idx`(`partnerKind`, `partnerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Partner` (
    `id` VARCHAR(30) NOT NULL,
    `category` VARCHAR(40) NOT NULL,
    `companyName` VARCHAR(255) NOT NULL,
    `contactName` VARCHAR(120) NOT NULL,
    `contactEmail` VARCHAR(191) NOT NULL,
    `contactPhone` VARCHAR(30) NULL,
    `website` VARCHAR(255) NULL,
    `serviceStates` VARCHAR(255) NOT NULL,
    `attestation` BOOLEAN NOT NULL DEFAULT false,
    `leadsOptIn` BOOLEAN NOT NULL DEFAULT false,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    `reviewNotes` TEXT NULL,
    `decisionMessage` TEXT NULL,
    `reviewedByAdminId` VARCHAR(30) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `stripeCustomerId` VARCHAR(40) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Partner_category_status_idx`(`category`, `status`),
    INDEX `Partner_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PartnerDocument` (
    `id` VARCHAR(30) NOT NULL,
    `partnerId` VARCHAR(30) NOT NULL,
    `docType` VARCHAR(24) NOT NULL,
    `storageKey` VARCHAR(255) NOT NULL,
    `fileName` VARCHAR(255) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PartnerDocument_partnerId_idx`(`partnerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PartnerPortalToken` (
    `id` VARCHAR(30) NOT NULL,
    `partnerId` VARCHAR(30) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(64) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `lastUsedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PartnerPortalToken_tokenHash_key`(`tokenHash`),
    INDEX `PartnerPortalToken_partnerId_idx`(`partnerId`),
    INDEX `PartnerPortalToken_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PartnerLedgerEntry` (
    `id` VARCHAR(30) NOT NULL,
    `partnerId` VARCHAR(30) NOT NULL,
    `kind` VARCHAR(20) NOT NULL,
    `amountCents` INTEGER NOT NULL,
    `currency` VARCHAR(10) NOT NULL DEFAULT 'usd',
    `leadDispatchId` VARCHAR(30) NULL,
    `periodKey` VARCHAR(7) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    `invoiceId` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PartnerLedgerEntry_leadDispatchId_key`(`leadDispatchId`),
    INDEX `PartnerLedgerEntry_partnerId_status_idx`(`partnerId`, `status`),
    INDEX `PartnerLedgerEntry_periodKey_status_idx`(`periodKey`, `status`),
    INDEX `PartnerLedgerEntry_invoiceId_idx`(`invoiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PartnerInvoice` (
    `id` VARCHAR(30) NOT NULL,
    `partnerId` VARCHAR(30) NOT NULL,
    `periodKey` VARCHAR(7) NOT NULL,
    `totalCents` INTEGER NOT NULL DEFAULT 0,
    `currency` VARCHAR(10) NOT NULL DEFAULT 'usd',
    `status` VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    `stripeInvoiceId` VARCHAR(60) NULL,
    `issuedAt` DATETIME(3) NULL,
    `paidAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PartnerInvoice_status_idx`(`status`),
    UNIQUE INDEX `PartnerInvoice_partnerId_periodKey_key`(`partnerId`, `periodKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `LeadDispatch` ADD CONSTRAINT `LeadDispatch_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PartnerDocument` ADD CONSTRAINT `PartnerDocument_partnerId_fkey` FOREIGN KEY (`partnerId`) REFERENCES `Partner`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

