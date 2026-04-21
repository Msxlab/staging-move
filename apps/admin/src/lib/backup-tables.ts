export const BACKUP_TABLES = {
  users: { model: "user", label: "Users" },
  profiles: { model: "profile", label: "Profiles" },
  providers: { model: "serviceProvider", label: "Service Providers" },
  addresses: { model: "address", label: "Addresses" },
  movingPlans: { model: "movingPlan", label: "Moving Plans" },
  tasks: { model: "task", label: "Tasks" },
  services: { model: "service", label: "Services" },
  budgets: { model: "budget", label: "Budgets" },
  subscriptions: { model: "subscription", label: "Subscriptions" },
  notifications: { model: "notification", label: "Notifications" },
  auditLogs: { model: "auditLog", label: "Audit Logs" },
} as const;

export type BackupTableName = keyof typeof BACKUP_TABLES;

export const BACKUP_TABLE_ORDER: BackupTableName[] = [
  "users",
  "profiles",
  "providers",
  "addresses",
  "movingPlans",
  "tasks",
  "services",
  "budgets",
  "subscriptions",
  "notifications",
  "auditLogs",
];

const BACKUP_TABLE_DEPENDENCIES: Partial<
  Record<BackupTableName, BackupTableName[]>
> = {
  profiles: ["users"],
  addresses: ["users"],
  movingPlans: ["users", "addresses"],
  tasks: ["users"],
  services: ["users", "addresses"],
  budgets: ["users"],
  subscriptions: ["users"],
  notifications: ["users"],
  auditLogs: ["users"],
};

const BACKUP_TABLE_REPLACE_REQUIREMENTS: Partial<
  Record<BackupTableName, BackupTableName[]>
> = {
  users: [
    "profiles",
    "addresses",
    "movingPlans",
    "tasks",
    "services",
    "budgets",
    "subscriptions",
    "notifications",
  ],
  addresses: ["movingPlans", "services", "budgets"],
  movingPlans: ["tasks"],
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
