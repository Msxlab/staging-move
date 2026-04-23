"use client";

export { BackupControlPlane as default } from "@/components/backup-control-plane";

import { useState, useEffect } from "react";
import {
  Database,
  Download,
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  HardDrive,
  FileJson,
  Table2,
  RefreshCw,
  AlertTriangle,
  FileUp,
} from "lucide-react";
import { toast } from "sonner";

interface BackupRecord {
  id: string;
  type: string;
  status: string;
  format: string;
  fileName?: string;
  fileSize?: number;
  recordCount?: number;
  tables?: string;
  errorMessage?: string;
  createdBy: string;
  completedAt?: string;
  createdAt: string;
  offsite?: {
    status: "stored" | "disabled" | "failed";
    location?: string | null;
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

const BACKUP_TYPES = [
  { value: "FULL", label: "Full Backup", desc: "All tables" },
  {
    value: "USERS",
    label: "Users Only",
    desc: "Users, profiles, subscriptions",
  },
  { value: "PROVIDERS", label: "Providers Only", desc: "Service providers" },
  { value: "SERVICES", label: "Services Only", desc: "User services" },
  { value: "MOVING_PLANS", label: "Moving Plans", desc: "Moving plan records" },
];

const STATUS_ICONS: Record<string, React.ElementType> = {
  COMPLETED: CheckCircle2,
  IN_PROGRESS: Loader2,
  FAILED: XCircle,
  PENDING: Clock,
};

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: "text-green-500 bg-green-500/10",
  IN_PROGRESS: "text-blue-500 bg-blue-500/10",
  FAILED: "text-red-500 bg-red-500/10",
  PENDING: "text-yellow-500 bg-yellow-500/10",
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function extractImportPreview(parsed: any) {
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
      for (const [key, value] of Object.entries(archive.payload.data)) {
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
  for (const [key, value] of Object.entries(data || {})) {
    if (Array.isArray(value)) preview[key] = value.length;
  }

  return {
    payload: { data },
    preview,
    encrypted: false,
  };
}

function LegacyBackupsPage() {
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [storage, setStorage] = useState<BackupStorageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedType, setSelectedType] = useState("FULL");
  const [selectedTables, setSelectedTables] = useState<string[]>([]);

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPayload, setImportPayload] = useState<any>(null);
  const [importPreview, setImportPreview] = useState<Record<
    string,
    number
  > | null>(null);
  const [importTables, setImportTables] = useState<string[]>([]);
  const [importMode, setImportMode] = useState<"MERGE" | "REPLACE">("MERGE");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [importIsEncrypted, setImportIsEncrypted] = useState(false);

  const allTables = [
    "users",
    "profiles",
    "providers",
    "movingPlans",
    "budgets",
    "subscriptions",
    "auditLogs",
    "notifications",
    "addresses",
    "services",
  ];

  async function submitWithPassword(
    url: string,
    payload: Record<string, unknown>,
    fallbackError: string,
  ) {
    let requestBody = payload;

    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        return data;
      }

      if (
        res.status === 403 &&
        data?.requiresPassword &&
        !requestBody.confirmPassword
      ) {
        const confirmPassword = window.prompt(
          "Confirm your admin password to continue this backup operation.",
        );
        if (!confirmPassword) {
          throw new Error(data?.error || "Password confirmation required.");
        }
        requestBody = { ...payload, confirmPassword };
        continue;
      }

      throw new Error(data?.error || fallbackError);
    }

    throw new Error(fallbackError);
  }

  async function downloadBackup(
    downloadUrl: string | null | undefined,
    downloadData: string | undefined,
    fileName: string,
  ) {
    if (downloadUrl) {
      const res = await fetch(downloadUrl);
      const blob = await res.blob();
      if (!res.ok) {
        let message = "Failed to download backup archive";
        try {
          const parsed = JSON.parse(await blob.text());
          message = parsed.error || message;
        } catch {
          message = (await blob.text()) || message;
        }
        throw new Error(message);
      }
      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(blobUrl);
      return;
    }

    if (!downloadData) {
      throw new Error("Backup archive is not available for download.");
    }

    const blob = new Blob([downloadData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  async function loadBackups() {
    try {
      const res = await fetch("/api/backup");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setBackups(data.backups || []);
      setStats(data.stats || {});
      setStorage(data.storage || null);
    } catch {
      toast.error("Failed to load backups");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBackups();
  }, []);

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
        "Failed to create backup",
      );

      await downloadBackup(
        data.downloadUrl,
        data.downloadData,
        data.backup?.fileName || "backup.json",
      );

      toast.success(
        data.offsite?.status === "stored"
          ? `Backup created and replicated offsite. ${data.backup?.recordCount || 0} records exported.`
          : `Backup created. ${data.backup?.recordCount || 0} records exported.`,
      );
      await loadBackups();
    } catch (error: any) {
      toast.error(error?.message || "Failed to create backup");
    } finally {
      setCreating(false);
    }
  }

  const totalRecords = Object.values(stats).reduce((sum, n) => sum + n, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">System Backups</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Export and manage system data backups
          </p>
        </div>
        <button
          onClick={loadBackups}
          className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-accent transition"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {storage && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                Offsite Backup Storage
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {storage.ready
                  ? `${storage.provider || "storage"} · ${storage.bucket || "bucket"} · ${storage.region || "region"}`
                  : storage.unsupportedProvider
                    ? `Configured provider ${storage.provider} is not supported by the current uploader.`
                    : storage.configured
                      ? "Storage target is set, but access credentials are still required for uploads."
                      : "Configure backup storage to replicate encrypted archives offsite."}
              </p>
              {storage.endpoint && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Endpoint: {storage.endpoint}
                </p>
              )}
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${storage.ready ? "bg-green-500/10 text-green-500" : storage.unsupportedProvider ? "bg-red-500/10 text-red-500" : storage.configured ? "bg-amber-500/10 text-amber-500" : "bg-slate-500/10 text-slate-500"}`}
            >
              {storage.ready
                ? "Ready"
                : storage.unsupportedProvider
                  ? "Unsupported"
                  : storage.configured
                    ? "Needs credentials"
                    : "Not configured"}
            </span>
          </div>
        </div>
      )}

      {/* Database Stats */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <HardDrive className="h-5 w-5" /> Database Overview
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {Object.entries(stats).map(([table, count]) => (
            <div key={table} className="rounded-lg bg-muted/30 p-3 text-center">
              <p className="text-lg font-bold text-foreground">
                {count.toLocaleString()}
              </p>
              <p className="text-[10px] text-muted-foreground capitalize">
                {table.replace(/([A-Z])/g, " $1").trim()}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Database className="h-3.5 w-3.5" />
            Total: {totalRecords.toLocaleString()} records across{" "}
            {Object.keys(stats).length} tables
          </div>
          {backups.length > 0 &&
            (() => {
              const lastBackup = backups[0];
              const daysSince = Math.floor(
                (Date.now() - new Date(lastBackup.createdAt).getTime()) /
                  (1000 * 60 * 60 * 24),
              );
              const lastCount = lastBackup.recordCount || 0;
              const diff = totalRecords - lastCount;
              return (
                <div className="flex items-center gap-3 text-xs">
                  {diff !== 0 && (
                    <span
                      className={diff > 0 ? "text-emerald-400" : "text-red-400"}
                    >
                      {diff > 0 ? "+" : ""}
                      {diff} records since last backup
                    </span>
                  )}
                  <span
                    className={`flex items-center gap-1 ${daysSince > 7 ? "text-amber-400" : "text-muted-foreground"}`}
                  >
                    {daysSince > 7 && <AlertTriangle className="h-3 w-3" />}
                    Last backup:{" "}
                    {daysSince === 0 ? "Today" : `${daysSince}d ago`}
                  </span>
                </div>
              );
            })()}
        </div>
      </div>

      {/* Create Backup */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Download className="h-5 w-5" /> Create New Backup
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">
              Backup Type
            </label>
            <div className="flex flex-wrap gap-2">
              {BACKUP_TYPES.map((bt) => (
                <button
                  key={bt.value}
                  onClick={() => setSelectedType(bt.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    selectedType === bt.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {bt.label}
                  <span className="block text-[10px] opacity-70">
                    {bt.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {selectedType !== "FULL" && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2">
                Select Tables
              </label>
              <div className="flex flex-wrap gap-2">
                {allTables.map((t) => (
                  <button
                    key={t}
                    onClick={() =>
                      setSelectedTables((prev) =>
                        prev.includes(t)
                          ? prev.filter((x) => x !== t)
                          : [...prev, t],
                      )
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      selectedTables.includes(t)
                        ? "bg-primary/20 text-primary border border-primary/30"
                        : "bg-muted/30 text-muted-foreground border border-transparent hover:bg-muted/50"
                    }`}
                  >
                    {t} ({stats[t] || 0})
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5" />
              {selectedType === "FULL"
                ? `Full backup will export ${totalRecords.toLocaleString()} records`
                : `Selected: ${selectedTables.length} tables`}
            </div>
            <button
              onClick={createBackup}
              disabled={
                creating ||
                (selectedType !== "FULL" && selectedTables.length === 0)
              }
              className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition"
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Creating...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" /> Create & Download
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Import Data */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Upload className="h-5 w-5" /> Import Data
        </h2>

        <div className="space-y-4">
          {/* File Upload */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">
              Upload Backup File (JSON)
            </label>
            <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-border rounded-xl cursor-pointer hover:bg-muted/20 transition">
              <FileUp className="h-6 w-6 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">
                {importFile
                  ? importFile.name
                  : "Click to select backup JSON file"}
              </span>
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setImportFile(file);
                  setImportResult(null);
                  setImportPayload(null);
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    try {
                      const parsed = JSON.parse(ev.target?.result as string);
                      const previewState = extractImportPreview(parsed);
                      const preview = previewState.preview;
                      setImportPayload(previewState.payload);
                      setImportPreview(preview);
                      setImportTables(Object.keys(preview));
                      setImportIsEncrypted(previewState.encrypted);
                    } catch {
                      toast.error("Invalid JSON file");
                      setImportPayload(null);
                      setImportPreview(null);
                      setImportTables([]);
                      setImportIsEncrypted(false);
                    }
                  };
                  reader.readAsText(file);
                }}
              />
            </label>
          </div>

          {/* Preview */}
          {importPreview && (
            <>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-2">
                  File Contents ({Object.keys(importPreview).length} tables,{" "}
                  {Object.values(importPreview)
                    .reduce((a, b) => a + b, 0)
                    .toLocaleString()}{" "}
                  records)
                </label>
                {importIsEncrypted && (
                  <p className="mb-2 text-[11px] text-muted-foreground">
                    Encrypted archive preview uses embedded metadata counts
                    until the file is decrypted on the server.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {Object.entries(importPreview).map(([table, count]) => (
                    <button
                      key={table}
                      onClick={() =>
                        setImportTables((prev) =>
                          prev.includes(table)
                            ? prev.filter((t) => t !== table)
                            : [...prev, table],
                        )
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                        importTables.includes(table)
                          ? "bg-primary/20 text-primary border border-primary/30"
                          : "bg-muted/30 text-muted-foreground border border-transparent hover:bg-muted/50"
                      }`}
                    >
                      {table} ({count})
                    </button>
                  ))}
                </div>
              </div>

              {/* Mode */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-2">
                  Import Mode
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setImportMode("MERGE")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      importMode === "MERGE"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Merge
                    <span className="block text-[10px] opacity-70">
                      Skip existing records
                    </span>
                  </button>
                  <button
                    onClick={() => setImportMode("REPLACE")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      importMode === "REPLACE"
                        ? "bg-destructive text-destructive-foreground"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Replace
                    <span className="block text-[10px] opacity-70">
                      Delete & re-insert
                    </span>
                  </button>
                </div>
              </div>

              {/* Import Button */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => {
                    setImportFile(null);
                    setImportPayload(null);
                    setImportPreview(null);
                    setImportResult(null);
                    setImportTables([]);
                    setImportIsEncrypted(false);
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground transition"
                >
                  Clear
                </button>
                <button
                  onClick={async () => {
                    if (!importPayload || importTables.length === 0) return;
                    setImporting(true);
                    try {
                      const result = await submitWithPassword(
                        "/api/backup/import",
                        {
                          ...importPayload,
                          tables: importTables,
                          mode: importMode,
                        },
                        "Import failed",
                      );
                      setImportResult(result);
                      toast.success(
                        `Imported ${result.summary?.totalImported || 0} records`,
                      );
                      await loadBackups();
                    } catch (error: any) {
                      toast.error(error?.message || "Import failed");
                    } finally {
                      setImporting(false);
                    }
                  }}
                  disabled={importing || importTables.length === 0}
                  className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition"
                >
                  {importing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" /> Import{" "}
                      {importTables.length} Tables
                    </>
                  )}
                </button>
              </div>

              {/* Import Result */}
              {importResult && (
                <div className="rounded-lg bg-muted/30 p-4 space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    Import Complete
                  </p>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-lg bg-emerald-500/10 p-2">
                      <p className="text-lg font-bold text-emerald-400">
                        {importResult.summary?.totalImported || 0}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Imported
                      </p>
                    </div>
                    <div className="rounded-lg bg-yellow-500/10 p-2">
                      <p className="text-lg font-bold text-yellow-400">
                        {importResult.summary?.totalSkipped || 0}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Skipped
                      </p>
                    </div>
                    <div className="rounded-lg bg-red-500/10 p-2">
                      <p className="text-lg font-bold text-red-400">
                        {importResult.summary?.totalErrors || 0}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Errors
                      </p>
                    </div>
                  </div>
                  {importResult.results && (
                    <div className="text-xs text-muted-foreground space-y-1 mt-2">
                      {Object.entries(importResult.results).map(
                        ([table, r]: [string, any]) => (
                          <div key={table} className="flex justify-between">
                            <span>{table}</span>
                            <span>
                              {r.imported} imported, {r.skipped} skipped
                              {r.errors > 0 ? `, ${r.errors} errors` : ""}
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Backup History */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Table2 className="h-5 w-5" /> Backup History ({backups.length})
        </h2>

        {backups.length === 0 ? (
          <div className="text-center py-8">
            <Database className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              No backups yet. Create your first backup above.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {backups.map((backup) => {
              const StatusIcon = STATUS_ICONS[backup.status] || Clock;
              const statusColor =
                STATUS_COLORS[backup.status] || "text-gray-500 bg-gray-500/10";
              const tables = backup.tables ? JSON.parse(backup.tables) : [];
              const offsiteColor =
                backup.offsite?.status === "stored"
                  ? "text-green-500 bg-green-500/10"
                  : backup.offsite?.status === "failed"
                    ? "text-red-500 bg-red-500/10"
                    : "text-slate-500 bg-slate-500/10";
              const offsiteLabel =
                backup.offsite?.status === "stored"
                  ? "Offsite stored"
                  : backup.offsite?.status === "failed"
                    ? "Offsite failed"
                    : "Offsite disabled";
              return (
                <div
                  key={backup.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${statusColor}`}>
                      <StatusIcon
                        className={`h-4 w-4 ${backup.status === "IN_PROGRESS" ? "animate-spin" : ""}`}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">
                          {backup.fileName || `backup-${backup.id}`}
                        </p>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary">
                          {backup.type}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>
                          {new Date(backup.createdAt).toLocaleString()}
                        </span>
                        {backup.recordCount !== undefined && (
                          <span>
                            {backup.recordCount.toLocaleString()} records
                          </span>
                        )}
                        {backup.fileSize && (
                          <span>{formatBytes(backup.fileSize)}</span>
                        )}
                        {tables.length > 0 && (
                          <span>{tables.length} tables</span>
                        )}
                      </div>
                      {(backup.offsite?.location ||
                        backup.offsite?.reason ||
                        backup.errorMessage) && (
                        <p
                          className={`mt-1 text-[11px] ${backup.offsite?.status === "failed" || backup.status === "FAILED" ? "text-red-500" : "text-muted-foreground"}`}
                        >
                          {backup.offsite?.reason ||
                            backup.errorMessage ||
                            backup.offsite?.location}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}`}
                    >
                      {backup.status}
                    </span>
                    {backup.offsite && (
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${offsiteColor}`}
                      >
                        {offsiteLabel}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
