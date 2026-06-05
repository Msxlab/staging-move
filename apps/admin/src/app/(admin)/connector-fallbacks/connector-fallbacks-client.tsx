"use client";

import { useEffect, useState } from "react";
import { Link2, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
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
  "rounded border border-foreground/10 bg-background px-2 py-1.5 text-sm text-foreground disabled:opacity-60";

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

  return (
    <div>
      <AdminPageHeader
        eyebrow="Connectors"
        title="Fallback actions"
        subtitle="Guided deep-link / mailto / PDF steps a connector degrades to when it can't auto-push. A row here overrides the in-code default; unsafe URLs are rejected and every write is audit-logged."
        actions={
          <button
            onClick={startCreate}
            className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Add fallback
          </button>
        }
      />

      {showForm ? (
        <div className="mb-6 rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            {editingKey ? `Edit ${editingKey}` : "New fallback action"}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              actionKey
              <input
                value={form.actionKey}
                disabled={!!editingKey}
                onChange={(e) => setForm({ ...form, actionKey: e.target.value })}
                placeholder="usps:MAIL_FORWARDING:DEEP_LINK"
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              connectorKey
              <input
                value={form.connectorKey}
                onChange={(e) => setForm({ ...form, connectorKey: e.target.value })}
                placeholder="usps"
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              type
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
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              locale
              <input
                value={form.locale}
                onChange={(e) => setForm({ ...form, locale: e.target.value })}
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-2">
              label
              <input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="Open update"
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-2">
              helperText
              <input
                value={form.helperText}
                onChange={(e) => setForm({ ...form, helperText: e.target.value })}
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-2">
              urlTemplate <span className="text-foreground/40">— {`{{to.city}}`}-style placeholders; must match the type</span>
              <input
                value={form.urlTemplate}
                onChange={(e) => setForm({ ...form, urlTemplate: e.target.value })}
                placeholder="https://moversguide.usps.com/  ·  mailto:support@acme.com  ·  /help/..."
                className={inputCls}
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              />
              enabled
            </label>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={save}
              disabled={busy}
              className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
            >
              {editingKey ? "Save changes" : "Create"}
            </button>
            <button
              onClick={reset}
              className="rounded-md border border-foreground/10 px-3 py-1.5 text-sm text-foreground hover:bg-muted/30"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
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
              <p className="mb-2 text-[11px] font-mono font-semibold uppercase tracking-[0.18em] text-foreground/40">
                {connectorKey}
              </p>
              <div className="overflow-hidden rounded-lg border border-foreground/10">
                {rows.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 border-b border-foreground/10 px-4 py-3 last:border-b-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">{a.label}</span>
                        <span className="rounded bg-muted/40 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                          {a.type}
                        </span>
                        {a.enabled ? (
                          <span className="inline-flex items-center gap-1 rounded bg-tone-sage-bg px-1.5 py-0.5 text-[10px] text-tone-sage-fg">
                            <ShieldCheck className="h-3 w-3" /> enabled
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">disabled</span>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{a.actionKey}</p>
                      {a.urlTemplate ? (
                        <p className="truncate text-[11px] text-foreground/40">{a.urlTemplate}</p>
                      ) : null}
                    </div>
                    <button
                      onClick={() => startEdit(a)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                      aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => remove(a.actionKey)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-muted/30 hover:text-foreground"
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
