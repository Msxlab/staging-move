-- Acquisition campaigns and redemption snapshots for Individual access.
-- This migration does not run Stripe changes or rewrite existing subscription
-- history. Legacy access rows are interpreted by application compatibility
-- logic after rollout.

CREATE TABLE `AcquisitionCampaign` (
  `id` VARCHAR(30) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `code` VARCHAR(80) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  `accessType` VARCHAR(30) NOT NULL,
  `plan` VARCHAR(30) NOT NULL DEFAULT 'INDIVIDUAL',
  `billingInterval` VARCHAR(20) NULL,
  `trialDays` INTEGER NULL,
  `freeAccessDays` INTEGER NULL,
  `stripePriceId` VARCHAR(191) NULL,
  `displayPriceLabel` VARCHAR(80) NULL,
  `requiresPaymentMethod` BOOLEAN NOT NULL DEFAULT false,
  `autoRenew` BOOLEAN NOT NULL DEFAULT false,
  `newUsersOnly` BOOLEAN NOT NULL DEFAULT true,
  `startsAt` DATETIME(3) NULL,
  `endsAt` DATETIME(3) NULL,
  `maxRedemptions` INTEGER NULL,
  `redemptionCount` INTEGER NOT NULL DEFAULT 0,
  `internalNotes` TEXT NULL,
  `publicHeadline` VARCHAR(200) NOT NULL,
  `publicSubheadline` VARCHAR(500) NULL,
  `checkoutDisclosureCopy` TEXT NULL,
  `createdByAdminId` VARCHAR(30) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `AcquisitionCampaign_code_key`(`code`),
  INDEX `AcquisitionCampaign_status_idx`(`status`),
  INDEX `AcquisitionCampaign_accessType_plan_idx`(`accessType`, `plan`),
  INDEX `AcquisitionCampaign_startsAt_endsAt_idx`(`startsAt`, `endsAt`),
  INDEX `AcquisitionCampaign_createdByAdminId_idx`(`createdByAdminId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Subscription`
  ALTER COLUMN `status` SET DEFAULT 'FREE_ACCESS';

ALTER TABLE `Subscription`
  ADD COLUMN `accessType` VARCHAR(30) NULL,
  ADD COLUMN `billingInterval` VARCHAR(20) NULL,
  ADD COLUMN `freeAccessEndsAt` DATETIME(3) NULL,
  ADD COLUMN `cancelAtPeriodEnd` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `firstChargeAt` DATETIME(3) NULL,
  ADD COLUMN `firstChargeAmount` DOUBLE NULL,
  ADD COLUMN `autoRenew` BOOLEAN NULL,
  ADD COLUMN `campaignId` VARCHAR(30) NULL,
  ADD COLUMN `campaignCode` VARCHAR(80) NULL,
  ADD COLUMN `campaignSnapshot` TEXT NULL,
  ADD COLUMN `checkoutConsentSnapshot` TEXT NULL,
  ADD COLUMN `termsVersion` VARCHAR(30) NULL,
  ADD COLUMN `subscriptionPolicyVersion` VARCHAR(30) NULL,
  ADD COLUMN `refundPolicyVersion` VARCHAR(30) NULL;

CREATE INDEX `Subscription_accessType_status_idx` ON `Subscription`(`accessType`, `status`);
CREATE INDEX `Subscription_campaignId_idx` ON `Subscription`(`campaignId`);

CREATE TABLE `AcquisitionRedemption` (
  `id` VARCHAR(30) NOT NULL,
  `campaignId` VARCHAR(30) NULL,
  `userId` VARCHAR(30) NOT NULL,
  `subscriptionId` VARCHAR(30) NULL,
  `accessType` VARCHAR(30) NOT NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'REDEEMED',
  `snapshot` TEXT NOT NULL,
  `consentAcceptedAt` DATETIME(3) NULL,
  `consentIpHash` VARCHAR(64) NULL,
  `consentUserAgentHash` VARCHAR(64) NULL,
  `termsVersion` VARCHAR(30) NULL,
  `subscriptionPolicyVersion` VARCHAR(30) NULL,
  `refundPolicyVersion` VARCHAR(30) NULL,
  `checkoutDisclosureTextHash` VARCHAR(64) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `AcquisitionRedemption_campaignId_idx`(`campaignId`),
  INDEX `AcquisitionRedemption_userId_idx`(`userId`),
  INDEX `AcquisitionRedemption_subscriptionId_idx`(`subscriptionId`),
  INDEX `AcquisitionRedemption_accessType_status_idx`(`accessType`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AcquisitionCampaign`
  ADD CONSTRAINT `AcquisitionCampaign_createdByAdminId_fkey`
  FOREIGN KEY (`createdByAdminId`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Subscription`
  ADD CONSTRAINT `Subscription_campaignId_fkey`
  FOREIGN KEY (`campaignId`) REFERENCES `AcquisitionCampaign`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `AcquisitionRedemption`
  ADD CONSTRAINT `AcquisitionRedemption_campaignId_fkey`
  FOREIGN KEY (`campaignId`) REFERENCES `AcquisitionCampaign`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `AcquisitionRedemption_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `AcquisitionRedemption_subscriptionId_fkey`
  FOREIGN KEY (`subscriptionId`) REFERENCES `Subscription`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO `AcquisitionCampaign` (
  `id`,
  `name`,
  `code`,
  `status`,
  `accessType`,
  `plan`,
  `billingInterval`,
  `trialDays`,
  `freeAccessDays`,
  `stripePriceId`,
  `displayPriceLabel`,
  `requiresPaymentMethod`,
  `autoRenew`,
  `newUsersOnly`,
  `publicHeadline`,
  `publicSubheadline`,
  `checkoutDisclosureCopy`,
  `createdAt`,
  `updatedAt`
) VALUES (
  'camp_individual90',
  'Individual Annual - 3 months free',
  'INDIVIDUAL90',
  'ACTIVE',
  'FREE_TRIAL',
  'INDIVIDUAL',
  'YEAR',
  90,
  NULL,
  NULL,
  '$79/year',
  true,
  true,
  true,
  'Start with 3 months free',
  'Individual Annual starts after your trial.',
  'Today: $0. Trial: 3 months. Your annual plan starts after the trial. You can cancel before then in Settings.',
  CURRENT_TIMESTAMP(3),
  CURRENT_TIMESTAMP(3)
) ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `accessType` = VALUES(`accessType`),
  `plan` = VALUES(`plan`),
  `billingInterval` = VALUES(`billingInterval`),
  `trialDays` = VALUES(`trialDays`),
  `displayPriceLabel` = VALUES(`displayPriceLabel`),
  `requiresPaymentMethod` = VALUES(`requiresPaymentMethod`),
  `autoRenew` = VALUES(`autoRenew`),
  `publicHeadline` = VALUES(`publicHeadline`),
  `publicSubheadline` = VALUES(`publicSubheadline`),
  `checkoutDisclosureCopy` = VALUES(`checkoutDisclosureCopy`),
  `updatedAt` = CURRENT_TIMESTAMP(3);
