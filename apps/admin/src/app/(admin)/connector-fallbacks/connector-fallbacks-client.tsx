"use client";

import { useEffect, useState } from "react";
import { Link2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin-page-header";
import { EmptyState } from "@/components/empty-state";

interface FallbackAction {
  id: string;
  actionKey: string;
  connectorKey: string;
  type: string;
  label: string;
  helperText: string;
  urlTemplate: string | null;
  locale: string;
  enabled: boolean;
}

const TYPES = ["DEEP_LINK", "MAILTO", "PDF", "PHONE"];

const EMPTY_FORM = {
  actionKey: "",
  connectorKey: "",
  type: "DEEP_LINK",
  label: "",
  helperText: "",
  urlTemplate: "",
  locale: "en",
  enabled: true,
};

type FormState = typeof EMPTY_FORM;

const inputCls =
  "rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60";

/** Mirror the server's URL-safety rule so the form warns before submit. */
function isUsableUrl(value: string, type: string): boolean {
  const v = value.trim();
  if (!v) return true; // empty allowed (label-only guided action)
  if ((type === "DEEP_LINK" || type === "PDF") && v.startsWith("/") && !v.startsWith("//")) return true;
  try {
    const u = new URL(v);
    if (type === "MAILTO") return u.protocol === "mailto:";
    if (type === "PHONE") return u.protocol === "tel:";
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export default function ConnectorFallbacksClient() {
  const [actions, setActions] = useState<FallbackAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    fetch("/api/connector-fallbacks")
      .then((r) => r.json())
      .then((d) => setActions(d.actions || []))
      .catch(() => toast.error("Failed to load fallback actions"))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);

  const reset = () => {
    setShowForm(false);
    setEditingKey(null);
    setForm({ ...EMPTY_FORM });
  };

  const startCreate = () => {
    setEditingKey(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
  };

  const startEdit = (a: FallbackAction) => {
    setEditingKey(a.actionKey);
    setForm({
      actionKey: a.actionKey,
      connectorKey: a.connectorKey,
      type: a.type,
      label: a.label,
      helperText: a.helperText,
      urlTemplate: a.urlTemplate ?? "",
      locale: a.locale,
      enabled: a.enabled,
    });
    setShowForm(true);
  };

  const save = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/connector-fallbacks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Failed to save");
        return;
      }
      toast.success(editingKey ? "Fallback updated" : "Fallback created");
      reset();
      load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (actionKey: string) => {
    if (!window.confirm(`Delete fallback "${actionKey}"?`)) return;
    const res = await fetch(`/api/connector-fallbacks?actionKey=${encodeURIComponent(actionKey)}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || "Failed to delete");
      return;
    }
    toast.success("Fallback deleted");
    load();
  };

  const byConnector = actions.reduce<Record<string, FallbackAction[]>>((acc, a) => {
    (acc[a.connectorKey] ??= []).push(a);
    return acc;
  }, {});

  const urlInvalid = !isUsableUrl(form.urlTemplate, form.type);
  const canSave =
    form.actionKey.trim() !== "" &&
    form.connectorKey.trim() !== "" &&
    form.label.trim() !== "" &&
    form.helperText.trim() !== "" &&
    !urlInvalid;

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Connectors"
        title="Fallback <em>actions</em>"
        subtitle="Guided deep-link / mailto / PDF steps a connector degrades to when it can't auto-push. A row here overrides the in-code default; unsafe URLs are rejected and every write is audit-logged."
        actions={
          <button
            onClick={startCreate}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Add fallback
          </button>
        }
      />

      {showForm ? (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
          <h2 className="mb-4 font-display text-base font-bold text-foreground">
            {editingKey ? `Edit ${editingKey}` : "New fallback action"}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-mono font-medium uppercase tracking-[0.18em] text-muted-foreground">actionKey</span>
              <input
                value={form.actionKey}
                disabled={!!editingKey}
                onChange={(e) => setForm({ ...form, actionKey: e.target.value })}
                placeholder="usps:MAIL_FORWARDING:DEEP_LINK"
                className={`${inputCls} font-mono`}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-mono font-medium uppercase tracking-[0.18em] text-muted-foreground">connectorKey</span>
              <input
                value={form.connectorKey}
                onChange={(e) => setForm({ ...form, connectorKey: e.target.value })}
                placeholder="usps"
                className={`${inputCls} font-mono`}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-mono font-medium uppercase tracking-[0.18em] text-muted-foreground">type</span>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className={inputCls}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-mono font-medium uppercase tracking-[0.18em] text-muted-foreground">locale</span>
              <input
                value={form.locale}
                onChange={(e) => setForm({ ...form, locale: e.target.value })}
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-[11px] font-mono font-medium uppercase tracking-[0.18em] text-muted-foreground">label</span>
              <input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="Open update"
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-[11px] font-mono font-medium uppercase tracking-[0.18em] text-muted-foreground">helperText</span>
              <input
                value={form.helperText}
                onChange={(e) => setForm({ ...form, helperText: e.target.value })}
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-[11px] font-mono font-medium uppercase tracking-[0.18em] text-muted-foreground">
                urlTemplate <span className="normal-case tracking-normal text-muted-foreground/70">— {`{{to.city}}`}-style placeholders; must match the type</span>
              </span>
              <input
                value={form.urlTemplate}
                onChange={(e) => setForm({ ...form, urlTemplate: e.target.value })}
                placeholder="https://moversguide.usps.com/  ·  mailto:support@acme.com  ·  /help/..."
                className={`${inputCls} font-mono`}
              />
              {urlInvalid ? (
                <span className="text-xs text-tone-rose-fg">
                  URL doesn&apos;t match the {form.type} type (unsafe protocols are rejected server-side too).
                </span>
              ) : null}
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                className="accent-primary"
              />
              enabled
            </label>
          </div>
          {form.label || form.urlTemplate ? (
            <div className="mt-5 rounded-2xl border border-border bg-card p-4">
              <p className="mb-2 text-[11px] font-mono font-medium uppercase tracking-[0.18em] text-muted-foreground">Preview</p>
              <span className="inline-flex items-center rounded-xl border border-border px-2.5 py-1 text-sm text-foreground">
                {form.label || "Open update"}
              </span>
              {form.helperText ? <p className="mt-2 text-xs text-muted-foreground">{form.helperText}</p> : null}
              {form.urlTemplate ? <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{form.urlTemplate}</p> : null}
            </div>
          ) : null}

          <div className="mt-5 flex items-center gap-2">
            <button
              onClick={save}
              disabled={busy || !canSave}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {editingKey ? "Save changes" : "Create"}
            </button>
            <button
              onClick={reset}
              className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="py-20 text-center text-sm text-muted-foreground">Loading…</div>
      ) : actions.length === 0 ? (
        <EmptyState
          icon={Link2}
          title="No fallback actions yet"
          description="Connectors fall back to their in-code default. Add a row to override one with an admin-managed deep-link, mailto, or PDF."
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(byConnector).map(([connectorKey, rows]) => (
            <div key={connectorKey}>
              <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {connectorKey}
              </p>
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                {rows.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 border-b border-border px-4 py-3.5 transition-colors last:border-b-0 hover:bg-accent/30"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">{a.label}</span>
                        <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
                          {a.type}
                        </span>
                        {a.enabled ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-tone-sage-bg px-2 py-0.5 text-[10px] font-semibold text-tone-sage-fg">
                            <span className="h-1.5 w-1.5 rounded-full bg-tone-sage-fg" /> enabled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-tone-slate-bg px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" /> disabled
                          </span>
                        )}
                      </div>
                      <p className="truncate font-mono text-xs text-muted-foreground">{a.actionKey}</p>
                      {a.urlTemplate ? (
                        <p className="truncate font-mono text-[11px] text-muted-foreground/70">{a.urlTemplate}</p>
                      ) : null}
                    </div>
                    <button
                      onClick={() => startEdit(a)}
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => remove(a.actionKey)}
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
