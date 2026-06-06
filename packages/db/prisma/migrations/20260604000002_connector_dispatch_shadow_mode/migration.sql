-- ConnectorDispatch live/shadow accounting.
-- Widen legacy eventId because enqueue writes a UUID changeRef (36 chars).
-- Add an explicit shadow flag so dry-run rows can be excluded from live
-- rate limits, admin health counts, and user-facing dispatch timelines.

ALTER TABLE `ConnectorDispatch`
  MODIFY COLUMN `eventId` VARCHAR(40) NULL,
  ADD COLUMN `isShadow` BOOLEAN NOT NULL DEFAULT false,
  ADD INDEX `ConnectorDispatch_isShadow_status_idx` (`isShadow`, `status`);
