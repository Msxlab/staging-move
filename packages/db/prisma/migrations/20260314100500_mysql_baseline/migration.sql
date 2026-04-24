-- CreateTable
CREATE TABLE `Address` (
    `id` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `type` VARCHAR(20) NOT NULL,
    `nickname` VARCHAR(50) NULL,
    `street` VARCHAR(200) NOT NULL,
    `street2` VARCHAR(200) NULL,
    `city` VARCHAR(100) NOT NULL,
    `state` VARCHAR(2) NOT NULL,
    `zip` VARCHAR(10) NOT NULL,
    `country` VARCHAR(10) NOT NULL DEFAULT 'USA',
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `ownership` VARCHAR(20) NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `placeId` VARCHAR(191) NULL,
    `formattedAddress` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `Address_deletedAt_idx`(`deletedAt` ASC),
    INDEX `Address_state_idx`(`state` ASC),
    INDEX `Address_userId_idx`(`userId` ASC),
    INDEX `Address_zip_idx`(`zip` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdminAuditLog` (
    `id` VARCHAR(30) NOT NULL,
    `adminUserId` VARCHAR(30) NOT NULL,
    `action` VARCHAR(20) NOT NULL,
    `entityType` VARCHAR(50) NOT NULL,
    `entityId` VARCHAR(30) NOT NULL,
    `changes` TEXT NULL,
    `ipAddress` VARCHAR(45) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AdminAuditLog_adminUserId_createdAt_idx`(`adminUserId` ASC, `createdAt` ASC),
    INDEX `AdminAuditLog_entityType_entityId_idx`(`entityType` ASC, `entityId` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdminPermission` (
    `id` VARCHAR(30) NOT NULL,
    `adminUserId` VARCHAR(30) NOT NULL,
    `resource` VARCHAR(50) NOT NULL,
    `canRead` BOOLEAN NOT NULL DEFAULT true,
    `canCreate` BOOLEAN NOT NULL DEFAULT false,
    `canUpdate` BOOLEAN NOT NULL DEFAULT false,
    `canDelete` BOOLEAN NOT NULL DEFAULT false,

    INDEX `AdminPermission_adminUserId_idx`(`adminUserId` ASC),
    UNIQUE INDEX `AdminPermission_adminUserId_resource_key`(`adminUserId` ASC, `resource` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdminUser` (
    `id` VARCHAR(30) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `firstName` VARCHAR(100) NOT NULL,
    `lastName` VARCHAR(100) NOT NULL,
    `role` VARCHAR(20) NOT NULL DEFAULT 'MODERATOR',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastLoginAt` DATETIME(3) NULL,
    `createdBy` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `mfaBackupCodes` TEXT NULL,
    `mfaEnabled` BOOLEAN NOT NULL DEFAULT false,
    `mfaSecret` VARCHAR(255) NULL,
    `mfaVerifiedAt` DATETIME(3) NULL,

    INDEX `AdminUser_email_idx`(`email` ASC),
    UNIQUE INDEX `AdminUser_email_key`(`email` ASC),
    INDEX `AdminUser_role_idx`(`role` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `action` VARCHAR(20) NOT NULL,
    `entityType` VARCHAR(50) NOT NULL,
    `entityId` VARCHAR(30) NOT NULL,
    `changes` TEXT NULL,
    `ipAddress` VARCHAR(45) NULL,
    `userAgent` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_entityType_entityId_idx`(`entityType` ASC, `entityId` ASC),
    INDEX `AuditLog_userId_createdAt_idx`(`userId` ASC, `createdAt` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BackupRecord` (
    `id` VARCHAR(30) NOT NULL,
    `type` VARCHAR(30) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    `format` VARCHAR(10) NOT NULL DEFAULT 'JSON',
    `fileName` VARCHAR(255) NULL,
    `fileSize` INTEGER NULL,
    `recordCount` INTEGER NULL,
    `tables` TEXT NULL,
    `errorMessage` TEXT NULL,
    `createdBy` VARCHAR(30) NOT NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BackupRecord_createdAt_idx`(`createdAt` ASC),
    INDEX `BackupRecord_createdBy_idx`(`createdBy` ASC),
    INDEX `BackupRecord_status_idx`(`status` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Badge` (
    `id` VARCHAR(30) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(500) NOT NULL,
    `iconUrl` VARCHAR(500) NULL,
    `category` VARCHAR(30) NOT NULL,
    `requirement` VARCHAR(50) NOT NULL,
    `requirementData` TEXT NULL,
    `rarity` VARCHAR(20) NOT NULL DEFAULT 'COMMON',
    `points` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Badge_code_key`(`code` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Budget` (
    `id` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `addressId` VARCHAR(30) NULL,
    `month` DATETIME(3) NOT NULL,
    `year` INTEGER NOT NULL,
    `plannedIncome` DOUBLE NULL,
    `actualIncome` DOUBLE NULL,
    `plannedExpenses` DOUBLE NULL,
    `actualExpenses` DOUBLE NOT NULL,
    `categoryBreakdown` TEXT NULL,
    `savingsRate` DOUBLE NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Budget_addressId_fkey`(`addressId` ASC),
    INDEX `Budget_month_idx`(`month` ASC),
    UNIQUE INDEX `Budget_userId_addressId_month_key`(`userId` ASC, `addressId` ASC, `month` ASC),
    INDEX `Budget_userId_idx`(`userId` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatMessage` (
    `id` VARCHAR(30) NOT NULL,
    `sessionId` VARCHAR(30) NOT NULL,
    `role` VARCHAR(20) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `metadata` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ChatMessage_createdAt_idx`(`createdAt` ASC),
    INDEX `ChatMessage_sessionId_idx`(`sessionId` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatSession` (
    `id` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `title` VARCHAR(200) NOT NULL DEFAULT 'New Chat',
    `context` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ChatSession_isActive_idx`(`isActive` ASC),
    INDEX `ChatSession_userId_idx`(`userId` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Document` (
    `id` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `serviceId` VARCHAR(30) NULL,
    `fileName` VARCHAR(255) NOT NULL,
    `fileUrl` VARCHAR(500) NOT NULL,
    `fileType` VARCHAR(50) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `category` VARCHAR(50) NULL,
    `tags` VARCHAR(500) NOT NULL DEFAULT '[]',
    `ocrProcessed` BOOLEAN NOT NULL DEFAULT false,
    `ocrText` LONGTEXT NULL,
    `extractedData` TEXT NULL,
    `documentDate` DATETIME(3) NULL,
    `description` VARCHAR(500) NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `Document_category_idx`(`category` ASC),
    INDEX `Document_deletedAt_idx`(`deletedAt` ASC),
    INDEX `Document_serviceId_idx`(`serviceId` ASC),
    INDEX `Document_userId_idx`(`userId` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailLog` (
    `id` VARCHAR(30) NOT NULL,
    `templateId` VARCHAR(30) NULL,
    `to` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(200) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    `error` TEXT NULL,
    `sentAt` DATETIME(3) NULL,
    `openedAt` DATETIME(3) NULL,
    `metadata` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EmailLog_createdAt_idx`(`createdAt` ASC),
    INDEX `EmailLog_status_idx`(`status` ASC),
    INDEX `EmailLog_templateId_idx`(`templateId` ASC),
    INDEX `EmailLog_to_idx`(`to` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailTemplate` (
    `id` VARCHAR(30) NOT NULL,
    `slug` VARCHAR(100) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `subject` VARCHAR(200) NOT NULL,
    `body` LONGTEXT NOT NULL,
    `category` VARCHAR(20) NOT NULL DEFAULT 'SYSTEM',
    `variables` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdBy` VARCHAR(30) NULL,
    `updatedBy` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EmailTemplate_category_idx`(`category` ASC),
    INDEX `EmailTemplate_isActive_idx`(`isActive` ASC),
    UNIQUE INDEX `EmailTemplate_slug_key`(`slug` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FAQ` (
    `id` VARCHAR(30) NOT NULL,
    `question` VARCHAR(500) NOT NULL,
    `answer` TEXT NOT NULL,
    `category` VARCHAR(50) NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `isPublished` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FAQ_category_idx`(`category` ASC),
    INDEX `FAQ_isPublished_idx`(`isPublished` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FamilyMember` (
    `id` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `familyId` VARCHAR(60) NOT NULL,
    `role` VARCHAR(20) NOT NULL DEFAULT 'ADMIN',
    `isChild` BOOLEAN NOT NULL DEFAULT false,
    `childName` VARCHAR(100) NULL,
    `childAge` INTEGER NULL,
    `childGrade` VARCHAR(20) NULL,
    `canManageServices` BOOLEAN NOT NULL DEFAULT true,
    `canManageBudget` BOOLEAN NOT NULL DEFAULT true,
    `canManageBilling` BOOLEAN NOT NULL DEFAULT false,
    `canInviteMembers` BOOLEAN NOT NULL DEFAULT false,
    `invitedBy` VARCHAR(30) NULL,
    `invitedAt` DATETIME(3) NULL,
    `acceptedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FamilyMember_familyId_idx`(`familyId` ASC),
    INDEX `FamilyMember_userId_idx`(`userId` ASC),
    UNIQUE INDEX `FamilyMember_userId_key`(`userId` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FeatureFlag` (
    `id` VARCHAR(30) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(500) NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `targetType` VARCHAR(20) NOT NULL DEFAULT 'ALL',
    `targetValue` TEXT NULL,
    `createdBy` VARCHAR(30) NULL,
    `updatedBy` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FeatureFlag_enabled_idx`(`enabled` ASC),
    INDEX `FeatureFlag_name_idx`(`name` ASC),
    UNIQUE INDEX `FeatureFlag_name_key`(`name` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GDPRRequest` (
    `id` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `type` VARCHAR(20) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    `requestData` TEXT NULL,
    `resultUrl` VARCHAR(500) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `GDPRRequest_status_idx`(`status` ASC),
    INDEX `GDPRRequest_userId_idx`(`userId` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HelpArticle` (
    `id` VARCHAR(30) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `excerpt` VARCHAR(500) NULL,
    `category` VARCHAR(50) NOT NULL,
    `tags` VARCHAR(2000) NOT NULL DEFAULT '[]',
    `order` INTEGER NOT NULL DEFAULT 0,
    `isPublished` BOOLEAN NOT NULL DEFAULT false,
    `viewCount` INTEGER NOT NULL DEFAULT 0,
    `helpfulYes` INTEGER NOT NULL DEFAULT 0,
    `helpfulNo` INTEGER NOT NULL DEFAULT 0,
    `createdBy` VARCHAR(30) NULL,
    `updatedBy` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `HelpArticle_category_idx`(`category` ASC),
    INDEX `HelpArticle_isPublished_idx`(`isPublished` ASC),
    INDEX `HelpArticle_slug_idx`(`slug` ASC),
    UNIQUE INDEX `HelpArticle_slug_key`(`slug` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IPRule` (
    `id` VARCHAR(30) NOT NULL,
    `ipAddress` VARCHAR(45) NOT NULL,
    `type` VARCHAR(20) NOT NULL,
    `reason` VARCHAR(500) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdBy` VARCHAR(30) NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `IPRule_ipAddress_idx`(`ipAddress` ASC),
    UNIQUE INDEX `IPRule_ipAddress_type_key`(`ipAddress` ASC, `type` ASC),
    INDEX `IPRule_type_isActive_idx`(`type` ASC, `isActive` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KeywordBlacklist` (
    `id` VARCHAR(30) NOT NULL,
    `keyword` VARCHAR(191) NOT NULL,
    `category` VARCHAR(20) NOT NULL DEFAULT 'CUSTOM',
    `severity` VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isRegex` BOOLEAN NOT NULL DEFAULT false,
    `createdBy` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `KeywordBlacklist_category_idx`(`category` ASC),
    INDEX `KeywordBlacklist_isActive_idx`(`isActive` ASC),
    UNIQUE INDEX `KeywordBlacklist_keyword_key`(`keyword` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ModerationStat` (
    `id` VARCHAR(30) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `totalReviews` INTEGER NOT NULL DEFAULT 0,
    `autoApproved` INTEGER NOT NULL DEFAULT 0,
    `autoRejected` INTEGER NOT NULL DEFAULT 0,
    `flagged` INTEGER NOT NULL DEFAULT 0,
    `manualApproved` INTEGER NOT NULL DEFAULT 0,
    `manualRejected` INTEGER NOT NULL DEFAULT 0,
    `falsePositives` INTEGER NOT NULL DEFAULT 0,
    `falseNegatives` INTEGER NOT NULL DEFAULT 0,
    `avgAiScore` DOUBLE NULL,
    `topFlags` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ModerationStat_date_idx`(`date` ASC),
    UNIQUE INDEX `ModerationStat_date_key`(`date` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MovingBox` (
    `id` VARCHAR(30) NOT NULL,
    `movingPlanId` VARCHAR(30) NOT NULL,
    `boxNumber` INTEGER NOT NULL,
    `label` VARCHAR(100) NOT NULL,
    `room` VARCHAR(50) NULL,
    `contents` TEXT NOT NULL,
    `isFragile` BOOLEAN NOT NULL DEFAULT false,
    `priority` VARCHAR(10) NOT NULL DEFAULT 'MEDIUM',
    `qrCode` VARCHAR(191) NOT NULL,
    `isPacked` BOOLEAN NOT NULL DEFAULT false,
    `packedAt` DATETIME(3) NULL,
    `isUnpacked` BOOLEAN NOT NULL DEFAULT false,
    `unpackedAt` DATETIME(3) NULL,
    `photoUrl` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MovingBox_movingPlanId_boxNumber_key`(`movingPlanId` ASC, `boxNumber` ASC),
    INDEX `MovingBox_movingPlanId_idx`(`movingPlanId` ASC),
    INDEX `MovingBox_qrCode_idx`(`qrCode` ASC),
    UNIQUE INDEX `MovingBox_qrCode_key`(`qrCode` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MovingPlan` (
    `id` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `fromAddressId` VARCHAR(30) NOT NULL,
    `toAddressId` VARCHAR(30) NOT NULL,
    `moveDate` DATETIME(3) NOT NULL,
    `isTemporary` BOOLEAN NOT NULL DEFAULT false,
    `estimatedDuration` INTEGER NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PLANNING',
    `totalTasks` INTEGER NOT NULL DEFAULT 0,
    `completedTasks` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `MovingPlan_deletedAt_idx`(`deletedAt` ASC),
    INDEX `MovingPlan_fromAddressId_idx`(`fromAddressId` ASC),
    INDEX `MovingPlan_moveDate_idx`(`moveDate` ASC),
    INDEX `MovingPlan_toAddressId_idx`(`toAddressId` ASC),
    INDEX `MovingPlan_userId_idx`(`userId` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `type` VARCHAR(30) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `body` TEXT NOT NULL,
    `href` VARCHAR(500) NULL,
    `icon` VARCHAR(50) NULL,
    `channel` VARCHAR(20) NOT NULL DEFAULT 'IN_APP',
    `read` BOOLEAN NOT NULL DEFAULT false,
    `readAt` DATETIME(3) NULL,
    `sent` BOOLEAN NOT NULL DEFAULT false,
    `sentAt` DATETIME(3) NULL,
    `sendAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NULL,
    `metadata` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_channel_idx`(`channel` ASC),
    INDEX `Notification_sendAt_sent_idx`(`sendAt` ASC, `sent` ASC),
    INDEX `Notification_userId_read_idx`(`userId` ASC, `read` ASC),
    INDEX `Notification_userId_type_idx`(`userId` ASC, `type` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NotificationPreference` (
    `id` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `channel` VARCHAR(20) NOT NULL,
    `type` VARCHAR(30) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `frequency` VARCHAR(20) NOT NULL DEFAULT 'IMMEDIATE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `NotificationPreference_userId_channel_type_key`(`userId` ASC, `channel` ASC, `type` ASC),
    INDEX `NotificationPreference_userId_idx`(`userId` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NotificationQueue` (
    `id` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NULL,
    `broadcast` BOOLEAN NOT NULL DEFAULT false,
    `type` VARCHAR(30) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `body` TEXT NOT NULL,
    `href` VARCHAR(500) NULL,
    `channel` VARCHAR(20) NOT NULL DEFAULT 'IN_APP',
    `sendAt` DATETIME(3) NOT NULL,
    `sent` BOOLEAN NOT NULL DEFAULT false,
    `sentAt` DATETIME(3) NULL,
    `error` TEXT NULL,
    `createdBy` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `NotificationQueue_broadcast_idx`(`broadcast` ASC),
    INDEX `NotificationQueue_sendAt_sent_idx`(`sendAt` ASC, `sent` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProcessedWebhookEvent` (
    `id` VARCHAR(255) NOT NULL,
    `source` VARCHAR(30) NOT NULL,
    `processedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProcessedWebhookEvent_processedAt_idx`(`processedAt` ASC),
    INDEX `ProcessedWebhookEvent_source_idx`(`source` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Profile` (
    `id` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `ageRange` VARCHAR(30) NULL,
    `familyStatus` VARCHAR(30) NULL,
    `hasChildren` BOOLEAN NOT NULL DEFAULT false,
    `childrenCount` INTEGER NOT NULL DEFAULT 0,
    `hasSenior` BOOLEAN NOT NULL DEFAULT false,
    `hasDisability` BOOLEAN NOT NULL DEFAULT false,
    `hasPets` BOOLEAN NOT NULL DEFAULT false,
    `petTypes` VARCHAR(500) NOT NULL DEFAULT '[]',
    `carCount` INTEGER NOT NULL DEFAULT 0,
    `hasMotorcycle` BOOLEAN NOT NULL DEFAULT false,
    `hasBoatRV` BOOLEAN NOT NULL DEFAULT false,
    `needsStorage` BOOLEAN NOT NULL DEFAULT false,
    `moveType` VARCHAR(20) NULL,
    `isBusinessOwner` BOOLEAN NOT NULL DEFAULT false,
    `businessType` VARCHAR(30) NULL,
    `isImmigrant` BOOLEAN NOT NULL DEFAULT false,
    `immigrationStatus` VARCHAR(30) NULL,
    `isMilitary` BOOLEAN NOT NULL DEFAULT false,
    `preferredLanguage` VARCHAR(10) NOT NULL DEFAULT 'en',
    `timezone` VARCHAR(50) NOT NULL DEFAULT 'America/New_York',
    `currentStreak` INTEGER NOT NULL DEFAULT 0,
    `longestStreak` INTEGER NOT NULL DEFAULT 0,
    `lastActiveDate` DATETIME(3) NULL,
    `totalPoints` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Profile_userId_idx`(`userId` ASC),
    UNIQUE INDEX `Profile_userId_key`(`userId` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RateLimitLog` (
    `id` VARCHAR(30) NOT NULL,
    `ipAddress` VARCHAR(45) NOT NULL,
    `endpoint` VARCHAR(200) NOT NULL,
    `count` INTEGER NOT NULL DEFAULT 1,
    `blocked` BOOLEAN NOT NULL DEFAULT false,
    `windowStart` DATETIME(3) NOT NULL,
    `windowEnd` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RateLimitLog_blocked_idx`(`blocked` ASC),
    INDEX `RateLimitLog_ipAddress_endpoint_idx`(`ipAddress` ASC, `endpoint` ASC),
    INDEX `RateLimitLog_windowStart_idx`(`windowStart` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReferralCode` (
    `id` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `clicks` INTEGER NOT NULL DEFAULT 0,
    `signups` INTEGER NOT NULL DEFAULT 0,
    `rewards` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ReferralCode_code_idx`(`code` ASC),
    UNIQUE INDEX `ReferralCode_code_key`(`code` ASC),
    INDEX `ReferralCode_userId_idx`(`userId` ASC),
    UNIQUE INDEX `ReferralCode_userId_key`(`userId` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReferralReward` (
    `id` VARCHAR(30) NOT NULL,
    `referrerId` VARCHAR(30) NOT NULL,
    `refereeId` VARCHAR(30) NOT NULL,
    `rewardType` VARCHAR(20) NOT NULL,
    `amount` INTEGER NOT NULL,
    `claimed` BOOLEAN NOT NULL DEFAULT false,
    `claimedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ReferralReward_refereeId_idx`(`refereeId` ASC),
    INDEX `ReferralReward_referrerId_idx`(`referrerId` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Reminder` (
    `id` VARCHAR(30) NOT NULL,
    `serviceId` VARCHAR(30) NULL,
    `type` VARCHAR(30) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `message` TEXT NULL,
    `remindAt` DATETIME(3) NOT NULL,
    `sent` BOOLEAN NOT NULL DEFAULT false,
    `sentAt` DATETIME(3) NULL,
    `isRecurring` BOOLEAN NOT NULL DEFAULT false,
    `recurrenceRule` VARCHAR(100) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Reminder_remindAt_sent_idx`(`remindAt` ASC, `sent` ASC),
    INDEX `Reminder_serviceId_idx`(`serviceId` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Review` (
    `id` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `providerName` VARCHAR(200) NOT NULL,
    `category` VARCHAR(50) NOT NULL,
    `zipCode` VARCHAR(10) NOT NULL,
    `city` VARCHAR(100) NOT NULL,
    `state` VARCHAR(2) NOT NULL,
    `rating` INTEGER NOT NULL,
    `title` VARCHAR(100) NULL,
    `content` TEXT NOT NULL,
    `speedRating` INTEGER NULL,
    `reliabilityRating` INTEGER NULL,
    `customerServiceRating` INTEGER NULL,
    `valueRating` INTEGER NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    `aiScore` DOUBLE NULL,
    `aiAnalysis` TEXT NULL,
    `isVerified` BOOLEAN NOT NULL DEFAULT false,
    `helpfulCount` INTEGER NOT NULL DEFAULT 0,
    `reportCount` INTEGER NOT NULL DEFAULT 0,
    `isHidden` BOOLEAN NOT NULL DEFAULT false,
    `moderatedAt` DATETIME(3) NULL,
    `moderatedBy` VARCHAR(30) NULL,
    `moderationNote` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Review_category_idx`(`category` ASC),
    INDEX `Review_isVerified_idx`(`isVerified` ASC),
    INDEX `Review_providerName_idx`(`providerName` ASC),
    INDEX `Review_rating_idx`(`rating` ASC),
    INDEX `Review_userId_fkey`(`userId` ASC),
    INDEX `Review_zipCode_idx`(`zipCode` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Service` (
    `id` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `addressId` VARCHAR(30) NOT NULL,
    `category` VARCHAR(50) NOT NULL,
    `subCategory` VARCHAR(50) NULL,
    `providerName` VARCHAR(200) NOT NULL,
    `accountNumber` VARCHAR(100) NULL,
    `username` VARCHAR(100) NULL,
    `website` VARCHAR(500) NULL,
    `phone` VARCHAR(20) NULL,
    `email` VARCHAR(191) NULL,
    `monthlyCost` DOUBLE NULL,
    `billingDay` INTEGER NULL,
    `billingCycle` VARCHAR(20) NULL,
    `autoRenewal` BOOLEAN NOT NULL DEFAULT false,
    `contractEndDate` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `activatedAt` DATETIME(3) NULL,
    `deactivatedAt` DATETIME(3) NULL,
    `personalRating` INTEGER NULL,
    `personalReview` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `migrationAction` VARCHAR(20) NULL,
    `previousServiceId` VARCHAR(30) NULL,
    `providerId` VARCHAR(30) NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `Service_addressId_idx`(`addressId` ASC),
    INDEX `Service_category_idx`(`category` ASC),
    INDEX `Service_deletedAt_idx`(`deletedAt` ASC),
    INDEX `Service_providerId_idx`(`providerId` ASC),
    INDEX `Service_providerName_idx`(`providerName` ASC),
    INDEX `Service_userId_category_idx`(`userId` ASC, `category` ASC),
    INDEX `Service_userId_idx`(`userId` ASC),
    INDEX `Service_userId_isActive_idx`(`userId` ASC, `isActive` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ServiceProvider` (
    `id` VARCHAR(30) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `category` VARCHAR(50) NOT NULL,
    `subCategory` VARCHAR(50) NULL,
    `description` TEXT NULL,
    `website` VARCHAR(500) NULL,
    `phone` VARCHAR(20) NULL,
    `logoUrl` VARCHAR(500) NULL,
    `scope` VARCHAR(20) NOT NULL DEFAULT 'FEDERAL',
    `states` VARCHAR(2000) NOT NULL DEFAULT '[]',
    `zipCodes` VARCHAR(2000) NOT NULL DEFAULT '[]',
    `tags` VARCHAR(2000) NOT NULL DEFAULT '[]',
    `popularityScore` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `reviewCount` INTEGER NOT NULL DEFAULT 0,
    `avgRating` DOUBLE NULL,
    `userCount` INTEGER NOT NULL DEFAULT 0,
    `lastUpdatedBy` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ServiceProvider_category_idx`(`category` ASC),
    INDEX `ServiceProvider_scope_idx`(`scope` ASC),
    INDEX `ServiceProvider_slug_idx`(`slug` ASC),
    UNIQUE INDEX `ServiceProvider_slug_key`(`slug` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StateRule` (
    `id` VARCHAR(30) NOT NULL,
    `stateCode` VARCHAR(5) NOT NULL,
    `stateName` VARCHAR(50) NOT NULL,
    `dmvRules` TEXT NULL,
    `voterRegistration` TEXT NULL,
    `utilityInfo` TEXT NULL,
    `taxInfo` TEXT NULL,
    `insuranceRules` TEXT NULL,
    `commonProviders` TEXT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `StateRule_stateCode_idx`(`stateCode` ASC),
    UNIQUE INDEX `StateRule_stateCode_key`(`stateCode` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Subscription` (
    `id` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `plan` VARCHAR(30) NOT NULL DEFAULT 'FREE_TRIAL',
    `status` VARCHAR(30) NOT NULL DEFAULT 'TRIALING',
    `stripeCustomerId` VARCHAR(191) NULL,
    `stripeSubscriptionId` VARCHAR(191) NULL,
    `stripePriceId` VARCHAR(191) NULL,
    `stripeCurrentPeriodEnd` DATETIME(3) NULL,
    `trialEndsAt` DATETIME(3) NULL,
    `canceledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `premiumGrantedAt` DATETIME(3) NULL,
    `premiumGrantedBy` VARCHAR(30) NULL,
    `premiumNote` VARCHAR(500) NULL,
    `premiumUntil` DATETIME(3) NULL,

    INDEX `Subscription_stripeCustomerId_idx`(`stripeCustomerId` ASC),
    UNIQUE INDEX `Subscription_stripeCustomerId_key`(`stripeCustomerId` ASC),
    UNIQUE INDEX `Subscription_stripeSubscriptionId_key`(`stripeSubscriptionId` ASC),
    INDEX `Subscription_userId_idx`(`userId` ASC),
    UNIQUE INDEX `Subscription_userId_key`(`userId` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SupportTicket` (
    `id` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `subject` VARCHAR(255) NOT NULL,
    `category` VARCHAR(30) NOT NULL DEFAULT 'GENERAL',
    `priority` VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    `status` VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    `platform` VARCHAR(10) NOT NULL DEFAULT 'WEB',
    `assignedTo` VARCHAR(30) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `closedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SupportTicket_assignedTo_idx`(`assignedTo` ASC),
    INDEX `SupportTicket_category_idx`(`category` ASC),
    INDEX `SupportTicket_createdAt_idx`(`createdAt` ASC),
    INDEX `SupportTicket_priority_idx`(`priority` ASC),
    INDEX `SupportTicket_status_idx`(`status` ASC),
    INDEX `SupportTicket_userId_idx`(`userId` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Task` (
    `id` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `movingPlanId` VARCHAR(30) NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `category` VARCHAR(50) NULL,
    `dueDate` DATETIME(3) NULL,
    `daysBeforeMove` INTEGER NULL,
    `completed` BOOLEAN NOT NULL DEFAULT false,
    `completedAt` DATETIME(3) NULL,
    `priority` VARCHAR(10) NOT NULL DEFAULT 'MEDIUM',
    `assignedTo` VARCHAR(30) NULL,
    `isAutoGenerated` BOOLEAN NOT NULL DEFAULT false,
    `templateId` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Task_completed_idx`(`completed` ASC),
    INDEX `Task_dueDate_idx`(`dueDate` ASC),
    INDEX `Task_movingPlanId_idx`(`movingPlanId` ASC),
    INDEX `Task_userId_completed_idx`(`userId` ASC, `completed` ASC),
    INDEX `Task_userId_dueDate_idx`(`userId` ASC, `dueDate` ASC),
    INDEX `Task_userId_idx`(`userId` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketMessage` (
    `id` VARCHAR(30) NOT NULL,
    `ticketId` VARCHAR(30) NOT NULL,
    `senderType` VARCHAR(10) NOT NULL,
    `senderId` VARCHAR(30) NOT NULL,
    `content` TEXT NOT NULL,
    `attachmentUrl` VARCHAR(500) NULL,
    `isInternal` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TicketMessage_senderId_idx`(`senderId` ASC),
    INDEX `TicketMessage_ticketId_createdAt_idx`(`ticketId` ASC, `createdAt` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(30) NOT NULL,
    `clerkId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(100) NULL,
    `lastName` VARCHAR(100) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `User_clerkId_idx`(`clerkId` ASC),
    UNIQUE INDEX `User_clerkId_key`(`clerkId` ASC),
    INDEX `User_email_idx`(`email` ASC),
    UNIQUE INDEX `User_email_key`(`email` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserBadge` (
    `id` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `badgeId` VARCHAR(30) NOT NULL,
    `earnedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `UserBadge_badgeId_fkey`(`badgeId` ASC),
    UNIQUE INDEX `UserBadge_userId_badgeId_key`(`userId` ASC, `badgeId` ASC),
    INDEX `UserBadge_userId_idx`(`userId` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserEvent` (
    `id` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `sessionId` VARCHAR(30) NULL,
    `event` VARCHAR(50) NOT NULL,
    `page` VARCHAR(200) NULL,
    `metadata` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `UserEvent_createdAt_idx`(`createdAt` ASC),
    INDEX `UserEvent_event_idx`(`event` ASC),
    INDEX `UserEvent_sessionId_idx`(`sessionId` ASC),
    INDEX `UserEvent_userId_event_idx`(`userId` ASC, `event` ASC),
    INDEX `UserEvent_userId_idx`(`userId` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserSession` (
    `id` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `ipAddress` VARCHAR(45) NULL,
    `userAgent` VARCHAR(500) NULL,
    `browser` VARCHAR(50) NULL,
    `browserVersion` VARCHAR(20) NULL,
    `os` VARCHAR(50) NULL,
    `osVersion` VARCHAR(20) NULL,
    `device` VARCHAR(50) NULL,
    `deviceType` VARCHAR(20) NULL,
    `platform` VARCHAR(20) NULL,
    `screenResolution` VARCHAR(20) NULL,
    `language` VARCHAR(10) NULL,
    `country` VARCHAR(50) NULL,
    `city` VARCHAR(100) NULL,
    `region` VARCHAR(100) NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `sessionStart` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `sessionEnd` DATETIME(3) NULL,
    `lastActivity` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `pageViews` INTEGER NOT NULL DEFAULT 1,
    `isActive` BOOLEAN NOT NULL DEFAULT true,

    INDEX `UserSession_country_idx`(`country` ASC),
    INDEX `UserSession_deviceType_idx`(`deviceType` ASC),
    INDEX `UserSession_isActive_idx`(`isActive` ASC),
    INDEX `UserSession_os_idx`(`os` ASC),
    INDEX `UserSession_platform_idx`(`platform` ASC),
    INDEX `UserSession_sessionStart_idx`(`sessionStart` ASC),
    INDEX `UserSession_userId_idx`(`userId` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Address` ADD CONSTRAINT `Address_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdminAuditLog` ADD CONSTRAINT `AdminAuditLog_adminUserId_fkey` FOREIGN KEY (`adminUserId`) REFERENCES `AdminUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdminPermission` ADD CONSTRAINT `AdminPermission_adminUserId_fkey` FOREIGN KEY (`adminUserId`) REFERENCES `AdminUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Budget` ADD CONSTRAINT `Budget_addressId_fkey` FOREIGN KEY (`addressId`) REFERENCES `Address`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Budget` ADD CONSTRAINT `Budget_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatMessage` ADD CONSTRAINT `ChatMessage_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `ChatSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatSession` ADD CONSTRAINT `ChatSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Document` ADD CONSTRAINT `Document_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `Service`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Document` ADD CONSTRAINT `Document_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailLog` ADD CONSTRAINT `EmailLog_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `EmailTemplate`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FamilyMember` ADD CONSTRAINT `FamilyMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MovingBox` ADD CONSTRAINT `MovingBox_movingPlanId_fkey` FOREIGN KEY (`movingPlanId`) REFERENCES `MovingPlan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MovingPlan` ADD CONSTRAINT `MovingPlan_fromAddressId_fkey` FOREIGN KEY (`fromAddressId`) REFERENCES `Address`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MovingPlan` ADD CONSTRAINT `MovingPlan_toAddressId_fkey` FOREIGN KEY (`toAddressId`) REFERENCES `Address`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MovingPlan` ADD CONSTRAINT `MovingPlan_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NotificationPreference` ADD CONSTRAINT `NotificationPreference_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Profile` ADD CONSTRAINT `Profile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReferralCode` ADD CONSTRAINT `ReferralCode_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReferralReward` ADD CONSTRAINT `ReferralReward_refereeId_fkey` FOREIGN KEY (`refereeId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReferralReward` ADD CONSTRAINT `ReferralReward_referrerId_fkey` FOREIGN KEY (`referrerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reminder` ADD CONSTRAINT `Reminder_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `Service`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Review` ADD CONSTRAINT `Review_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Service` ADD CONSTRAINT `Service_addressId_fkey` FOREIGN KEY (`addressId`) REFERENCES `Address`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Service` ADD CONSTRAINT `Service_providerId_fkey` FOREIGN KEY (`providerId`) REFERENCES `ServiceProvider`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Service` ADD CONSTRAINT `Service_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupportTicket` ADD CONSTRAINT `SupportTicket_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_movingPlanId_fkey` FOREIGN KEY (`movingPlanId`) REFERENCES `MovingPlan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketMessage` ADD CONSTRAINT `TicketMessage_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `SupportTicket`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserBadge` ADD CONSTRAINT `UserBadge_badgeId_fkey` FOREIGN KEY (`badgeId`) REFERENCES `Badge`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserBadge` ADD CONSTRAINT `UserBadge_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserEvent` ADD CONSTRAINT `UserEvent_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `UserSession`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserEvent` ADD CONSTRAINT `UserEvent_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserSession` ADD CONSTRAINT `UserSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;