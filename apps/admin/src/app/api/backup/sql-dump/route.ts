export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createGzip } from "node:zlib";
import { Readable } from "node:stream";
import { prismaUnsafe } from "@/lib/db";
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

const DEFAULT_DUMP_READY_TIMEOUT_MS = 45_000;
const MYSQLDUMP_CONNECT_TIMEOUT_SECONDS = 10;
const FALLBACK_DUMP_PAGE_SIZE = 500;

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
    sslRequired: isMysqlSslRequired(url.searchParams),
  };
}

function isTruthyParam(value: string | null): boolean {
  if (!value) return false;
  return ["1", "true", "yes", "required", "require"].includes(value.toLowerCase());
}

function isMysqlSslRequired(params: URLSearchParams): boolean {
  const sslMode = (params.get("ssl-mode") || params.get("ssl_mode") || params.get("sslmode") || "").toLowerCase();
  const sslAccept = (params.get("sslaccept") || "").toLowerCase();

  if (["disable", "disabled", "false", "0"].includes(sslMode)) return false;
  if (["required", "require", "verify_ca", "verify_identity"].includes(sslMode)) return true;
  if (["strict", "accept_invalid_certs", "accept_invalid_hostnames"].includes(sslAccept)) return true;
  return isTruthyParam(params.get("ssl")) || params.has("sslcert") || params.has("sslidentity");
}

function quoteIdentifier(value: string): string {
  return `\`${value.replace(/`/g, "``")}\``;
}

function sanitizeAttachmentFilename(value: string): string {
  const safe = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/["\\/:*?<>|\r\n\t]+/g, "-")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 180);
  return safe || "locateflow-database-dump.sql.gz";
}

function encodeRfc5987Value(value: string): string {
  return encodeURIComponent(value).replace(/['()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function contentDispositionAttachment(rawFileName: string): string {
  const safeFileName = sanitizeAttachmentFilename(rawFileName);
  return `attachment; filename="${safeFileName}"; filename*=UTF-8''${encodeRfc5987Value(safeFileName)}`;
}

function quoteSqlValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  if (value instanceof Date) return `'${value.toISOString().slice(0, 23).replace("T", " ")}'`;
  if (Buffer.isBuffer(value)) return `X'${value.toString("hex")}'`;
  if (typeof value === "object" && value && value.constructor?.name === "Decimal") {
    return String(value);
  }
  const raw = typeof value === "string" ? value : JSON.stringify(value);
  return `'${String(raw ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\0/g, "\\0")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\u001a/g, "\\Z")
    .replace(/'/g, "\\'")}'`;
}

function tableNameFromInformationSchema(row: Record<string, unknown>): string | null {
  const value = row.TABLE_NAME ?? row.table_name;
  return typeof value === "string" && value.length > 0 ? value : null;
}

function createTableSqlFromRow(row: Record<string, unknown>): string | null {
  const value = row["Create Table"] ?? row["Create View"] ?? row.create_table;
  return typeof value === "string" && value.length > 0 ? value : null;
}

async function* streamPrismaSqlDump(): AsyncGenerator<string> {
  const tableRows = await prismaUnsafe.$queryRawUnsafe<Array<Record<string, unknown>>>(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME",
  );
  const tables = tableRows.map(tableNameFromInformationSchema).filter((name): name is string => Boolean(name));
  const stamp = new Date().toISOString();

  yield `-- LocateFlow SQL dump fallback\n-- Generated: ${stamp}\n-- mysqldump binary was unavailable; schema and data were streamed through the admin DB connection.\n\nSET FOREIGN_KEY_CHECKS=0;\n\n`;

  for (const table of tables) {
    const identifier = quoteIdentifier(table);
    const createRows = await prismaUnsafe.$queryRawUnsafe<Array<Record<string, unknown>>>(`SHOW CREATE TABLE ${identifier}`);
    const createSql = createTableSqlFromRow(createRows[0] ?? {});
    if (!createSql) continue;

    yield `--\n-- Table structure for ${identifier}\n--\n\nDROP TABLE IF EXISTS ${identifier};\n${createSql};\n\n`;

    let offset = 0;
    let wroteHeader = false;
    for (;;) {
      const rows = await prismaUnsafe.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT * FROM ${identifier} LIMIT ${FALLBACK_DUMP_PAGE_SIZE} OFFSET ${offset}`,
      );
      if (!rows.length) break;
      if (!wroteHeader) {
        yield `--\n-- Data for ${identifier}\n--\n\n`;
        wroteHeader = true;
      }
      for (const row of rows) {
        const columns = Object.keys(row);
        if (!columns.length) continue;
        yield `INSERT INTO ${identifier} (${columns.map(quoteIdentifier).join(", ")}) VALUES (${columns
          .map((column) => quoteSqlValue(row[column]))
          .join(", ")});\n`;
      }
      offset += rows.length;
    }
    yield "\n";
  }

  yield "SET FOREIGN_KEY_CHECKS=1;\n";
}

async function firstChunkFromIterator(iterator: AsyncGenerator<string>): Promise<string> {
  const first = await iterator.next();
  if (first.done) return "";
  return first.value;
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

    const databaseUrl = process.env.DATABASE_URL || process.env.MYSQL_DATABASE_URL;
    if (!databaseUrl) {
      return NextResponse.json({ error: "DATABASE_URL or MYSQL_DATABASE_URL is not configured." }, { status: 500 });
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
      "--protocol=TCP",
      ...(conn.sslRequired ? ["--ssl"] : []),
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

    let firstChunk: Buffer | null = null;
    let streamMethod: "mysqldump" | "prisma-fallback" = "mysqldump";
    let fallbackIterator: AsyncGenerator<string> | null = null;
    try {
      firstChunk = await waitForFirstDumpChunk(child, () => stderr, getDumpReadyTimeoutMs());
    } catch (startupError: any) {
      if (startupError instanceof SqlDumpStartupError) {
        if (startupError.code === "MYSQLDUMP_NOT_AVAILABLE") {
          try {
            fallbackIterator = streamPrismaSqlDump();
            firstChunk = Buffer.from(await firstChunkFromIterator(fallbackIterator));
            streamMethod = "prisma-fallback";
          } catch (fallbackError: any) {
            await writeBackupAudit({
              session,
              action: "BACKUP_SQL_DUMP_FAILED",
              entityId: "sql-dump",
              request,
              metadata: { database: conn.database, method: "prisma-fallback", reason: "fallback_start_failed" },
              error: fallbackError,
            }).catch(() => {});
            return NextResponse.json(
              {
                error: "SQL dump fallback failed before streaming output.",
                code: "SQL_DUMP_FALLBACK_FAILED",
              },
              { status: 500 },
            );
          }
        } else {
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
      }
      if (streamMethod === "mysqldump") throw startupError;
    }
    if (!firstChunk) throw new Error("SQL dump stream did not produce a first chunk.");

    const gzip = createGzip();
    const dumpStream = Readable.from((async function* streamSqlDump() {
      yield firstChunk;
      if (fallbackIterator) {
        for await (const chunk of fallbackIterator) yield chunk;
      } else {
        for await (const chunk of child.stdout) {
          yield chunk;
        }
      }
    })());
    dumpStream.on("error", (err) => gzip.destroy(err));
    dumpStream.pipe(gzip);
    // If mysqldump dies mid-stream, tear down the gzip stream so the client sees
    // a failed (not silently truncated-but-"successful") download.
    if (streamMethod === "mysqldump") {
      child.on("error", (err) => gzip.destroy(err));
      const handleDumpClose = (code: number | null) => {
        if (code !== 0) {
          gzip.destroy(new Error(`mysqldump exited with code ${code ?? "null"}: ${redactBackupSecretText(stderr).slice(0, 300)}`));
        }
      };
      const exited = dumpExit as { code: number | null; signal: NodeJS.Signals | null } | null;
      if (exited) handleDumpClose(exited.code);
      else child.once("close", (code) => handleDumpClose(code));
    }

    await writeBackupAudit({
      session,
      action: "BACKUP_SQL_DUMP_STARTED",
      entityId: "sql-dump",
      request,
      metadata: { database: conn.database, host: conn.host, method: streamMethod },
    });

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const fileName = `locateflow-${conn.database}-${stamp}.sql.gz`;
    const webStream = Readable.toWeb(gzip) as unknown as ReadableStream;
    return new Response(webStream, {
      status: 200,
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": contentDispositionAttachment(fileName),
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
