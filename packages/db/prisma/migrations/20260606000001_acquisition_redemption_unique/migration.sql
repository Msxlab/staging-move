-- Remove duplicate (userId, campaignId) redemptions before adding the unique
-- index, keeping the EARLIEST row per pair (the original grant + its consent
-- snapshot). Duplicates can only be erroneous double-grants from the previous
-- check-then-create race. Only rows with a non-NULL campaignId are affected;
-- NULL campaignId rows stay distinct in MySQL and are left untouched.
DELETE r1 FROM `AcquisitionRedemption` r1
    INNER JOIN `AcquisitionRedemption` r2
        ON r1.`userId` = r2.`userId`
        AND r1.`campaignId` = r2.`campaignId`
        AND r1.`campaignId` IS NOT NULL
        AND (
            r1.`createdAt` > r2.`createdAt`
            OR (r1.`createdAt` = r2.`createdAt` AND r1.`id` > r2.`id`)
        );

-- CreateIndex: one redemption per (user, campaign), DB-enforced so two
-- concurrent POSTs can't both grant free access.
CREATE UNIQUE INDEX `AcquisitionRedemption_userId_campaignId_key`
    ON `AcquisitionRedemption`(`userId`, `campaignId`);
