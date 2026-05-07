import type { BackupArchiveMetadata } from "@/lib/backup-archive";
import {
  getCurrentBackupEnvironmentMetadata,
  type BackupEnvironmentMetadata,
} from "@/lib/backup-metadata";

type RestoreMode = "MERGE" | "REPLACE" | "DRY_RUN";

export class RestoreTargetGuardError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "RestoreTargetGuardError";
  }
}

function fingerprintPrefix(value: string | null | undefined) {
  return value ? value.slice(0, 12) : "unknown";
}

export function getReplaceConfirmationPhrase(
  environment: BackupEnvironmentMetadata,
) {
  return `REPLACE ${environment.name} ${fingerprintPrefix(environment.databaseFingerprint)}`;
}

export function getProductionRestoreConfirmationPhrase(
  environment: BackupEnvironmentMetadata,
) {
  return `RESTORE PRODUCTION ${fingerprintPrefix(environment.databaseFingerprint)}`;
}

export function getEnvironmentMismatchOverridePhrase(
  environment: BackupEnvironmentMetadata,
) {
  return `OVERRIDE ENVIRONMENT MISMATCH ${environment.name} ${fingerprintPrefix(environment.databaseFingerprint)}`;
}

function getBodyString(body: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = body[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function isProductionTarget(environment: BackupEnvironmentMetadata) {
  return environment.name === "production";
}

export function assertRestoreTargetAllowed(input: {
  mode: RestoreMode;
  body: Record<string, unknown>;
  archiveMetadata?: BackupArchiveMetadata | null;
  env?: NodeJS.ProcessEnv;
}) {
  if (input.mode === "DRY_RUN") return { warnings: [] as string[] };

  const currentEnvironment = getCurrentBackupEnvironmentMetadata(input.env);
  const env = input.env || process.env;
  const targetConfirmation = getBodyString(input.body, [
    "targetEnvironment",
    "confirmTargetEnvironment",
    "targetEnvironmentConfirmation",
  ]);

  if (targetConfirmation !== currentEnvironment.name) {
    throw new RestoreTargetGuardError(
      "RESTORE_TARGET_CONFIRMATION_REQUIRED",
      `${input.mode} restore requires targetEnvironment to exactly match the current environment.`,
      400,
      {
        expectedTargetEnvironment: currentEnvironment.name,
      },
    );
  }

  const archiveEnvironment = input.archiveMetadata?.environment || null;
  const warnings: string[] = [];
  if (archiveEnvironment?.databaseFingerprint) {
    const mismatch =
      archiveEnvironment.name !== currentEnvironment.name ||
      archiveEnvironment.databaseFingerprint !==
        currentEnvironment.databaseFingerprint;

    if (mismatch) {
      const overridePhrase = getEnvironmentMismatchOverridePhrase(
        currentEnvironment,
      );
      const overrideConfirmed =
        input.body.allowEnvironmentMismatch === true &&
        getBodyString(input.body, ["environmentMismatchConfirmation"]) ===
          overridePhrase;

      if (!overrideConfirmed) {
        throw new RestoreTargetGuardError(
          "RESTORE_ENVIRONMENT_MISMATCH",
          "Backup archive environment fingerprint does not match the target database/environment.",
          409,
          {
            archiveEnvironment: archiveEnvironment.name,
            targetEnvironment: currentEnvironment.name,
            archiveDatabaseFingerprint:
              fingerprintPrefix(archiveEnvironment.databaseFingerprint),
            targetDatabaseFingerprint: fingerprintPrefix(
              currentEnvironment.databaseFingerprint,
            ),
            overrideConfirmation: overridePhrase,
          },
        );
      }

      warnings.push(
        "Environment mismatch override accepted after explicit admin confirmation.",
      );
    }
  }

  if (input.mode === "REPLACE") {
    const replacePhrase = getReplaceConfirmationPhrase(currentEnvironment);
    if (getBodyString(input.body, ["replaceConfirmation"]) !== replacePhrase) {
      throw new RestoreTargetGuardError(
        "RESTORE_REPLACE_CONFIRMATION_REQUIRED",
        "REPLACE restore requires an explicit replaceConfirmation phrase for the target database.",
        400,
        { expectedConfirmation: replacePhrase },
      );
    }

    if (isProductionTarget(currentEnvironment)) {
      const productionPhrase =
        getProductionRestoreConfirmationPhrase(currentEnvironment);
      const approvedByEnv =
        env.ALLOW_PRODUCTION_REPLACE_RESTORE === "true";
      const confirmed =
        getBodyString(input.body, ["productionRestoreConfirmation"]) ===
        productionPhrase;

      if (!approvedByEnv || !confirmed) {
        throw new RestoreTargetGuardError(
          "RESTORE_PRODUCTION_REPLACE_BLOCKED",
          "Production REPLACE restore requires ALLOW_PRODUCTION_REPLACE_RESTORE=true and the productionRestoreConfirmation phrase.",
          403,
          {
            expectedConfirmation: productionPhrase,
            approvedByEnv,
          },
        );
      }
    }
  }

  return { warnings };
}
