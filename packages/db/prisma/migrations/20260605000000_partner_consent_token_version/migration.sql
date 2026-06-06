-- Optimistic-lock counter for connector OAuth token refresh. A concurrent
-- refresh bumps this, so a slower worker's compare-and-swap write matches 0 rows
-- and cannot clobber a newer (rotated) token. Additive; existing rows default 0.
ALTER TABLE `PartnerConsent` ADD COLUMN `tokenVersion` INTEGER NOT NULL DEFAULT 0;
