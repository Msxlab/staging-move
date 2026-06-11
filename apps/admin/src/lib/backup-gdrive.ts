import { createSign, randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { getAdminRuntimeConfigValues } from "@/lib/runtime-config";
import { redactBackupSecretText } from "@/lib/backup-metadata";
import {
  parseBackupRecordMetadata,
  serializeBackupRecordMetadata,
  type BackupGdriveMirrorMetadata,
} from "@/lib/backup-storage";

/**
 * Google Drive backup mirror (zero new dependencies).
 *
 * After a backup archive is successfully uploaded to the primary
 * offsite S3/R2 target, the SAME encrypted archive bytes can ALSO be
 * mirrored to the owner's Google Drive folder. The implementation is
 * a hand-rolled Drive REST v3 client:
 *
 *   1. Mint an RS256 service-account JWT with node:crypto createSign.
 *   2. Exchange it for an OAuth2 access token.
 *   3. Multipart media upload into the configured folder.
 *
 * Hard guarantees:
 * - Fire-and-forget: every failure is logged and recorded on the
 *   BackupRecord metadata, but NEVER thrown into the backup path.
 * - Disabled by default (GDRIVE_BACKUP_ENABLED must be exactly "true").
 * - Retention does NOT manage Drive — mirrored archives accumulate and
 *   the owner prunes them manually in Drive.
 */

export const GDRIVE_BACKUP_CONFIG_KEYS = [
  "GDRIVE_BACKUP_ENABLED",
  "GDRIVE_SERVICE_ACCOUNT_EMAIL",
  "GDRIVE_SERVICE_ACCOUNT_KEY",
  "GDRIVE_BACKUP_FOLDER_ID",
] as const;

export const GDRIVE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GDRIVE_UPLOAD_URL =
  "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id%2Cname";
// drive.file scope: the service account only ever sees files it created
// itself plus folders explicitly shared with it — least privilege.
export const GDRIVE_OAUTH_SCOPE = "https://www.googleapis.com/auth/drive.file";

interface GdriveBackupConfig {
  enabled: boolean;
  serviceAccountEmail: string | null;
  privateKeyPem: string | null;
  folderId: string | null;
}

function normalizeValue(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function resolveGdriveBackupConfig(): Promise<GdriveBackupConfig> {
  const values = await getAdminRuntimeConfigValues([
    ...GDRIVE_BACKUP_CONFIG_KEYS,
  ]);
  return {
    // Only the exact string "true" enables the mirror, matching the
    // catalog's strict boolean validation (typos stay off).
    enabled: values.GDRIVE_BACKUP_ENABLED?.trim() === "true",
    serviceAccountEmail: normalizeValue(values.GDRIVE_SERVICE_ACCOUNT_EMAIL),
    privateKeyPem: normalizeValue(values.GDRIVE_SERVICE_ACCOUNT_KEY),
    folderId: normalizeValue(values.GDRIVE_BACKUP_FOLDER_ID),
  };
}

function base64UrlEncode(input: Buffer | string): string {
  return (typeof input === "string" ? Buffer.from(input, "utf-8") : input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Accept both full PEM blocks and bare base64 key bodies (the catalog's
 * PEM validation allows either), and tolerate `\n`-escaped newlines from
 * pasted single-line env values.
 */
export function normalizeGdrivePrivateKeyPem(value: string): string {
  const normalized = value.replace(/\\n/g, "\n").trim();
  if (normalized.includes("-----BEGIN")) return normalized;
  const body = normalized.replace(/\s+/g, "");
  const wrapped = body.match(/.{1,64}/g)?.join("\n") ?? body;
  return `-----BEGIN PRIVATE KEY-----\n${wrapped}\n-----END PRIVATE KEY-----`;
}

/**
 * Assemble the signed service-account JWT used for the OAuth2 token
 * exchange (RS256 via node:crypto — no googleapis dependency).
 */
export function buildGdriveJwtAssertion(input: {
  serviceAccountEmail: string;
  privateKeyPem: string;
  issuedAtSeconds?: number;
}): string {
  const issuedAt =
    input.issuedAtSeconds ?? Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(
    JSON.stringify({ alg: "RS256", typ: "JWT" }),
  );
  const claims = base64UrlEncode(
    JSON.stringify({
      iss: input.serviceAccountEmail,
      scope: GDRIVE_OAUTH_SCOPE,
      aud: GDRIVE_TOKEN_URL,
      iat: issuedAt,
      exp: issuedAt + 3600,
    }),
  );
  const signingInput = `${header}.${claims}`;
  const signature = createSign("RSA-SHA256")
    .update(signingInput)
    .sign(normalizeGdrivePrivateKeyPem(input.privateKeyPem));
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

/**
 * Build the multipart/related body for a Drive v3 multipart media
 * upload: part one is the file metadata (name + parent folder), part
 * two is the raw archive bytes.
 */
export function buildGdriveMultipartBody(input: {
  fileName: string;
  folderId: string;
  content: Buffer;
  contentType?: string;
  boundary?: string;
}): { body: Buffer; contentType: string } {
  const boundary =
    input.boundary || `locateflow-gdrive-${randomBytes(12).toString("hex")}`;
  const metadata = JSON.stringify({
    name: input.fileName,
    parents: [input.folderId],
  });
  const mediaType = input.contentType || "application/json";
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\n` +
        `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
        `${metadata}\r\n` +
        `--${boundary}\r\n` +
        `Content-Type: ${mediaType}\r\n\r\n`,
      "utf-8",
    ),
    input.content,
    Buffer.from(`\r\n--${boundary}--\r\n`, "utf-8"),
  ]);
  return { body, contentType: `multipart/related; boundary=${boundary}` };
}

/**
 * The mirrored file keeps the exact storage-key basename so the Drive
 * copy and the offsite object are trivially correlatable.
 */
export function getGdriveMirrorFileName(
  offsiteObjectKey: string | null | undefined,
  fallbackFileName: string,
): string {
  const basename = offsiteObjectKey
    ?.split("/")
    .filter(Boolean)
    .pop()
    ?.trim();
  return basename || fallbackFileName;
}

function createGdriveMetadata(
  status: BackupGdriveMirrorMetadata["status"],
  overrides: Partial<BackupGdriveMirrorMetadata> = {},
): BackupGdriveMirrorMetadata {
  return {
    status,
    fileId: null,
    fileName: null,
    folderId: null,
    uploadedAt: null,
    reason: null,
    ...overrides,
  };
}

async function readResponseDetail(response: Response): Promise<string> {
  return (await response.text().catch(() => "")).slice(0, 300).trim();
}

/**
 * Upload one archive to the configured Drive folder. Resolves with a
 * status of "disabled", "failed", or "stored" — it never throws.
 */
export async function uploadBackupArchiveToGdrive(input: {
  fileName: string;
  archiveBody: string | Buffer;
}): Promise<BackupGdriveMirrorMetadata> {
  let config: GdriveBackupConfig;
  try {
    config = await resolveGdriveBackupConfig();
  } catch (error: any) {
    return createGdriveMetadata("failed", {
      fileName: input.fileName,
      reason: redactBackupSecretText(
        error?.message || "Failed to read Google Drive mirror configuration.",
      ),
    });
  }

  if (!config.enabled) {
    return createGdriveMetadata("disabled", {
      reason: "Google Drive backup mirror is disabled.",
    });
  }

  if (!config.serviceAccountEmail || !config.privateKeyPem || !config.folderId) {
    const missing = [
      !config.serviceAccountEmail && "GDRIVE_SERVICE_ACCOUNT_EMAIL",
      !config.privateKeyPem && "GDRIVE_SERVICE_ACCOUNT_KEY",
      !config.folderId && "GDRIVE_BACKUP_FOLDER_ID",
    ]
      .filter(Boolean)
      .join(", ");
    return createGdriveMetadata("failed", {
      fileName: input.fileName,
      folderId: config.folderId,
      reason: `Google Drive mirror is enabled but missing: ${missing}.`,
    });
  }

  try {
    let assertion: string;
    try {
      assertion = buildGdriveJwtAssertion({
        serviceAccountEmail: config.serviceAccountEmail,
        privateKeyPem: config.privateKeyPem,
      });
    } catch (error: any) {
      return createGdriveMetadata("failed", {
        fileName: input.fileName,
        folderId: config.folderId,
        reason: `Service account key rejected: ${redactBackupSecretText(
          error?.message || "unable to sign JWT",
        )}`,
      });
    }

    const tokenResponse = await fetch(GDRIVE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }).toString(),
    });
    if (!tokenResponse.ok) {
      const detail = await readResponseDetail(tokenResponse);
      return createGdriveMetadata("failed", {
        fileName: input.fileName,
        folderId: config.folderId,
        reason: detail
          ? `Token exchange failed (${tokenResponse.status}): ${redactBackupSecretText(detail)}`
          : `Token exchange failed with status ${tokenResponse.status}.`,
      });
    }
    const tokenPayload = (await tokenResponse.json().catch(() => null)) as {
      access_token?: unknown;
    } | null;
    const accessToken =
      typeof tokenPayload?.access_token === "string"
        ? tokenPayload.access_token
        : null;
    if (!accessToken) {
      return createGdriveMetadata("failed", {
        fileName: input.fileName,
        folderId: config.folderId,
        reason: "Token exchange succeeded but returned no access token.",
      });
    }

    const content = Buffer.isBuffer(input.archiveBody)
      ? input.archiveBody
      : Buffer.from(input.archiveBody, "utf-8");
    const multipart = buildGdriveMultipartBody({
      fileName: input.fileName,
      folderId: config.folderId,
      content,
    });
    const uploadResponse = await fetch(GDRIVE_UPLOAD_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": multipart.contentType,
      },
      body: new Uint8Array(multipart.body),
    });
    if (!uploadResponse.ok) {
      const detail = await readResponseDetail(uploadResponse);
      return createGdriveMetadata("failed", {
        fileName: input.fileName,
        folderId: config.folderId,
        reason: detail
          ? `Drive upload failed (${uploadResponse.status}): ${redactBackupSecretText(detail)}`
          : `Drive upload failed with status ${uploadResponse.status}.`,
      });
    }
    const uploadPayload = (await uploadResponse.json().catch(() => null)) as {
      id?: unknown;
    } | null;

    return createGdriveMetadata("stored", {
      fileId: typeof uploadPayload?.id === "string" ? uploadPayload.id : null,
      fileName: input.fileName,
      folderId: config.folderId,
      uploadedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return createGdriveMetadata("failed", {
      fileName: input.fileName,
      folderId: config.folderId,
      reason: redactBackupSecretText(
        error?.message || "Google Drive mirror upload failed.",
      ),
    });
  }
}

/**
 * Best-effort: persist the mirror outcome on the BackupRecord's JSON
 * metadata (the same errorMessage envelope as offsite/archive). Runs
 * AFTER the backup is already COMPLETED, so a lost write here only
 * costs observability — the logs above still carry the outcome.
 */
async function recordGdriveMirrorOutcome(
  backupId: string,
  result: BackupGdriveMirrorMetadata,
): Promise<void> {
  try {
    const record = await prisma.backupRecord.findUnique({
      where: { id: backupId },
      select: { errorMessage: true },
    });
    if (!record) return;
    const metadata = parseBackupRecordMetadata(record.errorMessage);
    await prisma.backupRecord.update({
      where: { id: backupId },
      data: {
        errorMessage: serializeBackupRecordMetadata({
          ...metadata,
          gdrive: result,
        }),
      },
    });
  } catch (error) {
    console.error(
      `[BACKUP-GDRIVE] failed to record mirror outcome backup=${backupId}: ${redactBackupSecretText(error)}`,
    );
  }
}

/**
 * Fire-and-forget entry point used by the manual and cron backup flows
 * AFTER the offsite upload succeeded. Logs the outcome, records it on
 * the BackupRecord metadata, and NEVER rejects — a Drive outage can
 * never fail a backup.
 */
export async function mirrorBackupArchiveToGdrive(input: {
  backupId: string;
  fileName: string;
  archiveBody: string | Buffer;
}): Promise<BackupGdriveMirrorMetadata> {
  try {
    const result = await uploadBackupArchiveToGdrive({
      fileName: input.fileName,
      archiveBody: input.archiveBody,
    });
    if (result.status === "disabled") {
      // Default state: stay silent so every backup run does not log a
      // non-event, and leave the record metadata untouched.
      return result;
    }
    if (result.status === "stored") {
      console.info(
        `[BACKUP-GDRIVE] mirror stored backup=${input.backupId} file=${result.fileName || input.fileName} driveFileId=${result.fileId || "<unknown>"}`,
      );
    } else {
      console.error(
        `[BACKUP-GDRIVE] mirror failed backup=${input.backupId} file=${input.fileName}: ${redactBackupSecretText(result.reason || "unknown error")}`,
      );
    }
    await recordGdriveMirrorOutcome(input.backupId, result);
    return result;
  } catch (error) {
    const reason = redactBackupSecretText(error);
    console.error(
      `[BACKUP-GDRIVE] mirror failed backup=${input.backupId} file=${input.fileName}: ${reason}`,
    );
    return createGdriveMetadata("failed", {
      fileName: input.fileName,
      reason,
    });
  }
}
