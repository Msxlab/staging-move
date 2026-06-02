"use client";

import { useEffect, useState } from "react";
import { Activity, CheckCircle2, Circle, Edit2, Plug, Plus, ShieldAlert, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";
import { PasswordConfirmModal, type StepUpValues } from "@/components/password-confirm-modal";
import { AdminPageHeader } from "@/components/admin-page-header";
import { EmptyState } from "@/components/empty-state";

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

interface AvailableConnector {
  connectorKey: string;
  displayName: string;
  version: string;
  registered: boolean;
  mode: string;
  reason: string;
  agreementStatus: "NONE" | "SANDBOX" | "PRODUCTION";
  credentialsPresent: boolean;
  authType: string;
  allowedHosts: string[];
  addressUpdatePush: boolean;
  fallbackActionKey: string | null;
}

const STAGES = ["SHADOW", "ROLLOUT", "GA", "RETIRED"];

// Honest operating mode, derived server-side via resolveConnectorMode and shown
// as a badge — the same truth the user Connections screen reads. API_SYNC needs
// a signed production agreement, so it can't appear without one.
const MODE_META: Record<string, { label: string; cls: string }> = {
  API_SYNC: { label: "API sync", cls: "bg-tone-sage-bg text-tone-sage-fg" },
  GUIDED_UPDATE: { label: "Guided update", cls: "bg-tone-sky-bg text-tone-sky-fg" },
  COMING_SOON: { label: "Coming soon", cls: "bg-tone-honey-bg text-tone-honey-fg" },
  DISABLED: { label: "Disabled", cls: "bg-foreground/5 text-muted-foreground" },
};

interface ConnectorLastFailure {
  errorCode: string;
  status: string;
  at: string;
}

/** Compact "2h ago" style relative label for the last-failure readout. */
function relativeTime(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

interface StepUpRequest {
  title: string;
  description: string;
  confirmLabel: string;
  run: (values: StepUpValues) => Promise<boolean>;
}

const EMPTY_FORM = { connectorKey: "", version: "1.0.0", enabled: false, stage: "SHADOW", rolloutPercent: 0, notes: "" };

export default function ConnectorsClient() {
  const [connectors, setConnectors] = useState<ConnectorConfig[]>([]);
  const [availableConnectors, setAvailableConnectors] = useState<AvailableConnector[]>([]);
  const [loading, setLoading] = useState(true);
  const [dispatchHealth, setDispatchHealth] = useState<Record<string, number>>({});
  const [dispatchByConnector, setDispatchByConnector] = useState<Record<string, Record<string, number>>>({});
  const [consentsByConnector, setConsentsByConnector] = useState<Record<string, Record<string, number>>>({});
  const [lastFailureByConnector, setLastFailureByConnector] = useState<Record<string, ConnectorLastFailure>>({});
  const [modeByConnector, setModeByConnector] = useState<Record<string, { mode: string; reason: string }>>({});
  const [healthChecks, setHealthChecks] = useState<Record<string, { ok: boolean; reason?: string; detail?: string; running?: boolean }>>({});
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
        setAvailableConnectors(d.availableConnectors || []);
        setDispatchHealth(d.dispatchHealth || {});
        setDispatchByConnector(d.dispatchByConnector || {});
        setConsentsByConnector(d.consentsByConnector || {});
        setLastFailureByConnector(d.lastFailureByConnector || {});
        setModeByConnector(d.modeByConnector || {});
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
    url: string,
    method: "POST" | "PUT",
    payload: Record<string, unknown>,
    stepUpValues: StepUpValues,
    successMessage: string,
    afterSuccess?: () => void,
  ) => {
    const res = await fetch(url, {
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

  const reset = () => {
    setEditing(null);
    setShowForm(false);
    setForm({ ...EMPTY_FORM });
  };

  const startRegister = (available?: AvailableConnector) => {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      connectorKey: available?.connectorKey ?? "",
      version: available?.version ?? EMPTY_FORM.version,
    });
    setShowForm(true);
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
      description: "Enter your admin password and MFA code or backup code before changing connector behavior.",
      confirmLabel: editing ? "Update connector" : "Register",
      run: (values) => sendMutation("/api/connectors", method, payload, values, editing ? "Updated" : "Registered", reset),
    });
  };

  const toggle = (c: ConnectorConfig) => {
    requestStepUp({
      title: `${!c.enabled ? "Enable" : "Disable"} connector`,
      description: !c.enabled
        ? "Enabling lets this connector run for eligible users."
        : "Disabling is the kill switch — in-flight work falls back to manual.",
      confirmLabel: !c.enabled ? "Enable" : "Disable (kill switch)",
      run: (values) =>
        sendMutation("/api/connectors", "PUT", { connectorKey: c.connectorKey, enabled: !c.enabled }, values, `${c.connectorKey} ${!c.enabled ? "enabled" : "disabled"}`),
    });
  };

  const bulkRevoke = (c: ConnectorConfig) => {
    requestStepUp({
      title: `Revoke all ${c.connectorKey} consents`,
      description: "Security-incident kill switch: revokes every user's grant and zeroes stored tokens. Enter MFA or a backup code; this cannot be undone.",
      confirmLabel: "Revoke all consents",
      run: (values) =>
        sendMutation("/api/connectors/consents", "POST", { connectorKey: c.connectorKey, reason: "SECURITY_INCIDENT" }, values, `Revoked ${c.connectorKey} consents`),
    });
  };

  const startEdit = (c: ConnectorConfig) => {
    setEditing(c);
    setForm({ connectorKey: c.connectorKey, version: c.version, enabled: c.enabled, stage: c.stage, rolloutPercent: c.rolloutPercent, notes: c.notes || "" });
    setShowForm(true);
  };

  // Run the connector's tokenless drift canary (health check) on demand. Read-
  // only — no step-up — so an operator can probe a partner before/after a
  // rollout without friction.
  const runHealthCheck = async (key: string) => {
    setHealthChecks((p) => ({ ...p, [key]: { ...(p[key] ?? { ok: false }), running: true } }));
    try {
      const res = await fetch("/api/connectors/healthcheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectorKey: key }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Health check failed");
        setHealthChecks((p) => ({ ...p, [key]: { ok: false, reason: data.error, running: false } }));
        return;
      }
      setHealthChecks((p) => ({ ...p, [key]: { ok: Boolean(data.ok), reason: data.reason, detail: data.detail, running: false } }));
      if (data.ok) toast.success(`${key}: healthy`);
      else toast.error(`${key}: ${data.reason || "unhealthy"}${data.detail ? ` — ${data.detail}` : ""}`);
    } catch {
      toast.error("Health check failed");
      setHealthChecks((p) => ({ ...p, [key]: { ok: false, reason: "ERROR", running: false } }));
    }
  };

  // Per-connector ops readout: consent adoption, outbox breakdown, and the most
  // recent failure — so an operator can tell a healthy connector from a stuck
  // one without leaving the list.
  const renderConnectorHealth = (key: string) => {
    const consents = consentsByConnector[key] || {};
    const totalConsents = Object.values(consents).reduce((a, b) => a + b, 0);
    const granted = consents.GRANTED ?? 0;
    const d = dispatchByConnector[key] || {};
    const confirmed = d.CONFIRMED ?? 0;
    const inflight = (d.QUEUED ?? 0) + (d.DISPATCHING ?? 0) + (d.SUBMITTED ?? 0);
    const needsUser = d.NEEDS_USER ?? 0;
    const failed = d.FAILED ?? 0;
    const hasDispatch = confirmed + inflight + needsUser + failed > 0;
    const fail = lastFailureByConnector[key];

    return (
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>
          {totalConsents === 0
            ? "no consents yet"
            : `${granted} active / ${totalConsents} consent${totalConsents === 1 ? "" : "s"}`}
        </span>
        {hasDispatch && (
          <span className="flex items-center gap-2">
            <span className="text-muted-foreground/40">·</span>
            <span title="confirmed dispatches">confirmed {confirmed}</span>
            {inflight > 0 && <span title="queued / dispatching / submitted">in flight {inflight}</span>}
            {needsUser > 0 && <span className="text-tone-honey-fg" title="fell back to guided update">needs user {needsUser}</span>}
            {failed > 0 && <span className="text-destructive" title="terminal failures">failed {failed}</span>}
          </span>
        )}
        {fail && (
          <span className="flex items-center gap-2">
            <span className="text-muted-foreground/40">·</span>
            <span className="text-destructive" title={`Last error at ${new Date(fail.at).toLocaleString()}`}>
              last error: {fail.errorCode} ({relativeTime(fail.at)})
            </span>
          </span>
        )}
      </div>
    );
  };

  const apiSyncCount = availableConnectors.filter((connector) => connector.mode === "API_SYNC").length;
  const firstRegisterableConnector = availableConnectors.find((connector) => !connector.registered);

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
        eyebrow="Integrations"
        title="<em>Connectors</em>"
        subtitle="Enable, stage, and roll out partner connectors — and kill them fast."
        actions={
          <button
            onClick={() => startRegister(firstRegisterableConnector)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> {firstRegisterableConnector ? `Register ${firstRegisterableConnector.displayName}` : "Register"}
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">Supported</p><p className="mt-1 text-2xl font-bold text-foreground">{availableConnectors.length}</p></div>
        <div className="rounded-xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">Registered</p><p className="mt-1 text-2xl font-bold text-foreground">{connectors.length}</p></div>
        <div className="rounded-xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">Enabled</p><p className="mt-1 text-2xl font-bold text-tone-sage-fg">{connectors.filter((c) => c.enabled).length}</p></div>
        <div className="rounded-xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">API sync ready</p><p className="mt-1 text-2xl font-bold text-tone-sky-fg">{apiSyncCount}</p></div>
      </div>

      {availableConnectors.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">Supported connector setup</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Built-in adapters are visible here even before a control-plane row is registered.
              </p>
            </div>
          </div>
          <div className="divide-y divide-border">
            {availableConnectors.map((available) => {
              const mode = MODE_META[available.mode];
              const setup = [
                { label: "Control row", value: available.registered ? "registered" : "missing", ok: available.registered },
                { label: "Agreement", value: available.agreementStatus, ok: available.agreementStatus === "PRODUCTION" },
                { label: "Credentials", value: available.credentialsPresent ? "configured" : "missing", ok: available.credentialsPresent },
              ];
              return (
                <div key={available.connectorKey} className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background">
                      <Plug className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">{available.displayName}</p>
                        <span className="font-mono text-xs text-muted-foreground">{available.connectorKey}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${mode?.cls ?? "bg-foreground/5 text-muted-foreground"}`} title={available.reason}>
                          {mode?.label ?? available.mode}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${available.registered ? "bg-tone-sage-bg text-tone-sage-fg" : "bg-foreground/5 text-muted-foreground"}`}>
                          {available.registered ? "registered" : "not registered"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{available.reason}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {setup.map((item) => (
                          <span key={item.label} className="inline-flex items-center gap-1.5 rounded-lg bg-background px-2 py-1">
                            {item.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-tone-sage-fg" /> : <Circle className="h-3.5 w-3.5 text-muted-foreground" />}
                            {item.label}: {item.value}
                          </span>
                        ))}
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-background px-2 py-1">
                          Host: {available.allowedHosts.join(", ")}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {!available.registered ? (
                      <button
                        onClick={() => startRegister(available)}
                        aria-label={`Register ${available.displayName}`}
                        className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
                      >
                        <Plus className="h-4 w-4" /> Register
                      </button>
                    ) : (
                      <span className="rounded-lg bg-background px-3 py-2 text-xs text-muted-foreground">Managed below</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
          <div className="rounded-xl border border-border bg-card">
            <EmptyState icon={Plug} title="No connector rows registered yet" description="Supported adapters are listed above; register one to create its control-plane row." />
          </div>
        ) : (
          connectors.map((c) => (
            <div key={c.id} className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button onClick={() => toggle(c)} aria-label={c.enabled ? "Disable connector (kill switch)" : "Enable connector"} aria-pressed={c.enabled} className="transition-colors" title={c.enabled ? "Disable (kill switch)" : "Enable"}>
                  {c.enabled ? <ToggleRight className="h-7 w-7 text-tone-sage-fg" /> : <ToggleLeft className="h-7 w-7 text-muted-foreground" />}
                </button>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-background"><Plug className="h-4 w-4 text-muted-foreground" /></div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-mono font-medium text-foreground">{c.connectorKey}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${c.enabled ? "bg-tone-sage-bg text-tone-sage-fg" : "bg-destructive/10 text-destructive"}`}>{c.enabled ? "ON" : "OFF"}</span>
                    <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{c.stage}</span>
                    {c.circuitState !== "CLOSED" && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">{c.circuitState}</span>}
                    {modeByConnector[c.connectorKey] && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${MODE_META[modeByConnector[c.connectorKey].mode]?.cls ?? "bg-foreground/5 text-muted-foreground"}`}
                        title={modeByConnector[c.connectorKey].reason}
                      >
                        {MODE_META[modeByConnector[c.connectorKey].mode]?.label ?? modeByConnector[c.connectorKey].mode}
                      </span>
                    )}
                    {healthChecks[c.connectorKey] && !healthChecks[c.connectorKey].running && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${healthChecks[c.connectorKey].ok ? "bg-tone-sage-bg text-tone-sage-fg" : "bg-destructive/10 text-destructive"}`}
                        title={healthChecks[c.connectorKey].detail || (healthChecks[c.connectorKey].ok ? "Health check passed" : "Health check failed")}
                      >
                        {healthChecks[c.connectorKey].ok ? "✓ healthy" : `✗ ${healthChecks[c.connectorKey].reason || "unhealthy"}`}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>v{c.version}</span>
                    <span>·</span>
                    <span>rollout {c.rolloutPercent}%</span>
                  </div>
                  {renderConnectorHealth(c.connectorKey)}
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => runHealthCheck(c.connectorKey)} disabled={healthChecks[c.connectorKey]?.running} aria-label="Test connection (health check)" className="rounded p-1.5 text-muted-foreground hover:bg-accent disabled:opacity-50" title="Test connection (health check)"><Activity className={`h-4 w-4 ${healthChecks[c.connectorKey]?.running ? "animate-pulse" : ""}`} /></button>
                <button onClick={() => startEdit(c)} aria-label="Edit connector" className="rounded p-1.5 text-muted-foreground hover:bg-accent" title="Edit"><Edit2 className="h-4 w-4" /></button>
                <button onClick={() => bulkRevoke(c)} aria-label="Revoke all consents (incident)" className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Revoke all consents (incident)"><ShieldAlert className="h-4 w-4" /></button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
