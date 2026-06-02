"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Link2, ExternalLink, Trash2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface Consent {
  id: string;
  connectorKey: string;
  status: string;
  scopes: string[];
}

interface CatalogEntry {
  connectorKey: string;
  displayName: string;
  /** Server-derived mode: API_SYNC | GUIDED_UPDATE | COMING_SOON. */
  mode: string;
  guidedAction?: {
    label: string;
    url: string;
    helperText: string;
  } | null;
}

interface CatalogResponse {
  connectors?: CatalogEntry[];
  entitlement?: { apiSync?: boolean };
}

// Mode -> user-facing badge. The server derives the mode (resolveConnectorMode),
// so a partner is never shown as "API sync" without a signed agreement.
const MODE_BADGE: Record<string, { label: string; cls: string }> = {
  API_SYNC: { label: "API sync", cls: "bg-tone-emerald-bg text-tone-emerald-fg" },
  GUIDED_UPDATE: { label: "Guided update", cls: "bg-tone-cyan-bg text-tone-cyan-fg" },
  COMING_SOON: { label: "Coming soon", cls: "bg-foreground/10 text-foreground/50" },
};

function statusLabel(status: string): string {
  switch (status) {
    case "GRANTED":
      return "Connected";
    case "EXPIRED":
      return "Expired - reconnect";
    case "REVOKED":
      return "Disconnected";
    default:
      return status;
  }
}

export default function ConnectionsPage() {
  const [consents, setConsents] = useState<Consent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [disabled, setDisabled] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(false);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [apiSyncEntitled, setApiSyncEntitled] = useState(false);

  const load = useCallback(() => {
    setError(false);
    // Honest partner catalog with derived modes (independent of consents).
    fetch("/api/connectors/catalog")
      .then((r) => (r.ok ? r.json() : { connectors: [] }))
      .then((d: CatalogResponse) => {
        setCatalog(d.connectors || []);
        setApiSyncEntitled(Boolean(d.entitlement?.apiSync));
      })
      .catch(() => {
        setCatalog([]);
        setApiSyncEntitled(false);
      });
    fetch("/api/partner-consents")
      .then((r) => {
        if (r.status === 404 || r.status === 503) {
          setDisabled(true);
          return { consents: [] };
        }
        if (!r.ok) throw new Error("load failed");
        return r.json();
      })
      .then((d) => setConsents(d.consents || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const grantedKeys = new Set(consents.filter((c) => c.status === "GRANTED").map((c) => c.connectorKey));
  const connectable = catalog.filter((c) => !grantedKeys.has(c.connectorKey));

  const connect = (key: string) => {
    // Server-side OAuth: the device/browser never holds the token. Inert (503)
    // until partner credentials are configured.
    window.location.href = `/api/partner-consents/oauth/initiate?connector=${encodeURIComponent(key)}`;
  };

  const revoke = async (c: Consent) => {
    setBusy(c.connectorKey);
    try {
      const res = await fetch(`/api/partner-consents/${c.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        toast.error("Couldn't disconnect. Try again.");
        return;
      }
      toast.success("Disconnected.");
      load();
    } finally {
      setBusy(null);
    }
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/connector-dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Couldn't start a sync.");
        return;
      }
      toast.success(data.created > 0 ? `Syncing your address to ${data.created} partner(s)...` : "Nothing to sync yet.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition">
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Connections</h1>
          <p className="text-sm text-muted-foreground">
            Connect supported partners for API sync, or use guided open-and-update steps when a partner needs you to submit.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading...
        </div>
      ) : disabled ? (
        <div className="rounded-2xl border border-border bg-foreground/5 p-6 text-sm text-muted-foreground">
          Partner connections aren&apos;t available on your plan yet.
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
          Couldn&apos;t load your connections.{" "}
          <button onClick={load} className="font-medium underline hover:no-underline">
            Try again
          </button>
        </div>
      ) : (
        <>
          {consents.length > 0 && (
            <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <span className="text-sm font-semibold text-foreground">Connected</span>
                <button
                  type="button"
                  onClick={syncNow}
                  disabled={syncing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-tone-orange-fg text-white text-xs font-medium hover:bg-tone-orange-bg transition disabled:opacity-50"
                >
                  {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Sync now
                </button>
              </div>
              <div className="px-5 pb-4 space-y-0.5">
                {consents.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between py-3 border-b border-foreground/[0.03] last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <Link2 className="h-4 w-4 text-tone-cyan-fg" />
                      <div>
                        <p className="text-sm font-medium text-foreground/80">{c.connectorKey.toUpperCase()}</p>
                        <p className="text-[11px] text-foreground/40">{statusLabel(c.status)}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => revoke(c)}
                      disabled={busy === c.connectorKey}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition disabled:opacity-50"
                    >
                      {busy === c.connectorKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      Disconnect
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl overflow-hidden">
            <div className="px-5 pt-5 pb-3 text-sm font-semibold text-foreground">Available</div>
            <div className="px-5 pb-4 space-y-0.5">
              {catalog.length === 0 ? (
                <p className="text-[13px] text-foreground/40 py-2">
                  No partner connections are available yet. Supported partners will appear here when the connector catalog is enabled.
                </p>
              ) : connectable.length === 0 ? (
                <p className="text-[13px] text-foreground/40 py-2">All available partners are connected.</p>
              ) : (
                connectable.map((c) => {
                  const badge = MODE_BADGE[c.mode];
                  return (
                    <div
                      key={c.connectorKey}
                      className="flex items-center justify-between py-3 border-b border-foreground/[0.03] last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <Link2 className="h-4 w-4 text-foreground/40" />
                        <p className="text-sm font-medium text-foreground/80">{c.displayName}</p>
                        {badge && (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.cls}`}>
                            {badge.label}
                          </span>
                        )}
                      </div>
                      {/* OAuth connect only when the partner is truly API-sync (signed
                          agreement + credentials) and the caller's plan is entitled.
                          Otherwise the honest path is guided/upgrade, not a doomed 403. */}
                      {c.mode === "API_SYNC" && apiSyncEntitled ? (
                        <button
                          type="button"
                          onClick={() => connect(c.connectorKey)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-tone-orange-fg text-white text-xs font-medium hover:bg-tone-orange-bg transition"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Connect
                        </button>
                      ) : c.mode === "GUIDED_UPDATE" && c.guidedAction ? (
                        <a
                          href={c.guidedAction.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs font-medium text-foreground hover:bg-foreground/5 transition"
                          title={c.guidedAction.helperText}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          {c.guidedAction.label}
                        </a>
                      ) : (
                        <span className="text-[11px] text-foreground/40">
                          {c.mode === "COMING_SOON"
                            ? "Coming soon"
                            : c.mode === "API_SYNC"
                              ? "Pro annual"
                              : "Guided update"}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
