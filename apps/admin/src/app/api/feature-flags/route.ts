export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePasswordConfirm, requirePermission } from "@/lib/auth";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";

export async function GET() {
  try {
    await requirePermission("settings", "canRead", { minimumRole: "ADMIN", fallbackResources: ["audit_logs"] });
    const flags = await prisma.featureFlag.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json({ flags });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// Feature flag changes are trivially reversible by the same operator
// (flip the boolean back, re-PUT the rollout %), so a one-hour grace
// window means an operator working through an incident enters their
// password once instead of every ten minutes. Step-up is still REQUIRED
// — only the cache TTL is wider than the 10-min default.
const FEATURE_FLAG_STEP_UP_GRACE_MS = 60 * 60 * 1000;
const TARGET_TYPES = ["ALL", "PERCENTAGE", "USER_LIST", "PLAN"] as const;

const stepUpSchema = {
  confirmPassword: z.string().max(256).optional(),
  mfaCode: z.string().trim().max(16).optional(),
  backupCode: z.string().trim().max(64).optional(),
};

const createFlagSchema = z
  .object({
    name: z.string().trim().min(1).max(100).regex(/^[a-z][a-z0-9_.:-]*$/),
    description: z.string().max(500).nullable().optional(),
    enabled: z.boolean().optional(),
    targetType: z.enum(TARGET_TYPES).optional(),
    targetValue: z.unknown().optional().nullable(),
    ...stepUpSchema,
  })
  .strict();

const updateFlagSchema = z
  .object({
    id: z.string().trim().min(1).max(30),
    description: z.string().max(500).nullable().optional(),
    enabled: z.boolean().optional(),
    targetType: z.enum(TARGET_TYPES).optional(),
    targetValue: z.unknown().optional().nullable(),
    ...stepUpSchema,
  })
  .strict();

const deleteFlagSchema = z
  .object({
    id: z.string().trim().min(1).max(30),
    ...stepUpSchema,
  })
  .strict();

type TargetType = (typeof TARGET_TYPES)[number];

function safeDescription(value: string | null | undefined) {
  if (typeof value !== "string") return value === null ? null : undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeStringList(raw: unknown, key: "userIds" | "plans", maxItems: number) {
  if (!isRecord(raw) || !Array.isArray(raw[key])) return null;
  const values = Array.from(
    new Set(
      raw[key]
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter((item) => item.length > 0 && item.length <= 100),
    ),
  );
  if (values.length === 0 || values.length > maxItems) return null;
  return values;
}

function normalizeTargetValue(
  targetType: TargetType | undefined,
  rawValue: unknown,
  mode: "create" | "update",
): { ok: true; value: string | null | undefined } | { ok: false; error: string } {
  if (!targetType) {
    if (rawValue !== undefined) return { ok: false, error: "targetType is required when targetValue is provided" };
    return { ok: true, value: undefined };
  }

  if (targetType === "ALL") {
    return { ok: true, value: null };
  }

  if (rawValue === undefined || rawValue === null) {
    return {
      ok: false,
      error: mode === "create" ? "Target value is required for targeted flags" : "Target value is required when changing target type",
    };
  }

  if (targetType === "PERCENTAGE") {
    const percentage = isRecord(rawValue) ? rawValue.percentage : null;
    if (typeof percentage !== "number" || !Number.isInteger(percentage) || percentage < 0 || percentage > 100) {
      return { ok: false, error: "Percentage target must be an integer from 0 to 100" };
    }
    return { ok: true, value: JSON.stringify({ percentage }) };
  }

  if (targetType === "USER_LIST") {
    const userIds = normalizeStringList(rawValue, "userIds", 200);
    if (!userIds) return { ok: false, error: "User list target must include 1-200 user IDs" };
    return { ok: true, value: JSON.stringify({ userIds }) };
  }

  const plans = normalizeStringList(rawValue, "plans", 20);
  if (!plans || !plans.every((plan) => /^[A-Z0-9_-]+$/.test(plan))) {
    return { ok: false, error: "Plan target must include 1-20 plan identifiers" };
  }
  return { ok: true, value: JSON.stringify({ plans }) };
}

function flagAuditSummary(flag: {
  name?: string | null;
  enabled?: boolean | null;
  description?: string | null;
  targetType?: string | null;
  targetValue?: string | null;
}) {
  return {
    name: flag.name ?? null,
    enabled: Boolean(flag.enabled),
    descriptionLength: typeof flag.description === "string" ? flag.description.length : 0,
    targetType: flag.targetType ?? null,
    targetValuePresent: Boolean(flag.targetValue),
    targetValueLength: typeof flag.targetValue === "string" ? flag.targetValue.length : 0,
  };
}

async function auditFeatureFlag(
  session: Awaited<ReturnType<typeof requirePermission>>,
  req: NextRequest,
  input: {
    action: string;
    entityId: string;
    before?: unknown;
    after?: unknown;
    metadata?: Record<string, unknown>;
  },
) {
  await writeAdminAudit(session, {
    action: input.action,
    entityType: "FeatureFlag",
    entityId: input.entityId.slice(0, 30),
    before: input.before,
    after: input.after,
    metadata: input.metadata,
    request: getAuditRequestMeta(req),
  });
}

function stepUpOptions(req: NextRequest, data: { mfaCode?: string; backupCode?: string }) {
  const meta = getAuditRequestMeta(req);
  return {
    operation: "feature_flag_write",
    maxAgeMs: FEATURE_FLAG_STEP_UP_GRACE_MS,
    requireMfa: true,
    mfaCode: data.mfaCode,
    backupCode: data.backupCode,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  };
}

function stepUpResponse(confirm: { error?: string; requiresMfa?: boolean; rateLimited?: boolean }) {
  return NextResponse.json(
    { error: confirm.error, requiresPassword: true, requiresMfa: confirm.requiresMfa || undefined },
    { status: confirm.rateLimited ? 429 : 403 },
  );
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("settings", "canCreate", { minimumRole: "ADMIN", fallbackResources: ["audit_logs"] });
    const raw = await req.json().catch(() => null);
    const parsed = createFlagSchema.safeParse(raw);
    if (!parsed.success) {
      await auditFeatureFlag(session, req, {
        action: "CREATE_FEATURE_FLAG_FAILED",
        entityId: "feature-flag",
        metadata: { reason: "invalid_body" },
      });
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const data = parsed.data;
    const targetType = data.targetType ?? "ALL";
    const target = normalizeTargetValue(targetType, data.targetValue, "create");
    if (!target.ok) {
      await auditFeatureFlag(session, req, {
        action: "CREATE_FEATURE_FLAG_FAILED",
        entityId: data.name,
        metadata: { reason: "invalid_target", targetType },
      });
      return NextResponse.json({ error: target.error }, { status: 400 });
    }

    const confirm = await requirePasswordConfirm(session, data.confirmPassword, stepUpOptions(req, data));
    if (!confirm.confirmed) {
      return stepUpResponse(confirm);
    }

    const existing = await prisma.featureFlag.findUnique({ where: { name: data.name } });
    if (existing) return NextResponse.json({ error: "Flag already exists" }, { status: 409 });

    const flag = await prisma.featureFlag.create({
      data: {
        name: data.name,
        description: safeDescription(data.description),
        enabled: data.enabled ?? false,
        targetType,
        targetValue: target.value ?? null,
        createdBy: session.adminId,
      },
    });
    await auditFeatureFlag(session, req, {
      action: "CREATE_FEATURE_FLAG",
      entityId: flag.id,
      after: flagAuditSummary(flag),
      metadata: { status: "success" },
    });
    return NextResponse.json(flag);
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requirePermission("settings", "canUpdate", { minimumRole: "ADMIN", fallbackResources: ["audit_logs"] });
    const raw = await req.json().catch(() => null);
    const parsed = updateFlagSchema.safeParse(raw);
    if (!parsed.success) {
      await auditFeatureFlag(session, req, {
        action: "UPDATE_FEATURE_FLAG_FAILED",
        entityId: "feature-flag",
        metadata: { reason: "invalid_body" },
      });
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const data = parsed.data;
    const target = normalizeTargetValue(data.targetType, data.targetValue, "update");
    if (!target.ok) {
      await auditFeatureFlag(session, req, {
        action: "UPDATE_FEATURE_FLAG_FAILED",
        entityId: data.id,
        metadata: { reason: "invalid_target", targetType: data.targetType ?? null },
      });
      return NextResponse.json({ error: target.error }, { status: 400 });
    }

    const confirm = await requirePasswordConfirm(session, data.confirmPassword, stepUpOptions(req, data));
    if (!confirm.confirmed) {
      return stepUpResponse(confirm);
    }
    const existing = await prisma.featureFlag.findUnique({ where: { id: data.id } });
    if (!existing) return NextResponse.json({ error: "Flag not found" }, { status: 404 });

    const flag = await prisma.featureFlag.update({
      data: {
        enabled: typeof data.enabled === "boolean" ? data.enabled : undefined,
        description: data.description !== undefined ? safeDescription(data.description) : undefined,
        targetType: data.targetType,
        targetValue: target.value,
        updatedBy: session.adminId,
      },
      where: { id: data.id },
    });
    await auditFeatureFlag(session, req, {
      action: "UPDATE_FEATURE_FLAG",
      entityId: flag.id,
      before: flagAuditSummary(existing),
      after: flagAuditSummary(flag),
      metadata: { status: "success" },
    });
    return NextResponse.json(flag);
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await requirePermission("settings", "canDelete", { minimumRole: "ADMIN", fallbackResources: ["audit_logs"] });
    const raw = await req.json().catch(() => null);
    const parsed = deleteFlagSchema.safeParse(raw);
    if (!parsed.success) {
      await auditFeatureFlag(session, req, {
        action: "DELETE_FEATURE_FLAG_FAILED",
        entityId: "feature-flag",
        metadata: { reason: "invalid_body" },
      });
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const data = parsed.data;
    const confirm = await requirePasswordConfirm(session, data.confirmPassword, stepUpOptions(req, data));
    if (!confirm.confirmed) {
      return stepUpResponse(confirm);
    }
    const existing = await prisma.featureFlag.findUnique({ where: { id: data.id } });
    if (!existing) return NextResponse.json({ error: "Flag not found" }, { status: 404 });
    await prisma.featureFlag.delete({ where: { id: data.id } });
    await auditFeatureFlag(session, req, {
      action: "DELETE_FEATURE_FLAG",
      entityId: data.id,
      before: flagAuditSummary(existing),
      metadata: { status: "success" },
    });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
