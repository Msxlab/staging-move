-- Enforce one active PartnerConsent grant per (user, connector) while keeping
-- historical revoked/expired rows. MySQL unique indexes allow multiple NULLs,
-- so active rows carry activeGrantKey='GRANTED' and history stores NULL.

ALTER TABLE `PartnerConsent`
  ADD COLUMN `activeGrantKey` VARCHAR(20) NULL;

UPDATE `PartnerConsent` pc
JOIN (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY `userId`, `connectorKey`
      ORDER BY `grantedAt` DESC, `createdAt` DESC, `id` DESC
    ) AS rn
  FROM `PartnerConsent`
  WHERE `status` = 'GRANTED'
) ranked ON ranked.id = pc.id
SET
  pc.`activeGrantKey` = CASE WHEN ranked.rn = 1 THEN 'GRANTED' ELSE NULL END,
  pc.`status` = CASE WHEN ranked.rn = 1 THEN pc.`status` ELSE 'REVOKED' END,
  pc.`revokedAt` = CASE WHEN ranked.rn = 1 THEN pc.`revokedAt` ELSE COALESCE(pc.`revokedAt`, CURRENT_TIMESTAMP(3)) END,
  pc.`revocationReason` = CASE WHEN ranked.rn = 1 THEN pc.`revocationReason` ELSE 'SUPERSEDED' END,
  pc.`tokenEncrypted` = CASE WHEN ranked.rn = 1 THEN pc.`tokenEncrypted` ELSE NULL END,
  pc.`refreshTokenEncrypted` = CASE WHEN ranked.rn = 1 THEN pc.`refreshTokenEncrypted` ELSE NULL END;

CREATE UNIQUE INDEX `PartnerConsent_userId_connectorKey_activeGrantKey_key`
  ON `PartnerConsent`(`userId`, `connectorKey`, `activeGrantKey`);
