import type { BackupOffsiteMetadata } from "@/lib/backup-storage";
import { validateKeyFormat } from "@/lib/shared-encryption";

export class BackupPolicyError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 503,
  ) {
    super(message);
    this.name = "BackupPolicyError";
  }
}

export interface BackupArchivePolicy {
  environment: string;
  production: boolean;
  encryptionRequired: boolean;
  cryptoReady: boolean;
  offsiteRequired: boolean;
  browserDownloadFallbackAllowed: boolean;
  message: string;
}

export const BACKUP_ARCHIVE_WARN_BYTES = 500 * 1024 * 1024;
export const BACKUP_ARCHIVE_MAX_BYTES = 1024 * 1024 * 1024;

function normalizeEnvValue(value: string | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export function getBackupArchivePolicy(
  env: NodeJS.ProcessEnv = process.env,
): BackupArchivePolicy {
  const environment = normalizeEnvValue(env.NODE_ENV) || "development";
  const production = environment === "production";
  const cryptoReady = validateKeyFormat(
    normalizeEnvValue(env.FIELD_ENCRYPTION_KEY),
  );

  return {
    environment,
    production,
    encryptionRequired: production,
    cryptoReady,
    offsiteRequired: production,
    browserDownloadFallbackAllowed: !production,
    message: production
      ? "Production backups require FIELD_ENCRYPTION_KEY, HMAC signing, encryption, and offsite storage. Browser download fallback is disabled."
      : "Non-production backups may use browser download fallback when offsite storage is unavailable.",
  };
}

export function requireBackupCrypto(policy = getBackupArchivePolicy()): void {
  if (policy.encryptionRequired && !policy.cryptoReady) {
    throw new BackupPolicyError(
      "BACKUP_CRYPTO_NOT_CONFIGURED",
      "Production backup archives require FIELD_ENCRYPTION_KEY to be a valid 64-character hex key. Refusing to create a plaintext or unsigned archive.",
    );
  }
}

export function requireArchiveProtected(input: {
  policy?: BackupArchivePolicy;
  encrypted: boolean;
  signed: boolean;
}): void {
  const policy = input.policy || getBackupArchivePolicy();
  if (policy.encryptionRequired && (!input.encrypted || !input.signed)) {
    throw new BackupPolicyError(
      "BACKUP_ARCHIVE_UNPROTECTED",
      "Production backup archive was not encrypted and signed. Refusing to retain or return the archive.",
    );
  }
}

export function requireOffsiteStored(input: {
  policy?: BackupArchivePolicy;
  offsite: BackupOffsiteMetadata;
}): void {
  const policy = input.policy || getBackupArchivePolicy();
  if (policy.offsiteRequired && input.offsite.status !== "stored") {
    throw new BackupPolicyError(
      "BACKUP_OFFSITE_REQUIRED",
      input.offsite.reason
        ? `Production backups require offsite storage. Upload did not complete: ${input.offsite.reason}`
        : "Production backups require offsite storage. Upload did not complete.",
    );
  }
}

export function shouldReturnBrowserDownloadFallback(input: {
  policy?: BackupArchivePolicy;
  offsite: BackupOffsiteMetadata;
}): boolean {
  const policy = input.policy || getBackupArchivePolicy();
  return policy.browserDownloadFallbackAllowed && input.offsite.status !== "stored";
}

export function evaluateBackupArchiveSize(bytes: number): {
  ok: boolean;
  warning: string | null;
} {
  if (bytes > BACKUP_ARCHIVE_MAX_BYTES) {
    throw new BackupPolicyError(
      "BACKUP_ARCHIVE_TOO_LARGE",
      "Backup archive exceeds the 1 GB safety limit. Use a managed database snapshot or a reviewed paginated export plan.",
      413,
    );
  }

  if (bytes >= BACKUP_ARCHIVE_WARN_BYTES) {
    return {
      ok: true,
      warning:
        "Backup archive is larger than 500 MB. Monitor storage cost and plan cursor-based pagination before data grows further.",
    };
  }

  return { ok: true, warning: null };
}
