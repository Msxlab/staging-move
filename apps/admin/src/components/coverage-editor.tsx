"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Globe,
  Loader2,
  MapPin,
  Pencil,
  RefreshCw,
  Save,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PasswordConfirmModal, StepUpValues } from "@/components/password-confirm-modal";
import { InfoHint } from "@/components/info-hint";

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID",
  "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO",
  "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA",
  "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

const COVERAGE_MODELS: Array<{ value: string; label: string; help: string }> = [
  { value: "", label: "Auto (seed metadata / heuristic)", help: "No override — the matcher uses the curated seed model, then a zip-vs-state heuristic." },
  { value: "state", label: "State", help: "Provider serves whole listed states." },
  { value: "zip_prefix", label: "ZIP / prefix", help: "Matched by exact ZIP or 3-digit prefix rows." },
  { value: "polygon", label: "Polygon (service area)", help: "Matched by point-in-polygon; polygons live in seed metadata." },
  { value: "live_address", label: "Live address check", help: "Availability can only be confirmed per address (shows 'check availability')." },
];

interface CoverageSummary {
  provider: {
    id: string;
    name: string;
    slug: string;
    category: string;
    scope: string;
    states: string[];
    zipCodes: string[];
    coverageModel: string | null;
    effectiveModel: string;
    version: number;
  };
  coverage: {
    totalRows: number;
    stateRows: number;
    prefixRows: number;
    exactRows: number;
    coverageStates: string[];
  };
  metadata: {
    coverageModel: string;
    note: string;
    officialUrl: string;
    source: string;
    hasPolygons: boolean;
  } | null;
}

type PendingAction = "save" | "recompute" | null;

export function CoverageEditor({ providerId }: { providerId: string }) {
  const [data, setData] = useState<CoverageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  // editable form state
  const [scope, setScope] = useState("FEDERAL");
  const [states, setStates] = useState<string[]>([]);
  const [zipText, setZipText] = useState("");
  const [model, setModel] = useState("");

  // step-up flow
  const [pending, setPending] = useState<PendingAction>(null);
  const [busy, setBusy] = useState(false);
  const [stepUpError, setStepUpError] = useState<string | null>(null);
  const [requiresMfa, setRequiresMfa] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/providers/${providerId}/coverage`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to load coverage");
      setData(json);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load coverage");
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    load();
  }, [load]);

  function beginEdit() {
    if (!data) return;
    setScope(data.provider.scope);
    setStates(data.provider.states);
    setZipText(data.provider.zipCodes.join(", "));
    setModel(data.provider.coverageModel || "");
    setStepUpError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setStepUpError(null);
  }

  function toggleState(st: string) {
    setStates((prev) => (prev.includes(st) ? prev.filter((s) => s !== st) : [...prev, st]));
  }

  function requestSave() {
    setStepUpError(null);
    setRequiresMfa(true);
    setPending("save");
  }

  function requestRecompute() {
    setStepUpError(null);
    setRequiresMfa(true);
    setPending("recompute");
  }

  async function runStepUp(_password: string, stepUp: StepUpValues) {
    if (!pending) return;
    setBusy(true);
    setStepUpError(null);
    try {
      let res: Response;
      if (pending === "save") {
        const zipCodes = zipText
          .split(",")
          .map((z) => z.trim())
          .filter(Boolean);
        res = await fetch(`/api/providers/${providerId}/coverage`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scope,
            states: scope === "FEDERAL" ? [] : states,
            zipCodes,
            coverageModel: model,
            ...stepUp,
          }),
        });
      } else {
        res = await fetch(`/api/providers/${providerId}/coverage/recompute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(stepUp),
        });
      }

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = json?.error || "Action failed";
        setRequiresMfa(Boolean(json?.requiresMfa ?? true));
        setStepUpError(message);
        toast.error(message);
        return;
      }

      toast.success(
        pending === "save"
          ? `Coverage saved · ${json.rebuiltRows} rows rebuilt`
          : `Coverage recomputed · ${json.rebuiltRows} rows (was ${json.previousRows})`,
      );
      setPending(null);
      setEditing(false);
      await load();
    } catch {
      setStepUpError("Action failed");
      toast.error("Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading coverage…
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { provider, coverage, metadata } = data;

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-foreground">
            <MapPin className="h-4 w-4 text-tone-honey-fg" /> Coverage editor
            <InfoHint
              label="Coverage editor"
              text="Define where this provider appears in user search. Saving rebuilds this provider's coverage rows through the same expandCoverageRows → rebuildProviderCoverage pipeline the seed uses."
            />
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Scope, per-state coverage, ZIP/prefix rules, and the coverage model.
            Changes affect which users this provider is matched to.
          </p>
        </div>
        {!editing && (
          <div className="flex items-center gap-2">
            <button
              onClick={requestRecompute}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
              title="Rebuild coverage rows from the stored definition"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Recompute
            </button>
            <button
              onClick={beginEdit}
              className="flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit coverage
            </button>
          </div>
        )}
      </div>

      {/* Row-count summary (always visible) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total rows", value: coverage.totalRows },
          { label: "State rows", value: coverage.stateRows },
          { label: "Prefix rows", value: coverage.prefixRows },
          { label: "Exact ZIP rows", value: coverage.exactRows },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-background/60 p-3">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-0.5 text-xl font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {metadata && (
        <div className="rounded-lg border border-tone-sky-br bg-tone-sky-bg/50 p-3 text-xs text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Seed metadata:</span> model{" "}
            <code className="rounded bg-background px-1">{metadata.coverageModel}</code> ({metadata.source})
            {metadata.coverageModel === "polygon" && !metadata.hasPolygons && (
              <span className="ml-1 text-tone-honey-fg">· no polygons (degrades to address check)</span>
            )}
          </p>
          {metadata.note && <p className="mt-1">{metadata.note}</p>}
        </div>
      )}

      {!editing ? (
        /* ── Read view ── */
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Scope:</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                provider.scope === "FEDERAL"
                  ? "bg-tone-sky-bg text-tone-sky-fg"
                  : "bg-tone-orange-bg text-tone-orange-fg"
              }`}
            >
              {provider.scope === "FEDERAL" ? (
                <><Globe className="mr-0.5 inline h-3 w-3" /> Federal (all states)</>
              ) : (
                <><MapPin className="mr-0.5 inline h-3 w-3" /> State-specific</>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Effective model:</span>
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
              {provider.effectiveModel}
            </code>
            {provider.coverageModel ? (
              <span className="rounded-full bg-tone-foil-bg px-2 py-0.5 text-[10px] uppercase text-tone-foil-fg">
                override
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground">(no override)</span>
            )}
          </div>
          {provider.scope === "STATE" && (
            <div>
              <p className="mb-1 text-muted-foreground">
                Coverage states ({coverage.coverageStates.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {coverage.coverageStates.length > 0 ? (
                  coverage.coverageStates.map((st) => (
                    <span key={st} className="rounded bg-tone-orange-bg px-2 py-0.5 text-xs font-medium text-tone-orange-fg">
                      {st}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">No coverage rows — provider will not match any state.</span>
                )}
              </div>
            </div>
          )}
          {provider.zipCodes.length > 0 && (
            <div>
              <p className="mb-1 text-muted-foreground">ZIP / prefix rules ({provider.zipCodes.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {provider.zipCodes.map((z) => (
                  <span key={z} className="rounded bg-tone-sky-bg px-2 py-0.5 text-xs font-medium text-tone-sky-fg">
                    {z}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── Edit view ── */
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Scope</label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              >
                <option value="FEDERAL">Federal (all states)</option>
                <option value="STATE">State-specific</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Coverage model
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              >
                {COVERAGE_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {COVERAGE_MODELS.find((m) => m.value === model)?.help}
              </p>
            </div>
          </div>

          {scope === "STATE" && (
            <div>
              <label className="mb-2 block text-sm font-medium text-muted-foreground">
                States ({states.length} selected)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {US_STATES.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => toggleState(st)}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                      states.includes(st)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          )}

          {scope === "STATE" && (
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                ZIP codes / prefixes
              </label>
              <input
                value={zipText}
                onChange={(e) => setZipText(e.target.value)}
                placeholder="78701, 787, 94105"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Comma-separated. 5 digits → exact ZIP row; 3–4 digits → prefix row.
                A ZIP whose state isn&apos;t in the list above is dropped on rebuild.
                Leave blank for whole-state coverage.
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={requestSave}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Save className="h-4 w-4" /> Save &amp; rebuild
            </button>
            <button
              onClick={cancelEdit}
              className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-accent"
            >
              <X className="h-4 w-4" /> Cancel
            </button>
          </div>
        </div>
      )}

      <PasswordConfirmModal
        open={pending !== null}
        title={pending === "recompute" ? "Recompute coverage" : "Save coverage changes"}
        description={
          pending === "recompute"
            ? `Rebuild "${provider.name}" coverage rows from its stored definition. Enter your admin password and MFA code to continue.`
            : `This rewrites where "${provider.name}" appears in user search. Enter your admin password and MFA code to continue.`
        }
        confirmLabel={pending === "recompute" ? "Recompute" : "Save coverage"}
        busy={busy}
        error={stepUpError}
        requiresMfa={requiresMfa}
        onClose={() => {
          if (!busy) {
            setPending(null);
            setStepUpError(null);
            setRequiresMfa(true);
          }
        }}
        onConfirm={runStepUp}
      />
    </div>
  );
}
