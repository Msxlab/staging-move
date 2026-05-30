"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search, Plus, Pencil, Trash2, ChevronDown, ChevronRight,
  Filter, X, Download, ToggleLeft, ToggleRight, LayoutGrid, List, Layers,
  Building2, Globe, MapPin, CheckSquare, Square, Eye, Upload, Loader2,
  AlertTriangle, ImageOff,
} from "lucide-react";
import { toast } from "sonner";
import { getCategoryIcon, getCategoryLabel, getCategoryOrder, PROVIDER_CATEGORY_OPTIONS } from "@/lib/recommendation-engine";
import { PasswordConfirmModal } from "@/components/password-confirm-modal";
import { validateCsvFileMetadata } from "@/lib/privacy";

interface Provider {
  id: string; name: string; slug: string; category: string; subCategory: string | null;
  description: string | null; website: string | null; phone: string | null; logoUrl: string | null;
  scope: string; states: string; tags: string;
  popularityScore: number; isActive: boolean; displayOrder: number;
  qualityWarningCount?: number;
  qualityWarnings?: Array<{ code: string; label: string; message: string; severity: string }>;
}

interface CategoryStat { category: string; count: number; avgScore: number; }

type ViewMode = "accordion" | "table" | "grid";

// Full category list for bulk "Change category" (the filter dropdown only
// lists categories present in the current result set; bulk edits need every
// valid target). Sorted to match the create/edit forms.
const BULK_CATEGORY_OPTIONS = [...PROVIDER_CATEGORY_OPTIONS].sort((a, b) => a.order - b.order);

export default function ProvidersPage() {
  const [groups, setGroups] = useState<Record<string, Provider[]>>({});
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
  const [total, setTotal] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [inactiveCount, setInactiveCount] = useState(0);
  const [qualitySummary, setQualitySummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [filterScope, setFilterScope] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterState, setFilterState] = useState("");
  const [scoreMin, setScoreMin] = useState("");
  const [scoreMax, setScoreMax] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // View
  const [viewMode, setViewMode] = useState<ViewMode>("accordion");
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());

  // Bulk
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState("");
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkScore, setBulkScore] = useState("");

  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [pendingDelete, setPendingDelete] = useState<
    | { type: "single"; id: string; name: string }
    | { type: "bulk"; ids: string[] }
    | null
  >(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const activeFilters = [filterScope, filterStatus, filterCategory, filterState, scoreMin, scoreMax].filter(Boolean).length;

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ grouped: "true" });
      if (search) params.set("search", search);
      if (filterScope) params.set("scope", filterScope);
      if (filterStatus) params.set("status", filterStatus);
      if (filterCategory) params.set("category", filterCategory);
      if (filterState) params.set("states", filterState.trim().toUpperCase());
      if (scoreMin) params.set("scoreMin", scoreMin);
      if (scoreMax) params.set("scoreMax", scoreMax);

      const res = await fetch(`/api/providers?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.mfaSetupRequired) {
          toast.error("MFA setup is required before provider data can be loaded.");
          window.location.assign("/settings/two-factor?required=1");
          return;
        }
        throw new Error(data?.error || "Failed to fetch providers");
      }
      setGroups(data.groups || {});
      setCategoryStats(data.categoryStats || []);
      setTotal(data.total || 0);
      setActiveCount(data.activeCount || 0);
      setInactiveCount(data.inactiveCount || 0);
      setQualitySummary(data.qualitySummary || {});
      setOpenCategories((prev) => {
        if (prev.size > 0) return prev;
        return new Set(Object.keys(data.groups || {}).slice(0, 5));
      });
    } catch (error: any) { toast.error(error?.message || "Failed to fetch providers"); }
    finally { setLoading(false); }
  }, [search, filterScope, filterStatus, filterCategory, filterState, scoreMin, scoreMax]);

  useEffect(() => { fetchProviders(); }, [fetchProviders]);

  function toggleCategory(cat: string) {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }

  function expandAll() { setOpenCategories(new Set(Object.keys(groups))); }
  function collapseAll() { setOpenCategories(new Set()); }

  function toggleSelect(id: string) {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }
  function selectAll() {
    const allIds = Object.values(groups).flat().map((p) => p.id);
    setSelected(new Set(allIds));
  }
  function resetBulk() {
    setSelected(new Set());
    setBulkAction("");
    setBulkCategory("");
    setBulkScore("");
  }
  function deselectAll() { resetBulk(); }

  async function handleBulk() {
    if (!bulkAction || selected.size === 0) return;
    const ids = Array.from(selected);

    if (bulkAction === "delete") {
      setDeleteError(null);
      setPendingDelete({ type: "bulk", ids });
      return;
    }

    const body: { action: string; ids: string[]; data?: Record<string, unknown> } = { action: bulkAction, ids };
    if (bulkAction === "change_category") {
      if (!bulkCategory) { toast.error("Choose a category to apply."); return; }
      body.data = { category: bulkCategory };
    }
    if (bulkAction === "set_score") {
      const score = Number.parseInt(bulkScore, 10);
      if (!Number.isFinite(score) || score < 0 || score > 100) {
        toast.error("Enter a score between 0 and 100.");
        return;
      }
      body.data = { score };
    }
    try {
      const res = await fetch("/api/providers/bulk", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(data.error || "Failed"); return; }
      toast.success(`${data.affected} providers updated`);
      resetBulk();
      fetchProviders();
    } catch { toast.error("Bulk operation failed"); }
  }

  function handleDelete(id: string, name: string) {
    setDeleteError(null);
    setPendingDelete({ type: "single", id, name });
  }

  async function confirmProviderDelete(confirmPassword: string) {
    if (!pendingDelete) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res =
        pendingDelete.type === "single"
          ? await fetch(`/api/providers/${pendingDelete.id}`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ confirmPassword }),
            })
          : await fetch("/api/providers/bulk", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "delete",
                ids: pendingDelete.ids,
                confirmPassword,
              }),
            });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = data.error || "Delete failed";
        setDeleteError(message);
        toast.error(message);
        return;
      }
      toast.success(pendingDelete.type === "single" ? "Deleted" : `${data.affected || pendingDelete.ids.length} providers deleted`);
      setPendingDelete(null);
      setSelected(new Set());
      setBulkAction("");
      fetchProviders();
    } catch {
      setDeleteError("Delete failed");
      toast.error("Delete failed");
    } finally {
      setDeleteBusy(false);
    }
  }

  function parseJSON(str: string): string[] {
    try { return JSON.parse(str); } catch { return []; }
  }

  function clearFilters() {
    setFilterScope(""); setFilterStatus(""); setFilterCategory("");
    setFilterState(""); setScoreMin(""); setScoreMax("");
  }

  async function handleImport() {
    if (!importFile) return;
    const validation = validateCsvFileMetadata({
      name: importFile.name,
      size: importFile.size,
      type: importFile.type,
    });
    if (!validation.ok) {
      toast.error(validation.error);
      return;
    }
    setImporting(true);
    try {
      const text = await importFile.text();
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length < 2) { toast.error("CSV must have header + data rows"); setImporting(false); return; }
      const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
      const rows = lines.slice(1).map((line) => {
        const values = line.match(/("[^"]*"|[^,]*)/g)?.map((v) => v.trim().replace(/^"|"$/g, "")) || [];
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = values[i] || ""; });
        return obj;
      });
      const res = await fetch("/api/providers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providers: rows,
          sourceFile: {
            name: importFile.name,
            size: importFile.size,
            type: importFile.type,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Import failed"); return; }
      toast.success(`Import complete: ${data.created} created, ${data.skipped} skipped`);
      if (data.errors?.length > 0) toast.error(`${data.errors.length} errors`);
      setShowImport(false);
      setImportFile(null);
      fetchProviders();
    } catch { toast.error("Failed to parse CSV"); }
    finally { setImporting(false); }
  }

  function handleExport() {
    const allProviders = Object.values(groups).flat();
    const filtered = selected.size > 0 ? allProviders.filter((p) => selected.has(p.id)) : allProviders;
    const csv = [
      "Name,Slug,Category,Scope,Score,Active,Website",
      ...filtered.map((p) => `"${p.name}","${p.slug}","${p.category}","${p.scope}",${p.popularityScore},${p.isActive},"${p.website || ""}"`)
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "providers.csv"; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} providers`);
  }

  const allProviders = Object.values(groups).flat();
  const federalCount = allProviders.filter((p) => p.scope === "FEDERAL").length;
  const stateCount = allProviders.filter((p) => p.scope === "STATE").length;
  const missingLogoCount = allProviders.filter((p) => p.isActive && !p.logoUrl).length;
  const qualityWarningTotal = Object.values(qualitySummary).reduce((sum, count) => sum + count, 0);
  const qualityIssues = Object.entries(qualitySummary)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Service Providers</h1>
          <p className="mt-1 text-muted-foreground">{total} providers in catalog</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowImport(!showImport)} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-accent">
            <Upload className="h-4 w-4" /> Import CSV
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-accent">
            <Download className="h-4 w-4" /> Export
          </button>
          <button onClick={() => window.location.assign("/providers/needs-logo")}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-accent">
            <ImageOff className="h-4 w-4" /> Logo backfill
            {missingLogoCount > 0 && (
              <span className="rounded-full bg-tone-honey-bg px-2 py-0.5 text-xs font-semibold text-tone-honey-fg">
                {missingLogoCount}
              </span>
            )}
          </button>
          <button onClick={() => window.location.assign("/providers/new")}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Add Provider
          </button>
        </div>
      </div>

      {/* CSV Import Panel */}
      {showImport && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Import Providers from CSV</h3>
            <button onClick={() => setShowImport(false)} className="p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <p className="text-xs text-muted-foreground">CSV must have headers: <code className="bg-muted px-1 rounded">name,category,scope,website,phone,description,popularityScore,states,tags</code></p>
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                const validation = validateCsvFileMetadata(file);
                if (!validation.ok) {
                  toast.error(validation.error);
                  e.currentTarget.value = "";
                  setImportFile(null);
                  return;
                }
                setImportFile(file);
              }}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-xs file:font-medium file:text-primary"
            />
            <button
              onClick={handleImport}
              disabled={!importFile || importing}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {importing ? <><Loader2 className="h-4 w-4 animate-spin" />Importing...</> : "Import"}
            </button>
          </div>
        </div>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          { label: "Total", value: total, color: "text-foreground", bg: "bg-card" },
          { label: "Active", value: activeCount, color: "text-tone-sage-fg", bg: "bg-tone-sage-bg" },
          { label: "Inactive", value: inactiveCount, color: "text-muted-foreground", bg: "bg-tone-slate-bg" },
          { label: "Federal", value: federalCount, color: "text-tone-sky-fg", bg: "bg-tone-sky-bg" },
          { label: "State", value: stateCount, color: "text-tone-orange-fg", bg: "bg-tone-orange-bg" },
          { label: "Quality warnings", value: qualityWarningTotal, color: "text-tone-honey-fg", bg: "bg-tone-honey-bg" },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border border-border ${s.bg} p-4`}>
            <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
            <p className={`mt-1 text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-tone-honey-br bg-tone-honey-bg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-tone-honey-fg" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">Provider data quality</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Warnings are derived from current catalog fields only. They do not prove a provider is verified or official.
            </p>
            {qualityIssues.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {qualityIssues.map(([code, count]) => (
                  <span key={code} className="rounded-full border border-tone-honey-br bg-background px-2.5 py-1 text-xs text-tone-honey-fg">
                    {code.replace(/_/g, " ")}: {count}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">No warnings in the current result set.</p>
            )}
          </div>
        </div>
      </div>

      {/* Search + Filter Bar + View Toggle */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Search name, slug, description, tags..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-input bg-background pl-10 pr-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <button onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${showFilters ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent"}`}>
          <Filter className="h-4 w-4" />
          Filters {activeFilters > 0 && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">{activeFilters}</span>}
        </button>
        <div className="flex items-center rounded-lg border border-border">
          {([["accordion", Layers], ["table", List], ["grid", LayoutGrid]] as [ViewMode, any][]).map(([mode, Icon]) => (
            <button key={mode} onClick={() => setViewMode(mode)}
              className={`p-2.5 transition-colors ${viewMode === mode ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"}`}>
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Advanced Filters</h3>
            <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground">Clear all</button>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Scope</label>
              <select value={filterScope} onChange={(e) => setFilterScope(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground">
                <option value="">All</option>
                <option value="FEDERAL">Federal</option>
                <option value="STATE">State</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Status</label>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground">
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Category</label>
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground">
                <option value="">All Categories</option>
                {categoryStats.sort((a, b) => getCategoryOrder(a.category) - getCategoryOrder(b.category)).map((c) => (
                  <option key={c.category} value={c.category}>{getCategoryLabel(c.category)} ({c.count})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">State</label>
              <input
                type="text"
                value={filterState}
                onChange={(e) => setFilterState(e.target.value.toUpperCase().slice(0, 2))}
                placeholder="TX"
                maxLength={2}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Min Score</label>
              <input type="number" value={scoreMin} onChange={(e) => setScoreMin(e.target.value)} placeholder="0" min={0} max={100}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Max Score</label>
              <input type="number" value={scoreMax} onChange={(e) => setScoreMax(e.target.value)} placeholder="100" min={0} max={100}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground" />
            </div>
          </div>
        </div>
      )}

      {/* Bulk Actions Bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <span className="text-sm font-medium text-primary">{selected.size} selected</span>
          <select value={bulkAction} onChange={(e) => { setBulkAction(e.target.value); setBulkCategory(""); setBulkScore(""); }} className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm text-foreground">
            <option value="">Choose action...</option>
            <option value="activate">Activate</option>
            <option value="deactivate">Deactivate</option>
            <option value="change_category">Change Category</option>
            <option value="set_score">Set Score</option>
            <option value="delete">Delete</option>
          </select>
          {bulkAction === "change_category" && (
            <select
              value={bulkCategory}
              onChange={(e) => setBulkCategory(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm text-foreground"
            >
              <option value="">Select category…</option>
              {BULK_CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
              ))}
            </select>
          )}
          {bulkAction === "set_score" && (
            <input
              type="number"
              min={0}
              max={100}
              value={bulkScore}
              onChange={(e) => setBulkScore(e.target.value)}
              placeholder="Score 0–100"
              className="w-32 rounded-lg border border-input bg-background px-3 py-1.5 text-sm text-foreground"
            />
          )}
          <button
            onClick={handleBulk}
            disabled={
              !bulkAction ||
              (bulkAction === "change_category" && !bulkCategory) ||
              (bulkAction === "set_score" && bulkScore.trim() === "")
            }
            className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Apply
          </button>
          <button onClick={deselectAll} className="ml-auto text-sm text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="py-20 text-center text-muted-foreground">Loading providers...</div>
      ) : viewMode === "accordion" ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <button onClick={expandAll} className="text-xs text-primary hover:underline">Expand All</button>
            <span className="text-muted-foreground">·</span>
            <button onClick={collapseAll} className="text-xs text-primary hover:underline">Collapse All</button>
            <span className="text-muted-foreground">·</span>
            <button onClick={selectAll} className="text-xs text-primary hover:underline">Select All</button>
          </div>
          {categoryStats.sort((a, b) => getCategoryOrder(a.category) - getCategoryOrder(b.category)).map((stat) => {
            const isOpen = openCategories.has(stat.category);
            const items = groups[stat.category] || [];
            const catActiveCount = items.filter((p) => p.isActive).length;
            return (
              <div key={stat.category} className="rounded-xl border border-border overflow-hidden">
                <button onClick={() => toggleCategory(stat.category)}
                  className="flex w-full items-center justify-between bg-card px-5 py-3.5 hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-3">
                    {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    <span className="text-lg">{getCategoryIcon(stat.category)}</span>
                    <span className="font-semibold text-foreground">{getCategoryLabel(stat.category)}</span>
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{stat.count}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Avg Score: <span className="font-medium text-foreground">{stat.avgScore}</span></span>
                    <span className="text-tone-sage-fg">{catActiveCount} active</span>
                    {items.length - catActiveCount > 0 && <span className="text-muted-foreground">{items.length - catActiveCount} inactive</span>}
                  </div>
                </button>
                {isOpen && items.length > 0 && (
                  <div className="border-t border-border">
                    <table className="w-full">
                      <thead className="bg-muted/30">
                        <tr>
                          <th className="w-10 px-3 py-2"><button onClick={() => { const allSelected = items.every(p => selected.has(p.id)); items.forEach(p => { setSelected(prev => { const n = new Set(prev); allSelected ? n.delete(p.id) : n.add(p.id); return n; }); }); }}><CheckSquare className="h-3.5 w-3.5 text-muted-foreground" /></button></th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Provider</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Scope</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">States</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">Score</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">Status</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {items.map((p) => {
                          const states = parseJSON(p.states);
                          return (
                            <tr key={p.id} className="bg-card/50 hover:bg-accent/30 transition-colors">
                              <td className="px-3 py-2.5">
                                <button onClick={() => toggleSelect(p.id)}>
                                  {selected.has(p.id) ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                                </button>
                              </td>
                              <td className="px-3 py-2.5">
                                <p className="font-medium text-foreground text-sm">{p.name}</p>
                                <p className="text-[11px] text-muted-foreground">{p.slug}</p>
                                {(p.qualityWarningCount || 0) > 0 && (
                                  <p className="mt-1 text-[11px] text-tone-honey-fg">
                                    {p.qualityWarningCount} quality warning{p.qualityWarningCount === 1 ? "" : "s"}
                                  </p>
                                )}
                              </td>
                              <td className="px-3 py-2.5">
                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${p.scope === "FEDERAL" ? "bg-tone-sky-bg text-tone-sky-fg" : "bg-tone-orange-bg text-tone-orange-fg"}`}>
                                  {p.scope === "FEDERAL" ? <><Globe className="inline h-3 w-3 mr-0.5" /> Federal</> : <><MapPin className="inline h-3 w-3 mr-0.5" /> State</>}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[120px] truncate">
                                {p.scope === "FEDERAL" ? "All" : states.length > 3 ? `${states.slice(0, 3).join(", ")} +${states.length - 3}` : states.join(", ") || "—"}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <span className={`text-sm font-bold ${p.popularityScore >= 90 ? "text-tone-sage-fg" : p.popularityScore >= 70 ? "text-tone-sky-fg" : p.popularityScore >= 50 ? "text-tone-honey-fg" : "text-muted-foreground"}`}>
                                  {p.popularityScore}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${p.isActive ? "bg-tone-sage-bg text-tone-sage-fg" : "bg-tone-slate-bg text-muted-foreground"}`}>
                                  {p.isActive ? "Active" : "Inactive"}
                                </span>
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="flex items-center justify-end gap-0.5">
                                  <button onClick={() => window.location.assign(`/providers/${p.id}`)} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" title="View"><Eye className="h-3.5 w-3.5" /></button>
                                  <button onClick={() => window.location.assign(`/providers/${p.id}/edit`)} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" title="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                                  <button onClick={() => handleDelete(p.id, p.name)} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {allProviders.map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-card p-4 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleSelect(p.id)}>
                    {selected.has(p.id) ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                  </button>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground">{getCategoryIcon(p.category)} {getCategoryLabel(p.category)}</p>
                    {(p.qualityWarningCount || 0) > 0 && (
                      <p className="mt-1 text-[11px] text-tone-honey-fg">
                        {p.qualityWarningCount} quality warning{p.qualityWarningCount === 1 ? "" : "s"}
                      </p>
                    )}
                  </div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${p.isActive ? "bg-tone-sage-bg text-tone-sage-fg" : "bg-tone-slate-bg text-muted-foreground"}`}>
                  {p.isActive ? "Active" : "Off"}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <span className={`rounded px-1.5 py-0.5 ${p.scope === "FEDERAL" ? "bg-tone-sky-bg text-tone-sky-fg" : "bg-tone-orange-bg text-tone-orange-fg"}`}>{p.scope}</span>
                <span className="font-bold text-foreground">{p.popularityScore}</span>
              </div>
              <div className="mt-3 flex items-center gap-1">
                <button onClick={() => window.location.assign(`/providers/${p.id}`)} className="flex-1 rounded-lg bg-muted/50 py-1.5 text-xs text-muted-foreground hover:bg-accent">View</button>
                <button onClick={() => window.location.assign(`/providers/${p.id}/edit`)} className="flex-1 rounded-lg bg-muted/50 py-1.5 text-xs text-muted-foreground hover:bg-accent">Edit</button>
                <button onClick={() => handleDelete(p.id, p.name)} className="rounded-lg bg-muted/50 p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Table View */
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="w-10 px-3 py-3"><button onClick={() => selected.size === allProviders.length ? deselectAll() : selectAll()}><CheckSquare className="h-3.5 w-3.5 text-muted-foreground" /></button></th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Provider</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Scope</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">States</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase text-muted-foreground">Score</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {allProviders.map((p) => {
                const states = parseJSON(p.states);
                return (
                  <tr key={p.id} className="bg-card hover:bg-accent/50 transition-colors">
                    <td className="px-3 py-3"><button onClick={() => toggleSelect(p.id)}>{selected.has(p.id) ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}</button></td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.slug}</p>
                      {(p.qualityWarningCount || 0) > 0 && (
                        <p className="mt-1 text-[11px] text-tone-honey-fg">
                          {p.qualityWarningCount} quality warning{p.qualityWarningCount === 1 ? "" : "s"}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground"><span className="mr-1">{getCategoryIcon(p.category)}</span>{getCategoryLabel(p.category)}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.scope === "FEDERAL" ? "bg-tone-sky-bg text-tone-sky-fg" : "bg-tone-orange-bg text-tone-orange-fg"}`}>{p.scope}</span></td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{p.scope === "FEDERAL" ? "All" : states.length > 3 ? `${states.slice(0, 3).join(", ")}...` : states.join(", ")}</td>
                    <td className="px-4 py-3 text-center text-sm font-bold text-foreground">{p.popularityScore}</td>
                    <td className="px-4 py-3 text-center"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.isActive ? "bg-tone-sage-bg text-tone-sage-fg" : "bg-tone-slate-bg text-muted-foreground"}`}>{p.isActive ? "Active" : "Inactive"}</span></td>
                    <td className="px-4 py-3 text-right"><div className="flex items-center justify-end gap-1">
                      <button onClick={() => window.location.assign(`/providers/${p.id}`)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"><Eye className="h-4 w-4" /></button>
                      <button onClick={() => window.location.assign(`/providers/${p.id}/edit`)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => handleDelete(p.id, p.name)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <PasswordConfirmModal
        open={Boolean(pendingDelete)}
        title={pendingDelete?.type === "bulk" ? "Delete providers" : "Delete provider"}
        description={
          pendingDelete?.type === "bulk"
            ? `This deletes ${pendingDelete.ids.length} selected providers. Enter your admin password to continue.`
            : pendingDelete
            ? `This deletes "${pendingDelete.name}". Enter your admin password to continue.`
            : ""
        }
        confirmLabel="Delete"
        busy={deleteBusy}
        error={deleteError}
        onClose={() => {
          if (!deleteBusy) {
            setPendingDelete(null);
            setDeleteError(null);
          }
        }}
        onConfirm={confirmProviderDelete}
      />
    </div>
  );
}
