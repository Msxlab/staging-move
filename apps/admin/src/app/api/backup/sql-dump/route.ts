export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createGzip } from "node:zlib";
import { Readable } from "node:stream";
import { requirePasswordConfirm, requirePermission } from "@/lib/auth";
import { writeBackupAudit } from "@/lib/backup-audit";
import { getAuditRequestMeta } from "@/lib/audit";
import { redactBackupSecretText } from "@/lib/backup-metadata";

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

const DEFAULT_DUMP_READY_TIMEOUT_MS = 20_000;
const MYSQLDUMP_CONNECT_TIMEOUT_SECONDS = 10;

class SqlDumpStartupError extends Error {
  status: number;
  code: string;
  metadata: Record<string, unknown>;

  constructor(
    message: string,
    options: { status: number; code: string; metadata?: Record<string, unknown> },
  ) {
    super(message);
    this.name = "SqlDumpStartupError";
    this.status = options.status;
    this.code = options.code;
    this.metadata = options.metadata || {};
  }
}

function getDumpReadyTimeoutMs() {
  const raw = Number(process.env.SQL_DUMP_READY_TIMEOUT_MS);
  if (Number.isFinite(raw) && raw > 0) return Math.min(raw, 60_000);
  return DEFAULT_DUMP_READY_TIMEOUT_MS;
}

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

async function waitForFirstDumpChunk(
  child: ChildProcessWithoutNullStreams,
  getStderr: () => string,
  timeoutMs: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let sawSpawn = false;

    const cleanup = () => {
      clearTimeout(timer);
      child.off("spawn", onSpawn);
      child.off("error", onError);
      child.off("close", onClose);
      child.stdout.off("data", onData);
    };
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };
    const safeStderr = () => redactBackupSecretText(getStderr()).slice(0, 500);
    const onSpawn = () => {
      sawSpawn = true;
    };
    const onError = (err: NodeJS.ErrnoException) => {
      const missing = err?.code === "ENOENT";
      settle(() =>
        reject(
          new SqlDumpStartupError(
            missing
              ? "mysqldump is not installed in this runtime. Rebuild the image with default-mysql-client to enable raw SQL dumps."
              : "Failed to start mysqldump.",
            {
              status: 503,
              code: missing ? "MYSQLDUMP_NOT_AVAILABLE" : "MYSQLDUMP_SPAWN_FAILED",
              metadata: { reason: missing ? "mysqldump_not_installed" : "spawn_failed" },
            },
          ),
        ),
      );
    };
    const onClose = (code: number | null, signal: NodeJS.Signals | null) => {
      const stderr = safeStderr();
      settle(() =>
        reject(
          new SqlDumpStartupError(
            stderr || `mysqldump exited before streaming output with code ${code ?? "null"}.`,
            {
              status: 502,
              code: "MYSQLDUMP_EXITED_BEFORE_OUTPUT",
              metadata: { exitCode: code, signal, stderr },
            },
          ),
        ),
      );
    };
    const onData = (chunk: Buffer | string) => {
      child.stdout.pause();
      settle(() => resolve(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    };
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      const stderr = safeStderr();
      settle(() =>
        reject(
          new SqlDumpStartupError(
            stderr ||
              `mysqldump did not produce output within ${timeoutMs}ms. Check database connectivity and dump privileges.`,
            {
              status: 504,
              code: "MYSQLDUMP_START_TIMEOUT",
              metadata: { timeoutMs, sawSpawn, stderr },
            },
          ),
        ),
      );
    }, timeoutMs);

    child.once("spawn", onSpawn);
    child.once("error", onError);
    child.once("close", onClose);
    child.stdout.once("data", onData);
  });
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
      `--connect-timeout=${MYSQLDUMP_CONNECT_TIMEOUT_SECONDS}`,
      "-h", conn.host,
      "-P", conn.port,
      "-u", conn.user,
      conn.database,
    ];
    const child = spawn("mysqldump", args, {
      env: { ...process.env, MYSQL_PWD: conn.password },
    });

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      if (stderr.length < 4000) stderr += chunk.toString();
    });
    let dumpExit: { code: number | null; signal: NodeJS.Signals | null } | null = null;
    child.once("close", (code, signal) => {
      dumpExit = { code, signal };
    });

    let firstChunk: Buffer;
    try {
      firstChunk = await waitForFirstDumpChunk(child, () => stderr, getDumpReadyTimeoutMs());
    } catch (startupError: any) {
      if (startupError instanceof SqlDumpStartupError) {
        await writeBackupAudit({
          session,
          action: "BACKUP_SQL_DUMP_FAILED",
          entityId: "sql-dump",
          request,
          metadata: { database: conn.database, ...startupError.metadata },
          error: startupError.message,
        }).catch(() => {});
        return NextResponse.json(
          {
            error: startupError.message,
            code: startupError.code,
          },
          { status: startupError.status },
        );
      }
      throw startupError;
    }

    const gzip = createGzip();
    const dumpStream = Readable.from((async function* streamMysqlDump() {
      yield firstChunk;
      for await (const chunk of child.stdout) {
        yield chunk;
      }
    })());
    dumpStream.on("error", (err) => gzip.destroy(err));
    dumpStream.pipe(gzip);
    // If mysqldump dies mid-stream, tear down the gzip stream so the client sees
    // a failed (not silently truncated-but-"successful") download.
    child.on("error", (err) => gzip.destroy(err));
    const handleDumpClose = (code: number | null) => {
      if (code !== 0) {
        gzip.destroy(new Error(`mysqldump exited with code ${code ?? "null"}: ${redactBackupSecretText(stderr).slice(0, 300)}`));
      }
    };
    const exited = dumpExit as { code: number | null; signal: NodeJS.Signals | null } | null;
    if (exited) handleDumpClose(exited.code);
    else child.once("close", (code) => handleDumpClose(code));

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
        "X-Accel-Buffering": "no",
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
