import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getBackupRuntimeMetadata,
  redactBackupMetadata,
} from "./backup-metadata";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("backup runtime metadata", () => {
  it("includes schema compatibility hashes", () => {
    const metadata = getBackupRuntimeMetadata({
      NODE_ENV: "production",
      APP_ENV: "staging",
      DATABASE_URL: "mysql://user:password@db.example.com:3306/locateflow",
      npm_package_version: "0.1.0",
    } as NodeJS.ProcessEnv);

    expect(metadata.environment.name).toBe("staging");
    expect(metadata.environment.databaseFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(metadata.compatibility.schemaHash).toMatch(/^[a-f0-9]{64}$/);
    expect(metadata.compatibility.schemaHashAlgorithm).toBe(
      "sha256-prisma-dmmf-v1",
    );
    expect(metadata.compatibility.backupTableCatalogHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("does not include raw database credentials or secret values", () => {
    const secret = "0123456789abcdef0123456789abcdef";
    vi.stubEnv("FIELD_ENCRYPTION_KEY", secret);
    const metadata = getBackupRuntimeMetadata({
      NODE_ENV: "production",
      APP_ENV: "production",
      DATABASE_URL: "mysql://user:super-secret@db.example.com:3306/prod",
      FIELD_ENCRYPTION_KEY: secret,
    } as NodeJS.ProcessEnv);

    const serialized = JSON.stringify(metadata);
    expect(serialized).not.toContain("super-secret");
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain("mysql://user");
  });

  it("redacts secret-like strings before metadata is stored", () => {
    vi.stubEnv("DATABASE_URL", "mysql://user:super-secret@db.example.com/prod");

    const redacted = redactBackupMetadata({
      error:
        "Upload failed for mysql://user:super-secret@db.example.com/prod token=abc123456789",
    });

    expect(redacted.error).toContain("mysql://[redacted]@");
    expect(redacted.error).toContain("token=[redacted]");
    expect(redacted.error).not.toContain("super-secret");
  });
});
