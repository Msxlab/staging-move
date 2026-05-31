-- Member consent for owner/admin-initiated "managed sync" (push an address
-- change to this member's connected partners on their behalf). Nullable;
-- resolveManagedSyncEnabled() treats null as true for CHILD, false otherwise.

-- AlterTable
ALTER TABLE `WorkspaceMember` ADD COLUMN `managedSyncEnabled` BOOLEAN NULL;
