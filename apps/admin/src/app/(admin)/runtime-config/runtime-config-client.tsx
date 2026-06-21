"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { EyeOff, KeyRound, RefreshCw, Save, ShieldAlert } from "lucide-react";
import { InfoHint } from "@/components/info-hint";
import { AdminPageHeader } from "@/components/admin-page-header";

type RuntimeConfigCatalogStatus =
  | "Verified from ENV"
  | "Verified from Runtime Config"
  | "Missing"
  | "Invalid"
  | "Conflict"
  | "Needs review"
  | "Not required in this environment"
  | "Build-time only"
  | "Manual console action required";

type RuntimeConfigCatalogEditable = "Yes" | "Restricted" | "No";

type RuntimeConfigCatalogSource =
  | "ENV"
  | "Runtime Config"
  | "ENV + Runtime Config"
  | "Missing"
  | "Default";

export interface RuntimeConfigCatalogItem {
  key: string;
  label: string;
  description: string;
  scope: string;
  category: string;
  isSecret: boolean;
  requiredInProduction: boolean;
  configured: boolean;
  source: RuntimeConfigCatalogSource;
  status: RuntimeConfigCatalogStatus;
  editable: RuntimeConfigCatalogEditable;
  maskedValue: string | null;
  warning: string | null;
  dbOverrideIgnored: boolean;
  usedBy: string[];
  validation: string | null;
  notes: string[];
  buildTimeOnly: boolean;
  conflict: boolean;
  updatedAt: string | null;
  lastValidatedAt: string | null;
  lastValidationStatus: string | null;
}

const STATUS_TONE: Record<RuntimeConfigCatalogStatus, "success" | "warning" | "danger" | "neutral"> = {
  "Verified from ENV": "success",
  "Verified from Runtime Config": "success",
  "Missing": "danger",
  "Invalid": "danger",
  "Conflict": "warning",
  "Needs review": "warning",
  "Not required in this environment": "neutral",
  "Build-time only": "neutral",
  "Manual console action required": "warning",
};

const EDITABLE_LABEL: Record<RuntimeConfigCatalogEditable, string> = {
  Yes: "Editable",
  Restricted: "Restricted",
  No: "Deployment env only",
};

export interface RuntimeConfigStepUpForm {
  value: string;
  note: string;
  confirmPassword: string;
  mfaCode: string;
  backupCode: string;
}

const EMPTY_FORM: RuntimeConfigStepUpForm = {
  value: "",
  note: "",
  confirmPassword: "",
  mfaCode: "",
  backupCode: "",
};

function optionalStepUpValue(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function clearRuntimeConfigStepUp(form: RuntimeConfigStepUpForm): RuntimeConfigStepUpForm {
  return {
    ...form,
    confirmPassword: "",
    mfaCode: "",
    backupCode: "",
  };
}

export function buildRuntimeConfigUpdatePayload(key: string, form: RuntimeConfigStepUpForm) {
  return {
    key,
    value: form.value,
    note: form.note,
    confirmPassword: form.confirmPassword,
    mfaCode: optionalStepUpValue(form.mfaCode),
    backupCode: optionalStepUpValue(form.backupCode),
  };
}

export function buildRuntimeConfigDeletePayload(key: string, form: RuntimeConfigStepUpForm) {
  return {
    key,
    confirmPassword: form.confirmPassword,
    mfaCode: optionalStepUpValue(form.mfaCode),
    backupCode: optionalStepUpValue(form.backupCode),
  };
}

export function getRuntimeConfigDisplayValue(item: Pick<RuntimeConfigCatalogItem, "maskedValue">) {
  return item.maskedValue || "Not configured";
}

export default function RuntimeConfigClient() {
  const [configs, setConfigs] = useState<RuntimeConfigCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [form, setForm] = useState<RuntimeConfigStepUpForm>(EMPTY_FORM);
  const [stepUpHint, setStepUpHint] = useState<string | null>(null);

  const grouped = useMemo(() => {
    return configs.reduce<Record<string, RuntimeConfigCatalogItem[]>>((acc, item) => {
      const key = item.category;
      acc[key] = acc[key] || [];
      acc[key].push(item);
      return acc;
    }, {});
  }, [configs]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/runtime-config");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load runtime config");
      setConfigs(data.configs || []);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load runtime config");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(key: string) {
    if (savingKey) return;
    setSavingKey(key);
    try {
      const res = await fetch("/api/runtime-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRuntimeConfigUpdatePayload(key, form)),
      });
      const data = await res.json();
      if (!res.ok && data.requiresMfa) {
        setStepUpHint("MFA code or backup code is required for this change.");
      }
      if (!res.ok) throw new Error(data.error || "Failed to save config");
      toast.success("Runtime config updated");
      setEditingKey(null);
      setStepUpHint(null);
      setForm({ ...EMPTY_FORM });
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Failed to save config");
      setForm((prev) => clearRuntimeConfigStepUp(prev));
    } finally {
      setSavingKey(null);
    }
  }

  async function reset(key: string) {
    if (savingKey) return;
    const confirmAction = window.confirm("Reset this key to ENV fallback?");
    if (!confirmAction) return;

    if (!form.confirmPassword) {
      toast.error("Enter your admin password in the form above before resetting this key.");
      setStepUpHint("Password is required to reset this key. Type it into the Confirm password field, then click Reset to ENV again.");
      return;
    }

    setSavingKey(key);
    try {
      const res = await fetch("/api/runtime-config", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRuntimeConfigDeletePayload(key, form)),
      });
      const data = await res.json();
      if (!res.ok && data.requiresMfa) {
        setStepUpHint("MFA code or backup code is required for this reset.");
      }
      if (!res.ok) throw new Error(data.error || "Failed to reset config");
      toast.success("Runtime config reset to ENV fallback");
      setEditingKey(null);
      setStepUpHint(null);
      setForm({ ...EMPTY_FORM });
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Failed to reset config");
      setForm((prev) => clearRuntimeConfigStepUp(prev));
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="System"
        title="Runtime <em>Config</em>"
        subtitle="Manage masked runtime settings with step-up authentication and env fallback."
        actions={
          <button
            onClick={() => void load()}
            className="flex items-center gap-2 rounded-xl border border-border bg-card/70 px-4 py-2 text-sm font-medium text-foreground shadow-sm backdrop-blur-xl hover:bg-accent"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        }
      />

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Runtime control plane</p>
            <h2 className="mt-1.5 font-display text-xl font-bold text-foreground">Config readiness stays visible before deploy impact.</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Production secrets still belong in deployment env. Runtime overrides remain a controlled recovery path with masked values, validation status, and step-up authentication.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-2xl border border-tone-sage-br bg-tone-sage-bg p-3 text-tone-sage-fg">
              <p className="font-display text-lg font-bold">{configs.filter((item) => item.configured).length}</p>
              <p className="mt-0.5 opacity-80">configured</p>
            </div>
            <div className="rounded-2xl border border-tone-honey-br bg-tone-honey-bg p-3 text-tone-honey-fg">
              <p className="font-display text-lg font-bold">{configs.filter((item) => item.status === "Conflict").length}</p>
              <p className="mt-0.5 opacity-80">conflicts</p>
            </div>
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-destructive">
              <p className="font-display text-lg font-bold">{configs.filter((item) => item.status === "Missing" && item.requiredInProduction).length}</p>
              <p className="mt-0.5 opacity-80">required</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard
          label="Managed Keys"
          value={configs.length}
          hint="Every config key this app reads, including secrets like JWT signing keys, service URLs such as Redis, Stripe keys, and feature toggles."
        />
        <MetricCard
          label="Verified from ENV"
          value={configs.filter((item) => item.status === "Verified from ENV").length}
          hint="Keys whose value comes from the deployment's environment variables and passed validation. This is the preferred source for production secrets."
        />
        <MetricCard
          label="Conflicts"
          value={configs.filter((item) => item.status === "Conflict").length}
          tone={configs.some((item) => item.status === "Conflict") ? "danger" : "default"}
          hint="Keys set in BOTH the environment and the database with different values. The app picks one, so resolve these to avoid surprises."
        />
        <MetricCard
          label="Missing required"
          value={configs.filter((item) => item.status === "Missing" && item.requiredInProduction).length}
          tone="danger"
          hint="Keys required in production that have no value anywhere. The features that depend on them will not work until set."
        />
      </div>

      <div className="rounded-2xl border border-tone-honey-br bg-tone-honey-bg p-5 text-sm text-tone-honey-fg">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <p className="font-display text-base font-bold text-foreground">Secrets are never shown in full.</p>
            <p className="mt-1 text-xs text-tone-honey-fg/80">For production, the safest model is still deployment-level secret management. DB overrides are encrypted at rest and intended for controlled break-glass or managed runtime updates.</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">Loading runtime config...</div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="space-y-3">
              <div>
                <h2 className="font-display text-lg font-bold text-foreground">{category.replace(/_/g, " ")}</h2>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground"><span className="font-mono">{items.length}</span> managed key{items.length === 1 ? "" : "s"}</p>
              </div>
              <div className="space-y-3">
                {items.map((item) => {
                  const isEditing = editingKey === item.key;
                  const editLocked = item.editable === "No";
                  return (
                    <div key={item.key} className="rounded-2xl border border-border bg-card p-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-display text-base font-bold text-foreground">{item.label}</h3>
                            <StatusBadge label={item.status} tone={STATUS_TONE[item.status]} />
                            {item.requiredInProduction && <StatusBadge label="Required" tone="warning" />}
                            {item.isSecret && <StatusBadge label="Secret" tone="neutral" />}
                            <StatusBadge label={EDITABLE_LABEL[item.editable]} tone="neutral" />
                          </div>
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                          {item.warning ? (
                            <p className="rounded-xl border border-tone-honey-br bg-tone-honey-bg px-3 py-2 text-xs text-tone-honey-fg">
                              {item.warning}
                            </p>
                          ) : null}
                          {item.notes && item.notes.length > 0 ? (
                            <ul className="list-disc rounded-xl border border-border bg-muted/50 px-5 py-2 text-xs text-muted-foreground">
                              {item.notes.map((note, idx) => (
                                <li key={idx}>{note}</li>
                              ))}
                            </ul>
                          ) : null}
                          <div className="grid grid-cols-1 gap-2 text-sm text-muted-foreground md:grid-cols-2">
                            <div><span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Key</span> <span className="ml-1 font-mono text-foreground">{item.key}</span></div>
                            <div><span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Scope</span> <span className="ml-1 text-foreground">{item.scope}</span></div>
                            <div><span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Source</span> <span className="ml-1 text-foreground">{item.source === "Missing" ? "-" : item.source}</span></div>
                            <div><span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Value</span> <span className="ml-1 font-mono text-foreground">{getRuntimeConfigDisplayValue(item)}</span></div>
                            {item.validation ? (
                              <div><span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Validation</span> <span className="ml-1 text-foreground">{item.validation}</span></div>
                            ) : null}
                            {item.usedBy && item.usedBy.length > 0 ? (
                              <div><span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Used by</span> <span className="ml-1 text-foreground">{item.usedBy.join(", ")}</span></div>
                            ) : null}
                            <div><span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Last validation</span> <span className="ml-1 font-mono text-foreground">{item.lastValidatedAt ? new Date(item.lastValidatedAt).toLocaleString() : "-"}</span></div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            disabled={editLocked}
                            onClick={() => {
                              if (editLocked) return;
                              setEditingKey(item.key);
                              setStepUpHint(null);
                              setForm({ ...EMPTY_FORM });
                            }}
                            className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                            title={editLocked ? "Deployment-only key - update in DigitalOcean env." : undefined}
                          >
                            <KeyRound className="h-4 w-4" /> Edit
                          </button>
                        </div>
                      </div>

                      {isEditing && (
                        <div className="mt-4 grid grid-cols-1 gap-3 rounded-2xl border border-border bg-muted/50 p-4 lg:grid-cols-2">
                          {stepUpHint ? (
                            <div className="lg:col-span-2 rounded-xl border border-tone-honey-br bg-tone-honey-bg px-3 py-2 text-sm text-tone-honey-fg">
                              {stepUpHint}
                            </div>
                          ) : null}
                          <div className="lg:col-span-2">
                            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">New value</label>
                            <textarea
                              value={form.value}
                              onChange={(event) => setForm((prev) => ({ ...prev, value: event.target.value }))}
                              className="min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                              placeholder={item.isSecret ? "Paste secret value" : "Enter runtime value"}
                            />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Change note</label>
                            <input
                              value={form.note}
                              onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
                              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                              placeholder="Rotation, override, emergency, etc."
                            />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Confirm password</label>
                            <input
                              type="password"
                              value={form.confirmPassword}
                              onChange={(event) => setForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                              placeholder="Required"
                            />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">MFA code</label>
                            <input
                              inputMode="numeric"
                              autoComplete="one-time-code"
                              value={form.mfaCode}
                              onChange={(event) => setForm((prev) => ({ ...prev, mfaCode: event.target.value }))}
                              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-mono text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                              placeholder="Authenticator code"
                            />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Backup code</label>
                            <input
                              type="password"
                              autoComplete="one-time-code"
                              value={form.backupCode}
                              onChange={(event) => setForm((prev) => ({ ...prev, backupCode: event.target.value }))}
                              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-mono text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                              placeholder="Recovery code"
                            />
                          </div>
                          <div className="lg:col-span-2 flex flex-wrap gap-2">
                            <button
                              onClick={() => void save(item.key)}
                              disabled={Boolean(savingKey)}
                              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                            >
                              <Save className="h-4 w-4" /> {savingKey === item.key ? "Saving..." : "Save Override"}
                            </button>
                            <button
                              onClick={() => void reset(item.key)}
                              disabled={Boolean(savingKey)}
                              className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
                            >
                              <EyeOff className="h-4 w-4" /> Reset to ENV
                            </button>
                            <button
                              onClick={() => {
                                setEditingKey(null);
                                setStepUpHint(null);
                                setForm({ ...EMPTY_FORM });
                              }}
                              className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, tone = "default", hint }: { label: string; value: number; tone?: "default" | "danger"; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
        {hint ? <InfoHint text={hint} label={label} /> : null}
      </p>
      <p className={`mt-1.5 font-display text-3xl font-extrabold leading-none ${tone === "danger" ? "text-destructive" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: "success" | "warning" | "danger" | "neutral" }) {
  const tones = {
    success: "bg-tone-sage-bg text-tone-sage-fg",
    warning: "bg-tone-honey-bg text-tone-honey-fg",
    danger: "bg-destructive/10 text-destructive",
    neutral: "bg-muted text-muted-foreground",
  } as const;
  const dots = {
    success: "bg-tone-sage-fg",
    warning: "bg-tone-honey-fg",
    danger: "bg-destructive",
    neutral: "bg-muted-foreground",
  } as const;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${tones[tone]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dots[tone]}`} />
      {label}
    </span>
  );
}
