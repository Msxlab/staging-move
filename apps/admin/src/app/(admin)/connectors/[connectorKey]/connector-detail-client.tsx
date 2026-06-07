"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Circle,
  KeyRound,
  Link2,
  Plug,
  RefreshCw,
  ShieldAlert,
  ToggleLeft,
  ToggleRight,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { PasswordConfirmModal, type StepUpValues } from "@/components/password-confirm-modal";
import { AdminPageHeader } from "@/components/admin-page-header";
import { EmptyState } from "@/components/empty-state";

// ── Shapes returned by GET /api/connectors/[connectorKey] ──────────────────
interface ConnectorManifest {
  key: string;
  version: string;
  displayName: string;
  authType: string;
  authScopes: string[];
  allowedHosts: string[];
  requiredFields: string[];
  capabilities: Record<string, boolean>;
  rateLimit: { perUserPerDay?: number; perConnectorPerMinute?: number } | null;
  requiresOrigin: boolean;
  fallbackActionKey: string | null;
  hasHealthCheck: boolean;
}
interface ConnectorConfigRow {
  id: string;
  connectorKey: string;
  version: string;
  enabled: boolean;
  rolloutPercent: number;
  circuitState: string;
  stage: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
interface CredentialPreview {
  key: string;
  label: string;
  configured: boolean;
  masked: string | null;
}
interface DispatchRow {
  id: string;
  status: string;
  isShadow: boolean;
  attemptCount: number;
  lastErrorCode: string | null;
  eventId: string | null;
  nextRetryAt: string | null;
  dispatchedAt: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
interface FallbackRow {
  id: string;
  actionKey: string;
  type: string;
  label: string;
  helperText: string;
  urlTemplate: string | null;
  locale: string;
  enabled: boolean;
}
interface ConnectorDetail {
  connectorKey: string;
  registered: boolean;
  displayName: string;
  hasAdapter: boolean;
  manifest: ConnectorManifest | null;
  config: ConnectorConfigRow | null;
  mode: string;
  modeReason: string;
  gate: { agreementStatus: "NONE" | "SANDBOX" | "PRODUCTION"; credentialsPresent: boolean };
  credentials: CredentialPreview[];
  dispatchCounts: Record<string, number>;
  recentDispatches: DispatchRow[];
  consentCounts: Record<string, number>;
  lastFailure: { errorCode: string; status: string; at: string } | null;
  fallbacks: FallbackRow[];
}

interface HealthCheckResult {
  ok: boolean;
  reason?: string;
  detail?: string;
  checkedAt?: string;
  running?: boolean;
}
interface TestConnectionResult {
  ok: boolean;
  reason?: string;
  detail?: string;
  checkedAt?: string;
  running?: boolean;
}

const STAGES = ["SHADOW", "ROLLOUT", "GA", "RETIRED"];
const CIRCUIT_STATES = ["CLOSED", "OPEN", "HALF_OPEN", "DISABLED"];

// Honest operating-mode badges — the same labels the list view uses.
const MODE_META: Record<string, { label: string; cls: string }> = {
  API_SYNC: { label: "API sync", cls: "bg-tone-sage-bg text-tone-sage-fg" },
  GUIDED_UPDATE: { label: "Guided update", cls: "bg-tone-sky-bg text-tone-sky-fg" },
  COMING_SOON: { label: "Coming soon", cls: "bg-tone-honey-bg text-tone-honey-fg" },
  DISABLED: { label: "Disabled", cls: "bg-foreground/5 text-muted-foreground" },
};

// Dispatch statuses in their natural lifecycle order for the breakdown strip.
const DISPATCH_STATUSES = ["QUEUED", "DISPATCHING", "SUBMITTED", "CONFIRMED", "NEEDS_USER", "FAILED"];

const CAPABILITY_LABELS: Record<string, string> = {
  addressValidate: "Validate address",
  addressUpdatePush: "Push address (zero-touch)",
  readBackVerify: "Read-back verify",
  asyncConfirm: "Async confirm (webhook)",
  household: "Household / multi-member",
  business: "Business address",
};

interface StepUpRequest {
  title: string;
  description: string;
  confirmLabel: string;
  run: (values: StepUpValues) => Promise<boolean>;
}

/** Compact "2h ago" style relative label. */
function relativeTime(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function statusBadgeClass(status: string): string {
  if (status === "CONFIRMED") return "bg-tone-sage-bg text-tone-sage-fg";
  if (status === "FAILED" || status === "NEEDS_USER") return "bg-destructive/10 text-destructive";
  return "bg-foreground/5 text-muted-foreground";
}

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {action}
      </div>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-medium text-foreground">{children}</span>
    </div>
  );
}

export default function ConnectorDetailClient() {
  const params = useParams();
  const connectorKey = Array.isArray(params.connectorKey) ? params.connectorKey[0] : (params.connectorKey as string);

  const [detail, setDetail] = useState<ConnectorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [health, setHealth] = useState<HealthCheckResult | null>(null);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ stage: "SHADOW", rolloutPercent: 0, circuitState: "CLOSED", notes: "" });

  const [stepUp, setStepUp] = useState<StepUpRequest | null>(null);
  const [stepUpBusy, setStepUpBusy] = useState(false);
  const [stepUpError, setStepUpError] = useState<string | null>(null);
  const [stepUpRequiresMfa, setStepUpRequiresMfa] = useState(false);

  const load = useCallback(() => {
    if (!connectorKey) return;
    setLoading(true);
    fetch(`/api/connectors/${encodeURIComponent(connectorKey)}`)
      .then((r) => {
        if (r.status === 404) {
          setNotFound(true);
          return null;
        }
        if (!r.ok) throw new Error("load failed");
        return r.json();
      })
      .then((d: ConnectorDetail | null) => {
        if (!d) return;
        setDetail(d);
        if (d.config) {
          setForm({
            stage: d.config.stage,
            rolloutPercent: d.config.rolloutPercent,
            circuitState: d.config.circuitState,
            notes: d.config.notes ?? "",
          });
        }
      })
      .catch(() => toast.error("Failed to load connector"))
      .finally(() => setLoading(false));
  }, [connectorKey]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Step-up plumbing (mirrors the list view) ─────────────────────────────
  const requestStepUp = (request: StepUpRequest) => {
    setStepUp(request);
    setStepUpError(null);
    setStepUpRequiresMfa(false);
  };
  const closeStepUp = () => {
    if (!stepUpBusy) {
      setStepUp(null);
      setStepUpError(null);
      setStepUpRequiresMfa(false);
    }
  };
  const confirmStepUp = async (_pw: string, values: StepUpValues) => {
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
    method: "PUT" | "POST",
    url: string,
    payload: Record<string, unknown>,
    stepUpValues: StepUpValues,
    successMessage: string,
    afterSuccess?: () => void,
  ): Promise<boolean> => {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, ...stepUpValues }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = data.error || "Failed";
      if (data.requiresPassword || res.status === 401 || res.status === 403) {
        setStepUpError(message);
        setStepUpRequiresMfa(Boolean(data.requiresMfa));
      }
      toast.error(message);
      return false;
    }
    toast.success(successMessage);
    afterSuccess?.();
    load();
    return true;
  };

  const cfg = detail?.config ?? null;

  const toggleEnabled = () => {
    if (!cfg) return;
    const next = !cfg.enabled;
    requestStepUp({
      title: `${next ? "Enable" : "Disable"} ${connectorKey}`,
      description: next
        ? "Enabling lets this connector run for eligible users."
        : "Disabling is the kill switch — in-flight work falls back to manual.",
      confirmLabel: next ? "Enable" : "Disable (kill switch)",
      run: (values) =>
        sendMutation(
          "PUT",
          "/api/connectors",
          { connectorKey, enabled: next },
          values,
          `${connectorKey} ${next ? "enabled" : "disabled"}`,
        ),
    });
  };

  const saveConfig = () => {
    if (!cfg) return;
    requestStepUp({
      title: `Update ${connectorKey}`,
      description: "Enter your admin password and MFA code or backup code before changing connector behavior.",
      confirmLabel: "Update connector",
      run: (values) =>
        sendMutation(
          "PUT",
          "/api/connectors",
          {
            connectorKey,
            stage: form.stage,
            rolloutPercent: form.rolloutPercent,
            circuitState: form.circuitState,
            notes: form.notes,
          },
          values,
          "Connector updated",
          () => setEditing(false),
        ),
    });
  };

  const bulkRevoke = () => {
    requestStepUp({
      title: `Revoke all ${connectorKey} consents`,
      description:
        "Security-incident kill switch: revokes every user's grant and zeroes stored tokens. Enter MFA or a backup code; this cannot be undone.",
      confirmLabel: "Revoke all consents",
      run: (values) =>
        sendMutation(
          "POST",
          "/api/connectors/consents",
          { connectorKey, reason: "SECURITY_INCIDENT" },
          values,
          `Revoked ${connectorKey} consents`,
        ),
    });
  };

  // ── Read-only probes (no step-up) ────────────────────────────────────────
  const runHealthCheck = async () => {
    setHealth({ ok: false, running: true });
    try {
      const res = await fetch("/api/connectors/healthcheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectorKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Health check failed");
        setHealth({ ok: false, reason: data.error, running: false });
        return;
      }
      setHealth({ ok: Boolean(data.ok), reason: data.reason, detail: data.detail, checkedAt: data.checkedAt, running: false });
      if (data.ok) toast.success(`${connectorKey}: healthy`);
      else toast.error(`${connectorKey}: ${data.reason || "unhealthy"}${data.detail ? ` — ${data.detail}` : ""}`);
    } catch {
      toast.error("Health check failed");
      setHealth({ ok: false, reason: "ERROR", running: false });
    }
  };

  // Credential test only exists for USPS today (the /test-connection route is
  // USPS-specific); offer it whenever credentials are configured.
  const runTestConnection = async () => {
    setTestResult({ ok: false, running: true });
    try {
      const res = await fetch("/api/connectors/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectorKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        toast.error(data.error || "Not permitted");
        setTestResult({ ok: false, reason: data.error, running: false });
        return;
      }
      setTestResult({ ok: Boolean(data.ok), reason: data.reason, detail: data.detail, checkedAt: data.checkedAt, running: false });
      if (data.ok) toast.success(`${connectorKey}: credentials verified`);
      else toast.error(`${connectorKey}: ${data.detail || data.reason || "test failed"}`);
    } catch {
      toast.error("Test failed to run");
      setTestResult({ ok: false, reason: "ERROR", running: false });
    }
  };

  if (loading && !detail) {
    return (
      <div className="space-y-6">
        <Link href="/connectors" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Connectors
        </Link>
        <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (notFound || !detail) {
    return (
      <div className="space-y-6">
        <Link href="/connectors" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Connectors
        </Link>
        <div className="rounded-xl border border-border bg-card">
          <EmptyState
            icon={Plug}
            title="Connector not found"
            description="No built-in adapter or control-plane row exists for this key."
          />
        </div>
      </div>
    );
  }

  const mode = MODE_META[detail.mode] ?? { label: detail.mode, cls: "bg-foreground/5 text-muted-foreground" };
  const totalConsents = Object.values(detail.consentCounts).reduce((a, b) => a + b, 0);
  const grantedConsents = detail.consentCounts.GRANTED ?? 0;
  const hasDispatch = Object.values(detail.dispatchCounts).some((n) => n > 0);
  const credentialsConfigured = detail.credentials.some((c) => c.configured);

  return (
    <div className="space-y-6">
      <PasswordConfirmModal
        open={Boolean(stepUp)}
        title={stepUp?.title || "Confirm action"}
        description={stepUp?.description || "Enter your admin password to continue."}
        confirmLabel={stepUp?.confirmLabel || "Confirm"}
        busy={stepUpBusy}
        error={stepUpError}
        requiresMfa={stepUpRequiresMfa}
        onClose={closeStepUp}
        onConfirm={confirmStepUp}
      />

      <Link href="/connectors" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Connectors
      </Link>

      {/* ── Identity + status/health header ─────────────────────────────── */}
      <AdminPageHeader
        eyebrow="Connector detail"
        title={`<em>${detail.displayName}</em>`}
        subtitle={detail.modeReason}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => load()}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            {detail.registered && (
              <button
                onClick={toggleEnabled}
                aria-pressed={cfg?.enabled ?? false}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
              >
                {cfg?.enabled ? <ToggleRight className="h-4 w-4 text-tone-sage-fg" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                {cfg?.enabled ? "Disable" : "Enable"}
              </button>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">{detail.connectorKey}</span>
        {detail.manifest && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-muted-foreground">v{detail.manifest.version}</span>}
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${mode.cls}`}>{mode.label}</span>
        {cfg ? (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.enabled ? "bg-tone-sage-bg text-tone-sage-fg" : "bg-destructive/10 text-destructive"}`}>
            {cfg.enabled ? "ON" : "OFF"}
          </span>
        ) : (
          <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">not registered</span>
        )}
        {cfg && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{cfg.stage}</span>}
        {cfg && cfg.circuitState !== "CLOSED" && (
          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">{cfg.circuitState}</span>
        )}
      </div>

      {/* ── Status / health + test run ──────────────────────────────────── */}
      <Card
        title="Status & health"
        action={
          <div className="flex items-center gap-2">
            {detail.manifest?.hasHealthCheck && (
              <button
                onClick={runHealthCheck}
                disabled={health?.running}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
              >
                <Activity className={`h-3.5 w-3.5 ${health?.running ? "animate-pulse" : ""}`} /> Health check
              </button>
            )}
            {credentialsConfigured && (
              <button
                onClick={runTestConnection}
                disabled={testResult?.running}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
              >
                <KeyRound className={`h-3.5 w-3.5 ${testResult?.running ? "animate-pulse" : ""}`} /> Test credentials
              </button>
            )}
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
          <div className="divide-y divide-border">
            <Row label="Operating mode">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${mode.cls}`}>{mode.label}</span>
            </Row>
            <Row label="Circuit state">{cfg?.circuitState ?? "—"}</Row>
            <Row label="Agreement">{detail.gate.agreementStatus}</Row>
            <Row label="Credentials">
              {detail.gate.credentialsPresent ? (
                <span className="inline-flex items-center gap-1 text-tone-sage-fg"><CheckCircle2 className="h-3.5 w-3.5" /> configured</span>
              ) : (
                <span className="inline-flex items-center gap-1 text-muted-foreground"><Circle className="h-3.5 w-3.5" /> missing</span>
              )}
            </Row>
          </div>
          <div className="divide-y divide-border">
            <Row label="Health check">
              {!detail.manifest?.hasHealthCheck ? (
                <span className="text-muted-foreground">not supported</span>
              ) : health?.running ? (
                <span className="text-muted-foreground">running…</span>
              ) : health ? (
                <span className={`inline-flex items-center gap-1 ${health.ok ? "text-tone-sage-fg" : "text-destructive"}`}>
                  {health.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                  {health.ok ? "healthy" : health.reason || "unhealthy"}
                </span>
              ) : (
                <span className="text-muted-foreground">not run yet</span>
              )}
            </Row>
            <Row label="Credential test">
              {!credentialsConfigured ? (
                <span className="text-muted-foreground">no credentials</span>
              ) : testResult?.running ? (
                <span className="text-muted-foreground">running…</span>
              ) : testResult ? (
                <span className={`inline-flex items-center gap-1 ${testResult.ok ? "text-tone-sage-fg" : "text-destructive"}`}>
                  {testResult.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                  {testResult.ok ? "verified" : testResult.reason || "failed"}
                </span>
              ) : (
                <span className="text-muted-foreground">not run yet</span>
              )}
            </Row>
            <Row label="Last failure">
              {detail.lastFailure ? (
                <span className="text-destructive" title={new Date(detail.lastFailure.at).toLocaleString()}>
                  {detail.lastFailure.errorCode} ({relativeTime(detail.lastFailure.at)})
                </span>
              ) : (
                <span className="text-muted-foreground">none</span>
              )}
            </Row>
            <Row label="Consents">
              {totalConsents === 0 ? "no consents yet" : `${grantedConsents} active / ${totalConsents}`}
            </Row>
          </div>
        </div>
        {(health?.detail || testResult?.detail) && (
          <div className="mt-3 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
            {health?.detail && <p>Health: {health.detail}</p>}
            {testResult?.detail && <p>Credentials: {testResult.detail}</p>}
          </div>
        )}
      </Card>

      {/* ── Configuration (manifest + masked credentials) ───────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Manifest & capabilities">
          {detail.manifest ? (
            <div className="space-y-4">
              <div className="divide-y divide-border">
                <Row label="Auth">{detail.manifest.authType}{detail.manifest.authScopes.length > 0 ? ` · ${detail.manifest.authScopes.join(", ")}` : ""}</Row>
                <Row label="Allowed hosts"><span className="font-mono text-xs">{detail.manifest.allowedHosts.join(", ")}</span></Row>
                <Row label="Required fields">{detail.manifest.requiredFields.length > 0 ? detail.manifest.requiredFields.join(", ") : "none"}</Row>
                <Row label="Requires origin">{detail.manifest.requiresOrigin ? "yes" : "no"}</Row>
                {detail.manifest.rateLimit && (
                  <Row label="Rate limit">
                    {[
                      detail.manifest.rateLimit.perUserPerDay != null ? `${detail.manifest.rateLimit.perUserPerDay}/user/day` : null,
                      detail.manifest.rateLimit.perConnectorPerMinute != null ? `${detail.manifest.rateLimit.perConnectorPerMinute}/min` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </Row>
                )}
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Capabilities</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(detail.manifest.capabilities).map(([cap, on]) => (
                    <span
                      key={cap}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs ${on ? "bg-tone-sage-bg text-tone-sage-fg" : "bg-foreground/5 text-muted-foreground"}`}
                    >
                      {on ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                      {CAPABILITY_LABELS[cap] ?? cap}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <EmptyState compact icon={Plug} title="No built-in adapter" description="This connector has a control-plane row but no adapter in code, so it can only run as a guided/disabled fallback." />
          )}
        </Card>

        <Card title="Credentials & settings">
          <p className="mb-3 text-xs text-muted-foreground">
            Secrets are masked server-side and never returned in plaintext. Edit values in{" "}
            <Link href="/runtime-config" className="text-foreground underline underline-offset-2">Runtime Config</Link>.
          </p>
          <div className="space-y-2">
            {detail.credentials.map((c) => (
              <div key={c.key} className="flex items-center justify-between gap-3 rounded-lg bg-background px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">{c.label}</p>
                  <p className="truncate font-mono text-[10px] text-muted-foreground">{c.key}</p>
                </div>
                <div className="shrink-0 text-right">
                  {c.configured ? (
                    <span className="font-mono text-xs text-foreground">{c.masked}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">not set</span>
                  )}
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 rounded-lg bg-background px-3 py-2">
              <p className="text-sm text-foreground">Agreement status</p>
              <span className="font-mono text-xs text-foreground">{detail.gate.agreementStatus}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Enable / stage / rollout controls ───────────────────────────── */}
      <Card
        title="Control plane"
        action={
          detail.registered ? (
            editing ? (
              <div className="flex gap-2">
                <button onClick={saveConfig} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">Save</button>
                <button
                  onClick={() => {
                    setEditing(false);
                    if (cfg) setForm({ stage: cfg.stage, rolloutPercent: cfg.rolloutPercent, circuitState: cfg.circuitState, notes: cfg.notes ?? "" });
                  }}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setEditing(true)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent">Edit</button>
            )
          ) : undefined
        }
      >
        {!detail.registered ? (
          <EmptyState
            compact
            icon={Plug}
            title="Not registered in the control plane"
            description="Register this connector from the Connectors list to manage its enable state, stage, and rollout."
          />
        ) : !editing ? (
          <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
            <div className="divide-y divide-border">
              <Row label="Enabled">
                <span className={cfg!.enabled ? "text-tone-sage-fg" : "text-destructive"}>{cfg!.enabled ? "ON" : "OFF"}</span>
              </Row>
              <Row label="Stage">{cfg!.stage}</Row>
              <Row label="Rollout">{cfg!.rolloutPercent}%</Row>
            </div>
            <div className="divide-y divide-border">
              <Row label="Circuit">{cfg!.circuitState}</Row>
              <Row label="Version">v{cfg!.version}</Row>
              <Row label="Updated">{new Date(cfg!.updatedAt).toLocaleString()}</Row>
            </div>
            {cfg!.notes && (
              <p className="col-span-full mt-3 border-t border-border pt-3 text-xs text-muted-foreground">{cfg!.notes}</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Stage</label>
              <select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
                {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Rollout %</label>
              <input type="number" min={0} max={100} value={form.rolloutPercent} onChange={(e) => setForm({ ...form, rolloutPercent: parseInt(e.target.value || "0", 10) })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Circuit state</label>
              <select value={form.circuitState} onChange={(e) => setForm({ ...form, circuitState: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
                {CIRCUIT_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Notes</label>
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" placeholder="Internal notes…" />
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">Saving requires admin password + MFA and is audit-logged.</p>
          </div>
        )}
      </Card>

      {/* ── Dispatch breakdown + recent call log ────────────────────────── */}
      <Card title="Dispatch activity (call log)">
        <div className="mb-4 flex flex-wrap gap-2">
          {DISPATCH_STATUSES.map((s) => (
            <span key={s} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${statusBadgeClass(s)}`}>
              {s.replace("_", " ").toLowerCase()}: {detail.dispatchCounts[s] ?? 0}
            </span>
          ))}
        </div>
        {detail.recentDispatches.length === 0 ? (
          <EmptyState
            compact
            icon={Activity}
            title="No dispatches yet"
            description="Per-call rows appear here once this connector is enabled and users trigger address changes. Aggregate health also lives on Connector Metrics."
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">Event</th>
                  <th className="px-3 py-2 text-right font-medium">Attempts</th>
                  <th className="px-3 py-2 text-left font-medium">Last error</th>
                  <th className="px-3 py-2 text-right font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {detail.recentDispatches.map((d) => (
                  <tr key={d.id} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadgeClass(d.status)}`}>{d.status.replace("_", " ").toLowerCase()}</span>
                      {d.isShadow && <span className="ml-1.5 rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] text-muted-foreground">shadow</span>}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{d.eventId ? d.eventId.slice(0, 12) : "—"}</td>
                    <td className="px-3 py-2 text-right text-foreground">{d.attemptCount}</td>
                    <td className="px-3 py-2 text-xs">{d.lastErrorCode ? <span className="text-destructive">{d.lastErrorCode}</span> : <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-3 py-2 text-right text-xs text-muted-foreground" title={new Date(d.updatedAt).toLocaleString()}>{relativeTime(d.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Retry / fallback config summary ─────────────────────────────── */}
      <Card
        title="Retry & fallback"
        action={
          <Link href="/connector-fallbacks" className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground hover:underline">
            <Link2 className="h-3.5 w-3.5" /> Manage fallbacks
          </Link>
        }
      >
        <div className="mb-4 divide-y divide-border">
          <Row label="Manifest fallback action">
            {detail.manifest?.fallbackActionKey ? <span className="font-mono text-xs">{detail.manifest.fallbackActionKey}</span> : <span className="text-muted-foreground">none declared</span>}
          </Row>
          <Row label="Circuit breaker">{cfg ? cfg.circuitState : "—"}</Row>
        </div>
        {detail.fallbacks.length === 0 ? (
          <EmptyState
            compact
            icon={Link2}
            title="No fallback overrides"
            description="This connector uses its in-code default guided action. Add an admin-managed override in Connector Fallbacks."
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            {detail.fallbacks.map((f) => (
              <div key={f.id} className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">{f.label}</span>
                    <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">{f.type}</span>
                    {f.enabled ? (
                      <span className="rounded bg-tone-sage-bg px-1.5 py-0.5 text-[10px] text-tone-sage-fg">enabled</span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">disabled</span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{f.actionKey}</p>
                  {f.urlTemplate && <p className="truncate text-[11px] text-foreground/40">{f.urlTemplate}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Incident kill-switch ────────────────────────────────────────── */}
      {detail.registered && (
        <Card title="Incident actions">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Revoke all consents</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Revokes every user grant for this connector, zeroes stored tokens, and drains in-flight dispatches. Requires step-up; audit-logged; cannot be undone.
              </p>
            </div>
            <button
              onClick={bulkRevoke}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-destructive/40 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
            >
              <ShieldAlert className="h-4 w-4" /> Revoke all consents
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}
