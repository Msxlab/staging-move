"use client";

import { useEffect, useState } from "react";
import { Plug, Plus, ToggleLeft, ToggleRight, Edit2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { PasswordConfirmModal } from "@/components/password-confirm-modal";

interface ConnectorConfig {
  id: string;
  connectorKey: string;
  version: string;
  enabled: boolean;
  rolloutPercent: number;
  circuitState: string;
  stage: string;
  notes: string | null;
  updatedAt: string;
}

const STAGES = ["SHADOW", "ROLLOUT", "GA", "RETIRED"];

interface StepUpRequest {
  title: string;
  description: string;
  confirmLabel: string;
  run: (confirmPassword: string) => Promise<boolean>;
}

const EMPTY_FORM = { connectorKey: "", version: "1.0.0", enabled: false, stage: "SHADOW", rolloutPercent: 0, notes: "" };

export default function ConnectorsClient() {
  const [connectors, setConnectors] = useState<ConnectorConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [dispatchHealth, setDispatchHealth] = useState<Record<string, number>>({});
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ConnectorConfig | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [stepUp, setStepUp] = useState<StepUpRequest | null>(null);
  const [stepUpBusy, setStepUpBusy] = useState(false);
  const [stepUpError, setStepUpError] = useState<string | null>(null);

  const load = () => {
    fetch("/api/connectors")
      .then((r) => r.json())
      .then((d) => {
        setConnectors(d.connectors || []);
        setDispatchHealth(d.dispatchHealth || {});
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);

  const requestStepUp = (request: StepUpRequest) => {
    setStepUp(request);
    setStepUpError(null);
  };
  const closeStepUp = () => {
    if (!stepUpBusy) {
      setStepUp(null);
      setStepUpError(null);
    }
  };
  const confirmStepUp = async (confirmPassword: string) => {
    if (!stepUp) return;
    setStepUpBusy(true);
    setStepUpError(null);
    try {
      const ok = await stepUp.run(confirmPassword);
      if (ok) setStepUp(null);
    } finally {
      setStepUpBusy(false);
    }
  };

  const sendMutation = async (
    url: string,
    method: "POST" | "PUT",
    payload: Record<string, unknown>,
    confirmPassword: string,
    successMessage: string,
    afterSuccess?: () => void,
  ) => {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, confirmPassword }),
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

  const reset = () => {
    setEditing(null);
    setShowForm(false);
    setForm({ ...EMPTY_FORM });
  };

  const save = () => {
    if (!editing && !/^[a-z][a-z0-9-]*$/.test(form.connectorKey)) {
      toast.error("connectorKey must be lowercase kebab-case");
      return;
    }
    const method = editing ? "PUT" : "POST";
    const payload = editing
      ? { connectorKey: editing.connectorKey, enabled: form.enabled, rolloutPercent: form.rolloutPercent, stage: form.stage, notes: form.notes }
      : { ...form };
    requestStepUp({
      title: editing ? "Confirm connector update" : "Register connector",
      description: "Enter your admin password before changing connector behavior.",
      confirmLabel: editing ? "Update connector" : "Register",
      run: (pw) => sendMutation("/api/connectors", method, payload, pw, editing ? "Updated" : "Registered", reset),
    });
  };

  const toggle = (c: ConnectorConfig) => {
    requestStepUp({
      title: `${!c.enabled ? "Enable" : "Disable"} connector`,
      description: !c.enabled
        ? "Enabling lets this connector run for eligible users."
        : "Disabling is the kill switch — in-flight work falls back to manual.",
      confirmLabel: !c.enabled ? "Enable" : "Disable (kill switch)",
      run: (pw) =>
        sendMutation("/api/connectors", "PUT", { connectorKey: c.connectorKey, enabled: !c.enabled }, pw, `${c.connectorKey} ${!c.enabled ? "enabled" : "disabled"}`),
    });
  };

  const bulkRevoke = (c: ConnectorConfig) => {
    requestStepUp({
      title: `Revoke all ${c.connectorKey} consents`,
      description: "Security-incident kill switch: revokes every user's grant and zeroes stored tokens. This cannot be undone.",
      confirmLabel: "Revoke all consents",
      run: (pw) =>
        sendMutation("/api/connectors/consents", "POST", { connectorKey: c.connectorKey, reason: "SECURITY_INCIDENT" }, pw, `Revoked ${c.connectorKey} consents`),
    });
  };

  const startEdit = (c: ConnectorConfig) => {
    setEditing(c);
    setForm({ connectorKey: c.connectorKey, version: c.version, enabled: c.enabled, stage: c.stage, rolloutPercent: c.rolloutPercent, notes: c.notes || "" });
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      <PasswordConfirmModal
        open={Boolean(stepUp)}
        title={stepUp?.title || "Confirm action"}
        description={stepUp?.description || "Enter your admin password to continue."}
        confirmLabel={stepUp?.confirmLabel || "Confirm"}
        busy={stepUpBusy}
        error={stepUpError}
        onClose={closeStepUp}
        onConfirm={confirmStepUp}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Connectors</h1>
          <p className="mt-1 text-muted-foreground">Enable, stage, and roll out partner connectors — and kill them fast.</p>
        </div>
        <button onClick={() => { reset(); setShowForm(true); }} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Register
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">Connectors</p><p className="mt-1 text-2xl font-bold text-foreground">{connectors.length}</p></div>
        <div className="rounded-xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">Enabled</p><p className="mt-1 text-2xl font-bold text-tone-sage-fg">{connectors.filter((c) => c.enabled).length}</p></div>
        <div className="rounded-xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">Circuit open</p><p className="mt-1 text-2xl font-bold text-destructive">{connectors.filter((c) => c.circuitState === "OPEN").length}</p></div>
      </div>

      {Object.keys(dispatchHealth).length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-3 text-sm font-medium text-foreground">Dispatch health</p>
          <div className="flex flex-wrap gap-2">
            {["QUEUED", "DISPATCHING", "SUBMITTED", "CONFIRMED", "NEEDS_USER", "FAILED"].map((s) => (
              <span
                key={s}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                  s === "NEEDS_USER" || s === "FAILED"
                    ? "bg-destructive/10 text-destructive"
                    : s === "CONFIRMED"
                      ? "bg-tone-sage-bg text-tone-sage-fg"
                      : "bg-foreground/5 text-muted-foreground"
                }`}
              >
                {s.replace("_", " ").toLowerCase()}: {dispatchHealth[s] ?? 0}
              </span>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">{editing ? `Edit ${editing.connectorKey}` : "Register connector"}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-muted-foreground mb-1">Connector key</label><input value={form.connectorKey} onChange={(e) => setForm({ ...form, connectorKey: e.target.value })} disabled={!!editing} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground disabled:opacity-50" placeholder="usps" /></div>
            <div><label className="block text-sm font-medium text-muted-foreground mb-1">Version</label><input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} disabled={!!editing} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground disabled:opacity-50" placeholder="1.0.0" /></div>
            <div><label className="block text-sm font-medium text-muted-foreground mb-1">Stage</label><select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">{STAGES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-muted-foreground mb-1">Rollout %</label><input type="number" min={0} max={100} value={form.rolloutPercent} onChange={(e) => setForm({ ...form, rolloutPercent: parseInt(e.target.value || "0", 10) })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" /></div>
            <div className="col-span-2"><label className="block text-sm font-medium text-muted-foreground mb-1">Notes</label><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" placeholder="Internal notes..." /></div>
            <div><label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} className="accent-primary" /> Enabled</label></div>
          </div>
          <div className="flex gap-2"><button onClick={save} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">{editing ? "Update" : "Register"}</button><button onClick={reset} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-accent">Cancel</button></div>
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : connectors.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">No connectors registered yet</div>
        ) : (
          connectors.map((c) => (
            <div key={c.id} className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button onClick={() => toggle(c)} className="transition-colors" title={c.enabled ? "Disable (kill switch)" : "Enable"}>
                  {c.enabled ? <ToggleRight className="h-7 w-7 text-tone-sage-fg" /> : <ToggleLeft className="h-7 w-7 text-muted-foreground" />}
                </button>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-background"><Plug className="h-4 w-4 text-muted-foreground" /></div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-mono font-medium text-foreground">{c.connectorKey}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${c.enabled ? "bg-tone-sage-bg text-tone-sage-fg" : "bg-destructive/10 text-destructive"}`}>{c.enabled ? "ON" : "OFF"}</span>
                    <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{c.stage}</span>
                    {c.circuitState !== "CLOSED" && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">{c.circuitState}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>v{c.version}</span>
                    <span>·</span>
                    <span>rollout {c.rolloutPercent}%</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => startEdit(c)} className="rounded p-1.5 text-muted-foreground hover:bg-accent" title="Edit"><Edit2 className="h-4 w-4" /></button>
                <button onClick={() => bulkRevoke(c)} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Revoke all consents (incident)"><ShieldAlert className="h-4 w-4" /></button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
