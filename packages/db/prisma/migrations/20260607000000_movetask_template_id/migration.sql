-- Link a generated MoveTask back to the relocation-checklist template item it
-- was created for (e.g. "P1_ELECTRIC"). This lets the checklist mark a template
-- item DONE when its linked MoveTask reaches COMPLETED status.
--
-- Additive & backward-compatible: the column is NULLABLE with no default, so
-- existing rows get NULL and existing tasks (including any that never map to a
-- template item) keep working exactly as before. No data migration required.
ALTER TABLE `MoveTask` ADD COLUMN `templateId` VARCHAR(191) NULL;

-- Index for filtering completed tasks by template item when computing checklist progress.
CREATE INDEX `MoveTask_templateId_idx` ON `MoveTask`(`templateId`);
