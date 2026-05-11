import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import type { AdminSession } from "@/lib/auth";
import { redactBackupSecretText } from "@/lib/backup-metadata";

type BackupAuditSession = Partial<AdminSession> | null | undefined;

export interface BackupAuditInput {
  session?: BackupAuditSession;
  action: string;
  entityId?: string | null;
  request?: NextRequest | Request | { headers: Headers } | null;
  metadata?: Record<string, unknown>;
  error?: unknown;
}

function firstForwardedIp(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

const DANGEROUS_METADATA_KEYS = new Set([
  "password",
  "confirmpassword",
  "mfacode",
  "backupcode",
  "token",
  "accesstoken",
  "refreshtoken",
  "secret",
  "key",
  "encryptionkey",
  "privatekey",
  "archive",
  "archivecontent",
  "downloaddata",
  "rawcontent",
  "signatureinput",
  "credential",
  "credentials",
  "authorization",
  "cookie",
]);

function normalizeMetadataKey(key: string) {
  return key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function shouldRedactMetadataKey(key: string) {
  const normalized = normalizeMetadataKey(key);
  return (
    DANGEROUS_METADATA_KEYS.has(normalized) ||
    normalized.includes("password") ||
    normalized.includes("token") ||
    normalized.includes("secret") ||
    normalized.includes("credential") ||
    normalized.includes("authorization") ||
    normalized.includes("cookie") ||
    normalized.endsWith("key")
  );
}

function redactBackupAuditMetadataValue(
  value: unknown,
  seen: WeakSet<object>,
): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === "bigint") return value.toString();
  if (typeof value === "symbol" || typeof value === "function") {
    return "[UNSERIALIZABLE]";
  }
  if (typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactBackupAuditMetadataValue(item, seen));
  }

  const output: Record<string, unknown> = {};
  let entries: Array<[string, unknown]>;
  try {
    entries = Object.entries(value as Record<string, unknown>);
  } catch {
    return "[UNSERIALIZABLE]";
  }

  for (const [key, nested] of entries) {
    output[key] = shouldRedactMetadataKey(key)
      ? "[REDACTED]"
      : redactBackupAuditMetadataValue(nested, seen);
  }

  return output;
}

export function redactBackupAuditMetadata(value: unknown): unknown {
  return redactBackupAuditMetadataValue(value, new WeakSet<object>());
}

export function getBackupAuditRequestMeta(
  request?: BackupAuditInput["request"],
) {
  const headers = request?.headers;
  if (!headers) return { ipAddress: null, userAgent: null };
  return {
    ipAddress:
      firstForwardedIp(headers.get("cf-connecting-ip")) ||
      firstForwardedIp(headers.get("x-vercel-forwarded-for")) ||
      firstForwardedIp(headers.get("x-forwarded-for")) ||
      firstForwardedIp(headers.get("x-real-ip")) ||
      "unknown",
    userAgent: headers.get("user-agent") || "unknown",
  };
}

export async function writeBackupAudit(input: BackupAuditInput): Promise<void> {
  const create = (prisma as any).adminAuditLog?.create;
  if (typeof create !== "function") return;

  const requestMeta = getBackupAuditRequestMeta(input.request || null);
  const safeMetadata = redactBackupAuditMetadata(input.metadata || {});
  const changes: Record<string, unknown> = {
    actor: input.session
      ? {
          adminId: input.session.adminId || null,
          email: input.session.email || null,
          role: input.session.role || null,
          userAgent: requestMeta.userAgent,
        }
      : {
          adminId: null,
          email: "cron",
          role: "SYSTEM",
          userAgent: requestMeta.userAgent,
    },
    success: !input.error,
    ...(safeMetadata as Record<string, unknown>),
  };

  if (input.error) {
    changes.error = redactBackupSecretText(input.error).slice(0, 500);
  }

  try {
    await create({
      data: {
        adminUserId: input.session?.adminId || null,
        action: input.action.slice(0, 64),
        entityType: "BackupRecord",
        entityId: (input.entityId || "backup").slice(0, 30),
        changes: JSON.stringify(changes),
        ipAddress: requestMeta.ipAddress,
      },
    });
  } catch (error) {
    console.error("[backup-audit] write failed:", redactBackupSecretText(error));
  }
}
