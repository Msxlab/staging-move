"use client";

import { useState, useEffect } from "react";
import { Lock, Shield, Plus, Trash2, ToggleLeft, ToggleRight, AlertTriangle, Globe, FileText, CheckCircle2, CircleHelp, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

interface IPRule { id: string; ipAddress: string; type: string; reason: string | null; isActive: boolean; expiresAt: string | null; createdAt: string }
interface RateLimitLog { id: string; ipAddress: string; endpoint: string; count: number; blocked: boolean; windowStart: string; createdAt: string }
interface GDPRRequest { id: string; userId: string; type: string; status: string; completedAt: string | null; createdAt: string }
interface Stats { totalIPRules: number; whitelisted: number; blacklisted: number; blockedRequests: number; pendingGDPR: number; totalGDPR: number }
interface SecurityReadinessCheck { key: string; label: string; status: "ready" | "warn" | "missing" | "unknown"; detail: string; source: string }
interface SecurityReadinessGroup { id: string; label: string; checks: SecurityReadinessCheck[] }
interface SecurityReadiness {
  generatedAt: string;
  summary: { ready: number; warn: number; missing: number; unknown: number; missingRequired: number };
  missingRequiredKeys: string[];
  lastBackup: { createdAt: string; fileName: string | null; recordCount: number | null; type: string } | null;
  groups: SecurityReadinessGroup[];
}

export default function SecurityClient() {
  const [ipRules, setIpRules] = useState<IPRule[]>([]);
  const [rateLimitLogs, setRateLimitLogs] = useState<RateLimitLog[]>([]);
  const [gdprRequests, setGdprRequests] = useState<GDPRRequest[]>([]);
  const [readiness, setReadiness] = useState<SecurityReadiness | null>(null);
  const [stats, setStats] = useState<Stats>({ totalIPRules: 0, whitelisted: 0, blacklisted: 0, blockedRequests: 0, pendingGDPR: 0, totalGDPR: 0 });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"ip" | "ratelimit" | "gdpr">("ip");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ipAddress: "", type: "BLACKLIST", reason: "", expiresAt: "" });

  const load = () => {
    fetch("/api/security").then(r => r.json()).then(d => {
      setIpRules(d.ipRules || []); setRateLimitLogs(d.rateLimitLogs || []); setGdprRequests(d.gdprRequests || []); setStats(d.stats || {}); setReadiness(d.readiness || null);
    }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const readinessStatCards = readiness ? [
    { label: "Ready", value: readiness.summary.ready, color: "text-tone-sage-fg", bg: "bg-tone-sage-bg", icon: CheckCircle2 },
    { label: "Warnings", value: readiness.summary.warn, color: "text-tone-honey-fg", bg: "bg-tone-honey-bg", icon: TriangleAlert },
    { label: "Missing", value: readiness.summary.missing, color: "text-destructive", bg: "bg-destructive/10", icon: AlertTriangle },
    { label: "Unknown", value: readiness.summary.unknown, color: "text-muted-foreground", bg: "bg-tone-slate-bg", icon: CircleHelp },
    { label: "Required Missing", value: readiness.summary.missingRequired, color: "text-destructive", bg: "bg-destructive/10", icon: Lock },
  ] : [];

  const statusClasses: Record<SecurityReadinessCheck["status"], string> = {
    ready: "bg-tone-sage-bg text-tone-sage-fg",
    warn: "bg-tone-honey-bg text-tone-honey-fg",
    missing: "bg-destructive/10 text-destructive",
    unknown: "bg-tone-slate-bg text-muted-foreground",
  };

  const addIPRule = async () => {
    if (!form.ipAddress) { toast.error("IP address required"); return; }
    const res = await fetch("/api/security", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add_ip_rule", ...form }) });
    if (res.ok) { toast.success("IP rule added"); setShowForm(false); setForm({ ipAddress: "", type: "BLACKLIST", reason: "", expiresAt: "" }); load(); }
    else { const d = await res.json(); toast.error(d.error || "Failed"); }
  };

  const deleteIPRule = async (id: string) => {
    if (!confirm("Delete this rule?")) return;
    await fetch("/api/security", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete_ip_rule", id }) });
    toast.success("Deleted"); load();
  };

  const toggleIPRule = async (id: string) => {
    await fetch("/api/security", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggle_ip_rule", id }) });
    load();
  };

  const updateGDPR = async (id: string, status: string) => {
    const res = await fetch("/api/security", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update_gdpr", id, status }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || "Failed to update GDPR request");
      return;
    }
    toast.success(`GDPR request ${status.toLowerCase()}`); load();
  };

  const statCards = [
    { label: "IP Rules", value: stats.totalIPRules, icon: Globe, color: "text-tone-sky-fg", bg: "bg-tone-sky-bg" },
    { label: "Whitelisted", value: stats.whitelisted, icon: Shield, color: "text-tone-sage-fg", bg: "bg-tone-sage-bg" },
    { label: "Blacklisted", value: stats.blacklisted, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
    { label: "Blocked Requests", value: stats.blockedRequests, icon: Lock, color: "text-tone-orange-fg", bg: "bg-tone-orange-bg" },
    { label: "GDPR Pending", value: stats.pendingGDPR, icon: FileText, color: "text-tone-foil-fg", bg: "bg-tone-foil-bg" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Security & Compliance</h1>
          <p className="mt-1 text-muted-foreground">IP rules, rate limiting, GDPR requests, and system security baseline</p>
        </div>
        <a href="/security/dashboard" className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          <Shield className="h-4 w-4" /> Security Dashboard
        </a>
      </div>
      <div className="flex items-center justify-end">
        {tab === "ip" && <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4" /> Add IP Rule</button>}
      </div>

      <div className="grid grid-cols-5 gap-4">
        {statCards.map(c => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-muted-foreground">{c.label}</p><p className="mt-1 text-2xl font-bold text-foreground">{c.value}</p></div>
              <div className={`rounded-lg p-2.5 ${c.bg}`}><c.icon className={`h-5 w-5 ${c.color}`} /></div>
            </div>
          </div>
        ))}
      </div>

      {readiness && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Security Readiness Baseline</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Live view of preventive controls, detection wiring, and backup recovery readiness.
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${readiness.summary.missingRequired > 0 ? "bg-destructive/10 text-destructive" : "bg-tone-sage-bg text-tone-sage-fg"}`}>
              {readiness.summary.missingRequired > 0 ? "Needs attention" : "Baseline healthy"}
            </span>
          </div>

          <div className="grid grid-cols-5 gap-4">
            {readinessStatCards.map((card) => (
              <div key={card.label} className="rounded-xl border border-border bg-background p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{card.label}</p>
                    <p className="mt-1 text-2xl font-bold text-foreground">{card.value}</p>
                  </div>
                  <div className={`rounded-lg p-2.5 ${card.bg}`}><card.icon className={`h-4 w-4 ${card.color}`} /></div>
                </div>
              </div>
            ))}
          </div>

          {readiness.missingRequiredKeys.length > 0 && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
              <p className="text-sm font-medium text-destructive">Missing required controls</p>
              <p className="mt-2 text-sm text-muted-foreground">{readiness.missingRequiredKeys.join(", ")}</p>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-3">
            {readiness.groups.map((group) => (
              <div key={group.id} className="rounded-xl border border-border bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-foreground">{group.label}</h3>
                  <span className="text-xs text-muted-foreground">{group.checks.length} checks</span>
                </div>
                <div className="mt-4 space-y-3">
                  {group.checks.map((check) => (
                    <div key={check.key} className="rounded-lg border border-border bg-card p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">{check.label}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClasses[check.status]}`}>{check.status}</span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">{check.detail}</p>
                      <p className="mt-2 text-[11px] uppercase tracking-wide text-muted-foreground">Source: {check.source}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
            <span>Last snapshot: {new Date(readiness.generatedAt).toLocaleString()}</span>
            <span>
              Last backup: {readiness.lastBackup ? `${new Date(readiness.lastBackup.createdAt).toLocaleString()} · ${readiness.lastBackup.type}` : "No completed backup"}
            </span>
          </div>
        </div>
      )}

      <div className="flex gap-2 border-b border-border">
        {([["ip", "IP Rules"], ["ratelimit", "Rate Limits"], ["gdpr", "GDPR Requests"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key as any)} className={`px-4 py-2 text-sm font-medium border-b-2 transition ${tab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{label}</button>
        ))}
      </div>

      {showForm && tab === "ip" && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Add IP Rule</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-muted-foreground mb-1">IP Address</label><input value={form.ipAddress} onChange={e => setForm({ ...form, ipAddress: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" placeholder="192.168.1.1" /></div>
            <div><label className="block text-sm font-medium text-muted-foreground mb-1">Type</label><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"><option value="BLACKLIST">Blacklist</option><option value="WHITELIST">Whitelist</option></select></div>
            <div><label className="block text-sm font-medium text-muted-foreground mb-1">Reason</label><input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" placeholder="Reason..." /></div>
            <div><label className="block text-sm font-medium text-muted-foreground mb-1">Expires At (optional)</label><input type="datetime-local" value={form.expiresAt} onChange={e => setForm({ ...form, expiresAt: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" /></div>
          </div>
          <div className="flex gap-2"><button onClick={addIPRule} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Add Rule</button><button onClick={() => setShowForm(false)} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-accent">Cancel</button></div>
        </div>
      )}

      {tab === "ip" && (
        <div className="rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="px-4 py-3 font-medium">IP Address</th><th className="px-4 py-3 font-medium">Type</th><th className="px-4 py-3 font-medium">Reason</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Expires</th><th className="px-4 py-3 font-medium w-24">Actions</th></tr></thead>
            <tbody>
              {ipRules.length === 0 ? (<tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No IP rules</td></tr>) : ipRules.map(r => (
                <tr key={r.id} className="border-b border-border hover:bg-accent/30">
                  <td className="px-4 py-3 font-mono text-foreground">{r.ipAddress}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.type === "BLACKLIST" ? "bg-destructive/10 text-destructive" : "bg-tone-sage-bg text-tone-sage-fg"}`}>{r.type}</span></td>
                  <td className="px-4 py-3 text-muted-foreground">{r.reason || "—"}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.isActive ? "bg-tone-sage-bg text-tone-sage-fg" : "bg-tone-slate-bg text-muted-foreground"}`}>{r.isActive ? "Active" : "Inactive"}</span></td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{r.expiresAt ? new Date(r.expiresAt).toLocaleString() : "Never"}</td>
                  <td className="px-4 py-3 flex gap-1">
                    <button onClick={() => toggleIPRule(r.id)} className="rounded p-1 text-muted-foreground hover:bg-accent">{r.isActive ? <ToggleRight className="h-4 w-4 text-tone-sage-fg" /> : <ToggleLeft className="h-4 w-4" />}</button>
                    <button onClick={() => deleteIPRule(r.id)} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "ratelimit" && (
        <div className="rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="px-4 py-3 font-medium">IP Address</th><th className="px-4 py-3 font-medium">Endpoint</th><th className="px-4 py-3 font-medium">Requests</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Window</th></tr></thead>
            <tbody>
              {rateLimitLogs.length === 0 ? (<tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No blocked requests</td></tr>) : rateLimitLogs.map(l => (
                <tr key={l.id} className="border-b border-border hover:bg-accent/30">
                  <td className="px-4 py-3 font-mono text-foreground">{l.ipAddress}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{l.endpoint}</td>
                  <td className="px-4 py-3 text-foreground font-medium">{l.count}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">Blocked</span></td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(l.windowStart).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "gdpr" && (
        <div className="rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="px-4 py-3 font-medium">User ID</th><th className="px-4 py-3 font-medium">Type</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Requested</th><th className="px-4 py-3 font-medium">Completed</th><th className="px-4 py-3 font-medium w-32">Actions</th></tr></thead>
            <tbody>
              {gdprRequests.length === 0 ? (<tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No GDPR requests</td></tr>) : gdprRequests.map(r => (
                <tr key={r.id} className="border-b border-border hover:bg-accent/30">
                  <td className="px-4 py-3 font-mono text-foreground text-xs">{r.userId}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{r.type}</span></td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.status === "COMPLETED" ? "bg-tone-sage-bg text-tone-sage-fg" : r.status === "PENDING" ? "bg-tone-honey-bg text-tone-honey-fg" : r.status === "PROCESSING" ? "bg-tone-sky-bg text-tone-sky-fg" : "bg-destructive/10 text-destructive"}`}>{r.status}</span></td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{r.completedAt ? new Date(r.completedAt).toLocaleString() : "—"}</td>
                  <td className="px-4 py-3">
                    {r.status === "PENDING" && (
                      <div className="flex gap-1">
                        <button onClick={() => updateGDPR(r.id, "PROCESSING")} className="rounded px-2 py-1 text-xs bg-tone-sky-bg text-tone-sky-fg hover:bg-tone-sky-bg">Process</button>
                        {r.type !== "DELETE" && (
                          <button onClick={() => updateGDPR(r.id, "COMPLETED")} className="rounded px-2 py-1 text-xs bg-tone-sage-bg text-tone-sage-fg hover:bg-tone-sage-bg">Complete</button>
                        )}
                        <button onClick={() => updateGDPR(r.id, "REJECTED")} className="rounded px-2 py-1 text-xs bg-destructive/10 text-destructive hover:bg-destructive/20">Reject</button>
                      </div>
                    )}
                    {r.status === "PROCESSING" && (
                      r.type === "DELETE"
                        ? <span className="text-xs text-muted-foreground">Auto-completes after staged cleanup</span>
                        : <button onClick={() => updateGDPR(r.id, "COMPLETED")} className="rounded px-2 py-1 text-xs bg-tone-sage-bg text-tone-sage-fg hover:bg-tone-sage-bg">Complete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
