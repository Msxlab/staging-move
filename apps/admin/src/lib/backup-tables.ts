/**
 * Per-table backup safety limits.
 *
 * BACKUP_PAGE_SIZE   — how many rows we fetch per cursor page. Smaller
 *                      pages keep memory bounded; larger pages reduce
 *                      DB round-trips. 5k strikes the balance Prisma
 *                      MySQL handles well without spiking heap.
 * MAX_BACKUP_ROWS_PER_TABLE — hard ceiling per table. Above this we
 *                      stop fetching and mark the BackupRecord as
 *                      PARTIAL so the operator never sees a silently
 *                      truncated "FULL" archive. Any production table
 *                      this large needs a streaming export job, not a
 *                      synchronous request handler.
 */
export const BACKUP_PAGE_SIZE = 5_000;
export const MAX_BACKUP_ROWS_PER_TABLE = 500_000;

export interface FetchAllRecordsResult {
  records: any[];
  truncated: boolean;
  fetched: number;
}

/**
 * Cursor-paginated fetch for a backup table. Replaces the previous
 * per-route `findMany({ take: 50000 })` which silently truncated past
 * 50k rows. The caller observes `truncated === true` and surfaces a
 * PARTIAL backup to the operator instead of a misleading FULL archive.
 *
 * The Prisma model name is taken from the BACKUP_TABLES entry; using
 * `(prismaClient as any)[modelName]` is safe because the keyset is
 * frozen at module-load time.
 */
export async function fetchAllRecords(
  prismaClient: { [key: string]: any },
  table: BackupTableName,
): Promise<FetchAllRecordsResult> {
  const modelName = BACKUP_TABLES[table].model;
  const model = (prismaClient as any)[modelName];
  if (!model || typeof model.findMany !== "function") {
    throw new Error(`Backup model ${modelName} not present on Prisma client`);
  }

  const records: any[] = [];
  let cursorId: string | undefined;
  let truncated = false;

  while (records.length < MAX_BACKUP_ROWS_PER_TABLE) {
    const batch = await model.findMany({
      orderBy: { id: "asc" },
      take: BACKUP_PAGE_SIZE,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    });
    if (!batch || batch.length === 0) break;
    records.push(...batch);
    if (batch.length < BACKUP_PAGE_SIZE) break;
    const last = batch[batch.length - 1];
    if (!last || typeof last.id !== "string") {
      // Rare: a table without a string `id`. Stop fetching to avoid an
      // infinite loop; caller should investigate the table layout.
      break;
    }
    cursorId = last.id;
  }

  if (records.length >= MAX_BACKUP_ROWS_PER_TABLE) {
    // We reached the ceiling — there might be more rows beyond. Mark
    // the result truncated so the BackupRecord can be flagged PARTIAL.
    const next = await model.findMany({
      orderBy: { id: "asc" },
      take: 1,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    });
    if (next && next.length > 0) truncated = true;
  }

  return { records, truncated, fetched: records.length };
}

export const BACKUP_TABLES = {
  users: { model: "user", label: "Users" },
  oauthAccounts: { model: "oAuthAccount", label: "OAuth Accounts" },
  profiles: { model: "profile", label: "Profiles" },
  dataConsents: { model: "dataConsent", label: "Data Consents" },
  providers: { model: "serviceProvider", label: "Service Providers" },
  providerLogoCandidates: {
    model: "providerLogoCandidate",
    label: "Provider Logo Candidates",
  },
  providerCoverages: { model: "serviceProviderCoverage", label: "Provider Coverage" },
  addresses: { model: "address", label: "Addresses" },
  movingPlans: { model: "movingPlan", label: "Moving Plans" },
  customProviders: { model: "userCustomProvider", label: "User Custom Providers" },
  services: { model: "service", label: "Services" },
  moveTasks: { model: "moveTask", label: "Move Tasks" },
  budgets: { model: "budget", label: "Budgets" },
  subscriptions: { model: "subscription", label: "Subscriptions" },
  notifications: { model: "notification", label: "Notifications" },
  emailLogs: { model: "emailLog", label: "Email Logs" },
  auditLogs: { model: "auditLog", label: "Audit Logs" },
  providerGovernanceIssues: {
    model: "providerGovernanceIssue",
    label: "Provider Governance Issues",
  },
  adminUsers: { model: "adminUser", label: "Admin Users" },
  adminPermissions: { model: "adminPermission", label: "Admin Permissions" },
  adminLoginLogs: { model: "adminLoginLog", label: "Admin Login Logs" },
  adminAuditLogs: { model: "adminAuditLog", label: "Admin Audit Logs" },
} as const;

export type BackupTableName = keyof typeof BACKUP_TABLES;

export const BACKUP_TABLE_ORDER: BackupTableName[] = [
  "users",
  "oauthAccounts",
  "profiles",
  "dataConsents",
  "providers",
  "providerLogoCandidates",
  "providerCoverages",
  "addresses",
  "movingPlans",
  "customProviders",
  "services",
  "moveTasks",
  "budgets",
  "subscriptions",
  "notifications",
  "emailLogs",
  "auditLogs",
  "providerGovernanceIssues",
  "adminUsers",
  "adminPermissions",
  "adminLoginLogs",
  "adminAuditLogs",
];

const BACKUP_TABLE_DEPENDENCIES: Partial<
  Record<BackupTableName, BackupTableName[]>
> = {
  oauthAccounts: ["users"],
  profiles: ["users"],
  dataConsents: ["users"],
  providerLogoCandidates: ["providers"],
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
  emailLogs: [],
  auditLogs: ["users"],
  providerGovernanceIssues: ["providers", "customProviders"],
  adminPermissions: ["adminUsers"],
  adminLoginLogs: ["adminUsers"],
  adminAuditLogs: ["adminUsers"],
};

const BACKUP_TABLE_REPLACE_REQUIREMENTS: Partial<
  Record<BackupTableName, BackupTableName[]>
> = {
  users: [
    "oauthAccounts",
    "profiles",
    "dataConsents",
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
  providers: [
    "providerLogoCandidates",
    "providerCoverages",
    "services",
    "moveTasks",
    "providerGovernanceIssues",
  ],
  providerLogoCandidates: ["providers"],
  providerCoverages: ["providers"],
  addresses: ["movingPlans", "services", "moveTasks", "budgets"],
  movingPlans: ["moveTasks"],
  customProviders: ["services", "moveTasks", "providerGovernanceIssues"],
  services: ["moveTasks"],
  adminUsers: ["adminPermissions", "adminLoginLogs", "adminAuditLogs"],
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
