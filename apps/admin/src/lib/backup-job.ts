import type { NextRequest } from "next/server";
import { prisma, prismaUnsafe } from "@/lib/db";
import { createBackupArchive } from "@/lib/backup-archive";
import {
  BACKUP_TABLE_ORDER,
  fetchAllRecords,
  MAX_BACKUP_ROWS_PER_TABLE,
  normalizeBackupTables,
} from "@/lib/backup-tables";
import {
  evaluateBackupArchiveSize,
  getBackupArchivePolicy,
  requireArchiveProtected,
  requireBackupCrypto,
  requireOffsiteStored,
  shouldReturnBrowserDownloadFallback,
} from "@/lib/backup-policy";
import {
  serializeBackupRecordMetadata,
  uploadBackupArchive,
} from "@/lib/backup-storage";
import { encryptBackup, signBackup } from "@/lib/shared-encryption";
import {
  acquireBackupRunLock,
  markBackupRunFailed,
} from "@/lib/backup-lock";
import {
  getBackupRuntimeMetadata,
  redactBackupSecretText,
} from "@/lib/backup-metadata";

export interface BackupJobActor {
  adminId: string;
  email?: string | null;
}

export interface BackupJobResult {
  backup: any;
  downloadData?: string;
  archivePolicy: ReturnType<typeof getBackupArchivePolicy>;
  offsite: Awaited<ReturnType<typeof uploadBackupArchive>>;
  encrypted: boolean;
  signature: boolean;
  fileSize: number;
  totalRecords: number;
  selectedTables: string[];
  truncatedTables: string[];
  failedTables: string[];
  partial: boolean;
  archiveSizeWarning: string | null;
}

export async function createBackupJob(input: {
  actor: BackupJobActor;
  type?: string;
  tables?: string[];
  format?: string;
  request?: NextRequest | Request | null;
  lockIgnoreActiveIds?: string[];
}) {
  let backupId: string | null = null;
  try {
    const type = input.type || "FULL";
    const format = input.format || "JSON";
    const archivePolicy = getBackupArchivePolicy();
    const requestedTables =
      Array.isArray(input.tables) && input.tables.length > 0
        ? input.tables
        : BACKUP_TABLE_ORDER;
    const selectedTables = normalizeBackupTables(requestedTables);
    if (selectedTables.length === 0) {
      throw new Error("BACKUP_NO_VALID_TABLES");
    }

    const backup = await acquireBackupRunLock({
      prismaClient: prisma as any,
      ignoreActiveBackupIds: input.lockIgnoreActiveIds,
      data: {
        type,
        status: "IN_PROGRESS",
        format,
        tables: JSON.stringify(selectedTables),
        createdBy: input.actor.adminId,
      },
    });
    backupId = backup.id;
    requireBackupCrypto(archivePolicy);

    const backupData: Record<string, any[]> = {};
    const tableCounts: Record<string, number> = {};
    const failedTables: string[] = [];
    const truncatedTables: string[] = [];
    let totalRecords = 0;

    for (const tableName of selectedTables) {
      try {
        const result = await fetchAllRecords(prismaUnsafe as any, tableName);
        backupData[tableName] = result.records;
        tableCounts[tableName] = result.fetched;
        totalRecords += result.fetched;
        if (result.truncated) truncatedTables.push(tableName);
      } catch (err) {
        console.error(
          `Failed to backup table ${tableName}: ${redactBackupSecretText(err)}`,
        );
        backupData[tableName] = [];
        tableCounts[tableName] = 0;
        failedTables.push(tableName);
      }
    }

    const effectiveType =
      truncatedTables.length > 0 || failedTables.length > 0 ? "PARTIAL" : type;
    const runtimeMetadata = getBackupRuntimeMetadata();
    const createdAt = new Date();
    const createdAtIso = createdAt.toISOString();
    const content = JSON.stringify(
      {
        metadata: {
          createdAt: createdAtIso,
          createdBy: input.actor.email || input.actor.adminId,
          type: effectiveType,
          requestedType: type,
          format,
          tables: selectedTables,
          tableCount: selectedTables.length,
          totalRecords,
          truncatedTables,
          failedTables,
          maxRowsPerTable: MAX_BACKUP_ROWS_PER_TABLE,
          environment: runtimeMetadata.environment,
          compatibility: runtimeMetadata.compatibility,
        },
        data: backupData,
      },
      null,
      2,
    );

    const fileName = `backup-${effectiveType.toLowerCase()}-${createdAtIso.slice(0, 10)}-${backup.id}.json`;
    const encrypted = encryptBackup(content);
    const signature = signBackup(content);
    requireArchiveProtected({
      policy: archivePolicy,
      encrypted: Boolean(encrypted),
      signed: Boolean(signature),
    });

    const archive = createBackupArchive({
      metadata: {
        backupId: backup.id,
        fileName,
        createdAt: createdAtIso,
        createdBy: input.actor.email || input.actor.adminId,
        type: effectiveType,
        format,
        tables: selectedTables,
        tableCount: selectedTables.length,
        totalRecords,
        tableCounts,
        truncatedTables,
        failedTables,
        maxRowsPerTable: MAX_BACKUP_ROWS_PER_TABLE,
        environment: runtimeMetadata.environment,
        compatibility: runtimeMetadata.compatibility,
      },
      rawContent: content,
      signature,
      encrypted,
    });
    const downloadData = JSON.stringify(archive, null, 2);
    const fileSize = Buffer.byteLength(downloadData, "utf-8");
    const sizeEvaluation = evaluateBackupArchiveSize(fileSize);
    const offsite = await uploadBackupArchive({
      backupId: backup.id,
      fileName,
      archiveBody: downloadData,
    });
    requireOffsiteStored({ policy: archivePolicy, offsite });

    const completedAt = new Date();
    const metadata = serializeBackupRecordMetadata({
      offsite,
      archive: {
        encrypted: Boolean(encrypted),
        signature: Boolean(signature),
        totalRecords,
        tableCounts,
        tableCount: selectedTables.length,
        archiveSizeWarning: sizeEvaluation.warning,
        truncatedTables: truncatedTables.length > 0 ? truncatedTables : undefined,
        failedTables: failedTables.length > 0 ? failedTables : undefined,
        maxRowsPerTable: MAX_BACKUP_ROWS_PER_TABLE,
        environment: runtimeMetadata.environment,
        compatibility: runtimeMetadata.compatibility,
      },
    });

    await prisma.backupRecord.update({
      where: { id: backup.id },
      data: {
        type: effectiveType,
        status: "COMPLETED",
        fileName,
        fileSize,
        recordCount: totalRecords,
        completedAt,
        errorMessage: metadata,
      },
    });

    return {
      backup: {
        ...backup,
        type: effectiveType,
        status: "COMPLETED",
        fileName,
        fileSize,
        recordCount: totalRecords,
        completedAt,
        errorMessage: metadata,
      },
      downloadData: shouldReturnBrowserDownloadFallback({
        policy: archivePolicy,
        offsite,
      })
        ? downloadData
        : undefined,
      archivePolicy,
      offsite,
      encrypted: Boolean(encrypted),
      signature: Boolean(signature),
      fileSize,
      totalRecords,
      selectedTables,
      truncatedTables,
      failedTables,
      partial: truncatedTables.length > 0 || failedTables.length > 0,
      archiveSizeWarning: sizeEvaluation.warning,
    } satisfies BackupJobResult;
  } catch (error) {
    if (backupId) {
      await markBackupRunFailed({
        prismaClient: prisma as any,
        backupId,
        error,
      });
    }
    throw error;
  }
}
