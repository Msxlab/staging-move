import { prisma } from "@/lib/db";
import { redactAuditPayload } from "@locateflow/shared";

export interface AuditLogParams {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  changes?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function createAuditLog(params: AuditLogParams): Promise<void> {
  try {
    const safeChanges = params.changes
      ? redactAuditPayload(params.changes) as Record<string, unknown>
      : null;
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        changes: safeChanges ? JSON.stringify(safeChanges) : null,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
      },
    });
  } catch (error) {
    // Audit logging should never break the main flow
    console.error("Audit log failed:", error);
  }
}

export function extractRequestMeta(request: Request): { ipAddress: string; userAgent: string } {
  return {
    ipAddress: (request.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim(),
    userAgent: request.headers.get("user-agent") ?? "unknown",
  };
}
