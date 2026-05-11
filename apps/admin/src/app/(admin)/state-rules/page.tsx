"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { PasswordConfirmModal } from "@/components/password-confirm-modal";

const US_STATES: Record<string, string> = {
  AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",CT:"Connecticut",
  DE:"Delaware",FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",
  KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",
  MN:"Minnesota",MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",
  NJ:"New Jersey",NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",
  OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",
  TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",WA:"Washington",WV:"West Virginia",
  WI:"Wisconsin",WY:"Wyoming",DC:"District of Columbia",
};

interface StateRule {
  id: string;
  stateCode: string;
  stateName: string;
  dmvRules: string | null;
  voterRegistration: string | null;
  utilityInfo: string | null;
  taxInfo: string | null;
  insuranceRules: string | null;
  commonProviders: string | null;
}

const emptyForm = {
  stateCode: "", stateName: "", dmvRules: "", voterRegistration: "",
  utilityInfo: "", taxInfo: "", insuranceRules: "", commonProviders: "",
};
interface StepUpRequest { title: string; description: string; confirmLabel: string; run: (confirmPassword: string) => Promise<boolean> }

export default function StateRulesPage() {
  const [rules, setRules] = useState<StateRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; code: string } | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [stepUp, setStepUp] = useState<StepUpRequest | null>(null);
  const [stepUpBusy, setStepUpBusy] = useState(false);
  const [stepUpError, setStepUpError] = useState<string | null>(null);

  useEffect(() => { fetchRules(); }, []);

  async function fetchRules() {
    setLoading(true);
    try {
      const res = await fetch("/api/state-rules");
      const data = await res.json();
      setRules(data.rules || []);
    } catch { toast.error("Failed to fetch"); }
    finally { setLoading(false); }
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(rule: StateRule) {
    setEditingId(rule.id);
    setForm({
      stateCode: rule.stateCode, stateName: rule.stateName,
      dmvRules: rule.dmvRules || "", voterRegistration: rule.voterRegistration || "",
      utilityInfo: rule.utilityInfo || "", taxInfo: rule.taxInfo || "",
      insuranceRules: rule.insuranceRules || "", commonProviders: rule.commonProviders || "",
    });
    setShowForm(true);
  }

  function requestStepUp(request: StepUpRequest) {
    setStepUp(request);
    setStepUpError(null);
  }

  function closeStepUp() {
    if (stepUpBusy) return;
    setStepUp(null);
    setStepUpError(null);
  }

  async function confirmStepUp(confirmPassword: string) {
    if (!stepUp) return;
    setStepUpBusy(true);
    setStepUpError(null);
    try {
      const ok = await stepUp.run(confirmPassword);
      if (ok) setStepUp(null);
    } finally {
      setStepUpBusy(false);
    }
  }

  async function saveStateRule(payload: typeof form, confirmPassword: string, targetEditingId: string | null): Promise<boolean> {
    setSaving(true);
    try {
      const url = targetEditingId ? `/api/state-rules/${targetEditingId}` : "/api/state-rules";
      const method = targetEditingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, confirmPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = data.error || "Failed";
        if (data.requiresPassword || res.status === 401 || res.status === 403) setStepUpError(message);
        toast.error(message);
        return false;
      }
      toast.success(targetEditingId ? "State rule updated" : "State rule created");
      setShowForm(false);
      fetchRules();
      return true;
    } catch {
      toast.error("Failed");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form };
    const targetEditingId = editingId;
    requestStepUp({
      title: targetEditingId ? "Confirm state rule update" : "Confirm state rule creation",
      description: "Enter your admin password before changing state rules.",
      confirmLabel: targetEditingId ? "Update rule" : "Create rule",
      run: (confirmPassword) => saveStateRule(payload, confirmPassword, targetEditingId),
    });
  }

  function handleDelete(id: string, code: string) {
    setDeleteConfirmation("");
    setDeleteTarget({ id, code });
  }

  async function confirmDelete() {
    if (!deleteTarget || deleteConfirmation !== deleteTarget.code) return;
    const target = { ...deleteTarget };
    requestStepUp({
      title: "Confirm state rule deletion",
      description: "Enter your admin password before deleting this state rule.",
      confirmLabel: "Delete rule",
      run: (confirmPassword) => deleteStateRule(target, confirmPassword),
    });
  }

  async function deleteStateRule(target: { id: string; code: string }, confirmPassword: string): Promise<boolean> {
    setDeleting(true);
    try {
      const res = await fetch(`/api/state-rules/${target.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = data.error || "Failed to delete";
        if (data.requiresPassword || res.status === 401 || res.status === 403) setStepUpError(message);
        toast.error(message);
        return false;
      }
      toast.success("State rule deleted");
      setDeleteTarget(null);
      setDeleteConfirmation("");
      fetchRules();
      return true;
    } catch {
      toast.error("Failed");
      return false;
    }
    finally { setDeleting(false); }
  }

  return (
    <div className="space-y-6">
      <PasswordConfirmModal
        open={Boolean(stepUp)}
        title={stepUp?.title || "Confirm action"}
        description={stepUp?.description || "Enter your admin password to continue."}
        confirmLabel={stepUp?.confirmLabel || "Confirm"}
        busy={stepUpBusy || saving || deleting}
        error={stepUpError}
        onClose={closeStepUp}
        onConfirm={confirmStepUp}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">State Rules</h1>
          <p className="mt-1 text-muted-foreground">{rules.length} states configured</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Add State
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">{editingId ? "Edit" : "New"} State Rule</h3>
            <button type="button" onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">State Code *</label>
              <select value={form.stateCode} onChange={(e) => setForm({ ...form, stateCode: e.target.value, stateName: US_STATES[e.target.value] || "" })} required disabled={!!editingId} className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-primary focus:outline-none disabled:opacity-50">
                <option value="">Select state...</option>
                {Object.entries(US_STATES).map(([code, name]) => (
                  <option key={code} value={code}>{code} - {name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">State Name</label>
              <input value={form.stateName} onChange={(e) => setForm({ ...form, stateName: e.target.value })} className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-primary focus:outline-none" />
            </div>
          </div>
          {[
            { key: "dmvRules", label: "DMV Rules" },
            { key: "voterRegistration", label: "Voter Registration" },
            { key: "utilityInfo", label: "Utility Info" },
            { key: "taxInfo", label: "Tax Info" },
            { key: "insuranceRules", label: "Insurance Rules" },
            { key: "commonProviders", label: "Common Providers" },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">{label}</label>
              <textarea value={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} rows={3} className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground text-sm focus:border-primary focus:outline-none" />
            </div>
          ))}
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {saving ? "Saving..." : editingId ? "Update" : "Create"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-border px-6 py-2.5 text-sm text-muted-foreground hover:bg-accent">Cancel</button>
          </div>
        </form>
      )}

      {/* Grid */}
      {loading ? (
        <div className="py-12 text-center text-muted-foreground">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rules.map((rule) => (
            <div key={rule.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-foreground">{rule.stateCode}</h3>
                  <p className="text-sm text-muted-foreground">{rule.stateName}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(rule)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" title="Edit">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(rule.id, rule.stateCode)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {rule.dmvRules && <span className="rounded bg-tone-sky-bg px-2 py-0.5 text-xs text-tone-sky-fg">DMV</span>}
                {rule.voterRegistration && <span className="rounded bg-tone-sage-bg px-2 py-0.5 text-xs text-tone-sage-fg">Voter</span>}
                {rule.utilityInfo && <span className="rounded bg-tone-orange-bg px-2 py-0.5 text-xs text-tone-orange-fg">Utility</span>}
                {rule.taxInfo && <span className="rounded bg-tone-foil-bg px-2 py-0.5 text-xs text-tone-foil-fg">Tax</span>}
                {rule.insuranceRules && <span className="rounded bg-destructive/10 px-2 py-0.5 text-xs text-destructive">Insurance</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 backdrop-blur-sm p-4">
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">Delete state rule</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Type {deleteTarget.code} to delete this state rule.
                </p>
              </div>
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 space-y-4">
              <input
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value.toUpperCase().slice(0, 2))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setDeleteTarget(null)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleting || deleteConfirmation !== deleteTarget.code}
                  onClick={() => void confirmDelete()}
                  className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
