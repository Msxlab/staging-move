"use client";

import { Fragment, useState, useEffect } from "react";
import { Mail, Plus, Trash2, Edit2, Eye, Send, CheckCircle2, XCircle, X } from "lucide-react";
import { toast } from "sonner";

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

export default function EmailTemplatesPage() {
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

  const load = () => {
    fetch("/api/email-templates").then((r) => r.json()).then((d) => {
      setTemplates(d.templates || []);
      setLogs(d.logs || []);
      setStats(d.stats || { totalTemplates: 0, activeTemplates: 0, totalSent: 0, totalFailed: 0 });
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name || !form.subject || !form.body) { toast.error("Name, subject, and body required"); return; }
    const method = editing ? "PUT" : "POST";
    const payload = editing ? { id: editing.id, ...form } : form;
    if (!editing && !form.slug) { toast.error("Slug required"); return; }
    const res = await fetch("/api/email-templates", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) { toast.success(editing ? "Updated" : "Created"); reset(); load(); }
    else { const d = await res.json(); toast.error(d.error || "Failed"); }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    const res = await fetch("/api/email-templates", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (res.ok) { toast.success("Deleted"); load(); } else toast.error("Failed");
  };

  const startEdit = (t: Template) => { setEditing(t); setForm({ slug: t.slug, name: t.name, subject: t.subject, body: t.body, category: t.category, variables: t.variables || "", isActive: t.isActive }); setShowForm(true); };
  const reset = () => { setEditing(null); setShowForm(false); setForm({ slug: "", name: "", subject: "", body: "", category: "SYSTEM", variables: "", isActive: true }); };

  const statCards = [
    { label: "Total Templates", value: stats.totalTemplates, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Active", value: stats.activeTemplates, color: "text-green-500", bg: "bg-green-500/10" },
    { label: "Emails Sent", value: stats.totalSent, color: "text-purple-500", bg: "bg-purple-500/10" },
    { label: "Failed", value: stats.totalFailed, color: "text-red-500", bg: "bg-red-500/10" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold text-foreground">Email Templates</h1><p className="mt-1 text-muted-foreground">Manage email templates and view send logs</p></div>
        <button onClick={() => { reset(); setShowForm(true); }} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4" /> New Template</button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {statCards.map((c) => (<div key={c.label} className="rounded-xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">{c.label}</p><p className={`mt-1 text-2xl font-bold ${c.color}`}>{c.value}</p></div>))}
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setPreview(null)}>
          <div className="w-full max-w-2xl max-h-[80vh] overflow-auto rounded-xl border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold text-foreground">Preview: {preview.name}</h2><button onClick={() => setPreview(null)}><X className="h-5 w-5 text-muted-foreground" /></button></div>
            <p className="text-sm text-muted-foreground mb-2">Subject: {preview.subject}</p>
            <iframe
              title={`Email preview: ${preview.name}`}
              sandbox=""
              srcDoc={preview.body}
              className="h-[420px] w-full rounded-lg border border-border bg-background"
            />
          </div>
        </div>
      )}

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">{editing ? "Edit Template" : "New Template"}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-muted-foreground mb-1">Slug</label><input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} disabled={!!editing} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground disabled:opacity-50" placeholder="welcome-email" /></div>
            <div><label className="block text-sm font-medium text-muted-foreground mb-1">Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" placeholder="Welcome Email" /></div>
            <div><label className="block text-sm font-medium text-muted-foreground mb-1">Subject</label><input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" placeholder="Welcome to LocateFlow!" /></div>
            <div><label className="block text-sm font-medium text-muted-foreground mb-1">Category</label><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
            <div className="col-span-2"><label className="block text-sm font-medium text-muted-foreground mb-1">Body (HTML)</label><textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={8} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono" placeholder="<h1>Hello {{firstName}}</h1>" /></div>
            <div><label className="block text-sm font-medium text-muted-foreground mb-1">Variables (comma-separated)</label><input value={form.variables} onChange={(e) => setForm({ ...form, variables: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" placeholder="firstName, email, link" /></div>
            <div className="flex items-end"><label className="flex items-center gap-2 text-sm text-foreground cursor-pointer"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="accent-primary" /> Active</label></div>
          </div>
          <div className="flex gap-2"><button onClick={save} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">{editing ? "Update" : "Create"}</button><button onClick={reset} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-accent">Cancel</button></div>
        </div>
      )}

      <div className="flex gap-2 border-b border-border">
        {(["templates", "logs"] as const).map((t) => (<button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 transition ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{t === "templates" ? "Templates" : "Send Logs"}</button>))}
      </div>

      {tab === "templates" && (
        <div className="rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="px-4 py-3 font-medium">Name</th><th className="px-4 py-3 font-medium">Slug</th><th className="px-4 py-3 font-medium">Category</th><th className="px-4 py-3 font-medium">Sent</th><th className="px-4 py-3 font-medium">Failed</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium w-32">Actions</th></tr></thead>
            <tbody>
              {templates.length === 0 ? (<tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No templates yet</td></tr>) : templates.map((t) => (
                <tr key={t.id} className="border-b border-border hover:bg-accent/30">
                  <td className="px-4 py-3 font-medium text-foreground">{t.name}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground text-xs">{t.slug}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{t.category}</span></td>
                  <td className="px-4 py-3 text-muted-foreground">{t.sendCounts?.sent ?? t._count?.emailLogs ?? 0}</td>
                  <td className="px-4 py-3 text-muted-foreground">{t.sendCounts?.failed ?? 0}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${t.isActive ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>{t.isActive ? "Active" : "Inactive"}</span></td>
                  <td className="px-4 py-3 flex gap-1">
                    <button onClick={() => setPreview(t)} className="rounded p-1 text-muted-foreground hover:bg-accent"><Eye className="h-4 w-4" /></button>
                    <button onClick={() => startEdit(t)} className="rounded p-1 text-muted-foreground hover:bg-accent"><Edit2 className="h-4 w-4" /></button>
                    <button onClick={() => remove(t.id)} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "logs" && (
        <div className="rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="px-4 py-3 font-medium">To</th><th className="px-4 py-3 font-medium">Template</th><th className="px-4 py-3 font-medium">Subject</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Sent</th><th className="px-4 py-3 font-medium">Provider ID</th><th className="px-4 py-3 font-medium">Details</th></tr></thead>
            <tbody>
              {logs.length === 0 ? (<tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No emails sent yet</td></tr>) : logs.map((l) => (
                <Fragment key={l.id}>
                  <tr className="border-b border-border hover:bg-accent/30">
                    <td className="px-4 py-3 text-foreground">{l.to}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {l.template ? <span>{l.template.name} <span className="font-mono">({l.template.slug})</span></span> : "Manual"}
                    </td>
                    <td className="px-4 py-3 text-foreground truncate max-w-xs">{l.subject}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${l.status === "SENT" ? "bg-green-500/10 text-green-500" : l.status === "FAILED" ? "bg-red-500/10 text-red-500" : "bg-yellow-500/10 text-yellow-500"}`}>{l.status}</span></td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{l.sentAt ? new Date(l.sentAt).toLocaleString() : new Date(l.failedAt || l.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground text-xs">{l.providerMessageId || "-"}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setExpandedLogId(expandedLogId === l.id ? null : l.id)}
                        className="rounded p-1 text-muted-foreground hover:bg-accent"
                        aria-label="View failure details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                  {expandedLogId === l.id && (
                    <tr className="border-b border-border bg-accent/20">
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
      )}
    </div>
  );
}
