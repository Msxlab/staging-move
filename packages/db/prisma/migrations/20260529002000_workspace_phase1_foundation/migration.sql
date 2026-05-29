-- Workspace foundation (Family/Pro) — Phase 1, additive only.
-- New tables + NULLABLE workspaceId columns on domain tables. Existing `userId`
-- columns are retained; nothing reads workspaceId yet (inert until the
-- migration backfill + WORKSPACE_MODEL_ENABLED). Safe to roll back (drop new
-- tables, drop nullable columns).

CREATE TABLE `Workspace` (
  `id` VARCHAR(30) NOT NULL,
  `ownerUserId` VARCHAR(30) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `transferRequestedToUserId` VARCHAR(30) NULL,
  `transferRequestedAt` DATETIME(3) NULL,
  `deletedAt` DATETIME(3) NULL,
  `deletionGraceUntil` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  INDEX `Workspace_ownerUserId_idx` (`ownerUserId`),
  INDEX `Workspace_deletedAt_idx` (`deletedAt`),
  INDEX `Workspace_createdAt_idx` (`createdAt`),
  CONSTRAINT `Workspace_ownerUserId_fkey`
    FOREIGN KEY (`ownerUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WorkspaceMember` (
  `id` VARCHAR(30) NOT NULL,
  `workspaceId` VARCHAR(30) NOT NULL,
  `userId` VARCHAR(30) NOT NULL,
  `role` VARCHAR(20) NOT NULL DEFAULT 'MEMBER',
  `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  `parentMemberId` VARCHAR(30) NULL,
  `invitedByUserId` VARCHAR(30) NULL,
  `invitationId` VARCHAR(30) NULL,
  `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `lastActiveAt` DATETIME(3) NULL,
  `suspendedAt` DATETIME(3) NULL,
  `suspendedReason` VARCHAR(255) NULL,
  `overflowSince` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `WorkspaceMember_workspaceId_userId_key` (`workspaceId`, `userId`),
  INDEX `WorkspaceMember_workspaceId_role_idx` (`workspaceId`, `role`),
  INDEX `WorkspaceMember_userId_idx` (`userId`),
  INDEX `WorkspaceMember_status_idx` (`status`),
  INDEX `WorkspaceMember_parentMemberId_idx` (`parentMemberId`),
  CONSTRAINT `WorkspaceMember_workspaceId_fkey`
    FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `WorkspaceMember_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `WorkspaceMember_parentMemberId_fkey`
    FOREIGN KEY (`parentMemberId`) REFERENCES `WorkspaceMember`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WorkspaceInvitation` (
  `id` VARCHAR(30) NOT NULL,
  `workspaceId` VARCHAR(30) NOT NULL,
  `invitedEmail` VARCHAR(191) NOT NULL,
  `role` VARCHAR(20) NOT NULL DEFAULT 'MEMBER',
  `invitedByUserId` VARCHAR(30) NOT NULL,
  `tokenHash` VARCHAR(64) NOT NULL,
  `tokenLast4` VARCHAR(8) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  `expiresAt` DATETIME(3) NOT NULL,
  `acceptedAt` DATETIME(3) NULL,
  `acceptedByUserId` VARCHAR(30) NULL,
  `revokedAt` DATETIME(3) NULL,
  `revokedByUserId` VARCHAR(30) NULL,
  `locale` VARCHAR(10) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `WorkspaceInvitation_tokenHash_key` (`tokenHash`),
  UNIQUE INDEX `WorkspaceInvitation_workspaceId_invitedEmail_expiresAt_key` (`workspaceId`, `invitedEmail`, `expiresAt`),
  INDEX `WorkspaceInvitation_workspaceId_status_idx` (`workspaceId`, `status`),
  INDEX `WorkspaceInvitation_invitedEmail_status_idx` (`invitedEmail`, `status`),
  INDEX `WorkspaceInvitation_expiresAt_idx` (`expiresAt`),
  CONSTRAINT `WorkspaceInvitation_workspaceId_fkey`
    FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WorkspaceAuthChallenge` (
  `id` VARCHAR(30) NOT NULL,
  `userId` VARCHAR(30) NOT NULL,
  `workspaceId` VARCHAR(30) NOT NULL,
  `method` VARCHAR(20) NOT NULL,
  `tokenHash` VARCHAR(64) NOT NULL,
  `challengeFor` VARCHAR(40) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `consumedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `WorkspaceAuthChallenge_userId_expiresAt_idx` (`userId`, `expiresAt`),
  INDEX `WorkspaceAuthChallenge_workspaceId_idx` (`workspaceId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Nullable workspaceId on domain tables (backfilled later, then NOT NULL).
ALTER TABLE `Address` ADD COLUMN `workspaceId` VARCHAR(30) NULL;
CREATE INDEX `Address_workspaceId_idx` ON `Address`(`workspaceId`);
ALTER TABLE `Address` ADD CONSTRAINT `Address_workspaceId_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Service` ADD COLUMN `workspaceId` VARCHAR(30) NULL;
CREATE INDEX `Service_workspaceId_idx` ON `Service`(`workspaceId`);
ALTER TABLE `Service` ADD CONSTRAINT `Service_workspaceId_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `MovingPlan` ADD COLUMN `workspaceId` VARCHAR(30) NULL;
CREATE INDEX `MovingPlan_workspaceId_idx` ON `MovingPlan`(`workspaceId`);
ALTER TABLE `MovingPlan` ADD CONSTRAINT `MovingPlan_workspaceId_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Budget` ADD COLUMN `workspaceId` VARCHAR(30) NULL;
CREATE INDEX `Budget_workspaceId_idx` ON `Budget`(`workspaceId`);
ALTER TABLE `Budget` ADD CONSTRAINT `Budget_workspaceId_fkey`
  FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
