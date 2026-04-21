-- Adds the per-user language preference column.
-- Null until a user explicitly picks a language — initial visits auto-
-- detect from the NEXT_LOCALE cookie or Accept-Language header.
ALTER TABLE `User`
  ADD COLUMN `preferredLocale` VARCHAR(10) NULL;
