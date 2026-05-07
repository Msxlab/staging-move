"use client";

import { useState, useEffect } from "react";
import { Flag, Plus, Trash2, ToggleLeft, ToggleRight, Edit2 } from "lucide-react";
import { toast } from "sonner";

interface FeatureFlag { id: string; name: string; description: string | null; enabled: boolean; targetType: string; targetValue: string | null; createdAt: string }
const TARGET_TYPES = ["ALL", "PERCENTAGE", "USER_LIST", "PLAN"];

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<FeatureFlag | null>(null);
  const [form, setForm] = useState({ name: "", description: "", enabled: false, targetType: "ALL", targetValue: "" });

  const load = () => { fetch("/api/feature-flags").then(r => r.json()).then(d => setFlags(d.flags || [])).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name && !editing) { toast.error("Name required"); return; }
    const method = editing ? "PUT" : "POST";
    let tv: any = undefined;
    if (form.targetType === "PERCENTAGE" && form.targetValue) tv = { percentage: parseInt(form.targetValue) };
    else if (form.targetType === "USER_LIST" && form.targetValue) tv = { userIds: form.targetValue.split(",").map(s => s.trim()) };
    else if (form.targetType === "PLAN" && form.targetValue) tv = { plans: form.targetValue.split(",").map(s => s.trim()) };

    const payload = editing ? { id: editing.id, enabled: form.enabled, description: form.description, targetType: form.targetType, targetValue: tv } : { ...form, targetValue: tv };
    const res = await fetch("/api/feature-flags", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) { toast.success(editing ? "Updated" : "Created"); reset(); load(); } else { const d = await res.json(); toast.error(d.error || "Failed"); }
  };

  const toggle = async (flag: FeatureFlag) => {
    const res = await fetch("/api/feature-flags", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: flag.id, enabled: !flag.enabled }) });
    if (res.ok) { toast.success(`${flag.name} ${!flag.enabled ? "enabled" : "disabled"}`); load(); }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this flag?")) return;
    const res = await fetch("/api/feature-flags", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (res.ok) { toast.success("Deleted"); load(); }
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
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold text-foreground">Feature Flags</h1><p className="mt-1 text-muted-foreground">Toggle features and manage rollouts</p></div>
        <button onClick={() => { reset(); setShowForm(true); }} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4" /> New Flag</button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">Total Flags</p><p className="mt-1 text-2xl font-bold text-foreground">{flags.length}</p></div>
        <div className="rounded-xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">Enabled</p><p className="mt-1 text-2xl font-bold text-tone-sage-fg">{flags.filter(f => f.enabled).length}</p></div>
        <div className="rounded-xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">Disabled</p><p className="mt-1 text-2xl font-bold text-destructive">{flags.filter(f => !f.enabled).length}</p></div>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">{editing ? "Edit Flag" : "New Feature Flag"}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-muted-foreground mb-1">Name</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} disabled={!!editing} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground disabled:opacity-50" placeholder="feature_new_dashboard" /></div>
            <div><label className="block text-sm font-medium text-muted-foreground mb-1">Target Type</label><select value={form.targetType} onChange={e => setForm({ ...form, targetType: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">{TARGET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
            <div className="col-span-2"><label className="block text-sm font-medium text-muted-foreground mb-1">Description</label><input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" placeholder="Description..." /></div>
            {form.targetType !== "ALL" && (
              <div className="col-span-2"><label className="block text-sm font-medium text-muted-foreground mb-1">{form.targetType === "PERCENTAGE" ? "Percentage (0-100)" : form.targetType === "USER_LIST" ? "User IDs (comma-separated)" : "Plans (comma-separated)"}</label><input value={form.targetValue} onChange={e => setForm({ ...form, targetValue: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" /></div>
            )}
            <div><label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} className="accent-primary" /> Enabled</label></div>
          </div>
          <div className="flex gap-2"><button onClick={save} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">{editing ? "Update" : "Create"}</button><button onClick={reset} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-accent">Cancel</button></div>
        </div>
      )}

      <div className="space-y-3">
        {loading ? <div className="text-center py-8 text-muted-foreground">Loading...</div> : flags.length === 0 ? <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">No feature flags yet</div> : flags.map(f => (
          <div key={f.id} className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => toggle(f)} className="transition-colors">{f.enabled ? <ToggleRight className="h-7 w-7 text-tone-sage-fg" /> : <ToggleLeft className="h-7 w-7 text-muted-foreground" />}</button>
              <div>
                <div className="flex items-center gap-2"><p className="font-mono font-medium text-foreground">{f.name}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${f.enabled ? "bg-tone-sage-bg text-tone-sage-fg" : "bg-destructive/10 text-destructive"}`}>{f.enabled ? "ON" : "OFF"}</span></div>
                {f.description && <p className="text-xs text-muted-foreground mt-0.5">{f.description}</p>}
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <span>Target: {f.targetType}</span>
                  {f.targetValue && <span className="font-mono text-[10px]">{f.targetValue.length > 50 ? f.targetValue.slice(0, 50) + "..." : f.targetValue}</span>}
                </div>
              </div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => startEdit(f)} className="rounded p-1.5 text-muted-foreground hover:bg-accent"><Edit2 className="h-4 w-4" /></button>
              <button onClick={() => remove(f.id)} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
