ALTER TABLE `Budget` ADD COLUMN `scopeKey` VARCHAR(64) NULL;

UPDATE `Budget`
SET `scopeKey` = CASE
  WHEN `deletedAt` IS NULL THEN COALESCE(`addressId`, '__global__')
  ELSE CONCAT('__deleted__', `id`)
END
WHERE `scopeKey` IS NULL;

UPDATE `Budget` b
JOIN (
  SELECT `id`
  FROM (
    SELECT
      `id`,
      ROW_NUMBER() OVER (
        PARTITION BY `userId`, `scopeKey`, `month`
        ORDER BY `updatedAt` DESC, `createdAt` DESC, `id` DESC
      ) AS rn
    FROM `Budget`
    WHERE `deletedAt` IS NULL
  ) ranked
  WHERE ranked.rn > 1
) duplicates ON duplicates.`id` = b.`id`
SET
  b.`deletedAt` = COALESCE(b.`deletedAt`, CURRENT_TIMESTAMP(3)),
  b.`scopeKey` = CONCAT('__deleted__', b.`id`);

ALTER TABLE `Budget` MODIFY `scopeKey` VARCHAR(64) NOT NULL;

DROP INDEX `Budget_userId_addressId_month_key` ON `Budget`;
CREATE UNIQUE INDEX `Budget_userId_scopeKey_month_key` ON `Budget`(`userId`, `scopeKey`, `month`);
CREATE INDEX `Budget_scopeKey_idx` ON `Budget`(`scopeKey`);
