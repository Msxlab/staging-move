-- AlterTable: explicit consent for movers to receive consumer lead PII by email
-- (audit P2). Default false — directory approval is not lead-program consent.
ALTER TABLE `MoverApplication` ADD COLUMN `leadsOptIn` BOOLEAN NOT NULL DEFAULT false;
