import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { gunzipSync } from "node:zlib";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  spawn: vi.fn(),
  requirePermission: vi.fn(),
  requirePasswordConfirm: vi.fn(),
  writeBackupAudit: vi.fn(),
  prismaUnsafe: {
    $queryRawUnsafe: vi.fn(),
  },
}));

vi.mock("node:child_process", () => ({
  spawn: mocks.spawn,
}));

vi.mock("@/lib/auth", () => ({
  requirePermission: mocks.requirePermission,
  requirePasswordConfirm: mocks.requirePasswordConfirm,
}));

vi.mock("@/lib/backup-audit", () => ({
  writeBackupAudit: mocks.writeBackupAudit,
}));

vi.mock("@/lib/db", () => ({
  prismaUnsafe: mocks.prismaUnsafe,
}));

vi.mock("@/lib/audit", () => ({
  getAuditRequestMeta: () => ({
    ipAddress: "203.0.113.44",
    userAgent: "vitest",
  }),
}));

vi.mock("@/lib/backup-metadata", () => ({
  redactBackupSecretText: (value: unknown) =>
    String(value ?? "").replace(/dump-secret/g, "[REDACTED]"),
}));

function request(body: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/backup/sql-dump", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      confirmPassword: "correct-password",
      mfaCode: "123456",
      ...body,
    }),
  }) as any;
}

function makeChild() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: PassThrough;
    stderr: PassThrough;
    kill: ReturnType<typeof vi.fn>;
  };
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = vi.fn(() => {
    queueMicrotask(() => child.emit("close", null, "SIGTERM"));
    return true;
  });
  return child;
}

describe("/api/backup/sql-dump", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv(
      "DATABASE_URL",
      "mysql://dump_user:dump-secret@db.example.com:3307/locateflow",
    );
    mocks.requirePermission.mockResolvedValue({
      adminId: "admin_1",
      email: "admin@example.com",
    });
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: true });
    mocks.writeBackupAudit.mockResolvedValue(undefined);
    mocks.prismaUnsafe.$queryRawUnsafe.mockReset();
  });

  it("streams a gzipped mysqldump after the first output chunk is available", async () => {
    const child = makeChild();
    mocks.spawn.mockImplementation(() => {
      setTimeout(() => {
        child.emit("spawn");
        child.stdout.write(Buffer.from("-- dump header\n"));
        child.stdout.end(Buffer.from("CREATE TABLE users (id int);\n"));
        child.emit("close", 0, null);
      }, 0);
      return child;
    });

    const { POST } = await import("./route");
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/gzip");
    expect(response.headers.get("X-Accel-Buffering")).toBe("no");

    const zipped = Buffer.from(await response.arrayBuffer());
    expect(gunzipSync(zipped).toString("utf8")).toContain(
      "CREATE TABLE users",
    );

    const [command, args, options] = mocks.spawn.mock.calls[0];
    expect(command).toBe("mysqldump");
    expect(args).toEqual(
      expect.arrayContaining([
        "--single-transaction",
        "--quick",
        "--no-tablespaces",
        "--connect-timeout=10",
        "--protocol=TCP",
        "-h",
        "db.example.com",
        "-P",
        "3307",
        "-u",
        "dump_user",
        "locateflow",
      ]),
    );
    expect(args).not.toContain("dump-secret");
    expect(options.env.MYSQL_PWD).toBe("dump-secret");
  });

  it("uses MYSQL_DATABASE_URL fallback and enables mysql SSL when the database URL requires it", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv(
      "MYSQL_DATABASE_URL",
      "mysql://dump_user:dump-secret@db.example.com:3307/locateflow?sslaccept=strict",
    );
    const child = makeChild();
    mocks.spawn.mockImplementation(() => {
      setTimeout(() => {
        child.emit("spawn");
        child.stdout.write(Buffer.from("-- dump header\n"));
        child.stdout.end(Buffer.from("CREATE TABLE users (id int);\n"));
        child.emit("close", 0, null);
      }, 0);
      return child;
    });

    const { POST } = await import("./route");
    const response = await POST(request());

    expect(response.status).toBe(200);
    const [, args] = mocks.spawn.mock.calls[0];
    expect(args).toEqual(expect.arrayContaining(["--protocol=TCP", "--ssl"]));
  });

  it("requires password plus MFA step-up before spawning mysqldump", async () => {
    mocks.requirePasswordConfirm.mockResolvedValue({
      confirmed: false,
      error: "MFA verification required.",
      requiresMfa: true,
    });

    const { POST } = await import("./route");
    const response = await POST(request({ confirmPassword: "" }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      requiresPassword: true,
      requiresMfa: true,
    });
    expect(mocks.spawn).not.toHaveBeenCalled();
  });

  it("streams a Prisma SQL fallback when mysqldump is not installed", async () => {
    const child = makeChild();
    let selectCalls = 0;
    mocks.prismaUnsafe.$queryRawUnsafe.mockImplementation(async (sql: string) => {
      if (sql.startsWith("SELECT TABLE_NAME")) return [{ TABLE_NAME: "users" }];
      if (sql.startsWith("SHOW CREATE TABLE")) {
        return [
          {
            "Create Table": "CREATE TABLE `users` (`id` varchar(191) NOT NULL, `email` varchar(191) DEFAULT NULL, PRIMARY KEY (`id`))",
          },
        ];
      }
      if (sql.startsWith("SELECT * FROM")) {
        selectCalls += 1;
        return selectCalls === 1 ? [{ id: "user_1", email: "person@example.com" }] : [];
      }
      return [];
    });
    mocks.spawn.mockImplementation(() => {
      setTimeout(() => {
        child.emit(
          "error",
          Object.assign(new Error("spawn mysqldump ENOENT"), { code: "ENOENT" }),
        );
      }, 0);
      return child;
    });

    const { POST } = await import("./route");
    const response = await POST(request());

    expect(response.status).toBe(200);
    const sql = gunzipSync(Buffer.from(await response.arrayBuffer())).toString("utf8");
    expect(sql).toContain("LocateFlow SQL dump fallback");
    expect(sql).toContain("CREATE TABLE `users`");
    expect(sql).toContain("INSERT INTO `users` (`id`, `email`) VALUES ('user_1', 'person@example.com');");
    expect(mocks.writeBackupAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "BACKUP_SQL_DUMP_STARTED",
        metadata: expect.objectContaining({
          method: "prisma-fallback",
        }),
      }),
    );
  });

  it("kills mysqldump and returns 504 when it never starts streaming data", async () => {
    vi.stubEnv("SQL_DUMP_READY_TIMEOUT_MS", "5");
    const child = makeChild();
    mocks.spawn.mockImplementation(() => {
      setTimeout(() => {
        child.emit("spawn");
      }, 0);
      return child;
    });

    const { POST } = await import("./route");
    const response = await POST(request());

    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toMatchObject({
      code: "MYSQLDUMP_START_TIMEOUT",
    });
    expect(child.kill).toHaveBeenCalledWith("SIGTERM");
    expect(mocks.writeBackupAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "BACKUP_SQL_DUMP_FAILED",
        metadata: expect.objectContaining({
          timeoutMs: 5,
        }),
      }),
    );
  });
});
