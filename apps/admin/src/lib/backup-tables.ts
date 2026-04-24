export const BACKUP_TABLES = {
  users: { model: "user", label: "Users" },
  profiles: { model: "profile", label: "Profiles" },
  providers: { model: "serviceProvider", label: "Service Providers" },
  providerCoverages: { model: "serviceProviderCoverage", label: "Provider Coverage" },
  addresses: { model: "address", label: "Addresses" },
  movingPlans: { model: "movingPlan", label: "Moving Plans" },
  customProviders: { model: "userCustomProvider", label: "User Custom Providers" },
  services: { model: "service", label: "Services" },
  moveTasks: { model: "moveTask", label: "Move Tasks" },
  budgets: { model: "budget", label: "Budgets" },
  subscriptions: { model: "subscription", label: "Subscriptions" },
  notifications: { model: "notification", label: "Notifications" },
  auditLogs: { model: "auditLog", label: "Audit Logs" },
  providerGovernanceIssues: {
    model: "providerGovernanceIssue",
    label: "Provider Governance Issues",
  },
} as const;

export type BackupTableName = keyof typeof BACKUP_TABLES;

export const BACKUP_TABLE_ORDER: BackupTableName[] = [
  "users",
  "profiles",
  "providers",
  "providerCoverages",
  "addresses",
  "movingPlans",
  "customProviders",
  "services",
  "moveTasks",
  "budgets",
  "subscriptions",
  "notifications",
  "auditLogs",
  "providerGovernanceIssues",
];

const BACKUP_TABLE_DEPENDENCIES: Partial<
  Record<BackupTableName, BackupTableName[]>
> = {
  profiles: ["users"],
  providerCoverages: ["providers"],
  addresses: ["users"],
  movingPlans: ["users", "addresses"],
  customProviders: ["users", "providers"],
  services: ["users", "addresses", "providers", "customProviders"],
  moveTasks: [
    "users",
    "movingPlans",
    "services",
    "addresses",
    "providers",
    "customProviders",
  ],
  budgets: ["users"],
  subscriptions: ["users"],
  notifications: ["users"],
  auditLogs: ["users"],
  providerGovernanceIssues: ["providers", "customProviders"],
};

const BACKUP_TABLE_REPLACE_REQUIREMENTS: Partial<
  Record<BackupTableName, BackupTableName[]>
> = {
  users: [
    "profiles",
    "addresses",
    "movingPlans",
    "customProviders",
    "services",
    "moveTasks",
    "budgets",
    "subscriptions",
    "notifications",
    "providerGovernanceIssues",
  ],
  providers: ["providerCoverages", "services", "moveTasks", "providerGovernanceIssues"],
  providerCoverages: ["providers"],
  addresses: ["movingPlans", "services", "moveTasks", "budgets"],
  movingPlans: ["moveTasks"],
  customProviders: ["services", "moveTasks", "providerGovernanceIssues"],
  services: ["moveTasks"],
};

export function isSupportedBackupTable(
  value: string,
): value is BackupTableName {
  return value in BACKUP_TABLES;
}

export function normalizeBackupTables(values: string[]): BackupTableName[] {
  const unique = new Set<BackupTableName>();
  for (const value of values) {
    if (isSupportedBackupTable(value)) {
      unique.add(value);
    }
  }

  return BACKUP_TABLE_ORDER.filter((table) => unique.has(table));
}

export function getBackupDependencyWarnings(values: string[]): string[] {
  const selected = new Set(normalizeBackupTables(values));
  const warnings: string[] = [];

  for (const table of BACKUP_TABLE_ORDER) {
    if (!selected.has(table)) continue;
    const missing = (BACKUP_TABLE_DEPENDENCIES[table] || []).filter(
      (dependency) => !selected.has(dependency),
    );
    if (missing.length > 0) {
      warnings.push(
        `${table} depends on ${missing.join(", ")}; import only succeeds if those parent records already exist in the target database.`,
      );
    }
  }

  return warnings;
}

export function getReplaceSafetyIssues(values: string[]): string[] {
  const selected = new Set(normalizeBackupTables(values));
  const issues: string[] = [];

  for (const table of BACKUP_TABLE_ORDER) {
    if (!selected.has(table)) continue;
    const missing = (BACKUP_TABLE_REPLACE_REQUIREMENTS[table] || []).filter(
      (dependency) => !selected.has(dependency),
    );
    if (missing.length > 0) {
      issues.push(
        `${table} cannot be replaced safely without also selecting ${missing.join(", ")} because deleting ${table} would cascade into those tables.`,
      );
    }
  }

  return issues;
}
