import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePasswordConfirm, requirePermission } from "@/lib/auth";
import { isEncrypted, reEncrypt, validateKeyFormat } from "@/lib/shared-encryption";

// Encrypted field map: table → model name → encrypted column names
const ENCRYPTED_FIELDS: Record<string, { model: string; fields: string[] }> = {
  services: {
    model: "service",
    fields: ["accountNumber", "username", "phone", "email", "notes"],
  },
  addresses: {
    model: "address",
    fields: ["formattedAddress"],
  },
};

// POST /api/security/key-rotation — rotate encryption key
// Steps:
//   1. Admin provides oldKey (the current FIELD_ENCRYPTION_KEY)
//   2. New FIELD_ENCRYPTION_KEY must already be set in env
//   3. All encrypted fields are re-encrypted from old → new key
//   4. Supports dry-run mode
export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("settings", "canUpdate", { minimumRole: "SUPER_ADMIN" });
    const body = await request.json();
    const { oldKey, confirmPassword, dryRun = false } = body;

    // Step-up auth required
    const confirm = await requirePasswordConfirm(session, confirmPassword);
    if (!confirm.confirmed) {
      return NextResponse.json({ error: confirm.error, requiresPassword: true }, { status: 403 });
    }

    if (!oldKey || !validateKeyFormat(oldKey)) {
      return NextResponse.json({
        error: "oldKey is required and must be a 64-character hex string (256-bit key)",
      }, { status: 400 });
    }

    // Verify new key is configured
    const newKey = process.env.FIELD_ENCRYPTION_KEY;
    if (!newKey || !validateKeyFormat(newKey)) {
      return NextResponse.json({
        error: "FIELD_ENCRYPTION_KEY env var must be set to the new key before rotation",
      }, { status: 400 });
    }

    if (oldKey === newKey) {
      return NextResponse.json({
        error: "Old and new keys are the same. Set FIELD_ENCRYPTION_KEY to the new key first.",
      }, { status: 400 });
    }

    const results: Record<string, { total: number; rotated: number; skipped: number; errors: number }> = {};

    for (const [tableName, config] of Object.entries(ENCRYPTED_FIELDS) as Array<[keyof typeof ENCRYPTED_FIELDS, typeof ENCRYPTED_FIELDS[keyof typeof ENCRYPTED_FIELDS]]>) {
      const stats = { total: 0, rotated: 0, skipped: 0, errors: 0 };

      const batchSize = 100;
      let skip = 0;
      let hasMore = true;

      while (hasMore) {
        if (tableName === "services") {
          const records = await prisma.service.findMany({
            skip,
            take: batchSize,
            select: { id: true, accountNumber: true, username: true, phone: true, email: true, notes: true },
          });
          if (records.length < batchSize) hasMore = false;
          skip += batchSize;

          for (const record of records) {
            stats.total++;
            const updates: Record<string, string> = {};
            let hasEncryptedField = false;
            const serviceFields = {
              accountNumber: record.accountNumber,
              username: record.username,
              phone: record.phone,
              email: record.email,
              notes: record.notes,
            };

            for (const field of config.fields) {
              const value = serviceFields[field as keyof typeof serviceFields];
              if (!value || !isEncrypted(value)) {
                stats.skipped++;
                continue;
              }

              hasEncryptedField = true;
              const rotated = reEncrypt(value, oldKey);
              if (rotated === null) {
                stats.errors++;
                continue;
              }
              updates[field] = rotated;
            }

            if (!hasEncryptedField) continue;

            if (Object.keys(updates).length > 0 && !dryRun) {
              try {
                await prisma.service.update({
                  where: { id: record.id },
                  data: {
                    ...(updates.accountNumber ? { accountNumber: updates.accountNumber } : {}),
                    ...(updates.username ? { username: updates.username } : {}),
                    ...(updates.phone ? { phone: updates.phone } : {}),
                    ...(updates.email ? { email: updates.email } : {}),
                    ...(updates.notes ? { notes: updates.notes } : {}),
                  },
                });
                stats.rotated++;
              } catch {
                stats.errors++;
              }
            } else if (Object.keys(updates).length > 0) {
              stats.rotated++;
            }
          }
        } else {
          const records = await prisma.address.findMany({
            skip,
            take: batchSize,
            select: { id: true, formattedAddress: true },
          });
          if (records.length < batchSize) hasMore = false;
          skip += batchSize;

          for (const record of records) {
            stats.total++;
            const updates: Record<string, string> = {};
            let hasEncryptedField = false;

            for (const field of config.fields) {
              const value = field === "formattedAddress" ? record.formattedAddress : null;
              if (!value || !isEncrypted(value)) {
                stats.skipped++;
                continue;
              }

              hasEncryptedField = true;
              const rotated = reEncrypt(value, oldKey);
              if (rotated === null) {
                stats.errors++;
                continue;
              }
              updates[field] = rotated;
            }

            if (!hasEncryptedField) continue;

            if (Object.keys(updates).length > 0 && !dryRun) {
              try {
                await prisma.address.update({
                  where: { id: record.id },
                  data: {
                    ...(updates.formattedAddress ? { formattedAddress: updates.formattedAddress } : {}),
                  },
                });
                stats.rotated++;
              } catch {
                stats.errors++;
              }
            } else if (Object.keys(updates).length > 0) {
              stats.rotated++;
            }
          }
        }
      }

      results[tableName] = stats;
    }

    // Audit log
    if (!dryRun) {
      await prisma.adminAuditLog.create({
        data: {
          adminUserId: session.adminId,
          action: "KEY_ROTATION",
          entityType: "Encryption",
          entityId: "FIELD_ENCRYPTION_KEY",
          changes: JSON.stringify({
            tables: Object.keys(results),
            results,
          }),
          ipAddress: request.headers.get("x-forwarded-for") || "unknown",
        },
      });
    }

    return NextResponse.json({
      success: true,
      dryRun,
      message: dryRun
        ? "Dry run complete. No data was modified."
        : "Key rotation complete. All encrypted fields have been re-encrypted with the new key.",
      results,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Key rotation failed:", error);
    return NextResponse.json({ error: "Key rotation failed" }, { status: 500 });
  }
}
