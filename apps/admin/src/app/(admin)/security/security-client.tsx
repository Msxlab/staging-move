"use client";

import { useState, useEffect } from "react";
import { Lock, Shield, Plus, Trash2, ToggleLeft, ToggleRight, AlertTriangle, Globe, FileText, CheckCircle2, CircleHelp, TriangleAlert, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { PasswordConfirmModal, type StepUpValues } from "@/components/password-confirm-modal";
import { AdminPageHeader } from "@/components/admin-page-header";

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
interface StepUpRequest { title: string; description: string; confirmLabel: string; run: (values: StepUpValues) => Promise<boolean> }

export default function SecurityClient() {
  const [ipRules, setIpRules] = useState<IPRule[]>([]);
  const [rateLimitLogs, setRateLimitLogs] = useState<RateLimitLog[]>([]);
  const [gdprRequests, setGdprRequests] = useState<GDPRRequest[]>([]);
  const [readiness, setReadiness] = useState<SecurityReadiness | null>(null);
  const [stats, setStats] = useState<Stats>({ totalIPRules: 0, whitelisted: 0, blacklisted: 0, blockedRequests: 0, pendingGDPR: 0, totalGDPR: 0 });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"ip" | "ratelimit" | "gdpr">("ip");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ipAddress: "", type: "BLACKLIST", reason: "", expiresAt: "", breakGlass: false });
  const [stepUp, setStepUp] = useState<StepUpRequest | null>(null);
  const [stepUpBusy, setStepUpBusy] = useState(false);
  const [stepUpError, setStepUpError] = useState<string | null>(null);
  const [stepUpRequiresMfa, setStepUpRequiresMfa] = useState(false);
  const [currentAdminRole, setCurrentAdminRole] = useState<string | null>(null);
  // Readiness baseline (groups + 5 stat cards + check details) is dense
  // and rarely needed. Default closed; the always-visible summary header
  // still surfaces "Needs attention" so missing controls aren't hidden.
  const [readinessOpen, setReadinessOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => setCurrentAdminRole(typeof data?.admin?.role === "string" ? data.admin.role : null))
      .catch(() => null);
  }, []);

  const isSuperAdmin = currentAdminRole === "SUPER_ADMIN";

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

  const requestStepUp = (request: StepUpRequest) => { setStepUp(request); setStepUpError(null); setStepUpRequiresMfa(false); };
  const closeStepUp = () => { if (!stepUpBusy) { setStepUp(null); setStepUpError(null); setStepUpRequiresMfa(false); } };
  const confirmStepUp = async (_confirmPassword: string, values: StepUpValues) => {
    if (!stepUp) return;
    setStepUpBusy(true);
    setStepUpError(null);
    try {
      const ok = await stepUp.run(values);
      if (ok) {
        setStepUp(null);
        setStepUpRequiresMfa(false);
      }
    } finally {
      setStepUpBusy(false);
    }
  };

  const runSecurityMutation = async (
    requestBody: Record<string, unknown>,
    values: StepUpValues,
    successMessage: string | null,
    afterSuccess?: () => void,
  ) => {
    const res = await fetch("/api/security", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...requestBody,
        confirmPassword: values.confirmPassword,
        mfaCode: values.mfaCode,
        backupCode: values.backupCode,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = data.error || "Failed";
      if (data.requiresMfa) {
        setStepUpRequiresMfa(true);
        setStepUpError("Enter an authenticator code or backup code for this security action.");
      } else if (data.requiresPassword || res.status === 401 || res.status === 403) {
        setStepUpRequiresMfa(false);
        setStepUpError(message);
      }
      toast.error(message);
      return false;
    }
    if (successMessage) toast.success(successMessage);
    afterSuccess?.();
    load();
    return true;
  };

  const addIPRule = async () => {
    if (!form.ipAddress) { toast.error("IP address required"); return; }
    if (form.type === "WHITELIST" && !isSuperAdmin) {
      toast.error("Only SUPER_ADMIN can create whitelist rules.");
      return;
    }
    if (form.type === "WHITELIST" && !form.breakGlass) {
      toast.error("Confirm the break-glass acknowledgement before creating a whitelist rule.");
      return;
    }
    // Backend requires `breakGlass:true` (and SUPER_ADMIN) for any
    // active WHITELIST mutation; otherwise the rule cannot be created
    // and the admin would see a generic 403. We forward the flag only
    // when the operator has explicitly checked the acknowledgement.
    const payload: Record<string, unknown> = { action: "add_ip_rule", ipAddress: form.ipAddress, type: form.type, reason: form.reason, expiresAt: form.expiresAt };
    if (form.type === "WHITELIST") payload.breakGlass = true;
    const description = form.type === "WHITELIST"
      ? "You are creating an active whitelist rule. Confirm with admin password and MFA — get the IP wrong and SUPER_ADMINs can still reach /login (break-glass), but every other admin path will refuse non-whitelisted IPs."
      : "Enter your admin password plus an authenticator or backup code before adding an IP rule.";
    requestStepUp({
      title: form.type === "WHITELIST" ? "Confirm whitelist break-glass" : "Confirm IP rule change",
      description,
      confirmLabel: form.type === "WHITELIST" ? "Add whitelist rule" : "Add IP rule",
      run: (values) => runSecurityMutation(payload, values, "IP rule added", () => {
        setShowForm(false);
        setForm({ ipAddress: "", type: "BLACKLIST", reason: "", expiresAt: "", breakGlass: false });
      }),
    });
  };

  const deleteIPRule = async (rule: IPRule) => {
    requestStepUp({
      title: "Confirm IP rule deletion",
      description: "Enter your admin password plus an authenticator or backup code before deleting this IP rule.",
      confirmLabel: "Delete rule",
      run: (values) => runSecurityMutation({ action: "delete_ip_rule", id: rule.id }, values, "Deleted"),
    });
  };

  const toggleIPRule = async (rule: IPRule) => {
    // Re-enabling an inactive WHITELIST also requires SUPER_ADMIN +
    // breakGlass on the server; surface that to non-SUPER_ADMINs early
    // rather than letting the server 403 with a generic error.
    if (rule.type === "WHITELIST" && !rule.isActive && !isSuperAdmin) {
      toast.error("Only SUPER_ADMIN can re-enable a whitelist rule.");
      return;
    }
    const reactivating = rule.type === "WHITELIST" && !rule.isActive;
    const body: Record<string, unknown> = { action: "toggle_ip_rule", id: rule.id };
    if (reactivating) body.breakGlass = true;
    requestStepUp({
      title: reactivating ? "Confirm whitelist re-activation" : "Confirm IP rule toggle",
      description: reactivating
        ? "Re-activating a whitelist rule requires SUPER_ADMIN break-glass acknowledgement. Confirm with admin password and MFA."
        : "Enter your admin password plus an authenticator or backup code before changing this IP rule status.",
      confirmLabel: reactivating ? "Re-activate whitelist" : "Update rule",
      run: (values) => runSecurityMutation(body, values, null),
    });
  };

  const updateGDPR = async (id: string, status: string) => {
    requestStepUp({
      title: "Confirm GDPR status change",
      description: "Enter your admin password plus an authenticator or backup code before updating this GDPR request.",
      confirmLabel: "Update request",
      run: (values) => runSecurityMutation(
        { action: "update_gdpr", id, status },
        values,
        `GDPR request ${status.toLowerCase()}`,
      ),
    });
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
      <PasswordConfirmModal
        open={Boolean(stepUp)}
        title={stepUp?.title || "Confirm action"}
        description={stepUp?.description || "Enter your admin password to continue."}
        confirmLabel={stepUp?.confirmLabel || "Confirm"}
        busy={stepUpBusy}
        error={stepUpError}
        requiresMfa={stepUpRequiresMfa}
        onClose={closeStepUp}
        onConfirm={confirmStepUp}
      />

      <AdminPageHeader
        eyebrow="Security"
        title="Security & <em>Compliance</em>"
        subtitle="IP rules, rate limiting, GDPR requests, and system security baseline"
        actions={
          <>
            <a href="/security/dashboard" className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
              <Shield className="h-4 w-4" /> Security Dashboard
            </a>
          </>
        }
      />
      <div className="flex items-center justify-end">
        {tab === "ip" && <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"><Plus className="h-4 w-4" /> Add IP Rule</button>}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {statCards.map(c => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{c.label}</p>
                <p className={`mt-1.5 font-display text-3xl font-extrabold leading-none ${c.color}`}>{c.value}</p>
              </div>
              <div className={`rounded-xl p-2.5 ${c.bg}`}><c.icon className={`h-5 w-5 ${c.color}`} /></div>
            </div>
          </div>
        ))}
      </div>

      {readiness && (
        <div className="rounded-2xl border border-border bg-card">
          <button
            type="button"
            onClick={() => setReadinessOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-4 p-5 text-left transition-colors hover:bg-accent/40"
          >
            <div className="flex items-center gap-3">
              {readinessOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Baseline</p>
                <h2 className="mt-1 font-display text-lg font-bold text-foreground">Security Readiness Baseline</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  <span className="font-mono">{readiness.summary.ready}</span> ready · <span className="font-mono">{readiness.summary.warn}</span> warning{readiness.summary.warn === 1 ? "" : "s"} · <span className="font-mono">{readiness.summary.missing}</span> missing
                  {readiness.summary.missingRequired > 0 ? <> · <span className="font-mono">{readiness.summary.missingRequired}</span> required missing</> : ""}
                </p>
              </div>
            </div>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ${readiness.summary.missingRequired > 0 ? "bg-destructive/10 text-destructive" : "bg-tone-sage-bg text-tone-sage-fg"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${readiness.summary.missingRequired > 0 ? "bg-destructive" : "bg-tone-sage-fg"}`} />
              {readiness.summary.missingRequired > 0 ? "Needs attention" : "Baseline healthy"}
            </span>
          </button>

          {readinessOpen && (
            <div className="border-t border-border p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
                {readinessStatCards.map((card) => (
                  <div key={card.label} className="rounded-2xl border border-border bg-background p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{card.label}</p>
                        <p className={`mt-1.5 font-display text-2xl font-extrabold leading-none ${card.color}`}>{card.value}</p>
                      </div>
                      <div className={`rounded-xl p-2.5 ${card.bg}`}><card.icon className={`h-4 w-4 ${card.color}`} /></div>
                    </div>
                  </div>
                ))}
              </div>

              {readiness.missingRequiredKeys.length > 0 && (
                <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
                  <p className="font-display text-sm font-bold text-destructive">Missing required controls</p>
                  <p className="mt-2 font-mono text-xs text-muted-foreground">{readiness.missingRequiredKeys.join(", ")}</p>
                </div>
              )}

              <div className="grid gap-4 lg:grid-cols-3">
                {readiness.groups.map((group) => (
                  <div key={group.id} className="rounded-2xl border border-border bg-background p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-display text-sm font-bold text-foreground">{group.label}</h3>
                      <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground"><span className="font-mono normal-case tracking-normal">{group.checks.length}</span> checks</span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {group.checks.map((check) => (
                        <div key={check.key} className="rounded-xl border border-border bg-card p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium text-foreground">{check.label}</p>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClasses[check.status]}`}>{check.status}</span>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-muted-foreground">{check.detail}</p>
                          <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Source: <span className="font-mono normal-case tracking-normal text-muted-foreground">{check.source}</span></p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                <span>Last snapshot: <span className="font-mono text-foreground">{new Date(readiness.generatedAt).toLocaleString()}</span></span>
                <span>
                  Last backup: {readiness.lastBackup ? <span className="font-mono text-foreground">{`${new Date(readiness.lastBackup.createdAt).toLocaleString()} · ${readiness.lastBackup.type}`}</span> : "No completed backup"}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 border-b border-border">
        {([["ip", "IP Rules"], ["ratelimit", "Rate Limits"], ["gdpr", "GDPR Requests"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key as any)} className={`border-b-2 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] transition-colors ${tab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{label}</button>
        ))}
      </div>

      {showForm && tab === "ip" && (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-foreground">Add IP Rule</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">IP Address</label><input value={form.ipAddress} onChange={e => setForm({ ...form, ipAddress: e.target.value })} className="w-full rounded-xl border border-input bg-background px-3 py-2 font-mono text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="192.168.1.1" /></div>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Type</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value, breakGlass: false })} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
                <option value="BLACKLIST">Blacklist</option>
                <option value="WHITELIST" disabled={!isSuperAdmin}>Whitelist {isSuperAdmin ? "" : "(SUPER_ADMIN only)"}</option>
              </select>
            </div>
            <div><label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Reason</label><input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="Reason..." /></div>
            <div><label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Expires At (optional)</label><input type="datetime-local" value={form.expiresAt} onChange={e => setForm({ ...form, expiresAt: e.target.value })} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" /></div>
          </div>

          {form.type === "WHITELIST" && (
            <div className="rounded-2xl border border-tone-honey-br bg-tone-honey-bg p-4 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-tone-honey-fg" />
                <p className="text-xs text-foreground">
                  Once any active whitelist exists, every admin path is deny-by-default for IPs that don&apos;t match. <strong>/login, /api/auth/login and /api/healthz remain reachable</strong> via the break-glass bypass so you can recover from a wrong rule, but every other admin route will refuse non-whitelisted IPs immediately. Verify the IP/CIDR is correct before confirming.
                </p>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={form.breakGlass}
                  onChange={(e) => setForm({ ...form, breakGlass: e.target.checked })}
                  className="accent-primary"
                />
                I understand this is a break-glass operation and accept the risk.
              </label>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={addIPRule}
              disabled={form.type === "WHITELIST" && (!isSuperAdmin || !form.breakGlass)}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              Add Rule
            </button>
            <button onClick={() => setShowForm(false)} className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">Cancel</button>
          </div>
        </div>
      )}

      {tab === "ip" && (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50"><tr className="text-left"><th className="px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">IP Address</th><th className="px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Type</th><th className="px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Reason</th><th className="px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Status</th><th className="px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Expires</th><th className="w-24 px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Actions</th></tr></thead>
            <tbody className="divide-y divide-border">
              {ipRules.length === 0 ? (<tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No IP rules</td></tr>) : ipRules.map(r => (
                <tr key={r.id} className="bg-card transition-colors hover:bg-accent/40">
                  <td className="px-4 py-3 font-mono text-foreground">{r.ipAddress}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.type === "BLACKLIST" ? "bg-destructive/10 text-destructive" : "bg-tone-sage-bg text-tone-sage-fg"}`}>{r.type}</span></td>
                  <td className="px-4 py-3 text-muted-foreground">{r.reason || "—"}</td>
                  <td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${r.isActive ? "bg-tone-sage-bg text-tone-sage-fg" : "bg-tone-slate-bg text-muted-foreground"}`}><span className={`h-1.5 w-1.5 rounded-full ${r.isActive ? "bg-tone-sage-fg" : "bg-muted-foreground"}`} />{r.isActive ? "Active" : "Inactive"}</span></td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.expiresAt ? new Date(r.expiresAt).toLocaleString() : "Never"}</td>
                  <td className="px-4 py-3"><div className="flex gap-1">
                    <button onClick={() => toggleIPRule(r)} aria-label={r.isActive ? "Deactivate IP rule" : "Activate IP rule"} aria-pressed={r.isActive} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">{r.isActive ? <ToggleRight className="h-4 w-4 text-tone-sage-fg" /> : <ToggleLeft className="h-4 w-4" />}</button>
                    <button onClick={() => deleteIPRule(r)} aria-label="Delete IP rule" className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "ratelimit" && (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50"><tr className="text-left"><th className="px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">IP Address</th><th className="px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Endpoint</th><th className="px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Requests</th><th className="px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Status</th><th className="px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Window</th></tr></thead>
            <tbody className="divide-y divide-border">
              {rateLimitLogs.length === 0 ? (<tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No blocked requests</td></tr>) : rateLimitLogs.map(l => (
                <tr key={l.id} className="bg-card transition-colors hover:bg-accent/40">
                  <td className="px-4 py-3 font-mono text-foreground">{l.ipAddress}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{l.endpoint}</td>
                  <td className="px-4 py-3 font-mono font-medium text-foreground">{l.count}</td>
                  <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive"><span className="h-1.5 w-1.5 rounded-full bg-destructive" />Blocked</span></td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{new Date(l.windowStart).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "gdpr" && (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50"><tr className="text-left"><th className="px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">User ID</th><th className="px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Type</th><th className="px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Status</th><th className="px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Requested</th><th className="px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Completed</th><th className="w-32 px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Actions</th></tr></thead>
            <tbody className="divide-y divide-border">
              {gdprRequests.length === 0 ? (<tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No GDPR requests</td></tr>) : gdprRequests.map(r => (
                <tr key={r.id} className="bg-card transition-colors hover:bg-accent/40">
                  <td className="px-4 py-3 font-mono text-xs text-foreground">{r.userId}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{r.type}</span></td>
                  <td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${r.status === "COMPLETED" ? "bg-tone-sage-bg text-tone-sage-fg" : r.status === "PENDING" ? "bg-tone-honey-bg text-tone-honey-fg" : r.status === "PROCESSING" ? "bg-tone-sky-bg text-tone-sky-fg" : "bg-destructive/10 text-destructive"}`}><span className={`h-1.5 w-1.5 rounded-full ${r.status === "COMPLETED" ? "bg-tone-sage-fg" : r.status === "PENDING" ? "bg-tone-honey-fg" : r.status === "PROCESSING" ? "bg-tone-sky-fg" : "bg-destructive"}`} />{r.status}</span></td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.completedAt ? new Date(r.completedAt).toLocaleString() : "—"}</td>
                  <td className="px-4 py-3">
                    {r.status === "PENDING" && (
                      <div className="flex gap-1">
                        <button onClick={() => updateGDPR(r.id, "PROCESSING")} className="rounded-lg bg-tone-sky-bg px-2 py-1 text-xs font-medium text-tone-sky-fg transition-colors hover:bg-tone-sky-bg">Process</button>
                        {r.type !== "DELETE" && (
                          <button onClick={() => updateGDPR(r.id, "COMPLETED")} className="rounded-lg bg-tone-sage-bg px-2 py-1 text-xs font-medium text-tone-sage-fg transition-colors hover:bg-tone-sage-bg">Complete</button>
                        )}
                        <button onClick={() => updateGDPR(r.id, "REJECTED")} className="rounded-lg bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20">Reject</button>
                      </div>
                    )}
                    {r.status === "PROCESSING" && (
                      r.type === "DELETE"
                        ? <span className="text-xs text-muted-foreground">Auto-completes after staged cleanup</span>
                        : <button onClick={() => updateGDPR(r.id, "COMPLETED")} className="rounded-lg bg-tone-sage-bg px-2 py-1 text-xs font-medium text-tone-sage-fg transition-colors hover:bg-tone-sage-bg">Complete</button>
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
