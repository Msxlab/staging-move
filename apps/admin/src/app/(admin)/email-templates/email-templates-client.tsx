"use client";

import { Fragment, useState, useEffect } from "react";
import { Mail, Plus, Trash2, Edit2, Eye, Send, CheckCircle2, XCircle, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { AdminPageHeader } from "@/components/admin-page-header";
import { EmptyState } from "@/components/empty-state";

interface Template {
  id: string;
  slug: string;
  name: string;
  subject: string;
  body: string;
  category: string;
  variables: string | null;
  isActive: boolean;
  createdAt: string;
  sendCounts?: { sent: number; failed: number; total: number };
  _count?: { emailLogs: number };
}
interface LogEntry {
  id: string;
  to: string;
  toDomain?: string | null;
  subject: string;
  status: string;
  error?: string | null;
  safeErrorReason?: string | null;
  sentAt: string | null;
  failedAt?: string | null;
  createdAt: string;
  providerMessageId: string | null;
  templateIdPresent?: boolean;
  fromAddress?: string | null;
  missingConfig?: boolean;
  dedupeConflict?: boolean;
  resendApiError?: boolean;
  retryAvailable?: boolean;
  template?: { name: string; slug: string } | null;
}

const CATEGORIES = ["SYSTEM", "MARKETING", "TRANSACTIONAL", "NOTIFICATION"];

// Template `variables` is stored as JSON (an array of names) and the server
// schema only accepts an array/object (or omitted). The form edits a
// comma-separated string, so convert in both directions — this maps the stored
// value back into the text input for editing.
function variablesToInput(v: unknown): string {
  if (!v) return "";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "object") return Object.keys(v as Record<string, unknown>).join(", ");
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.join(", ");
      if (parsed && typeof parsed === "object") return Object.keys(parsed).join(", ");
    } catch {
      /* not JSON — treat as a plain comma string */
    }
    return v;
  }
  return "";
}

export default function EmailTemplatesClient() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState({ totalTemplates: 0, activeTemplates: 0, totalSent: 0, totalFailed: 0 });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"templates" | "logs">("templates");
  const [editing, setEditing] = useState<Template | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [preview, setPreview] = useState<Template | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [form, setForm] = useState({ slug: "", name: "", subject: "", body: "", category: "SYSTEM", variables: "", isActive: true });
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetch("/api/email-templates").then((r) => r.json()).then((d) => {
      setTemplates(d.templates || []);
      setLogs(d.logs || []);
      setStats(d.stats || { totalTemplates: 0, activeTemplates: 0, totalSent: 0, totalFailed: 0 });
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Escape closes the preview modal (keyboard parity with the backdrop click).
  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPreview(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview]);

  const save = async () => {
    if (saving) return; // guard against double-submit (would create duplicate templates)
    if (!form.name || !form.subject || !form.body) { toast.error("Name, subject, and body required"); return; }
    const method = editing ? "PUT" : "POST";
    // Convert the comma-separated `variables` field into the array the server
    // schema expects (array | object | omitted). Sending the raw string 400s
    // ("Invalid template payload") — which previously broke EVERY create/edit.
    const variablesArray = form.variables.trim()
      ? form.variables.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;
    const base = { ...form, variables: variablesArray };
    const payload = editing ? { id: editing.id, ...base } : base;
    if (!editing && !form.slug) { toast.error("Slug required"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/email-templates", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) { toast.success(editing ? "Updated" : "Created"); reset(); load(); }
      else { const d = await res.json(); toast.error(d.error || "Failed"); }
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    const res = await fetch("/api/email-templates", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: pendingDelete.id }) });
    setDeleting(false);
    if (res.ok) { toast.success("Deleted"); setPendingDelete(null); load(); } else toast.error("Failed");
  };

  const startEdit = (t: Template) => { setEditing(t); setForm({ slug: t.slug, name: t.name, subject: t.subject, body: t.body, category: t.category, variables: variablesToInput(t.variables), isActive: t.isActive }); setShowForm(true); };
  const reset = () => { setEditing(null); setShowForm(false); setForm({ slug: "", name: "", subject: "", body: "", category: "SYSTEM", variables: "", isActive: true }); };

  const statCards = [
    { label: "Total Templates", value: stats.totalTemplates, color: "text-tone-sky-fg", bg: "bg-tone-sky-bg" },
    { label: "Active", value: stats.activeTemplates, color: "text-tone-sage-fg", bg: "bg-tone-sage-bg" },
    { label: "Emails Sent", value: stats.totalSent, color: "text-tone-foil-fg", bg: "bg-tone-foil-bg" },
    { label: "Failed", value: stats.totalFailed, color: "text-destructive", bg: "bg-destructive/10" },
  ];

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Comms"
        title="Email <em>Templates</em>"
        subtitle="Manage email templates and view send logs"
        actions={
          <button onClick={() => { reset(); setShowForm(true); }} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"><Plus className="h-4 w-4" /> New Template</button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map((c) => (
          <div key={c.label} className={`rounded-2xl border border-border ${c.bg} p-4`}>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{c.label}</p>
            <p className={`mt-1.5 font-display text-3xl font-extrabold leading-none ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-sm" role="presentation" onClick={() => setPreview(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="email-preview-title" className="w-full max-w-2xl max-h-[80vh] overflow-auto rounded-2xl border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 id="email-preview-title" className="font-display text-lg font-bold text-foreground">Preview: {preview.name}</h2><button aria-label="Close preview" onClick={() => setPreview(null)} className="text-muted-foreground transition-colors hover:text-foreground"><X className="h-5 w-5" /></button></div>
            <p className="text-sm text-muted-foreground mb-2">Subject: {preview.subject}</p>
            <iframe
              title={`Email preview: ${preview.name}`}
              sandbox=""
              srcDoc={preview.body}
              className="h-[420px] w-full rounded-xl border border-border bg-background"
            />
          </div>
        </div>
      )}

      {showForm && (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-foreground">{editing ? "Edit Template" : "New Template"}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Slug</label><input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} disabled={!!editing} className="w-full rounded-xl border border-input bg-background px-3 py-2 font-mono text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50" placeholder="welcome-email" /></div>
            <div><label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="Welcome Email" /></div>
            <div><label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Subject</label><input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="Welcome to Move!" /></div>
            <div><label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Category</label><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
            <div className="sm:col-span-2"><label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Body (HTML)</label><textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={8} className="w-full rounded-xl border border-input bg-background px-3 py-2 font-mono text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="<h1>Hello {{firstName}}</h1>" /></div>
            <div><label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Variables (comma-separated)</label><input value={form.variables} onChange={(e) => setForm({ ...form, variables: e.target.value })} className="w-full rounded-xl border border-input bg-background px-3 py-2 font-mono text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="firstName, email, link" /></div>
            <div className="flex items-end"><label className="flex items-center gap-2 text-sm text-foreground cursor-pointer"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="accent-primary" /> Active</label></div>
          </div>
          <div className="flex gap-2"><button onClick={save} disabled={saving} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">{saving ? "Saving…" : editing ? "Update" : "Create"}</button><button onClick={reset} className="rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">Cancel</button></div>
        </div>
      )}

      <div className="flex gap-1 border-b border-border">
        {(["templates", "logs"] as const).map((t) => (<button key={t} onClick={() => setTab(t)} className={`-mb-px border-b-2 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{t === "templates" ? "Templates" : "Send Logs"}</button>))}
      </div>

      {tab === "templates" && (
        <>
        <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card sm:block">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/50"><tr className="text-left"><th className="px-4 py-3 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Name</th><th className="px-4 py-3 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Slug</th><th className="px-4 py-3 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Category</th><th className="px-4 py-3 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Sent</th><th className="px-4 py-3 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Failed</th><th className="px-4 py-3 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Status</th><th className="px-4 py-3 w-32 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Actions</th></tr></thead>
            <tbody className="divide-y divide-border">
              {templates.length === 0 ? (<tr><td colSpan={7} className="px-4"><EmptyState icon={Mail} title="No templates yet" description="Create your first email template to get started." /></td></tr>) : templates.map((t) => (
                <tr key={t.id} className="transition-colors hover:bg-accent/30">
                  <td className="px-4 py-3 font-medium text-foreground">{t.name}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground text-xs">{t.slug}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{t.category}</span></td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">{t.sendCounts?.sent ?? t._count?.emailLogs ?? 0}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">{t.sendCounts?.failed ?? 0}</td>
                  <td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${t.isActive ? "bg-tone-sage-bg text-tone-sage-fg" : "bg-destructive/10 text-destructive"}`}><span className={`h-1.5 w-1.5 rounded-full ${t.isActive ? "bg-tone-sage-fg" : "bg-destructive"}`} />{t.isActive ? "Active" : "Inactive"}</span></td>
                  <td className="px-4 py-3 flex gap-1">
                    <button onClick={() => setPreview(t)} aria-label="Preview template" className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"><Eye className="h-4 w-4" /></button>
                    <button onClick={() => startEdit(t)} aria-label="Edit template" className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"><Edit2 className="h-4 w-4" /></button>
                    <button onClick={() => setPendingDelete({ id: t.id, name: t.name })} aria-label="Delete template" className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-2.5 sm:hidden">
          {templates.length === 0 ? (
            <EmptyState icon={Mail} title="No templates yet" description="Create your first email template to get started." />
          ) : templates.map((t) => (
            <div key={t.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{t.name}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">{t.slug}</p>
                </div>
                <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${t.isActive ? "bg-tone-sage-bg text-tone-sage-fg" : "bg-destructive/10 text-destructive"}`}><span className={`h-1.5 w-1.5 rounded-full ${t.isActive ? "bg-tone-sage-fg" : "bg-destructive"}`} />{t.isActive ? "Active" : "Inactive"}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">{t.category}</span>
                <span>Sent <span className="font-mono">{t.sendCounts?.sent ?? t._count?.emailLogs ?? 0}</span></span>
                <span>Failed <span className="font-mono">{t.sendCounts?.failed ?? 0}</span></span>
              </div>
              <div className="mt-2.5 flex gap-2">
                <button onClick={() => setPreview(t)} className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"><Eye className="h-3.5 w-3.5" /> Preview</button>
                <button onClick={() => startEdit(t)} className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"><Edit2 className="h-3.5 w-3.5" /> Edit</button>
                <button onClick={() => setPendingDelete({ id: t.id, name: t.name })} aria-label="Delete template" className="inline-flex items-center justify-center rounded-xl border border-destructive/40 px-3 py-2 text-xs text-destructive transition-colors hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
        </>
      )}

      {tab === "logs" && (
        <>
        <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card sm:block">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/50"><tr className="text-left"><th className="px-4 py-3 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">To</th><th className="px-4 py-3 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Template</th><th className="px-4 py-3 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Subject</th><th className="px-4 py-3 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Status</th><th className="px-4 py-3 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Sent</th><th className="px-4 py-3 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Provider ID</th><th className="px-4 py-3 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Details</th></tr></thead>
            <tbody className="divide-y divide-border">
              {logs.length === 0 ? (<tr><td colSpan={7} className="px-4"><EmptyState icon={Send} title="No emails sent yet" description="Send logs will appear here once emails go out." /></td></tr>) : logs.map((l) => (
                <Fragment key={l.id}>
                  <tr className="transition-colors hover:bg-accent/30">
                    <td className="px-4 py-3 text-foreground">{l.to}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {l.template ? <span>{l.template.name} <span className="font-mono">({l.template.slug})</span></span> : "Manual"}
                    </td>
                    <td className="px-4 py-3 text-foreground truncate max-w-xs">{l.subject}</td>
                    <td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${l.status === "SENT" ? "bg-tone-sage-bg text-tone-sage-fg" : l.status === "FAILED" ? "bg-destructive/10 text-destructive" : "bg-tone-honey-bg text-tone-honey-fg"}`}><span className={`h-1.5 w-1.5 rounded-full ${l.status === "SENT" ? "bg-tone-sage-fg" : l.status === "FAILED" ? "bg-destructive" : "bg-tone-honey-fg"}`} />{l.status}</span></td>
                    <td className="px-4 py-3 font-mono text-muted-foreground text-xs">{l.sentAt ? new Date(l.sentAt).toLocaleString() : new Date(l.failedAt || l.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground text-xs">{l.providerMessageId || "-"}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setExpandedLogId(expandedLogId === l.id ? null : l.id)}
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        aria-label="View failure details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                  {expandedLogId === l.id && (
                    <tr className="bg-accent/20">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                          <p><span className="font-medium text-foreground">Failure reason:</span> {l.safeErrorReason || l.error || "-"}</p>
                          <p><span className="font-medium text-foreground">From:</span> {l.fromAddress || "-"}</p>
                          <p><span className="font-medium text-foreground">Recipient domain:</span> {l.toDomain || "-"}</p>
                          <p><span className="font-medium text-foreground">Template linked:</span> {l.templateIdPresent ? "Yes" : "No"}</p>
                          <p><span className="font-medium text-foreground">Missing config:</span> {l.missingConfig ? "Yes" : "No"}</p>
                          <p><span className="font-medium text-foreground">Resend API error:</span> {l.resendApiError ? "Yes" : "No"}</p>
                          <p><span className="font-medium text-foreground">Dedupe conflict:</span> {l.dedupeConflict ? "Yes" : "No"}</p>
                          <p><span className="font-medium text-foreground">Retry available:</span> {l.retryAvailable ? "Yes" : "No"}</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-2.5 sm:hidden">
          {logs.length === 0 ? (
            <EmptyState icon={Send} title="No emails sent yet" description="Send logs will appear here once emails go out." />
          ) : logs.map((l) => (
            <div key={l.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 truncate font-medium text-foreground">{l.to}</p>
                <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${l.status === "SENT" ? "bg-tone-sage-bg text-tone-sage-fg" : l.status === "FAILED" ? "bg-destructive/10 text-destructive" : "bg-tone-honey-bg text-tone-honey-fg"}`}><span className={`h-1.5 w-1.5 rounded-full ${l.status === "SENT" ? "bg-tone-sage-fg" : l.status === "FAILED" ? "bg-destructive" : "bg-tone-honey-fg"}`} />{l.status}</span>
              </div>
              <p className="mt-1 truncate text-xs text-foreground">{l.subject}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {l.template ? `${l.template.name} (${l.template.slug})` : "Manual"} · <span className="font-mono">{l.sentAt ? new Date(l.sentAt).toLocaleString() : new Date(l.failedAt || l.createdAt).toLocaleString()}</span>
              </p>
              <button type="button" onClick={() => setExpandedLogId(expandedLogId === l.id ? null : l.id)} className="mt-1.5 text-xs text-primary hover:underline">
                {expandedLogId === l.id ? "Hide details" : "Details"}
              </button>
              {expandedLogId === l.id && (
                <div className="mt-2 grid gap-1 border-t border-border pt-2 text-xs text-muted-foreground">
                  <p><span className="font-medium text-foreground">Failure reason:</span> {l.safeErrorReason || l.error || "-"}</p>
                  <p><span className="font-medium text-foreground">From:</span> {l.fromAddress || "-"}</p>
                  <p><span className="font-medium text-foreground">Recipient domain:</span> {l.toDomain || "-"}</p>
                  <p><span className="font-medium text-foreground">Provider ID:</span> <span className="font-mono">{l.providerMessageId || "-"}</span></p>
                </div>
              )}
            </div>
          ))}
        </div>
        </>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete email template"
        description={pendingDelete ? `"${pendingDelete.name}" will be permanently deleted. This cannot be undone.` : ""}
        confirmLabel="Delete"
        busy={deleting}
        onClose={() => { if (!deleting) setPendingDelete(null); }}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
