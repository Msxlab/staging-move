-- Task assignment for Family/Pro workspaces.
--
-- Adds an OPTIONAL assignee to a MoveTask so that, in a multi-member workspace,
-- any ACTIVE member can assign a task to any ACTIVE member of the same
-- workspace. Null = unassigned, which is the default for every existing task
-- and for every solo/Individual workspace (which never surface assignment).
--
-- Additive & backward-compatible: the column is NULLABLE with no default, so
-- existing rows get NULL and behave exactly as before. The FK uses ON DELETE
-- SET NULL so removing a workspace member leaves their tasks intact (they just
-- become unassigned again). No data migration required.
ALTER TABLE `MoveTask` ADD COLUMN `assignedToUserId` VARCHAR(30) NULL;

-- Index for "tasks assigned to me" style filtering.
CREATE INDEX `MoveTask_assignedToUserId_idx` ON `MoveTask`(`assignedToUserId`);

-- FK to User; SET NULL on delete keeps the task and only clears the assignee.
ALTER TABLE `MoveTask`
  ADD CONSTRAINT `MoveTask_assignedToUserId_fkey`
    FOREIGN KEY (`assignedToUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
