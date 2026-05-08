export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { listRuntimeConfigCatalog, resetRuntimeConfigEntry, upsertRuntimeConfigEntry } from "@/lib/runtime-config";
import { requirePasswordConfirm, requirePermission } from "@/lib/auth";

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
    default:
      return "Value does not match the format required for this key.";
  }
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
  try {
    const session = await requirePermission("settings", "canUpdate", { minimumRole: "SUPER_ADMIN" });
    const raw = await req.json().catch(() => null);
    const parsed = runtimeConfigPutSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }
    const { key, value, note, confirmPassword, mfaCode, backupCode } = parsed.data;

    // Runtime-config holds secrets (Stripe, Resend, encryption keys,
    // Redis tokens). Treat the write path as "key rotation level": require
    // MFA when the admin has it enabled. Read path stays password-only via
    // GET above.
    const confirm = await requirePasswordConfirm(session, confirmPassword, {
      operation: "runtime_config",
      requireMfa: true,
      mfaCode,
      backupCode,
    });
    if (!confirm.confirmed) {
      return NextResponse.json({ error: confirm.error, requiresPassword: true }, { status: 403 });
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
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "UPDATE",
        entityType: "RuntimeConfig",
        entityId: entry.id,
        changes: JSON.stringify({
          key,
          note: note || null,
          valueLength: value.length,
        }),
        ipAddress: req.headers.get("x-forwarded-for") || "unknown",
      },
    });

    // Response intentionally returns only `{ success: true }` — never
    // include the saved value (or anything derived from it) so the
    // browser cache, fetch interceptors, or shoulder-surfers never see
    // it. The catalog endpoint surfaces a masked summary on next load.
    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (e?.message === "UNKNOWN_RUNTIME_CONFIG_KEY") return NextResponse.json({ error: "Unsupported config key" }, { status: 400 });
    if (e?.message === "EMPTY_RUNTIME_CONFIG_VALUE") return NextResponse.json({ error: "Config value cannot be empty" }, { status: 400 });
    if (e?.message === "RUNTIME_CONFIG_NOT_EDITABLE") {
      return NextResponse.json(
        {
          error:
            "This key is deployment-only and cannot be set via Runtime Config. Update it in DigitalOcean (or your deployment env) and redeploy.",
        },
        { status: 403 },
      );
    }
    if (typeof e?.message === "string" && e.message.startsWith("INVALID_RUNTIME_CONFIG_VALUE:")) {
      const reason = e.message.slice("INVALID_RUNTIME_CONFIG_VALUE:".length);
      return NextResponse.json({ error: invalidValueMessage(reason) }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await requirePermission("settings", "canDelete", { minimumRole: "SUPER_ADMIN" });
    const raw = await req.json().catch(() => null);
    const parsed = runtimeConfigDeleteSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }
    const { key, confirmPassword, mfaCode, backupCode } = parsed.data;

    const confirm = await requirePasswordConfirm(session, confirmPassword, {
      operation: "runtime_config",
      requireMfa: true,
      mfaCode,
      backupCode,
    });
    if (!confirm.confirmed) {
      return NextResponse.json({ error: confirm.error, requiresPassword: true }, { status: 403 });
    }

    const entry = await resetRuntimeConfigEntry(key, session.adminId);

    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "DELETE",
        entityType: "RuntimeConfig",
        entityId: entry?.id || key.slice(0, 30),
        changes: JSON.stringify({ key, source: "ENV" }),
        ipAddress: req.headers.get("x-forwarded-for") || "unknown",
      },
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (e?.message === "UNKNOWN_RUNTIME_CONFIG_KEY") return NextResponse.json({ error: "Unsupported config key" }, { status: 400 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
