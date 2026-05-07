"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ElementType,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Cloud,
  Clock3,
  Database,
  Download,
  Eye,
  FileJson,
  FileUp,
  Filter,
  HardDrive,
  Loader2,
  Lock,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Table2,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn, formatDateTime, truncate } from "@/lib/utils";

interface BackupArchiveDiagnostics {
  encrypted: boolean;
  signature: boolean;
  totalRecords: number | null;
  tableCounts: Record<string, number>;
}

interface BackupRecord {
  id: string;
  type: string;
  status: string;
  format: string;
  fileName?: string | null;
  fileSize?: number | null;
  recordCount?: number | null;
  tables?: string | null;
  errorMessage?: string | null;
  createdBy: string;
  createdByLabel?: string;
  completedAt?: string | null;
  createdAt: string;
  archive?: BackupArchiveDiagnostics | null;
  offsite?: {
    status: "stored" | "disabled" | "failed";
    provider?: string | null;
    bucket?: string | null;
    region?: string | null;
    endpoint?: string | null;
    objectKey?: string | null;
    location?: string | null;
    uploadedAt?: string | null;
    reason?: string | null;
  } | null;
}

interface BackupStorageSummary {
  provider: string | null;
  bucket: string | null;
  region: string | null;
  endpoint: string | null;
  configured: boolean;
  credentialsConfigured: boolean;
  ready: boolean;
  unsupportedProvider: boolean;
}

interface BackupArchivePolicy {
  environment: string;
  production: boolean;
  encryptionRequired: boolean;
  cryptoReady: boolean;
  offsiteRequired: boolean;
  browserDownloadFallbackAllowed: boolean;
  message: string;
}

interface BackupTableConfig {
  model: string;
  label: string;
}

interface VerifyCheck {
  name: string;
  status: "pass" | "fail" | "warn";
  detail: string;
}

interface VerifyResult {
  success: boolean;
  verdict: "PASS" | "WARN" | "FAIL";
  message: string;
  checks: VerifyCheck[];
  totalRecords: number;
  tableStats: Record<
    string,
    { count: number; sampleFields: string[]; dbCount?: number }
  >;
}

interface ImportResult {
  success: boolean;
  mode: string;
  message?: string;
  tables?: string[];
  results?: Record<
    string,
    { imported: number; skipped: number; errors: number; deleted?: number }
  >;
  summary?: {
    totalImported: number;
    totalSkipped: number;
    totalErrors: number;
  };
}

interface PasswordPromptState {
  open: boolean;
  title: string;
  description: string;
  actionLabel: string;
}

const BACKUP_TYPES = [
  { value: "FULL", label: "Full Backup", desc: "All protected tables" },
  { value: "USERS", label: "Users", desc: "Users, profiles, subscriptions" },
  {
    value: "PROVIDERS",
    label: "Providers",
    desc: "Provider catalog and coverage",
  },
  {
    value: "SERVICES",
    label: "Services",
    desc: "Services and related records",
  },
  {
    value: "MOVING_PLANS",
    label: "Moving Plans",
    desc: "Moving plan records",
  },
] as const;

const FALLBACK_TABLES = [
  "users",
  "profiles",
  "providers",
  "providerCoverages",
  "addresses",
  "movingPlans",
  "services",
  "budgets",
  "subscriptions",
  "notifications",
  "auditLogs",
];

const STATUS_FILTERS = [
  "ALL",
  "COMPLETED",
  "FAILED",
  "IN_PROGRESS",
  "PENDING",
] as const;
const OFFSITE_FILTERS = ["ALL", "stored", "failed", "disabled"] as const;

const statusToneClasses: Record<string, string> = {
  COMPLETED: "bg-tone-sage-bg text-tone-sage-fg border-tone-sage-br",
  FAILED: "bg-destructive/10 text-destructive border-destructive/20",
  IN_PROGRESS: "bg-tone-sky-bg text-tone-sky-fg border-tone-sky-br",
  PENDING: "bg-tone-honey-bg text-tone-honey-fg border-tone-honey-br",
};

const offsiteToneClasses: Record<string, string> = {
  stored: "bg-tone-sage-bg text-tone-sage-fg border-tone-sage-br",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
  disabled: "bg-tone-slate-bg text-muted-foreground border-tone-slate-br",
};

const checkToneClasses: Record<VerifyCheck["status"], string> = {
  pass: "bg-tone-sage-bg text-tone-sage-fg border-tone-sage-br",
  warn: "bg-tone-honey-bg text-tone-honey-fg border-tone-honey-br",
  fail: "bg-destructive/10 text-destructive border-destructive/20",
};

function formatBytes(bytes?: number | null): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const size = Math.max(bytes, 0);
  const unitIndex = Math.min(
    Math.floor(Math.log(size || 1) / Math.log(1024)),
    units.length - 1,
  );
  return `${(size / Math.pow(1024, unitIndex)).toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatRelativeTime(value?: string | null): string {
  if (!value) return "â€”";
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(Math.round(diff / 60000), 0);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  return `${months}mo ago`;
}

function parseTables(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function getBackupTypeLabel(type: string) {
  return BACKUP_TYPES.find((item) => item.value === type)?.label || type;
}

function extractImportPreview(parsed: any): {
  payload: Record<string, unknown>;
  preview: Record<string, number>;
  encrypted: boolean;
} {
  const archive =
    parsed && parsed.version === 1 && parsed.metadata && parsed.payload
      ? parsed
      : null;

  if (archive) {
    const metadataCounts =
      archive.metadata?.tableCounts &&
      typeof archive.metadata.tableCounts === "object"
        ? archive.metadata.tableCounts
        : {};
    const tables = Array.isArray(archive.metadata?.tables)
      ? archive.metadata.tables.filter(
          (table: unknown): table is string => typeof table === "string",
        )
      : Object.keys(metadataCounts);
    const preview = Object.fromEntries(
      tables.map((table: string) => [
        table,
        typeof metadataCounts[table] === "number" ? metadataCounts[table] : 0,
      ]),
    );

    if (
      Object.keys(preview).length === 0 &&
      archive.payload?.type === "plain" &&
      archive.payload?.data
    ) {
      for (const [key, value] of Object.entries(
        archive.payload.data as Record<string, unknown>,
      )) {
        if (Array.isArray(value)) preview[key] = value.length;
      }
    }

    return {
      payload: { archive },
      preview,
      encrypted: archive.payload?.type === "encrypted",
    };
  }

  const data = parsed?.data || parsed;
  const preview: Record<string, number> = {};
  for (const [key, value] of Object.entries(
    (data || {}) as Record<string, unknown>,
  )) {
    if (Array.isArray(value)) preview[key] = value.length;
  }

  return {
    payload: { data },
    preview,
    encrypted: false,
  };
}

function downloadFile(
  content: BlobPart | Blob,
  fileName: string,
  type = "application/json",
) {
  const blob =
    content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

async function downloadBackupFromUrl(url: string, fileName: string) {
  const response = await fetch(url);
  const blob = await response.blob();
  if (!response.ok) {
    let message = "Failed to download backup archive";
    try {
      const parsed = JSON.parse(await blob.text());
      message = parsed.error || message;
    } catch {
      message = (await blob.text()) || message;
    }
    throw new Error(message);
  }

  downloadFile(blob, fileName, blob.type || "application/json");
}

function buildToneClass(
  tone: "neutral" | "success" | "warning" | "danger" | "info",
) {
  if (tone === "success")
    return "border-tone-sage-br bg-tone-sage-bg text-tone-sage-fg";
  if (tone === "warning")
    return "border-tone-honey-br bg-tone-honey-bg text-tone-honey-fg";
  if (tone === "danger") return "border-destructive/20 bg-destructive/5 text-destructive";
  if (tone === "info") return "border-tone-sky-br bg-tone-sky-bg text-tone-sky-fg";
  return "border-border bg-background text-foreground";
}

export function BackupControlPlane() {
  const router = useRouter();
  const passwordResolverRef = useRef<((value: string | null) => void) | null>(
    null,
  );
  const hasLoadedBackupsRef = useRef(false);
  const [passwordPrompt, setPasswordPrompt] = useState<PasswordPromptState>({
    open: false,
    title: "",
    description: "",
    actionLabel: "Continue",
  });
  const [passwordValue, setPasswordValue] = useState("");
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [tableMap, setTableMap] = useState<Record<string, BackupTableConfig>>(
    {},
  );
  const [storage, setStorage] = useState<BackupStorageSummary | null>(null);
  const [archivePolicy, setArchivePolicy] =
    useState<BackupArchivePolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [downloadingBackupId, setDownloadingBackupId] = useState<string | null>(
    null,
  );
  const [selectedType, setSelectedType] = useState("FULL");
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [selectedBackupId, setSelectedBackupId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUS_FILTERS)[number]>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [offsiteFilter, setOffsiteFilter] =
    useState<(typeof OFFSITE_FILTERS)[number]>("ALL");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPayload, setImportPayload] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [importPreview, setImportPreview] = useState<Record<
    string,
    number
  > | null>(null);
  const [importTables, setImportTables] = useState<string[]>([]);
  const [importMode, setImportMode] = useState<"MERGE" | "REPLACE">("MERGE");
  const [importIsEncrypted, setImportIsEncrypted] = useState(false);
  const [verificationResult, setVerificationResult] =
    useState<VerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<ImportResult | null>(null);
  const [dryRunning, setDryRunning] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);

  const availableTables = useMemo(
    () =>
      Object.keys(tableMap).length > 0
        ? Object.keys(tableMap)
        : FALLBACK_TABLES,
    [tableMap],
  );

  const totalDatabaseRecords = useMemo(
    () => Object.values(stats).reduce((sum, value) => sum + value, 0),
    [stats],
  );

  const filteredBackups = useMemo(() => {
    const query = search.trim().toLowerCase();
    return backups.filter((backup) => {
      const statusMatch =
        statusFilter === "ALL" || backup.status === statusFilter;
      const typeMatch = typeFilter === "ALL" || backup.type === typeFilter;
      const offsiteMatch =
        offsiteFilter === "ALL" ||
        (backup.offsite?.status || "disabled") === offsiteFilter;
      const searchMatch =
        query.length === 0 ||
        (backup.fileName || "").toLowerCase().includes(query) ||
        backup.id.toLowerCase().includes(query) ||
        (backup.createdByLabel || backup.createdBy || "")
          .toLowerCase()
          .includes(query) ||
        backup.type.toLowerCase().includes(query);
      return statusMatch && typeMatch && offsiteMatch && searchMatch;
    });
  }, [backups, offsiteFilter, search, statusFilter, typeFilter]);

  const selectedBackup = useMemo(
    () => backups.find((backup) => backup.id === selectedBackupId) || null,
    [backups, selectedBackupId],
  );

  const completedBackups = useMemo(
    () => backups.filter((backup) => backup.status === "COMPLETED"),
    [backups],
  );

  const latestCompletedBackup = completedBackups[0] || null;
  const failedBackups = backups.filter(
    (backup) => backup.status === "FAILED",
  ).length;
  const offsiteProtectedCount = completedBackups.filter(
    (backup) => backup.offsite?.status === "stored",
  ).length;

  const recoveryPosture = useMemo(() => {
    if (!latestCompletedBackup) {
      return {
        tone: "danger" as const,
        title: "At risk",
        description: "No completed backups are recorded yet.",
      };
    }

    const ageHours =
      (Date.now() - new Date(latestCompletedBackup.createdAt).getTime()) /
      (1000 * 60 * 60);
    if (
      latestCompletedBackup.offsite?.status === "stored" &&
      latestCompletedBackup.archive?.encrypted &&
      latestCompletedBackup.archive?.signature &&
      ageHours <= 24
    ) {
      return {
        tone: "success" as const,
        title: "Protected",
        description: "A fresh encrypted and signed backup is replicated offsite.",
      };
    }

    if (ageHours <= 24) {
      return {
        tone: "warning" as const,
        title: "Partially protected",
        description:
          "A fresh backup exists, but offsite protection is incomplete.",
      };
    }

    if (ageHours <= 24 * 7) {
      return {
        tone: "warning" as const,
        title: "Attention needed",
        description:
          "Your most recent completed backup is aging out of the ideal recovery window.",
      };
    }

    return {
      tone: "danger" as const,
      title: "Stale",
      description: "The most recent completed backup is older than seven days.",
    };
  }, [latestCompletedBackup]);

  const riskItems = useMemo(() => {
    const items: Array<{
      tone: "warning" | "danger" | "info";
      title: string;
      detail: string;
    }> = [];

    if (!storage?.ready) {
      items.push({
        tone: storage?.configured ? "warning" : "danger",
        title: "Offsite replication is not fully ready",
        detail: storage?.unsupportedProvider
          ? `Configured provider ${storage.provider} is not supported by the current uploader.`
          : storage?.configured
            ? "Storage target exists, but credentials or readiness requirements are incomplete."
            : "No offsite target is configured, so historical archive re-download is unavailable.",
      });
    }

    if (archivePolicy?.encryptionRequired && !archivePolicy.cryptoReady) {
      items.push({
        tone: "danger",
        title: "Backup encryption is not production-ready",
        detail:
          "Production backup creation is blocked until FIELD_ENCRYPTION_KEY is configured as a valid 64-character hex key.",
      });
    }

    if (archivePolicy?.offsiteRequired && !storage?.ready) {
      items.push({
        tone: "danger",
        title: "Production offsite retention is required",
        detail:
          "Production backup jobs must upload to offsite storage. Browser download fallback is disabled in production.",
      });
    }

    if (!latestCompletedBackup) {
      items.push({
        tone: "danger",
        title: "No completed backup found",
        detail: "Create a full backup before relying on restore workflows.",
      });
    }

    if (latestCompletedBackup?.offsite?.status === "failed") {
      items.push({
        tone: "danger",
        title: "Latest backup failed offsite replication",
        detail:
          latestCompletedBackup.offsite.reason ||
          "Review storage credentials and bucket access before the next backup window.",
      });
    }

    if (failedBackups > 0) {
      items.push({
        tone: "warning",
        title: `${failedBackups} backup job(s) failed`,
        detail:
          "Inspect the failed jobs in the activity table and resolve blocking issues.",
      });
    }

    if (items.length === 0) {
      items.push({
        tone: "info",
        title: "Recovery posture looks healthy",
        detail:
          "No immediate backup or offsite replication risks are detected in recent jobs.",
      });
    }

    return items;
  }, [archivePolicy, failedBackups, latestCompletedBackup, storage]);

  useEffect(() => {
    if (!backups.length) {
      setSelectedBackupId(null);
      return;
    }

    if (
      !selectedBackupId ||
      !backups.some((backup) => backup.id === selectedBackupId)
    ) {
      setSelectedBackupId(backups[0].id);
    }
  }, [backups, selectedBackupId]);

  async function requestPassword(
    title: string,
    description: string,
    actionLabel: string,
  ) {
    return new Promise<string | null>((resolve) => {
      passwordResolverRef.current = resolve;
      setPasswordValue("");
      setPasswordPrompt({ open: true, title, description, actionLabel });
    });
  }

  function resolvePasswordPrompt(value: string | null) {
    const resolver = passwordResolverRef.current;
    passwordResolverRef.current = null;
    setPasswordPrompt((current) => ({ ...current, open: false }));
    setPasswordValue("");
    resolver?.(value);
  }

  async function submitWithPassword(
    url: string,
    payload: Record<string, unknown>,
    options: {
      title: string;
      description: string;
      actionLabel?: string;
      errorMessage: string;
    },
  ) {
    let requestBody: Record<string, unknown> = payload;

    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        return data;
      }

      if (
        response.status === 403 &&
        data?.requiresPassword &&
        !requestBody.confirmPassword
      ) {
        const confirmedPassword = await requestPassword(
          options.title,
          options.description,
          options.actionLabel || "Confirm",
        );
        if (!confirmedPassword) {
          throw new Error(data?.error || "Password confirmation required.");
        }
        requestBody = { ...payload, confirmPassword: confirmedPassword };
        continue;
      }

      throw new Error(data?.error || options.errorMessage);
    }

    throw new Error(options.errorMessage);
  }

  const loadBackups = useCallback(async (showSuccessToast = false) => {
    if (hasLoadedBackupsRef.current) {
      setRefreshing(true);
    }

    try {
      const response = await fetch("/api/backup", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (data?.mfaSetupRequired) {
          toast.error("MFA setup is required before backups can be loaded.");
          router.push("/settings/two-factor?required=1");
          return;
        }
        throw new Error(data.error || "Failed to load backups");
      }
      setBackups(data.backups || []);
      setStats(data.stats || {});
      setTableMap(data.tables || {});
      setStorage(data.storage || null);
      setArchivePolicy(data.archivePolicy || null);
      if (showSuccessToast) {
        toast.success("Backup control plane refreshed");
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to load backups");
    } finally {
      hasLoadedBackupsRef.current = true;
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    void loadBackups();
  }, [loadBackups]);

  async function createBackup() {
    setCreating(true);
    try {
      const data = await submitWithPassword(
        "/api/backup",
        {
          type: selectedType,
          tables: selectedType === "FULL" ? [] : selectedTables,
          format: "JSON",
        },
        {
          title: "Create encrypted backup",
          description:
            "Confirm your admin password to export system data and issue an encrypted archive.",
          actionLabel: "Create backup",
          errorMessage: "Failed to create backup",
        },
      );

      if (data.downloadData) {
        downloadFile(data.downloadData, data.backup?.fileName || "backup.json");
      }

      setSelectedBackupId(data.backup?.id || null);
      await loadBackups();
      toast.success(
        data.offsite?.status === "stored"
          ? "Backup created and replicated offsite"
          : data.downloadData
            ? "Backup created for local download. Offsite replication is not available for this non-production job"
            : "Backup created, but archive download is not available for this job",
      );
    } catch (error: any) {
      toast.error(error?.message || "Failed to create backup");
    } finally {
      setCreating(false);
    }
  }

  async function handleHistoricalDownload(backup: BackupRecord) {
    setDownloadingBackupId(backup.id);
    try {
      const confirmedPassword = await requestPassword(
        "Download backup archive",
        "Confirm your admin password before downloading this retained backup archive.",
        "Download archive",
      );
      if (!confirmedPassword) return;

      const response = await fetch(`/api/backup/${backup.id}/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmPassword: confirmedPassword }),
      });
      const blob = await response.blob();
      if (!response.ok) {
        let message = "Failed to download backup archive";
        try {
          const parsed = JSON.parse(await blob.text());
          message = parsed.error || message;
        } catch {
          message = (await blob.text()) || message;
        }
        throw new Error(message);
      }

      downloadFile(
        blob,
        backup.fileName || `backup-${backup.id}.json`,
        blob.type || "application/json",
      );
      toast.success("Backup archive downloaded from offsite storage");
    } catch (error: any) {
      toast.error(error?.message || "Failed to download backup archive");
    } finally {
      setDownloadingBackupId(null);
    }
  }

  async function handleImportFile(file: File) {
    try {
      const parsed = JSON.parse(await file.text());
      const previewState = extractImportPreview(parsed);
      setImportFile(file);
      setImportPayload(previewState.payload);
      setImportPreview(previewState.preview);
      setImportTables(Object.keys(previewState.preview));
      setImportIsEncrypted(previewState.encrypted);
      setVerificationResult(null);
      setDryRunResult(null);
      setImportResult(null);
      toast.success("Backup archive loaded");
    } catch {
      setImportFile(null);
      setImportPayload(null);
      setImportPreview(null);
      setImportTables([]);
      setImportIsEncrypted(false);
      setVerificationResult(null);
      setDryRunResult(null);
      setImportResult(null);
      toast.error("Invalid backup file");
    }
  }

  function clearImportState() {
    setImportFile(null);
    setImportPayload(null);
    setImportPreview(null);
    setImportTables([]);
    setImportIsEncrypted(false);
    setVerificationResult(null);
    setDryRunResult(null);
    setImportResult(null);
  }

  async function runVerification() {
    if (!importPayload) return;
    setVerifying(true);
    try {
      const response = await fetch("/api/backup/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(importPayload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Verification failed");
      }
      setVerificationResult(data);
      toast.success(
        data.success
          ? "Archive verification passed"
          : "Archive verification returned warnings or failures",
      );
    } catch (error: any) {
      toast.error(error?.message || "Verification failed");
    } finally {
      setVerifying(false);
    }
  }

  async function runDryRun() {
    if (!importPayload || importTables.length === 0) return;
    setDryRunning(true);
    try {
      const response = await fetch("/api/backup/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...importPayload,
          tables: importTables,
          mode: "DRY_RUN",
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Dry run failed");
      }
      setDryRunResult(data);
      toast.success("Restore impact analysis completed");
    } catch (error: any) {
      toast.error(error?.message || "Dry run failed");
    } finally {
      setDryRunning(false);
    }
  }

  async function executeImport() {
    if (!importPayload || importTables.length === 0) return;
    setImporting(true);
    try {
      const result = await submitWithPassword(
        "/api/backup/import",
        { ...importPayload, tables: importTables, mode: importMode },
        {
          title:
            importMode === "REPLACE"
              ? "Run replace restore"
              : "Run merge restore",
          description:
            importMode === "REPLACE"
              ? "Confirm your admin password to replace selected tables with archive data. The route performs an all-or-nothing transaction."
              : "Confirm your admin password to merge the selected archive data into the live database.",
          actionLabel: importMode === "REPLACE" ? "Replace data" : "Run merge",
          errorMessage: "Import failed",
        },
      );
      setImportResult(result);
      await loadBackups();
      toast.success(
        `Restore completed: ${result.summary?.totalImported || 0} records imported`,
      );
    } catch (error: any) {
      toast.error(error?.message || "Import failed");
    } finally {
      setImporting(false);
    }
  }

  const selectedBackupTables = useMemo(() => {
    if (!selectedBackup) return [] as Array<[string, number]>;
    const tableCounts = selectedBackup.archive?.tableCounts || {};
    const tableNames =
      Object.keys(tableCounts).length > 0
        ? Object.keys(tableCounts)
        : parseTables(selectedBackup.tables);
    return tableNames.map(
      (table) => [table, tableCounts[table] ?? 0] as [string, number],
    );
  }, [selectedBackup]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Backup Control Plane
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Create encrypted archives, inspect replication health, verify
              restore safety, and manage historical backup jobs from one
              operational console.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => void loadBackups(true)}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
            >
              <RefreshCw
                className={cn("h-4 w-4", refreshing && "animate-spin")}
              />
              Refresh
            </button>
            <div
              className={cn(
                "rounded-lg border px-4 py-2 text-sm font-medium",
                buildToneClass(recoveryPosture.tone),
              )}
            >
              {recoveryPosture.title}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={ShieldCheck}
            label="Recovery posture"
            value={recoveryPosture.title}
            hint={recoveryPosture.description}
            tone={recoveryPosture.tone}
          />
          <MetricCard
            icon={Database}
            label="Completed jobs"
            value={completedBackups.length.toString()}
            hint={
              latestCompletedBackup
                ? `Last completed ${formatRelativeTime(latestCompletedBackup.createdAt)}`
                : "No successful backup yet"
            }
            tone="neutral"
          />
          <MetricCard
            icon={Cloud}
            label="Offsite protected"
            value={`${offsiteProtectedCount}`}
            hint={
              completedBackups.length > 0
                ? `${Math.round((offsiteProtectedCount / completedBackups.length) * 100) || 0}% of completed jobs are re-downloadable`
                : "Offsite copy unavailable until a backup completes"
            }
            tone={storage?.ready ? "success" : "warning"}
          />
          <MetricCard
            icon={HardDrive}
            label="Database footprint"
            value={totalDatabaseRecords.toLocaleString()}
            hint={`${Object.keys(stats).length} tracked tables in the live dataset`}
            tone="info"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]">
          <div className="space-y-6">
            <Panel
              icon={Download}
              title="Create encrypted backup"
              description="Issue a new archive immediately. Production jobs require encryption, signing, and offsite retention; browser fallback is non-production only."
              action={
                <button
                  onClick={createBackup}
                  disabled={
                    creating ||
                    (selectedType !== "FULL" && selectedTables.length === 0) ||
                    Boolean(
                      archivePolicy?.encryptionRequired &&
                        !archivePolicy.cryptoReady,
                    ) ||
                    Boolean(archivePolicy?.offsiteRequired && !storage?.ready)
                  }
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {creating ? "Creating..." : "Create backup"}
                </button>
              }
            >
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.9fr)]">
                <div className="space-y-3">
                  {archivePolicy ? (
                    <div
                      className={cn(
                        "rounded-2xl border p-4 text-sm",
                        archivePolicy.encryptionRequired &&
                          (!archivePolicy.cryptoReady || !storage?.ready)
                          ? buildToneClass("danger")
                          : buildToneClass("info"),
                      )}
                    >
                      <p className="font-semibold text-foreground">
                        Backup archive policy
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {archivePolicy.message}
                      </p>
                    </div>
                  ) : null}
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {BACKUP_TYPES.map((type) => (
                      <button
                        key={type.value}
                        onClick={() => setSelectedType(type.value)}
                        className={cn(
                          "rounded-xl border p-4 text-left transition",
                          selectedType === type.value
                            ? "border-primary bg-primary/10"
                            : "border-border bg-background hover:bg-accent/50",
                        )}
                      >
                        <p className="text-sm font-semibold text-foreground">
                          {type.label}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {type.desc}
                        </p>
                      </button>
                    ))}
                  </div>
                  {selectedType !== "FULL" ? (
                    <div className="rounded-xl border border-border bg-background p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">
                          Included tables
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {selectedTables.length} selected
                        </p>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {availableTables.map((table) => {
                          const active = selectedTables.includes(table);
                          return (
                            <button
                              key={table}
                              onClick={() =>
                                setSelectedTables((current) =>
                                  current.includes(table)
                                    ? current.filter((item) => item !== table)
                                    : [...current, table],
                                )
                              }
                              className={cn(
                                "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                                active
                                  ? "border-primary/30 bg-primary/10 text-primary"
                                  : "border-border bg-card text-muted-foreground hover:bg-accent",
                              )}
                            >
                              {tableMap[table]?.label || table} (
                              {stats[table] || 0})
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="rounded-xl border border-border bg-background p-4">
                  <p className="text-sm font-medium text-foreground">
                    Job summary
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                    <SummaryItem
                      label="Type"
                      value={getBackupTypeLabel(selectedType)}
                    />
                    <SummaryItem
                      label="Scope"
                      value={
                        selectedType === "FULL"
                          ? `${Object.keys(stats).length} live tables`
                          : `${selectedTables.length} selected tables`
                      }
                    />
                    <SummaryItem
                      label="Estimated records"
                      value={(selectedType === "FULL"
                        ? totalDatabaseRecords
                        : selectedTables.reduce(
                            (sum, table) => sum + (stats[table] || 0),
                            0,
                          )
                      ).toLocaleString()}
                    />
                    <SummaryItem
                      label="Archive format"
                      value="Encrypted JSON archive"
                    />
                    <SummaryItem
                      label="Historical retrieval"
                      value={
                        storage?.ready
                          ? "Available via offsite storage"
                          : "Only immediate browser download"
                      }
                    />
                  </div>
                </div>
              </div>
            </Panel>

            <Panel
              icon={Table2}
              title="Backup jobs"
              description="Browse recent backup activity, filter by status, and inspect or download protected jobs."
            >
              <div className="space-y-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search by name, creator, type, or job ID"
                      className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                      <Filter className="h-4 w-4" />
                      Filters
                    </div>
                    <select
                      value={statusFilter}
                      onChange={(event) =>
                        setStatusFilter(
                          event.target.value as (typeof STATUS_FILTERS)[number],
                        )
                      }
                      className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
                    >
                      {STATUS_FILTERS.map((option) => (
                        <option key={option} value={option}>
                          {option === "ALL" ? "All statuses" : option}
                        </option>
                      ))}
                    </select>
                    <select
                      value={typeFilter}
                      onChange={(event) => setTypeFilter(event.target.value)}
                      className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
                    >
                      <option value="ALL">All types</option>
                      {Array.from(
                        new Set(backups.map((backup) => backup.type)),
                      ).map((type) => (
                        <option key={type} value={type}>
                          {getBackupTypeLabel(type)}
                        </option>
                      ))}
                    </select>
                    <select
                      value={offsiteFilter}
                      onChange={(event) =>
                        setOffsiteFilter(
                          event.target
                            .value as (typeof OFFSITE_FILTERS)[number],
                        )
                      }
                      className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
                    >
                      <option value="ALL">All offsite states</option>
                      <option value="stored">Offsite stored</option>
                      <option value="failed">Offsite failed</option>
                      <option value="disabled">Offsite disabled</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-border">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border text-sm">
                      <thead className="bg-background/80 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 font-medium">Job</th>
                          <th className="px-4 py-3 font-medium">Created</th>
                          <th className="px-4 py-3 font-medium">Creator</th>
                          <th className="px-4 py-3 font-medium">Records</th>
                          <th className="px-4 py-3 font-medium">Archive</th>
                          <th className="px-4 py-3 font-medium">Offsite</th>
                          <th className="px-4 py-3 font-medium text-right">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border bg-card">
                        {filteredBackups.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-4 py-10 text-center">
                              <EmptyState
                                icon={Database}
                                title="No backup jobs match the current filters"
                                description="Adjust the search or filter criteria to inspect a different slice of backup activity."
                              />
                            </td>
                          </tr>
                        ) : (
                          filteredBackups.map((backup) => {
                            const statusClass =
                              statusToneClasses[backup.status] ||
                              "bg-tone-slate-bg text-muted-foreground border-tone-slate-br";
                            const offsiteStatus =
                              backup.offsite?.status || "disabled";
                            const offsiteClass =
                              offsiteToneClasses[offsiteStatus] ||
                              offsiteToneClasses.disabled;
                            return (
                              <tr
                                key={backup.id}
                                onClick={() => setSelectedBackupId(backup.id)}
                                className={cn(
                                  "cursor-pointer transition hover:bg-accent/30",
                                  selectedBackupId === backup.id &&
                                    "bg-primary/5",
                                )}
                              >
                                <td className="px-4 py-4 align-top">
                                  <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="font-medium text-foreground">
                                        {backup.fileName ||
                                          `backup-${backup.id}`}
                                      </p>
                                      <span
                                        className={cn(
                                          "rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                                          statusClass,
                                        )}
                                      >
                                        {backup.status}
                                      </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      {truncate(backup.id, 18)} Â·{" "}
                                      {getBackupTypeLabel(backup.type)}
                                    </p>
                                  </div>
                                </td>
                                <td className="px-4 py-4 align-top text-xs text-muted-foreground">
                                  <div>{formatDateTime(backup.createdAt)}</div>
                                  <div className="mt-1 flex items-center gap-1">
                                    <Clock3 className="h-3.5 w-3.5" />
                                    {formatRelativeTime(backup.createdAt)}
                                  </div>
                                </td>
                                <td className="px-4 py-4 align-top text-xs text-muted-foreground">
                                  {backup.createdByLabel || backup.createdBy}
                                </td>
                                <td className="px-4 py-4 align-top text-xs text-muted-foreground">
                                  <div>
                                    {(backup.recordCount || 0).toLocaleString()}{" "}
                                    rows
                                  </div>
                                  <div className="mt-1">
                                    {formatBytes(backup.fileSize)}
                                  </div>
                                </td>
                                <td className="px-4 py-4 align-top text-xs text-muted-foreground">
                                  <div className="flex flex-wrap gap-1.5">
                                    <InlineBadge
                                      tone={
                                        backup.archive?.encrypted
                                          ? "success"
                                          : "warning"
                                      }
                                    >
                                      {backup.archive?.encrypted
                                        ? "Encrypted"
                                        : "Plain"}
                                    </InlineBadge>
                                    <InlineBadge
                                      tone={
                                        backup.archive?.signature
                                          ? "success"
                                          : "warning"
                                      }
                                    >
                                      {backup.archive?.signature
                                        ? "Signed"
                                        : "Unsigned"}
                                    </InlineBadge>
                                  </div>
                                  <div className="mt-2">
                                    {selectedBackupId === backup.id
                                      ? selectedBackupTables.length
                                      : Object.keys(
                                          backup.archive?.tableCounts || {},
                                        ).length ||
                                        parseTables(backup.tables).length}{" "}
                                    tables
                                  </div>
                                </td>
                                <td className="px-4 py-4 align-top text-xs text-muted-foreground">
                                  <div className="flex flex-wrap gap-1.5">
                                    <span
                                      className={cn(
                                        "rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                                        offsiteClass,
                                      )}
                                    >
                                      {offsiteStatus === "stored"
                                        ? "Stored"
                                        : offsiteStatus === "failed"
                                          ? "Failed"
                                          : "Disabled"}
                                    </span>
                                  </div>
                                  <div className="mt-2">
                                    {backup.offsite?.location
                                      ? truncate(backup.offsite.location, 36)
                                      : backup.offsite?.reason ||
                                        "No retained offsite copy"}
                                  </div>
                                </td>
                                <td className="px-4 py-4 align-top text-right">
                                  <div className="flex justify-end gap-2">
                                    <button
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setSelectedBackupId(backup.id);
                                      }}
                                      className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                      Inspect
                                    </button>
                                    <button
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        void handleHistoricalDownload(backup);
                                      }}
                                      disabled={
                                        backup.offsite?.status !== "stored" ||
                                        downloadingBackupId === backup.id
                                      }
                                      className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {downloadingBackupId === backup.id ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Download className="h-3.5 w-3.5" />
                                      )}
                                      Download
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </Panel>

            <Panel
              icon={Upload}
              title="Restore center"
              description="Load an archive, verify integrity, simulate restore impact, then run a merge or transactional replace."
            >
              <div className="space-y-5">
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-background px-6 py-10 text-center transition hover:bg-accent/30">
                  <FileUp className="h-8 w-8 text-muted-foreground" />
                  <p className="mt-3 text-sm font-medium text-foreground">
                    {importFile ? importFile.name : "Select a backup archive"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    JSON archives exported by this system can be verified,
                    previewed, and restored here.
                  </p>
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        void handleImportFile(file);
                      }
                    }}
                  />
                </label>

                {importPreview ? (
                  <div className="space-y-5 rounded-2xl border border-border bg-background p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">
                            Archive preview
                          </p>
                          <InlineBadge
                            tone={importIsEncrypted ? "success" : "warning"}
                          >
                            {importIsEncrypted
                              ? "Encrypted archive"
                              : "Plain archive"}
                          </InlineBadge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {Object.keys(importPreview).length} tables Â·{" "}
                          {Object.values(importPreview)
                            .reduce((sum, value) => sum + value, 0)
                            .toLocaleString()}{" "}
                          records staged for verification.
                        </p>
                      </div>
                      <button
                        onClick={clearImportState}
                        className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent"
                      >
                        <X className="h-3.5 w-3.5" />
                        Clear archive
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {Object.entries(importPreview).map(([table, count]) => {
                        const selected = importTables.includes(table);
                        return (
                          <button
                            key={table}
                            onClick={() =>
                              setImportTables((current) =>
                                current.includes(table)
                                  ? current.filter((item) => item !== table)
                                  : [...current, table],
                              )
                            }
                            className={cn(
                              "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                              selected
                                ? "border-primary/30 bg-primary/10 text-primary"
                                : "border-border bg-card text-muted-foreground hover:bg-accent",
                            )}
                          >
                            {tableMap[table]?.label || table} ({count})
                          </button>
                        );
                      })}
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)]">
                      <div className="rounded-xl border border-border bg-card p-4">
                        <p className="text-sm font-medium text-foreground">
                          Restore mode
                        </p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <button
                            onClick={() => setImportMode("MERGE")}
                            className={cn(
                              "rounded-xl border p-3 text-left transition",
                              importMode === "MERGE"
                                ? "border-primary bg-primary/10"
                                : "border-border bg-background hover:bg-accent",
                            )}
                          >
                            <p className="text-sm font-semibold text-foreground">
                              Merge
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Only inserts non-existing records and preserves
                              live data.
                            </p>
                          </button>
                          <button
                            onClick={() => setImportMode("REPLACE")}
                            className={cn(
                              "rounded-xl border p-3 text-left transition",
                              importMode === "REPLACE"
                                ? "border-destructive/30 bg-destructive/10"
                                : "border-border bg-background hover:bg-accent",
                            )}
                          >
                            <p className="text-sm font-semibold text-foreground">
                              Replace
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Deletes selected tables first, then restores
                              archive rows transactionally.
                            </p>
                          </button>
                        </div>
                        {importMode === "REPLACE" ? (
                          <div className="mt-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
                            Replace mode is destructive. The API rolls back on
                            failure, but you should still verify and dry-run
                            first.
                          </div>
                        ) : null}
                      </div>

                      <div className="rounded-xl border border-border bg-card p-4">
                        <p className="text-sm font-medium text-foreground">
                          Restore workflow
                        </p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                          <button
                            onClick={() => void runVerification()}
                            disabled={verifying}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
                          >
                            {verifying ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <ShieldCheck className="h-4 w-4" />
                            )}
                            Verify
                          </button>
                          <button
                            onClick={() => void runDryRun()}
                            disabled={dryRunning || importTables.length === 0}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
                          >
                            {dryRunning ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Table2 className="h-4 w-4" />
                            )}
                            Dry run
                          </button>
                          <button
                            onClick={() => void executeImport()}
                            disabled={importing || importTables.length === 0}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                          >
                            {importing ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4" />
                            )}
                            Execute
                          </button>
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">
                          {verificationResult
                            ? verificationResult.message
                            : "Run verification first to confirm integrity, then preview restore impact before execution."}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                      <ResultCard
                        icon={ShieldCheck}
                        title="Verification"
                        emptyTitle="Verification not run yet"
                        emptyDescription="Archive integrity, schema shape, table coverage, and IDs are validated through the verify API."
                      >
                        {verificationResult ? (
                          <div className="space-y-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <InlineBadge
                                tone={
                                  verificationResult.verdict === "PASS"
                                    ? "success"
                                    : verificationResult.verdict === "WARN"
                                      ? "warning"
                                      : "danger"
                                }
                              >
                                {verificationResult.verdict}
                              </InlineBadge>
                              <span className="text-xs text-muted-foreground">
                                {verificationResult.totalRecords.toLocaleString()}{" "}
                                records analyzed
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {verificationResult.message}
                            </p>
                            <div className="space-y-2">
                              {verificationResult.checks.map((check) => (
                                <div
                                  key={`${check.name}-${check.detail}`}
                                  className="rounded-xl border border-border bg-background p-3"
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm font-medium text-foreground">
                                      {check.name}
                                    </p>
                                    <span
                                      className={cn(
                                        "rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                                        checkToneClasses[check.status],
                                      )}
                                    >
                                      {check.status}
                                    </span>
                                  </div>
                                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                                    {check.detail}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </ResultCard>

                      <ResultCard
                        icon={Eye}
                        title="Restore impact analysis"
                        emptyTitle="Dry run not executed"
                        emptyDescription="Preview how many rows will import, skip, or be replaced before touching live data."
                      >
                        {dryRunResult?.summary ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-3">
                              <MiniStat
                                title="Import"
                                value={dryRunResult.summary.totalImported}
                                tone="success"
                              />
                              <MiniStat
                                title="Skip"
                                value={dryRunResult.summary.totalSkipped}
                                tone="warning"
                              />
                              <MiniStat
                                title="Errors"
                                value={dryRunResult.summary.totalErrors}
                                tone="danger"
                              />
                            </div>
                            {dryRunResult.results ? (
                              <div className="space-y-2">
                                {Object.entries(dryRunResult.results).map(
                                  ([table, result]) => (
                                    <div
                                      key={table}
                                      className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2 text-xs text-muted-foreground"
                                    >
                                      <span>
                                        {tableMap[table]?.label || table}
                                      </span>
                                      <span>
                                        {result.imported} import Â·{" "}
                                        {result.skipped} skip
                                        {typeof result.deleted === "number"
                                          ? ` Â· ${result.deleted} delete`
                                          : ""}
                                      </span>
                                    </div>
                                  ),
                                )}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </ResultCard>
                    </div>

                    {importResult?.summary ? (
                      <div className="rounded-2xl border border-tone-sage-br bg-tone-sage-bg p-4">
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="mt-0.5 h-5 w-5 text-tone-sage-fg" />
                          <div className="space-y-3">
                            <p className="text-sm font-semibold text-foreground">
                              Restore completed
                            </p>
                            <div className="grid grid-cols-3 gap-3">
                              <MiniStat
                                title="Imported"
                                value={importResult.summary.totalImported}
                                tone="success"
                              />
                              <MiniStat
                                title="Skipped"
                                value={importResult.summary.totalSkipped}
                                tone="warning"
                              />
                              <MiniStat
                                title="Errors"
                                value={importResult.summary.totalErrors}
                                tone="danger"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </Panel>
          </div>

          <div className="space-y-6">
            <Panel
              icon={Cloud}
              title="Offsite storage health"
              description="Historical archive retrieval depends on successful replication to the configured storage target."
            >
              <div className="space-y-4">
                <div
                  className={cn(
                    "rounded-2xl border p-4",
                    buildToneClass(
                      storage?.ready
                        ? "success"
                        : storage?.configured
                          ? "warning"
                          : "danger",
                    ),
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {storage?.ready
                          ? "Ready for historical retention"
                          : storage?.configured
                            ? "Configuration incomplete"
                            : "Not configured"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {storage?.ready
                          ? "Completed jobs can be re-downloaded from offsite storage."
                          : storage?.unsupportedProvider
                            ? `Configured provider ${storage?.provider} is unsupported.`
                            : storage?.configured
                              ? "Bucket/region are set, but credentials or readiness requirements are missing."
                              : "Only the immediate browser download exists until offsite storage is configured."}
                      </p>
                    </div>
                    <InlineBadge
                      tone={
                        storage?.ready
                          ? "success"
                          : storage?.configured
                            ? "warning"
                            : "danger"
                      }
                    >
                      {storage?.ready
                        ? "Ready"
                        : storage?.configured
                          ? "Attention"
                          : "Offline"}
                    </InlineBadge>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <SummaryItem
                    label="Provider"
                    value={storage?.provider || "â€”"}
                  />
                  <SummaryItem label="Bucket" value={storage?.bucket || "â€”"} />
                  <SummaryItem label="Region" value={storage?.region || "â€”"} />
                  <SummaryItem
                    label="Credentials"
                    value={
                      storage?.credentialsConfigured ? "Configured" : "Missing"
                    }
                  />
                </div>
                {storage?.endpoint ? (
                  <div className="rounded-xl border border-border bg-background p-3 text-xs text-muted-foreground">
                    Endpoint: {storage.endpoint}
                  </div>
                ) : null}
              </div>
            </Panel>

            <Panel
              icon={FileJson}
              title="Selected backup detail"
              description="Inspect archive diagnostics, included tables, creator context, and offsite retention state."
            >
              {selectedBackup ? (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-border bg-background p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {selectedBackup.fileName ||
                            `backup-${selectedBackup.id}`}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {selectedBackup.createdByLabel ||
                            selectedBackup.createdBy}{" "}
                          Â· {getBackupTypeLabel(selectedBackup.type)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span
                          className={cn(
                            "rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                            statusToneClasses[selectedBackup.status] ||
                              "bg-tone-slate-bg text-muted-foreground border-tone-slate-br",
                          )}
                        >
                          {selectedBackup.status}
                        </span>
                        <span
                          className={cn(
                            "rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                            offsiteToneClasses[
                              selectedBackup.offsite?.status || "disabled"
                            ] || offsiteToneClasses.disabled,
                          )}
                        >
                          {selectedBackup.offsite?.status === "stored"
                            ? "Offsite stored"
                            : selectedBackup.offsite?.status === "failed"
                              ? "Offsite failed"
                              : "Offsite disabled"}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <SummaryItem
                        label="Created"
                        value={formatDateTime(selectedBackup.createdAt)}
                      />
                      <SummaryItem
                        label="Completed"
                        value={
                          selectedBackup.completedAt
                            ? formatDateTime(selectedBackup.completedAt)
                            : "â€”"
                        }
                      />
                      <SummaryItem
                        label="Archive size"
                        value={formatBytes(selectedBackup.fileSize)}
                      />
                      <SummaryItem
                        label="Rows"
                        value={(
                          selectedBackup.recordCount || 0
                        ).toLocaleString()}
                      />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <InlineBadge
                        tone={
                          selectedBackup.archive?.encrypted
                            ? "success"
                            : "warning"
                        }
                      >
                        {selectedBackup.archive?.encrypted
                          ? "Encrypted"
                          : "Plain archive"}
                      </InlineBadge>
                      <InlineBadge
                        tone={
                          selectedBackup.archive?.signature
                            ? "success"
                            : "warning"
                        }
                      >
                        {selectedBackup.archive?.signature
                          ? "HMAC signed"
                          : "No signature"}
                      </InlineBadge>
                      <InlineBadge
                        tone={
                          selectedBackup.offsite?.status === "stored"
                            ? "success"
                            : selectedBackup.offsite?.status === "failed"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {selectedBackup.offsite?.status === "stored"
                          ? "Re-downloadable"
                          : selectedBackup.offsite?.status === "failed"
                            ? "Retention failed"
                            : archivePolicy?.browserDownloadFallbackAllowed
                              ? "Browser fallback copy"
                              : "No retained archive"}
                      </InlineBadge>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={() =>
                          void handleHistoricalDownload(selectedBackup)
                        }
                        disabled={
                          selectedBackup.offsite?.status !== "stored" ||
                          downloadingBackupId === selectedBackup.id
                        }
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {downloadingBackupId === selectedBackup.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                        Download archive
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-background p-4">
                    <p className="text-sm font-medium text-foreground">
                      Offsite retention
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <SummaryItem
                        label="Location"
                        value={
                          selectedBackup.offsite?.location ||
                          "Not retained offsite"
                        }
                      />
                      <SummaryItem
                        label="Uploaded"
                        value={
                          selectedBackup.offsite?.uploadedAt
                            ? formatDateTime(selectedBackup.offsite.uploadedAt)
                            : "â€”"
                        }
                      />
                      <SummaryItem
                        label="Bucket"
                        value={selectedBackup.offsite?.bucket || "â€”"}
                      />
                      <SummaryItem
                        label="Region"
                        value={selectedBackup.offsite?.region || "â€”"}
                      />
                    </div>
                    <div className="mt-3 rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
                      {selectedBackup.offsite?.status === "stored"
                        ? "This archive can be retrieved later from offsite storage through the jobs table or this detail panel."
                        : selectedBackup.offsite?.reason ||
                          (archivePolicy?.browserDownloadFallbackAllowed
                            ? "No local archive retention is configured on the server. If offsite storage is unavailable, only the original browser download exists."
                            : "No offsite archive is retained. Production browser download fallback is disabled, so this job cannot be used for restore.")}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-background p-4">
                    <p className="text-sm font-medium text-foreground">
                      Included tables
                    </p>
                    <div className="mt-3 space-y-2 max-h-72 overflow-y-auto pr-1">
                      {selectedBackupTables.length > 0 ? (
                        selectedBackupTables.map(([table, count]) => (
                          <div
                            key={table}
                            className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground"
                          >
                            <span>{tableMap[table]?.label || table}</span>
                            <span>{count.toLocaleString()} rows</span>
                          </div>
                        ))
                      ) : (
                        <EmptyState
                          icon={Table2}
                          title="No table breakdown available"
                          description="This backup record does not include table-level archive diagnostics."
                          compact
                        />
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={Eye}
                  title="Choose a backup job"
                  description="Select a job from the table to inspect archive diagnostics, offsite status, and table coverage."
                />
              )}
            </Panel>

            <Panel
              icon={ShieldAlert}
              title="Operational risks"
              description="These signals summarize the current recovery posture based on recent jobs and storage readiness."
            >
              <div className="space-y-3">
                {riskItems.map((item) => (
                  <div
                    key={`${item.title}-${item.detail}`}
                    className={cn(
                      "rounded-2xl border p-4",
                      buildToneClass(item.tone),
                    )}
                  >
                    <p className="text-sm font-semibold text-foreground">
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {item.detail}
                    </p>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      </div>

      {passwordPrompt.open ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-foreground">
                  {passwordPrompt.title}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {passwordPrompt.description}
                </p>
              </div>
              <button
                onClick={() => resolvePasswordPrompt(null)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form
              className="mt-5 space-y-4"
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                resolvePasswordPrompt(
                  passwordValue.trim() ? passwordValue : null,
                );
              }}
            >
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Admin password
                </label>
                <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <input
                    type="password"
                    autoFocus
                    value={passwordValue}
                    onChange={(event) => setPasswordValue(event.target.value)}
                    className="w-full bg-transparent text-sm text-foreground outline-none"
                    placeholder="Enter your password"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => resolvePasswordPrompt(null)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  {passwordPrompt.actionLabel}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Panel(props: {
  icon: ElementType;
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const Icon = props.icon;
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {props.title}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {props.description}
              </p>
            </div>
          </div>
        </div>
        {props.action ? (
          <div className="flex-shrink-0">{props.action}</div>
        ) : null}
      </div>
      <div className="mt-5">{props.children}</div>
    </section>
  );
}

function MetricCard(props: {
  icon: ElementType;
  label: string;
  value: string;
  hint: string;
  tone: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const Icon = props.icon;
  return (
    <div
      className={cn(
        "rounded-2xl border p-5 shadow-sm",
        buildToneClass(props.tone),
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {props.label}
          </p>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {props.value}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {props.hint}
          </p>
        </div>
        <div className="rounded-xl bg-card/60 p-2.5">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function SummaryItem(props: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {props.label}
      </p>
      <div className="mt-2 text-sm font-medium text-foreground break-words">
        {props.value}
      </div>
    </div>
  );
}

function InlineBadge(props: {
  tone: "success" | "warning" | "danger" | "info";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
        buildToneClass(props.tone),
      )}
    >
      {props.children}
    </span>
  );
}

function ResultCard(props: {
  icon: ElementType;
  title: string;
  emptyTitle: string;
  emptyDescription: string;
  children: ReactNode;
}) {
  const Icon = props.icon;
  const hasChildren = Boolean(props.children);
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <p className="text-sm font-medium text-foreground">{props.title}</p>
      </div>
      <div className="mt-4">
        {hasChildren ? (
          props.children
        ) : (
          <EmptyState
            icon={Icon}
            title={props.emptyTitle}
            description={props.emptyDescription}
            compact
          />
        )}
      </div>
    </div>
  );
}

function MiniStat(props: {
  title: string;
  value: number;
  tone: "success" | "warning" | "danger";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3 text-center",
        buildToneClass(props.tone),
      )}
    >
      <p className="text-lg font-bold text-foreground">
        {props.value.toLocaleString()}
      </p>
      <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
        {props.title}
      </p>
    </div>
  );
}

function EmptyState(props: {
  icon: ElementType;
  title: string;
  description: string;
  compact?: boolean;
}) {
  const Icon = props.icon;
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        props.compact ? "py-4" : "py-8",
      )}
    >
      <div className="rounded-full bg-muted/30 p-3 text-muted-foreground">
        <Icon className={cn(props.compact ? "h-5 w-5" : "h-6 w-6")} />
      </div>
      <p className="mt-3 text-sm font-medium text-foreground">{props.title}</p>
      <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
        {props.description}
      </p>
    </div>
  );
}
