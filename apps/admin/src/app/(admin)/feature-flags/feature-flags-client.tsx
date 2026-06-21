"use client";

import { useState, useEffect } from "react";
import { Flag, Plus, Trash2, ToggleLeft, ToggleRight, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { PasswordConfirmModal, type StepUpValues } from "@/components/password-confirm-modal";
import { AdminPageHeader } from "@/components/admin-page-header";
import { EmptyState } from "@/components/empty-state";

interface FeatureFlag { id: string; name: string; description: string | null; enabled: boolean; targetType: string; targetValue: string | null; createdAt: string }
const TARGET_TYPES = ["ALL", "PERCENTAGE", "USER_LIST", "PLAN"];
interface StepUpRequest { title: string; description: string; confirmLabel: string; run: (values: StepUpValues) => Promise<boolean> }

export default function FeatureFlagsClient() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<FeatureFlag | null>(null);
  const [form, setForm] = useState({ name: "", description: "", enabled: false, targetType: "ALL", targetValue: "" });
  const [stepUp, setStepUp] = useState<StepUpRequest | null>(null);
  const [stepUpBusy, setStepUpBusy] = useState(false);
  const [stepUpError, setStepUpError] = useState<string | null>(null);

  const load = () => { fetch("/api/feature-flags").then(r => r.json()).then(d => setFlags(d.flags || [])).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const requestStepUp = (request: StepUpRequest) => { setStepUp(request); setStepUpError(null); };
  const closeStepUp = () => { if (!stepUpBusy) { setStepUp(null); setStepUpError(null); } };
  const confirmStepUp = async (_confirmPassword: string, values: StepUpValues) => {
    if (!stepUp) return;
    setStepUpBusy(true);
    setStepUpError(null);
    try {
      const ok = await stepUp.run(values);
      if (ok) setStepUp(null);
    } finally {
      setStepUpBusy(false);
    }
  };

  const sendMutation = async (
    method: "POST" | "PUT" | "DELETE",
    payload: Record<string, unknown>,
    stepUpValues: StepUpValues,
    successMessage: string,
    afterSuccess?: () => void,
  ) => {
    const res = await fetch("/api/feature-flags", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, ...stepUpValues }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = data.error || "Failed";
      if (data.requiresPassword || res.status === 401 || res.status === 403) setStepUpError(message);
      toast.error(message);
      return false;
    }
    toast.success(successMessage);
    afterSuccess?.();
    load();
    return true;
  };

  const save = async () => {
    if (!form.name && !editing) { toast.error("Name required"); return; }
    const method = editing ? "PUT" : "POST";
    let tv: any = undefined;
    if (form.targetType === "PERCENTAGE") {
      const percentage = Number(form.targetValue);
      if (!Number.isInteger(percentage) || percentage < 0 || percentage > 100) {
        toast.error("Percentage must be an integer from 0 to 100");
        return;
      }
      tv = { percentage };
    } else if (form.targetType === "USER_LIST") {
      const userIds = form.targetValue.split(",").map(s => s.trim()).filter(Boolean);
      if (userIds.length === 0) {
        toast.error("Enter at least one user ID");
        return;
      }
      tv = { userIds };
    } else if (form.targetType === "PLAN") {
      const plans = form.targetValue.split(",").map(s => s.trim()).filter(Boolean);
      if (plans.length === 0) {
        toast.error("Enter at least one plan");
        return;
      }
      tv = { plans };
    }

    const payload = editing ? { id: editing.id, enabled: form.enabled, description: form.description, targetType: form.targetType, targetValue: tv } : { ...form, targetValue: tv };
    requestStepUp({
      title: editing ? "Confirm feature flag update" : "Confirm feature flag creation",
      description: "Enter your admin password and MFA code or backup code before changing feature flag behavior.",
      confirmLabel: editing ? "Update flag" : "Create flag",
      run: (values) => sendMutation(method, payload, values, editing ? "Updated" : "Created", reset),
    });
  };

  const toggle = async (flag: FeatureFlag) => {
    requestStepUp({
      title: `${!flag.enabled ? "Enable" : "Disable"} feature flag`,
      description: "Enter your admin password and MFA code or backup code before changing feature flag rollout.",
      confirmLabel: !flag.enabled ? "Enable flag" : "Disable flag",
      run: (values) => sendMutation("PUT", { id: flag.id, enabled: !flag.enabled }, values, `${flag.name} ${!flag.enabled ? "enabled" : "disabled"}`),
    });
  };

  const remove = async (id: string) => {
    requestStepUp({
      title: "Confirm feature flag deletion",
      description: "Enter your admin password and MFA code or backup code before deleting this feature flag.",
      confirmLabel: "Delete flag",
      run: (values) => sendMutation("DELETE", { id }, values, "Deleted"),
    });
  };

  const startEdit = (f: FeatureFlag) => {
    setEditing(f);
    let tv = "";
    if (f.targetValue) { try { const p = JSON.parse(f.targetValue); tv = p.percentage?.toString() || p.userIds?.join(", ") || p.plans?.join(", ") || ""; } catch {} }
    setForm({ name: f.name, description: f.description || "", enabled: f.enabled, targetType: f.targetType, targetValue: tv });
    setShowForm(true);
  };

  const reset = () => { setEditing(null); setShowForm(false); setForm({ name: "", description: "", enabled: false, targetType: "ALL", targetValue: "" }); };

  return (
    <div className="space-y-6">
      <PasswordConfirmModal
        open={Boolean(stepUp)}
        title={stepUp?.title || "Confirm action"}
        description={stepUp?.description || "Enter your admin password to continue."}
        confirmLabel={stepUp?.confirmLabel || "Confirm"}
        busy={stepUpBusy}
        error={stepUpError}
        requiresMfa={true}
        onClose={closeStepUp}
        onConfirm={confirmStepUp}
      />

      <AdminPageHeader
        eyebrow="System"
        title="Feature <em>Flags</em>"
        subtitle="Toggle features and manage rollouts"
        actions={
          <button onClick={() => { reset(); setShowForm(true); }} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"><Plus className="h-4 w-4" /> New Flag</button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "Total Flags", value: flags.length, color: "text-foreground", bg: "bg-card" },
          { label: "Enabled", value: flags.filter(f => f.enabled).length, color: "text-tone-sage-fg", bg: "bg-tone-sage-bg" },
          { label: "Disabled", value: flags.filter(f => !f.enabled).length, color: "text-destructive", bg: "bg-tone-slate-bg" },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl border border-border ${s.bg} p-5`}>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{s.label}</p>
            <p className={`mt-1.5 font-display text-3xl font-extrabold leading-none ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-foreground">{editing ? "Edit Flag" : "New Feature Flag"}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Name</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} disabled={!!editing} className="w-full rounded-xl border border-input bg-background px-3 py-2 font-mono text-sm text-foreground disabled:opacity-50" placeholder="feature_new_dashboard" /></div>
            <div><label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Target Type</label><select value={form.targetType} onChange={e => setForm({ ...form, targetType: e.target.value })} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground">{TARGET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
            <div className="sm:col-span-2"><label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Description</label><input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground" placeholder="Description..." /></div>
            {form.targetType !== "ALL" && (
              <div className="sm:col-span-2"><label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{form.targetType === "PERCENTAGE" ? "Percentage (0-100)" : form.targetType === "USER_LIST" ? "User IDs (comma-separated)" : "Plans (comma-separated)"}</label><input value={form.targetValue} onChange={e => setForm({ ...form, targetValue: e.target.value })} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground" /></div>
            )}
            <div><label className="flex items-center gap-2 text-sm cursor-pointer text-foreground"><input type="checkbox" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} className="accent-primary" /> Enabled</label></div>
          </div>
          <div className="flex gap-2"><button onClick={save} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">{editing ? "Update" : "Create"}</button><button onClick={reset} className="rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">Cancel</button></div>
        </div>
      )}

      <div className="space-y-3">
        {loading ? <div className="py-20 text-center text-sm text-muted-foreground">Loading flags...</div> : flags.length === 0 ? <div className="rounded-2xl border border-dashed border-border bg-card"><EmptyState icon={Flag} title="No feature flags yet" description="Create your first feature flag to control rollouts." /></div> : flags.map(f => (
          <div key={f.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-accent/30">
            <div className="flex items-center gap-4">
              <button onClick={() => toggle(f)} aria-label={f.enabled ? "Disable flag" : "Enable flag"} aria-pressed={f.enabled} className="transition-colors">{f.enabled ? <ToggleRight className="h-7 w-7 text-tone-sage-fg" /> : <ToggleLeft className="h-7 w-7 text-muted-foreground" />}</button>
              <div>
                <div className="flex items-center gap-2"><p className="font-mono font-medium text-foreground">{f.name}</p><span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${f.enabled ? "bg-tone-sage-bg text-tone-sage-fg" : "bg-tone-slate-bg text-muted-foreground"}`}><span className={`h-1.5 w-1.5 rounded-full ${f.enabled ? "bg-tone-sage-fg" : "bg-muted-foreground"}`} />{f.enabled ? "ON" : "OFF"}</span></div>
                {f.description && <p className="mt-0.5 text-xs text-muted-foreground">{f.description}</p>}
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="text-[10px] font-medium uppercase tracking-[0.18em]">Target</span>
                  <span className="font-mono text-foreground">{f.targetType}</span>
                  {f.targetValue && <span className="font-mono text-[10px]">{f.targetValue.length > 50 ? f.targetValue.slice(0, 50) + "..." : f.targetValue}</span>}
                </div>
              </div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => startEdit(f)} aria-label="Edit flag" className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"><Edit2 className="h-4 w-4" /></button>
              <button onClick={() => remove(f.id)} aria-label="Delete flag" className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
