export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listRuntimeConfigCatalog, resetRuntimeConfigEntry, upsertRuntimeConfigEntry } from "@/lib/runtime-config";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";
import { requireAdmin, requirePasswordConfirm, requirePermission, type AdminSession } from "@/lib/auth";

// Cap value length so a malicious admin cannot wedge a multi-MB blob
// into the encrypted column. Real-world keys/URLs are well under 16 KB;
// 64 KB leaves room for cert chains.
const runtimeConfigPutSchema = z
  .object({
    key: z.string().trim().min(1).max(100),
    value: z.string().min(1).max(64 * 1024),
    note: z.string().max(2000).optional(),
    confirmPassword: z.string().max(256).optional(),
    mfaCode: z.string().trim().max(16).optional(),
    backupCode: z.string().trim().max(64).optional(),
  })
  .strict();

const runtimeConfigDeleteSchema = z
  .object({
    key: z.string().trim().min(1).max(100),
    confirmPassword: z.string().max(256).optional(),
    mfaCode: z.string().trim().max(16).optional(),
    backupCode: z.string().trim().max(64).optional(),
  })
  .strict();

function invalidValueMessage(reason: string): string {
  switch (reason) {
    case "not_a_url":
      return "Value is not a valid URL.";
    case "non_http_scheme":
      return "URL must use http:// or https://.";
    case "requires_https":
      return "This setting must use https://.";
    case "internal_or_loopback_host":
      return "URL must not point to localhost or an internal hostname.";
    case "private_ip":
    case "link_local_ip":
      return "URL must not point to a private or link-local IP address.";
    case "hex_64_required":
      return "Value must be exactly 64 hexadecimal characters (256-bit key).";
    case "stripe_secret_prefix":
      return "Stripe secret key must start with sk_test_ or sk_live_.";
    case "stripe_webhook_prefix":
      return "Stripe webhook secret must start with whsec_.";
    case "resend_prefix":
      return "Resend API key must start with re_.";
    case "secret_too_short":
      return "Secret value is too short for this key.";
    case "placeholder_secret":
      return "Secret value still looks like a placeholder or test value.";
    case "boolean_required":
      return "Value must be exactly 'true' or 'false'.";
    case "positive_integer_required":
      return "Value must be a positive integer.";
    case "non_negative_integer_required":
      return "Value must be a non-negative integer.";
    case "email_required":
      return "Value must be a valid email address.";
    case "production_required":
      return "Value must be production for a production deployment.";
    case "production_like_required":
      return "Value must be production, staging, or preview.";
    case "stripe_publishable_prefix":
      return "Stripe publishable key must start with pk_test_ or pk_live_.";
    case "stripe_live_secret_required":
      return "Production-like deployments must use a live Stripe secret key.";
    case "stripe_live_publishable_required":
      return "Production-like deployments must use a live Stripe publishable key.";
    case "stripe_price_prefix":
      return "Stripe price IDs must start with price_.";
    case "masked_value":
      return "Masked or redacted display values cannot be saved. Paste the real value instead.";
    case "value_too_short":
      return "Value is too short for this key.";
    case "invalid_identifier":
      return "Identifier format is invalid for this key.";
    case "storage_provider":
      return "Backup storage provider must be one of: s3, s3-compatible, aws-s3, r2, cloudflare-r2.";
    case "bucket_name_pattern":
      return "Bucket name format is invalid.";
    case "region_pattern":
      return "Region format is invalid.";
    case "access_key_pattern":
      return "Access key format is invalid.";
    case "private_key_pem_required":
      return "Private key must be PEM formatted, including BEGIN/END PRIVATE KEY lines.";
    case "apple_team_id_pattern":
      return "Apple Team ID must be a 10-character uppercase identifier.";
    case "apple_key_id_pattern":
      return "Apple Key ID must be a 10-character uppercase identifier.";
    case "apple_environment":
      return "Apple environment must be Sandbox or Production.";
    case "product_id_pattern":
      return "Product ID format is invalid.";
    case "android_package_pattern":
      return "Google Play package name must look like an Android package name.";
    case "service_account_email_required":
      return "Google Play service account email must be an iam.gserviceaccount.com address.";
    default:
      return "Value does not match the format required for this key.";
  }
}

function safeAuditEntityId(key: string | null | undefined) {
  return (key || "runtime-config").slice(0, 30);
}

function safeStringField(raw: unknown, field: string): string | null {
  if (!raw || typeof raw !== "object") return null;
  const value = (raw as Record<string, unknown>)[field];
  return typeof value === "string" ? value : null;
}

function safeLength(value: string | null | undefined) {
  return typeof value === "string" ? value.length : undefined;
}

function stepUpFailureReason(confirm: { error?: string; requiresMfa?: boolean; rateLimited?: boolean }) {
  if (confirm.rateLimited) return "step_up_rate_limited";
  if (confirm.requiresMfa) return "mfa_required_or_invalid";
  if (confirm.error?.toLowerCase().includes("password confirmation required")) return "missing_password";
  if (confirm.error?.toLowerCase().includes("incorrect password")) return "failed_password";
  return "step_up_failed";
}

async function getAuditActor() {
  try {
    return await requireAdmin();
  } catch {
    return null;
  }
}

async function writeRuntimeConfigAudit(
  session: AdminSession | null,
  req: NextRequest,
  action: "RUNTIME_CONFIG_UPDATE_SUCCESS" | "RUNTIME_CONFIG_UPDATE_FAILED" | "RUNTIME_CONFIG_DELETE_SUCCESS" | "RUNTIME_CONFIG_DELETE_FAILED",
  key: string | null | undefined,
  metadata: Record<string, unknown>,
) {
  if (!session) return;
  await writeAdminAudit(session, {
    action,
    entityType: "RuntimeConfig",
    entityId: safeAuditEntityId(key),
    metadata,
    request: getAuditRequestMeta(req),
  });
}

interface RuntimeConfigErrorResponse {
  status: number;
  body: { error: string };
  reason: string;
  validationErrorCode?: string;
}

function runtimeConfigErrorResponse(error: unknown): RuntimeConfigErrorResponse {
  const message = error instanceof Error ? error.message : String((error as any)?.message || "");
  if (message === "UNAUTHORIZED") return { status: 401, body: { error: "Unauthorized" }, reason: "unauthorized" };
  if (message === "FORBIDDEN") return { status: 403, body: { error: "Forbidden" }, reason: "forbidden" };
  if (message === "UNKNOWN_RUNTIME_CONFIG_KEY") {
    return { status: 400, body: { error: "Unsupported config key" }, reason: "unknown_key" };
  }
  if (message === "EMPTY_RUNTIME_CONFIG_VALUE") {
    return { status: 400, body: { error: "Config value cannot be empty" }, reason: "empty_value" };
  }
  if (message === "RUNTIME_CONFIG_NOT_EDITABLE") {
    return {
      status: 403,
      body: {
        error:
          "This key is deployment-only and cannot be set via Runtime Config. Update it in DigitalOcean (or your deployment env) and redeploy.",
      },
      reason: "deployment_only",
    };
  }
  if (message.startsWith("INVALID_RUNTIME_CONFIG_VALUE:")) {
    const validationErrorCode = message.slice("INVALID_RUNTIME_CONFIG_VALUE:".length);
    return {
      status: 400,
      body: { error: invalidValueMessage(validationErrorCode) },
      reason: "invalid_value",
      validationErrorCode,
    };
  }
  return { status: 500, body: { error: "Internal error" }, reason: "unexpected_exception" };
}

export async function GET() {
  try {
    await requirePermission("settings", "canRead", { minimumRole: "SUPER_ADMIN" });
    const configs = await listRuntimeConfigCatalog();
    return NextResponse.json({ configs });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  let auditSession: AdminSession | null = null;
  let keyForAudit: string | null = null;
  let valueLength: number | undefined;
  let noteLength: number | undefined;
  try {
    auditSession = await getAuditActor();
    const session = await requirePermission("settings", "canUpdate", { minimumRole: "SUPER_ADMIN" });
    auditSession = session;
    const raw = await req.json().catch(() => null);
    keyForAudit = safeStringField(raw, "key");
    valueLength = safeLength(safeStringField(raw, "value"));
    noteLength = safeLength(safeStringField(raw, "note"));
    const parsed = runtimeConfigPutSchema.safeParse(raw);
    if (!parsed.success) {
      await writeRuntimeConfigAudit(auditSession, req, "RUNTIME_CONFIG_UPDATE_FAILED", keyForAudit, {
        operation: "runtime_config_update",
        key: keyForAudit,
        keyName: keyForAudit,
        reason: "invalid_body",
        status: "failed",
        valueLength,
        noteLength,
      });
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }
    const { key, value, note, confirmPassword, mfaCode, backupCode } = parsed.data;
    keyForAudit = key;
    valueLength = value.length;
    noteLength = note?.length ?? 0;

    // Runtime-config holds secrets (Stripe, Resend, encryption keys,
    // Redis tokens). Treat the write path as "key rotation level": require
    // MFA when the admin has it enabled. Read path stays password-only via
    // GET above.
    const confirm = await requirePasswordConfirm(session, confirmPassword, {
      operation: "runtime_config",
      requireMfa: true,
      mfaCode,
      backupCode,
      ipAddress: getAuditRequestMeta(req).ipAddress,
      userAgent: getAuditRequestMeta(req).userAgent,
    });
    if (!confirm.confirmed) {
      await writeRuntimeConfigAudit(auditSession, req, "RUNTIME_CONFIG_UPDATE_FAILED", key, {
        operation: "runtime_config_update",
        key,
        keyName: key,
        reason: stepUpFailureReason(confirm),
        status: "failed",
        requiresMfa: Boolean(confirm.requiresMfa),
        valueLength,
        noteLength,
      });
      return NextResponse.json(
        { error: confirm.error, requiresPassword: true, requiresMfa: confirm.requiresMfa || undefined },
        { status: 403 },
      );
    }

    const entry = await upsertRuntimeConfigEntry({
      key,
      value,
      note,
      adminId: session.adminId,
    });

    // Audit log records ONLY metadata — never the value or any portion
    // of it. Secret values are encrypted at rest in
    // RuntimeConfigEntry.valueEncrypted; the audit log is not.
    await writeRuntimeConfigAudit(session, req, "RUNTIME_CONFIG_UPDATE_SUCCESS", key, {
      operation: "runtime_config_update",
      key,
      keyName: key,
      valueLength: value.length,
      noteLength: note?.length ?? 0,
      source: "runtime_config_db",
      validationResult: entry.lastValidationStatus || "CONFIGURED",
      status: "success",
    });

    // Response intentionally returns only `{ success: true }` — never
    // include the saved value (or anything derived from it) so the
    // browser cache, fetch interceptors, or shoulder-surfers never see
    // it. The catalog endpoint surfaces a masked summary on next load.
    return NextResponse.json({ success: true });
  } catch (e: any) {
    const mapped = runtimeConfigErrorResponse(e);
    await writeRuntimeConfigAudit(auditSession, req, "RUNTIME_CONFIG_UPDATE_FAILED", keyForAudit, {
      operation: "runtime_config_update",
      key: keyForAudit,
      keyName: keyForAudit,
      reason: mapped.reason,
      status: "failed",
      validationErrorCode: mapped.validationErrorCode,
      valueLength,
      noteLength,
    });
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

export async function DELETE(req: NextRequest) {
  let auditSession: AdminSession | null = null;
  let keyForAudit: string | null = null;
  try {
    auditSession = await getAuditActor();
    const session = await requirePermission("settings", "canDelete", { minimumRole: "SUPER_ADMIN" });
    auditSession = session;
    const raw = await req.json().catch(() => null);
    keyForAudit = safeStringField(raw, "key");
    const parsed = runtimeConfigDeleteSchema.safeParse(raw);
    if (!parsed.success) {
      await writeRuntimeConfigAudit(auditSession, req, "RUNTIME_CONFIG_DELETE_FAILED", keyForAudit, {
        operation: "runtime_config_delete",
        key: keyForAudit,
        keyName: keyForAudit,
        reason: "invalid_body",
        status: "failed",
      });
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }
    const { key, confirmPassword, mfaCode, backupCode } = parsed.data;
    keyForAudit = key;

    const confirm = await requirePasswordConfirm(session, confirmPassword, {
      operation: "runtime_config",
      requireMfa: true,
      mfaCode,
      backupCode,
      ipAddress: getAuditRequestMeta(req).ipAddress,
      userAgent: getAuditRequestMeta(req).userAgent,
    });
    if (!confirm.confirmed) {
      await writeRuntimeConfigAudit(auditSession, req, "RUNTIME_CONFIG_DELETE_FAILED", key, {
        operation: "runtime_config_delete",
        key,
        keyName: key,
        reason: stepUpFailureReason(confirm),
        status: "failed",
        requiresMfa: Boolean(confirm.requiresMfa),
      });
      return NextResponse.json(
        { error: confirm.error, requiresPassword: true, requiresMfa: confirm.requiresMfa || undefined },
        { status: 403 },
      );
    }

    const entry = await resetRuntimeConfigEntry(key, session.adminId);

    await writeRuntimeConfigAudit(session, req, "RUNTIME_CONFIG_DELETE_SUCCESS", key, {
      operation: "runtime_config_delete",
      key,
      keyName: key,
      fallbackStatus: entry?.lastValidationStatus || "NO_DB_OVERRIDE",
      source: "env_fallback",
      status: "success",
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    const mapped = runtimeConfigErrorResponse(e);
    await writeRuntimeConfigAudit(auditSession, req, "RUNTIME_CONFIG_DELETE_FAILED", keyForAudit, {
      operation: "runtime_config_delete",
      key: keyForAudit,
      keyName: keyForAudit,
      reason: mapped.reason,
      status: "failed",
      validationErrorCode: mapped.validationErrorCode,
    });
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
