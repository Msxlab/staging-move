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
  // Family/Pro workspaces have launched — these stopped being the empty,
  // flag-off skeleton they were when first excluded. Workspace rows anchor
  // the isolation axis (addresses/services/movingPlans/budgets carry a
  // workspaceId FK); members carry roles and managed-sync consent.
  workspaces: { model: "workspace", label: "Workspaces" },
  workspaceMembers: { model: "workspaceMember", label: "Workspace Members" },
  // Per-user channel/type opt-outs (including MARKETING). A restore that
  // drops these silently resets everyone to default-enabled, undoing
  // explicit user opt-outs — consent-adjacent, so always recover.
  notificationPreferences: {
    model: "notificationPreference",
    label: "Notification Preferences",
  },
  providers: { model: "serviceProvider", label: "Service Providers" },
  providerLogoCandidates: {
    model: "providerLogoCandidate",
    label: "Provider Logo Candidates",
  },
  providerCoverages: { model: "serviceProviderCoverage", label: "Provider Coverage" },
  addresses: { model: "address", label: "Addresses" },
  addressChangeEvents: {
    model: "addressChangeEvent",
    label: "Address Change Events",
  },
  movingPlans: { model: "movingPlan", label: "Moving Plans" },
  customProviders: { model: "userCustomProvider", label: "User Custom Providers" },
  services: { model: "service", label: "Services" },
  // User-created reminders hang off services (Cascade FK) — user data.
  reminders: { model: "reminder", label: "Reminders" },
  moveTasks: { model: "moveTask", label: "Move Tasks" },
  budgets: { model: "budget", label: "Budgets" },
  subscriptions: { model: "subscription", label: "Subscriptions" },
  notifications: { model: "notification", label: "Notifications" },
  // Admin-authored email content; EmailLog.templateId references these.
  emailTemplates: { model: "emailTemplate", label: "Email Templates" },
  emailLogs: { model: "emailLog", label: "Email Logs" },
  auditLogs: { model: "auditLog", label: "Audit Logs" },
  providerGovernanceIssues: {
    model: "providerGovernanceIssue",
    label: "Provider Governance Issues",
  },
  connectorFallbackActions: {
    model: "connectorFallbackAction",
    label: "Connector Fallback Actions",
  },
  // User support history. senderId/assignedTo are loose admin refs (no
  // FK), so `users` is the only hard parent of the ticket thread.
  supportTickets: { model: "supportTicket", label: "Support Tickets" },
  ticketMessages: { model: "ticketMessage", label: "Ticket Messages" },
  adminUsers: { model: "adminUser", label: "Admin Users" },
  adminPermissions: { model: "adminPermission", label: "Admin Permissions" },
  adminLoginLogs: { model: "adminLoginLog", label: "Admin Login Logs" },
  adminAuditLogs: { model: "adminAuditLog", label: "Admin Audit Logs" },
  acquisitionCampaigns: {
    model: "acquisitionCampaign",
    label: "Acquisition Campaigns",
  },
  acquisitionRedemptions: {
    model: "acquisitionRedemption",
    label: "Acquisition Redemptions",
  },
  // Affiliate revenue attribution. Conversions are partner-reported payout
  // events (Layer 1 revenue) and are worth recovering on restore; clicks are
  // their originating context (a conversion echoes back its click id), so the
  // click table is included as the conversion's dependency.
  affiliateClicks: { model: "affiliateClick", label: "Affiliate Clicks" },
  affiliateConversions: {
    model: "affiliateConversion",
    label: "Affiliate Conversions",
  },
  blogCategories: { model: "blogCategory", label: "Blog Categories" },
  blogTags: { model: "blogTag", label: "Blog Tags" },
  blogPosts: { model: "blogPost", label: "Blog Posts" },
  // Sponsored placements are admin-managed delivery records whose
  // impression/click counters are the billing evidence — recover on restore.
  sponsoredPlacements: {
    model: "sponsoredPlacement",
    label: "Sponsored Placements",
  },
  // Admin-curated content with no FK parents. StateRule's seed script only
  // provides initial values — admin edits make the DB the source of truth.
  helpArticles: { model: "helpArticle", label: "Help Articles" },
  faqs: { model: "fAQ", label: "FAQs" },
  stateRules: { model: "stateRule", label: "State Rules" },
  // Accumulated allow/block list. Losing the blacklist in a disaster would
  // fail open for known-abusive IPs, so it is part of the recovery set.
  ipRules: { model: "iPRule", label: "IP Rules" },
  // Marketing waitlist leads — externally irreplaceable contact data.
  // `userId` is a loose ref (no FK), so there is no ordering constraint.
  waitlistSignups: { model: "waitlistSignup", label: "Waitlist Signups" },
  // Partner-submitted mover applications + the index of their uploaded
  // compliance docs (USDOT cert / insurance COI — the files live in R2, backed
  // up separately). Externally irreplaceable: the attestation, FMCSA review
  // snapshot, and decision trail are NOT reconstructable from FMCSA (unlike
  // MovingCompany, which IS, so it stays excluded). MoverDocument Cascade-
  // children of the application.
  moverApplications: { model: "moverApplication", label: "Mover Applications" },
  moverDocuments: { model: "moverDocument", label: "Mover Documents" },
  // Lead-gen (R3): captured moving-quote requests + their per-partner delivery
  // rows. Externally irreplaceable (the consumer's request + immutable consent
  // snapshot + delivery/billing trail). PII is encrypted in Lead.payloadEncrypted.
  // LeadDispatch.leadId Cascade-FKs Lead, so the lead imports first.
  leads: { model: "lead", label: "Leads" },
  leadDispatches: { model: "leadDispatch", label: "Lead Dispatches" },
  // Generic partners (R4: cleaning/junk) + their verification documents.
  // Externally irreplaceable (registration + attestation + review trail);
  // PartnerDocument.partnerId Cascade-FKs Partner, so the partner imports first.
  partners: { model: "partner", label: "Partners" },
  partnerDocuments: { model: "partnerDocument", label: "Partner Documents" },
  // Partner billing (R5): the period invoices + the per-charge ledger lines.
  // Money records — externally irreplaceable. Loose refs (partnerId / invoiceId,
  // no FK); ledger.invoiceId softly points at an invoice, so invoices import first.
  partnerInvoices: { model: "partnerInvoice", label: "Partner Invoices" },
  partnerLedgerEntries: { model: "partnerLedgerEntry", label: "Partner Ledger Entries" },
} as const;

export type BackupTableName = keyof typeof BACKUP_TABLES;

// Restore order == FK order: every table appears after all of its FK
// parents so MERGE/REPLACE imports can create rows table-by-table without
// tripping referential integrity. Notable constraints:
//   - the admin block leads because AcquisitionCampaign (admin-created)
//     must exist before Subscription rows that reference it (campaignId);
//   - workspaces sit right after users (owner FK) and before every table
//     carrying a workspaceId FK (addresses/services/movingPlans/budgets);
//   - emailTemplates precede emailLogs (templateId FK).
export const BACKUP_TABLE_ORDER: BackupTableName[] = [
  "adminUsers",
  "adminPermissions",
  "adminLoginLogs",
  "adminAuditLogs",
  "users",
  "workspaces",
  "workspaceMembers",
  "oauthAccounts",
  "profiles",
  "dataConsents",
  "notificationPreferences",
  "acquisitionCampaigns",
  "subscriptions",
  "acquisitionRedemptions",
  "providers",
  "providerLogoCandidates",
  "providerCoverages",
  "addresses",
  "addressChangeEvents",
  "movingPlans",
  "customProviders",
  "services",
  "reminders",
  "moveTasks",
  "budgets",
  "notifications",
  "emailTemplates",
  "emailLogs",
  "auditLogs",
  "providerGovernanceIssues",
  "connectorFallbackActions",
  "supportTickets",
  "ticketMessages",
  "affiliateClicks",
  "affiliateConversions",
  "blogCategories",
  "blogTags",
  "blogPosts",
  "sponsoredPlacements",
  // FK-free admin content/config — relative order here is irrelevant.
  "helpArticles",
  "faqs",
  "stateRules",
  "ipRules",
  "waitlistSignups",
  // MoverApplication carries only loose refs (no FK); MoverDocument FKs it
  // (Cascade), so the application must be imported first.
  "moverApplications",
  "moverDocuments",
  // Lead before its dispatch children (Cascade FK). Lead.userId is a loose ref
  // (no FK), so there is no ordering constraint against users.
  "leads",
  "leadDispatches",
  // Partner before its documents (Cascade FK); Partner has only loose refs.
  "partners",
  "partnerDocuments",
  // Invoices before ledger entries (soft invoiceId ref); both loose-ref'd to Partner.
  "partnerInvoices",
  "partnerLedgerEntries",
];

// Exported so the colocated test can assert that BACKUP_TABLE_ORDER lists
// every dependency before its dependent (the FK-ordering invariant above).
export const BACKUP_TABLE_DEPENDENCIES: Partial<
  Record<BackupTableName, BackupTableName[]>
> = {
  oauthAccounts: ["users"],
  profiles: ["users"],
  dataConsents: ["users"],
  // Workspace.ownerUserId → User (Restrict); members FK both axes. The
  // member's parentMemberId self-FK stays within the table.
  workspaces: ["users"],
  workspaceMembers: ["users", "workspaces"],
  notificationPreferences: ["users"],
  providerLogoCandidates: ["providers"],
  providerCoverages: ["providers"],
  // workspaceId FKs (nullable, Cascade) on the four workspace-scoped
  // domain tables: rows with the FK set need the workspace row present.
  addresses: ["users", "workspaces"],
  addressChangeEvents: ["users"],
  movingPlans: ["users", "addresses", "workspaces"],
  customProviders: ["users", "providers"],
  services: [
    "users",
    "addresses",
    "providers",
    "customProviders",
    "workspaces",
  ],
  reminders: ["services"],
  moveTasks: [
    "users",
    "movingPlans",
    "services",
    "addresses",
    "providers",
    "customProviders",
  ],
  budgets: ["users", "workspaces"],
  // Subscription.campaignId is a SetNull FK, but an INSERT with the field
  // set still requires the campaign row — soft dependency, same pattern as
  // affiliateConversions below.
  subscriptions: ["users", "acquisitionCampaigns"],
  notifications: ["users"],
  // EmailLog.templateId (SetNull FK) — the template must exist at insert
  // time whenever the field is populated.
  emailLogs: ["emailTemplates"],
  auditLogs: ["users"],
  providerGovernanceIssues: ["providers", "customProviders"],
  connectorFallbackActions: [],
  supportTickets: ["users"],
  ticketMessages: ["supportTickets"],
  adminPermissions: ["adminUsers"],
  adminLoginLogs: ["adminUsers"],
  adminAuditLogs: ["adminUsers"],
  acquisitionCampaigns: ["adminUsers"],
  acquisitionRedemptions: [
    "users",
    "subscriptions",
    "acquisitionCampaigns",
  ],
  // Click is FK'd to both the user and the provider (both Cascade), so its
  // import needs those parents present.
  affiliateClicks: ["users", "providers"],
  // Conversion is FK'd to the provider (Cascade) and, optionally, to its
  // originating click (SetNull). The click is therefore a soft dependency:
  // importing conversions before clicks would null out the click linkage.
  affiliateConversions: ["providers", "affiliateClicks"],
  blogPosts: ["adminUsers", "blogCategories"],
  // MoverDocument.applicationId → MoverApplication (Cascade). MoverApplication
  // carries only loose refs (linkedMovingCompanyId / reviewedByAdminId, no FK).
  moverDocuments: ["moverApplications"],
  // LeadDispatch.leadId → Lead (Cascade); the lead must import first. Lead itself
  // has only loose refs (userId / partner refs), so no entry for it.
  leadDispatches: ["leads"],
  // PartnerDocument.partnerId → Partner (Cascade); the partner imports first.
  partnerDocuments: ["partners"],
  // Soft ref: a ledger line may carry invoiceId, so invoices import first (same
  // SetNull-style pattern as affiliateConversions → affiliateClicks).
  partnerLedgerEntries: ["partnerInvoices"],
};

const BACKUP_TABLE_REPLACE_REQUIREMENTS: Partial<
  Record<BackupTableName, BackupTableName[]>
> = {
  users: [
    "oauthAccounts",
    "profiles",
    "dataConsents",
    "workspaceMembers",
    "notificationPreferences",
    "addresses",
    "addressChangeEvents",
    "movingPlans",
    "customProviders",
    "services",
    "moveTasks",
    "budgets",
    "subscriptions",
    "acquisitionRedemptions",
    "notifications",
    "providerGovernanceIssues",
    "affiliateClicks",
    "supportTickets",
  ],
  // Deleting a workspace cascades down the workspaceId FK into the four
  // workspace-scoped domain tables and into its membership rows.
  workspaces: [
    "workspaceMembers",
    "addresses",
    "services",
    "movingPlans",
    "budgets",
  ],
  providers: [
    "providerLogoCandidates",
    "providerCoverages",
    "services",
    "moveTasks",
    "providerGovernanceIssues",
    "affiliateClicks",
    "affiliateConversions",
  ],
  providerLogoCandidates: ["providers"],
  providerCoverages: ["providers"],
  addresses: ["movingPlans", "services", "moveTasks", "budgets"],
  movingPlans: ["moveTasks"],
  customProviders: ["services", "moveTasks", "providerGovernanceIssues"],
  services: ["moveTasks", "reminders"],
  supportTickets: ["ticketMessages"],
  // SetNull fan-out: deleting these parents mutates (nulls FK columns on)
  // rows in the child table, so the child must be selected for re-import
  // too — same rationale the campaigns → redemptions pair already used.
  emailTemplates: ["emailLogs"],
  affiliateClicks: ["affiliateConversions"],
  adminUsers: ["adminPermissions", "adminLoginLogs", "adminAuditLogs"],
  acquisitionCampaigns: ["acquisitionRedemptions", "subscriptions"],
  blogCategories: ["blogPosts"],
  // Deleting an application cascades into its uploaded documents.
  moverApplications: ["moverDocuments"],
  // Deleting a lead cascades into its dispatch rows.
  leads: ["leadDispatches"],
  // Deleting a partner cascades into its documents.
  partners: ["partnerDocuments"],
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
