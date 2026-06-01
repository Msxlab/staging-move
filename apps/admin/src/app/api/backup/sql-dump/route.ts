export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { createGzip } from "node:zlib";
import { Readable } from "node:stream";
import { requirePasswordConfirm, requirePermission } from "@/lib/auth";
import { writeBackupAudit } from "@/lib/backup-audit";
import { getAuditRequestMeta } from "@/lib/audit";

/**
 * Raw full-database logical dump (`mysqldump` → gzip), streamed as a download.
 *
 * This is the "everything" backup — schema + every table, including ones the
 * structured JSON backup intentionally excludes (sessions, tokens, etc.). It is
 * therefore the crown-jewels export and is gated hard: SUPER_ADMIN + password
 * step-up + MFA + audit. The stream is piped straight from the child process so
 * a multi-GB database never buffers in the Node heap.
 *
 * Requires the `mysqldump` binary in the runtime (default-mysql-client in the
 * Dockerfile). If it is missing we fail fast with a clear 503 BEFORE streaming,
 * rather than handing back a truncated archive.
 */

function parseMysqlConnection(databaseUrl: string) {
  const url = new URL(databaseUrl);
  if (url.protocol !== "mysql:" && url.protocol !== "mariadb:") {
    throw new Error("DATABASE_URL is not a mysql:// connection string");
  }
  const database = url.pathname.replace(/^\//, "");
  if (!database) throw new Error("DATABASE_URL has no database name");
  return {
    host: url.hostname || "localhost",
    port: url.port || "3306",
    user: decodeURIComponent(url.username || "root"),
    password: decodeURIComponent(url.password || ""),
    database,
  };
}

export async function POST(request: NextRequest) {
  const meta = getAuditRequestMeta(request);
  let session: Awaited<ReturnType<typeof requirePermission>> | null = null;
  try {
    // Crown-jewels export → SUPER_ADMIN only.
    session = await requirePermission("settings", "canCreate", { minimumRole: "SUPER_ADMIN" });
    const body = await request.json().catch(() => ({}));
    const { confirmPassword, mfaCode, backupCode } = body ?? {};

    const confirm = await requirePasswordConfirm(session, confirmPassword, {
      operation: "backup_sql_dump",
      requireMfa: true,
      mfaCode: typeof mfaCode === "string" ? mfaCode : undefined,
      backupCode: typeof backupCode === "string" ? backupCode : undefined,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    if (!confirm.confirmed) {
      await writeBackupAudit({
        session,
        action: "BACKUP_SQL_DUMP_FAILED",
        entityId: "sql-dump",
        request,
        error: confirm.error || "step-up failed",
      });
      return NextResponse.json(
        { error: confirm.error, requiresPassword: true, requiresMfa: confirm.requiresMfa },
        { status: confirm.rateLimited ? 429 : 403 },
      );
    }

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 500 });
    }
    let conn: ReturnType<typeof parseMysqlConnection>;
    try {
      conn = parseMysqlConnection(databaseUrl);
    } catch {
      return NextResponse.json({ error: "DATABASE_URL is not a MySQL connection string." }, { status: 500 });
    }

    // --single-transaction: consistent InnoDB snapshot without locking writes.
    // --no-tablespaces: avoids requiring the PROCESS global privilege.
    // Password is passed via MYSQL_PWD (NOT argv) so it never appears in the
    // host process list. spawn() with an arg array means no shell interpolation.
    const args = [
      "--single-transaction",
      "--quick",
      "--routines",
      "--triggers",
      "--events",
      "--no-tablespaces",
      "--default-character-set=utf8mb4",
      "-h", conn.host,
      "-P", conn.port,
      "-u", conn.user,
      conn.database,
    ];
    const child = spawn("mysqldump", args, {
      env: { ...process.env, MYSQL_PWD: conn.password },
    });

    // Detect a missing binary / immediate spawn failure BEFORE we commit to a
    // 200 streamed response, so the operator gets a clean error instead of a
    // corrupt 0-byte archive.
    try {
      await new Promise<void>((resolve, reject) => {
        child.once("spawn", () => resolve());
        child.once("error", (err) => reject(err));
      });
    } catch (spawnError: any) {
      const missing = spawnError?.code === "ENOENT";
      await writeBackupAudit({
        session,
        action: "BACKUP_SQL_DUMP_FAILED",
        entityId: "sql-dump",
        request,
        metadata: { database: conn.database, reason: missing ? "mysqldump_not_installed" : "spawn_failed" },
        error: spawnError,
      }).catch(() => {});
      return NextResponse.json(
        {
          error: missing
            ? "mysqldump is not installed in this runtime. Rebuild the image with default-mysql-client to enable raw SQL dumps."
            : "Failed to start mysqldump.",
          code: missing ? "MYSQLDUMP_NOT_AVAILABLE" : "MYSQLDUMP_SPAWN_FAILED",
        },
        { status: 503 },
      );
    }

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      if (stderr.length < 4000) stderr += chunk.toString();
    });

    const gzip = createGzip();
    child.stdout.pipe(gzip);
    // If mysqldump dies mid-stream, tear down the gzip stream so the client sees
    // a failed (not silently truncated-but-"successful") download.
    child.on("error", (err) => gzip.destroy(err));
    child.on("close", (code) => {
      if (code !== 0) {
        gzip.destroy(new Error(`mysqldump exited with code ${code}: ${stderr.slice(0, 300)}`));
      }
    });

    await writeBackupAudit({
      session,
      action: "BACKUP_SQL_DUMP_STARTED",
      entityId: "sql-dump",
      request,
      metadata: { database: conn.database, host: conn.host },
    });

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const fileName = `locateflow-${conn.database}-${stamp}.sql.gz`;
    const webStream = Readable.toWeb(gzip) as unknown as ReadableStream;
    return new Response(webStream, {
      status: 200,
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (session) {
      await writeBackupAudit({
        session,
        action: "BACKUP_SQL_DUMP_FAILED",
        entityId: "sql-dump",
        request,
        error,
      }).catch(() => {});
    }
    return NextResponse.json({ error: "SQL dump failed" }, { status: 500 });
  }
}
