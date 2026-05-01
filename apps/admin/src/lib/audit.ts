/**
 * Centralized admin audit-log writer.
 *
 * Every admin destructive route should call `writeAdminAudit` instead
 * of inlining `prisma.adminAuditLog.create({...})`. The wrapper exists
 * to enforce three things uniformly:
 *
 *   1. Required fields (action, entityType, entityId) cannot be skipped
 *      — Zod-validated before the row is written, so a route can't
 *      silently produce an audit row with a blank `entityType`.
 *   2. Identity is snapshotted at write time — the admin email and role
 *      are merged into `changes.actor` so the row stays useful even
 *      after the AdminUser is deleted (P0-2 changes the FK to
 *      onDelete: SetNull, so `adminUserId` will become nullable).
 *   3. Request metadata (IP, UA) is captured uniformly. Today the
 *      schema only has an `ipAddress` column, so the userAgent is
 *      stored under `changes.actor.userAgent` until a follow-up
 *      migration adds dedicated columns.
 *
 * The route can pass any of:
 *   - `before` / `after` snapshots → serialized into `changes.before`
 *     and `changes.after` for diffability.
 *   - `metadata` → arbitrary extra context merged into `changes.metadata`.
 *
 * Failure mode: this helper never throws. An audit-write failure must
 * not break the operator action — we log to console and move on. (The
 * underlying Prisma error is swallowed because the alternative is
 * worse: an admin clicks "delete user", the row IS deleted in the same
 * transaction, but the audit write fails and the route 500s, leaving
 * the operator unsure whether the action took effect.)
 */

import { z } from "zod";
import type { AdminSession } from "./auth";
import { prisma } from "./db";

export interface AuditRequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface WriteAdminAuditInput {
  /** Short verb describing the operation. Capped at 20 chars by schema. */
  action: string;
  /** Prisma model or domain entity name. Capped at 50 chars by schema. */
  entityType: string;
  /**
   * Stable identifier of the entity. For broadcast / fan-out operations
   * pass a sentinel like "broadcast" — schema requires non-null and
   * caps at 30 chars.
   */
  entityId: string;
  /** Snapshot before the change (for UPDATE / DELETE). */
  before?: unknown;
  /** Snapshot after the change (for CREATE / UPDATE). */
  after?: unknown;
  /** Free-form extra context (counts, batch IDs, reasons, etc). */
  metadata?: Record<string, unknown>;
  /** Caller-supplied request metadata; pass the result of getRequestMeta(). */
  request?: AuditRequestMeta;
}

const inputSchema = z.object({
  action: z.string().trim().min(1).max(20),
  entityType: z.string().trim().min(1).max(50),
  entityId: z.string().trim().min(1).max(30),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
  metadata: z.record(z.unknown()).optional(),
  request: z
    .object({
      ipAddress: z.string().nullable().optional(),
      userAgent: z.string().nullable().optional(),
    })
    .optional(),
});

function buildChangesPayload(
  session: AdminSession,
  parsed: z.infer<typeof inputSchema>,
): string {
  const changes: Record<string, unknown> = {
    actor: {
      adminId: session.adminId,
      email: session.email,
      role: session.role,
      userAgent: parsed.request?.userAgent ?? null,
    },
  };
  if (parsed.before !== undefined) changes.before = parsed.before;
  if (parsed.after !== undefined) changes.after = parsed.after;
  if (parsed.metadata !== undefined) changes.metadata = parsed.metadata;
  return JSON.stringify(changes);
}

export async function writeAdminAudit(
  session: AdminSession,
  input: WriteAdminAuditInput,
): Promise<void> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    // Fail loud in development so a bad call site is caught early; in
    // production we still write a degraded row rather than dropping
    // the audit entirely, because losing the audit trail is worse than
    // a malformed log line.
    console.error(
      "[audit] writeAdminAudit received invalid input:",
      parsed.error.flatten(),
    );
    if (process.env.NODE_ENV !== "production") {
      throw new Error("writeAdminAudit invalid input");
    }
  }
  const data = parsed.success ? parsed.data : (input as z.infer<typeof inputSchema>);

  try {
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: String(data.action ?? "UNKNOWN").slice(0, 20),
        entityType: String(data.entityType ?? "Unknown").slice(0, 50),
        entityId: String(data.entityId ?? "unknown").slice(0, 30),
        changes: buildChangesPayload(session, data),
        ipAddress: data.request?.ipAddress ?? null,
      },
    });
  } catch (err) {
    // Never throw from the audit path — the operator action has already
    // happened by the time we reach here, and turning a logging failure
    // into a 500 would mislead the operator into retrying a destructive
    // op. Log loudly so the gap is visible in error reporting.
    console.error("[audit] writeAdminAudit failed:", err);
  }
}

/**
 * Extract request metadata in the canonical precedence order. The full
 * cross-app helper (P1-9) will replace this with a shared package import;
 * for now this mirrors apps/web/src/lib/rate-limit.ts ordering so admin
 * audit IPs match what the rate-limiter sees.
 */
export function getAuditRequestMeta(req: { headers: Headers }): AuditRequestMeta {
  const cf = req.headers.get("cf-connecting-ip");
  const vercel = req.headers.get("x-vercel-forwarded-for");
  const xff = req.headers.get("x-forwarded-for");
  const real = req.headers.get("x-real-ip");
  const firstIp = (val: string | null | undefined) => {
    if (!val) return null;
    const first = val.split(",")[0]?.trim();
    return first || null;
  };
  const ip = firstIp(cf) || firstIp(vercel) || firstIp(xff) || firstIp(real) || null;
  const userAgent = req.headers.get("user-agent");
  return { ipAddress: ip, userAgent };
}
