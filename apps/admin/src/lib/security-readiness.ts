import { prisma } from "@/lib/db";
import { parseBackupRecordMetadata, type BackupOffsiteMetadata } from "@/lib/backup-storage";
import { listRuntimeConfigCatalog, type RuntimeConfigCatalogItem } from "@/lib/runtime-config";

type ReadinessStatus = "ready" | "warn" | "missing" | "unknown";
type ReadinessSource = RuntimeConfigCatalogItem["source"] | "DERIVED";

export interface SecurityReadinessCheck {
  key: string;
  label: string;
  status: ReadinessStatus;
  detail: string;
  source: ReadinessSource;
}

export interface SecurityReadinessGroup {
  id: string;
  label: string;
  checks: SecurityReadinessCheck[];
}

export interface SecurityReadinessSnapshot {
  generatedAt: string;
  summary: {
    ready: number;
    warn: number;
    missing: number;
    unknown: number;
    missingRequired: number;
  };
  missingRequiredKeys: string[];
  lastBackup: {
    createdAt: string;
    fileName: string | null;
    recordCount: number | null;
    type: string;
    offsiteStatus: BackupOffsiteMetadata["status"] | null;
    offsiteLocation: string | null;
  } | null;
  groups: SecurityReadinessGroup[];
}

function buildConfigCheck(
  entry: RuntimeConfigCatalogItem | undefined,
  key: string,
  label: string,
  readyDetail: string,
  missingDetail: string
): SecurityReadinessCheck {
  const configured = Boolean(entry?.configured);
  const status: ReadinessStatus = configured ? "ready" : entry?.requiredInProduction ? "missing" : "warn";
  return {
    key,
    label,
    status,
    detail: configured ? `${readyDetail} Source: ${entry?.source || "ENV"}.` : missingDetail,
    source: configured ? entry?.source || "ENV" : entry?.source || "MISSING",
  };
}

function buildAlertEmailCheck(input: {
  apiKey: RuntimeConfigCatalogItem | undefined;
  recipients: RuntimeConfigCatalogItem | undefined;
  alertSender: RuntimeConfigCatalogItem | undefined;
  defaultSender: RuntimeConfigCatalogItem | undefined;
}): SecurityReadinessCheck {
  const hasApiKey = Boolean(input.apiKey?.configured);
  const hasRecipients = Boolean(input.recipients?.configured);
  const hasSender = Boolean(input.alertSender?.configured || input.defaultSender?.configured);

  if (hasApiKey && hasRecipients && hasSender) {
    return {
      key: "alert_email_channel",
      label: "Security alert email channel",
      status: "ready",
      detail: "Alert email delivery has a configured API key, recipients, and sender identity.",
      source: "DERIVED",
    };
  }

  if (hasApiKey && hasRecipients) {
    return {
      key: "alert_email_channel",
      label: "Security alert email channel",
      status: "warn",
      detail: "Alert recipients and API key are configured, but no explicit alert sender was found. Delivery may rely on a default sender that is not verified.",
      source: "DERIVED",
    };
  }

  return {
    key: "alert_email_channel",
    label: "Security alert email channel",
    status: hasApiKey || hasRecipients ? "warn" : "missing",
    detail: hasApiKey || hasRecipients
      ? "Security alert email routing is only partially configured. Both RESEND_API_KEY and ALERT_EMAIL_TO are required for delivery."
      : "Security alert email delivery is not configured.",
    source: "DERIVED",
  };
}

function detectDatabaseTransportCheck(databaseUrl: string | undefined): SecurityReadinessCheck {
  if (!databaseUrl) {
    return {
      key: "database_transport",
      label: "Database transport security",
      status: "missing",
      detail: "DATABASE_URL is missing, so database transport security cannot be established.",
      source: "DERIVED",
    };
  }

  const normalized = databaseUrl.toLowerCase();
  const isLocal = normalized.includes("localhost") || normalized.includes("127.0.0.1") || normalized.includes("@mysql:");
  if (isLocal) {
    return {
      key: "database_transport",
      label: "Database transport security",
      status: "warn",
      detail: "Database appears to use a local/private host. Verify TLS settings in production separately from local development.",
      source: "DERIVED",
    };
  }

  const skipsCertificateValidation =
    normalized.includes("sslaccept=accept_invalid_certs") ||
    normalized.includes("sslaccept=accept_invalid_hostnames") ||
    normalized.includes("sslmode=disable") ||
    normalized.includes("tls=false");

  if (skipsCertificateValidation) {
    return {
      key: "database_transport",
      label: "Database transport security",
      status: "warn",
      detail: "DATABASE_URL appears to allow TLS/SSL without strict certificate validation. Require verified certificates for production database traffic.",
      source: "DERIVED",
    };
  }

  const hasExplicitTls =
    normalized.includes("sslmode=require") ||
    normalized.includes("sslaccept=strict") ||
    normalized.includes("tls=true") ||
    normalized.includes("ssl={") ||
    normalized.includes("ssl=true");

  if (hasExplicitTls) {
    return {
      key: "database_transport",
      label: "Database transport security",
      status: "ready",
      detail: "DATABASE_URL appears to include explicit TLS or SSL requirements.",
      source: "DERIVED",
    };
  }

  return {
    key: "database_transport",
    label: "Database transport security",
    status: "unknown",
    detail: "No explicit TLS requirement was detected in DATABASE_URL. Confirm managed provider TLS enforcement outside application code.",
    source: "DERIVED",
  };
}

function buildDatabaseAtRestCheck(): SecurityReadinessCheck {
  return {
    key: "database_at_rest",
    label: "Database at-rest encryption",
    status: "unknown",
    detail: "At-rest database encryption cannot be proven from application code alone. Confirm provider or disk encryption in infrastructure settings.",
    source: "DERIVED",
  };
}

function buildBackupFreshnessCheck(createdAt: Date | null): SecurityReadinessCheck {
  if (!createdAt) {
    return {
      key: "backup_freshness",
      label: "Backup freshness",
      status: "missing",
      detail: "No completed backup record was found.",
      source: "DERIVED",
    };
  }

  const ageHours = (Date.now() - createdAt.getTime()) / (60 * 60 * 1000);
  if (ageHours <= 24) {
    return {
      key: "backup_freshness",
      label: "Backup freshness",
      status: "ready",
      detail: `A completed backup exists from the last ${Math.round(ageHours)} hour(s).`,
      source: "DERIVED",
    };
  }

  if (ageHours <= 24 * 7) {
    return {
      key: "backup_freshness",
      label: "Backup freshness",
      status: "warn",
      detail: `Last completed backup is ${Math.round(ageHours / 24)} day(s) old.`,
      source: "DERIVED",
    };
  }

  return {
    key: "backup_freshness",
    label: "Backup freshness",
    status: "missing",
    detail: `Last completed backup is ${Math.round(ageHours / 24)} day(s) old.`,
    source: "DERIVED",
  };
}

function buildBackupOffsiteCheck(offsite: BackupOffsiteMetadata | null | undefined, hasBackup: boolean): SecurityReadinessCheck {
  if (!hasBackup) {
    return {
      key: "backup_offsite_replication",
      label: "Offsite backup replication",
      status: "missing",
      detail: "No completed backup exists yet, so offsite replication cannot be verified.",
      source: "DERIVED",
    };
  }

  if (!offsite) {
    return {
      key: "backup_offsite_replication",
      label: "Offsite backup replication",
      status: "warn",
      detail: "Last completed backup does not include offsite replication metadata.",
      source: "DERIVED",
    };
  }

  if (offsite.status === "stored") {
    return {
      key: "backup_offsite_replication",
      label: "Offsite backup replication",
      status: "ready",
      detail: offsite.location
        ? `Last completed backup was replicated offsite to ${offsite.location}.`
        : "Last completed backup was replicated offsite successfully.",
      source: "DERIVED",
    };
  }

  if (offsite.status === "failed") {
    return {
      key: "backup_offsite_replication",
      label: "Offsite backup replication",
      status: "missing",
      detail: offsite.reason || "Last completed backup was not replicated offsite successfully.",
      source: "DERIVED",
    };
  }

  return {
    key: "backup_offsite_replication",
    label: "Offsite backup replication",
    status: "warn",
    detail: offsite.reason || "Last completed backup was created, but offsite replication is disabled.",
    source: "DERIVED",
  };
}

function summarizeChecks(checks: SecurityReadinessCheck[], missingRequired: number) {
  return checks.reduce(
    (acc, check) => {
      acc[check.status] += 1;
      acc.missingRequired = missingRequired;
      return acc;
    },
    { ready: 0, warn: 0, missing: 0, unknown: 0, missingRequired }
  );
}

export async function getSecurityReadinessSnapshot(): Promise<SecurityReadinessSnapshot> {
  const catalog = await listRuntimeConfigCatalog();
  const catalogMap = new Map<string, RuntimeConfigCatalogItem>(catalog.map((item) => [item.key, item]));
  const trackedConfigKeys = [
    "FIELD_ENCRYPTION_KEY",
    "RESEND_API_KEY",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "CRON_SECRET",
    "INTERNAL_WEBHOOK_SECRET",
    "IMPERSONATION_HANDOFF_SECRET",
    "ALERT_EMAIL_TO",
    "SLACK_WEBHOOK_URL",
    "NEXT_PUBLIC_SENTRY_DSN",
    "BACKUP_STORAGE_PROVIDER",
    "BACKUP_STORAGE_BUCKET",
    "BACKUP_STORAGE_REGION",
    "BACKUP_STORAGE_ENDPOINT",
    "BACKUP_STORAGE_ACCESS_KEY_ID",
    "BACKUP_STORAGE_SECRET_ACCESS_KEY",
  ] as const;
  const lastBackup = await prisma.backupRecord.findFirst({
    where: { status: "COMPLETED" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, fileName: true, recordCount: true, type: true, errorMessage: true },
  }).catch(() => null);
  const lastBackupMetadata = parseBackupRecordMetadata(lastBackup?.errorMessage);
  const lastBackupOffsite = lastBackupMetadata.offsite || null;

  const preventiveChecks: SecurityReadinessCheck[] = [
    buildConfigCheck(
      catalogMap.get("FIELD_ENCRYPTION_KEY"),
      "field_encryption_key",
      "Field encryption key",
      "Application-level encryption is configured",
      "Field encryption key is not configured"
    ),
    buildConfigCheck(
      catalogMap.get("UPSTASH_REDIS_REST_URL"),
      "upstash_redis_rest_url",
      "Redis rate-limit endpoint",
      "Redis endpoint is configured for rate limiting",
      "Redis endpoint is missing, so production rate limiting can fail closed"
    ),
    buildConfigCheck(
      catalogMap.get("UPSTASH_REDIS_REST_TOKEN"),
      "upstash_redis_rest_token",
      "Redis rate-limit token",
      "Redis token is configured for rate limiting",
      "Redis token is missing, so production rate limiting can fail closed"
    ),
    buildConfigCheck(
      catalogMap.get("CRON_SECRET"),
      "cron_secret",
      "Cron secret",
      "Cron secret is configured for scheduled routes",
      "Cron secret is not configured"
    ),
    buildConfigCheck(
      catalogMap.get("INTERNAL_WEBHOOK_SECRET"),
      "internal_webhook_secret",
      "Internal webhook secret",
      "Internal webhook secret is configured independently of CRON_SECRET",
      "Internal webhook secret is not configured — internal webhook endpoints will reject server-to-server calls"
    ),
    buildConfigCheck(
      catalogMap.get("IMPERSONATION_HANDOFF_SECRET"),
      "impersonation_handoff_secret",
      "Impersonation handoff secret",
      "Impersonation handoff secret is configured independently of CRON_SECRET",
      "Impersonation handoff secret is not configured — admin impersonation handoff is disabled"
    ),
    detectDatabaseTransportCheck(process.env.DATABASE_URL),
    buildDatabaseAtRestCheck(),
  ];

  const detectionChecks: SecurityReadinessCheck[] = [
    buildAlertEmailCheck({
      apiKey: catalogMap.get("RESEND_API_KEY"),
      recipients: catalogMap.get("ALERT_EMAIL_TO"),
      alertSender: catalogMap.get("ALERT_EMAIL_FROM"),
      defaultSender: catalogMap.get("EMAIL_FROM"),
    }),
    buildConfigCheck(
      catalogMap.get("SLACK_WEBHOOK_URL"),
      "slack_webhook_url",
      "Slack security alert routing",
      "Slack webhook is configured for security alerts",
      "Slack webhook is not configured"
    ),
    buildConfigCheck(
      catalogMap.get("NEXT_PUBLIC_SENTRY_DSN"),
      "next_public_sentry_dsn",
      "Error monitoring",
      "Sentry DSN is configured",
      "Sentry DSN is not configured"
    ),
  ];

  const recoveryChecks: SecurityReadinessCheck[] = [
    buildConfigCheck(
      catalogMap.get("BACKUP_STORAGE_PROVIDER"),
      "backup_storage_provider",
      "Backup storage provider",
      "Offsite backup provider is configured",
      "Offsite backup provider is not configured"
    ),
    buildConfigCheck(
      catalogMap.get("BACKUP_STORAGE_BUCKET"),
      "backup_storage_bucket",
      "Backup storage bucket",
      "Offsite backup bucket is configured",
      "Offsite backup bucket is not configured"
    ),
    buildConfigCheck(
      catalogMap.get("BACKUP_STORAGE_REGION"),
      "backup_storage_region",
      "Backup storage region",
      "Offsite backup region is configured",
      "Offsite backup region is not configured"
    ),
    buildConfigCheck(
      catalogMap.get("BACKUP_STORAGE_ACCESS_KEY_ID"),
      "backup_storage_access_key_id",
      "Backup storage access key",
      "Offsite backup access key is configured",
      "Offsite backup access key is not configured"
    ),
    buildConfigCheck(
      catalogMap.get("BACKUP_STORAGE_SECRET_ACCESS_KEY"),
      "backup_storage_secret_access_key",
      "Backup storage secret key",
      "Offsite backup secret key is configured",
      "Offsite backup secret key is not configured"
    ),
    buildBackupFreshnessCheck(lastBackup?.createdAt || null),
    buildBackupOffsiteCheck(lastBackupOffsite, Boolean(lastBackup)),
  ];

  const allChecks = [...preventiveChecks, ...detectionChecks, ...recoveryChecks];
  const missingRequiredKeys = trackedConfigKeys.filter((key) => {
    const item = catalogMap.get(key);
    return Boolean(item?.requiredInProduction && !item.configured);
  });

  return {
    generatedAt: new Date().toISOString(),
    summary: summarizeChecks(allChecks, missingRequiredKeys.length),
    missingRequiredKeys,
    lastBackup: lastBackup
      ? {
          createdAt: lastBackup.createdAt.toISOString(),
          fileName: lastBackup.fileName || null,
          recordCount: lastBackup.recordCount || null,
          type: lastBackup.type,
          offsiteStatus: lastBackupOffsite?.status || null,
          offsiteLocation: lastBackupOffsite?.location || null,
        }
      : null,
    groups: [
      { id: "preventive", label: "Preventive Controls", checks: preventiveChecks },
      { id: "detection", label: "Detection & Alerting", checks: detectionChecks },
      { id: "recovery", label: "Backup & Recovery", checks: recoveryChecks },
    ],
  };
}
