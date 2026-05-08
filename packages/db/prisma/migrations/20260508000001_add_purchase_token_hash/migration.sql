ALTER TABLE `Subscription`
  ADD COLUMN `purchaseTokenHash` VARCHAR(64) NULL;

UPDATE `Subscription`
SET `purchaseTokenHash` = SHA2(`purchaseToken`, 256)
WHERE `purchaseToken` IS NOT NULL AND `purchaseToken` <> '';

CREATE UNIQUE INDEX `Subscription_purchaseTokenHash_key`
  ON `Subscription`(`purchaseTokenHash`);
