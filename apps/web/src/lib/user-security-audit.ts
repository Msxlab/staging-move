import { createAuditLog, type AuditLogParams } from "@/lib/audit";

type SecurityAuditInput = Omit<AuditLogParams, "entityType"> & {
  entityType?: string;
  changes?: Record<string, unknown>;
};

export function recordUserSecurityAudit(input: SecurityAuditInput): void {
  void createAuditLog({
    ...input,
    entityType: input.entityType ?? "User",
  } as AuditLogParams);
}
