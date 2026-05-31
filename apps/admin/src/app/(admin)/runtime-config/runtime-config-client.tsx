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
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard
          label="Managed Keys"
          value={configs.length}
          hint="Every config key this app reads — secrets like JWT signing keys, service URLs (e.g. Redis), Stripe keys, and feature toggles."
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

      <div className="rounded-xl border border-tone-honey-br bg-tone-honey-bg p-4 text-sm text-tone-honey-fg">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <p className="font-medium">Secrets are never shown in full.</p>
            <p className="mt-1 text-tone-honey-fg/80">For production, the safest model is still deployment-level secret management. DB overrides are encrypted at rest and intended for controlled break-glass or managed runtime updates.</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground">Loading runtime config...</div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{category.replace(/_/g, " ")}</h2>
                <p className="text-sm text-muted-foreground">{items.length} managed key{items.length === 1 ? "" : "s"}</p>
              </div>
              <div className="space-y-3">
                {items.map((item) => {
                  const isEditing = editingKey === item.key;
                  const editLocked = item.editable === "No";
                  return (
                    <div key={item.key} className="rounded-xl border border-border bg-card p-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-foreground">{item.label}</h3>
                            <StatusBadge label={item.status} tone={STATUS_TONE[item.status]} />
                            {item.requiredInProduction && <StatusBadge label="Required" tone="warning" />}
                            {item.isSecret && <StatusBadge label="Secret" tone="neutral" />}
                            <StatusBadge label={EDITABLE_LABEL[item.editable]} tone="neutral" />
                          </div>
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                          {item.warning ? (
                            <p className="rounded-lg border border-tone-honey-br bg-tone-honey-bg px-3 py-2 text-xs text-tone-honey-fg">
                              {item.warning}
                            </p>
                          ) : null}
                          {item.notes && item.notes.length > 0 ? (
                            <ul className="list-disc rounded-lg border border-border bg-background/50 px-5 py-2 text-xs text-muted-foreground">
                              {item.notes.map((note, idx) => (
                                <li key={idx}>{note}</li>
                              ))}
                            </ul>
                          ) : null}
                          <div className="grid grid-cols-1 gap-2 text-sm text-muted-foreground md:grid-cols-2">
                            <div><span className="font-medium text-foreground">Key:</span> <span className="font-mono">{item.key}</span></div>
                            <div><span className="font-medium text-foreground">Scope:</span> {item.scope}</div>
                            <div><span className="font-medium text-foreground">Source:</span> {item.source === "Missing" ? "—" : item.source}</div>
                            <div><span className="font-medium text-foreground">Value:</span> {getRuntimeConfigDisplayValue(item)}</div>
                            {item.validation ? (
                              <div><span className="font-medium text-foreground">Validation:</span> {item.validation}</div>
                            ) : null}
                            {item.usedBy && item.usedBy.length > 0 ? (
                              <div><span className="font-medium text-foreground">Used by:</span> {item.usedBy.join(", ")}</div>
                            ) : null}
                            <div><span className="font-medium text-foreground">Last validation:</span> {item.lastValidatedAt ? new Date(item.lastValidatedAt).toLocaleString() : "—"}</div>
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
                            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                            title={editLocked ? "Deployment-only key — update in DigitalOcean env." : undefined}
                          >
                            <KeyRound className="h-4 w-4" /> Edit
                          </button>
                        </div>
                      </div>

                      {isEditing && (
                        <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-border bg-background/50 p-4 lg:grid-cols-2">
                          {stepUpHint ? (
                            <div className="lg:col-span-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
                              {stepUpHint}
                            </div>
                          ) : null}
                          <div className="lg:col-span-2">
                            <label className="mb-1 block text-sm font-medium text-muted-foreground">New value</label>
                            <textarea
                              value={form.value}
                              onChange={(event) => setForm((prev) => ({ ...prev, value: event.target.value }))}
                              className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                              placeholder={item.isSecret ? "Paste secret value" : "Enter runtime value"}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-medium text-muted-foreground">Change note</label>
                            <input
                              value={form.note}
                              onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
                              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                              placeholder="Rotation, override, emergency, etc."
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-medium text-muted-foreground">Confirm password</label>
                            <input
                              type="password"
                              value={form.confirmPassword}
                              onChange={(event) => setForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                              placeholder="Required"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-medium text-muted-foreground">MFA code</label>
                            <input
                              inputMode="numeric"
                              autoComplete="one-time-code"
                              value={form.mfaCode}
                              onChange={(event) => setForm((prev) => ({ ...prev, mfaCode: event.target.value }))}
                              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                              placeholder="Authenticator code"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-medium text-muted-foreground">Backup code</label>
                            <input
                              type="password"
                              autoComplete="one-time-code"
                              value={form.backupCode}
                              onChange={(event) => setForm((prev) => ({ ...prev, backupCode: event.target.value }))}
                              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                              placeholder="Recovery code"
                            />
                          </div>
                          <div className="lg:col-span-2 flex flex-wrap gap-2">
                            <button
                              onClick={() => void save(item.key)}
                              disabled={Boolean(savingKey)}
                              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                            >
                              <Save className="h-4 w-4" /> {savingKey === item.key ? "Saving..." : "Save Override"}
                            </button>
                            <button
                              onClick={() => void reset(item.key)}
                              disabled={Boolean(savingKey)}
                              className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
                            >
                              <EyeOff className="h-4 w-4" /> Reset to ENV
                            </button>
                            <button
                              onClick={() => {
                                setEditingKey(null);
                                setStepUpHint(null);
                                setForm({ ...EMPTY_FORM });
                              }}
                              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent"
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
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="flex items-center gap-1 text-sm text-muted-foreground">
        {label}
        {hint ? <InfoHint text={hint} label={label} /> : null}
      </p>
      <p className={`mt-1 text-2xl font-bold ${tone === "danger" ? "text-destructive" : "text-foreground"}`}>{value}</p>
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

  return <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${tones[tone]}`}>{label}</span>;
}
