-- Per-user toggle for the Budget / Service Costs surface. Default true
-- preserves the current visibility for all existing users; the settings
-- page exposes the switch so anyone who doesn't track spend can hide the
-- nav item.
ALTER TABLE `User`
  ADD COLUMN `showBudget` BOOLEAN NOT NULL DEFAULT true;
