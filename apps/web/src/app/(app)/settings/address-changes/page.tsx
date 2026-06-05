"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, MapPin } from "lucide-react";

interface Dispatch {
  connectorKey: string;
  status: string;
  confirmedAt: string | null;
  lastErrorCode: string | null;
}

interface Change {
  id: string;
  fromAddressId: string | null;
  toAddressId: string;
  status: string;
  dispatchCount: number;
  createdAt: string;
  dispatches: Dispatch[];
}

const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: "Confirmed",
  SUBMITTED: "Submitted",
  QUEUED: "Queued",
  DISPATCHING: "Sending",
  NEEDS_USER: "Action needed",
  FAILED: "Failed",
};

function statusClass(status: string): string {
  if (status === "CONFIRMED") return "text-tone-sage-fg";
  if (status === "NEEDS_USER" || status === "FAILED") return "text-tone-rose-fg";
  return "text-foreground/60";
}

export default function AddressChangesPage() {
  const [changes, setChanges] = useState<Change[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/connectors/changes")
      .then((r) => (r.ok ? r.json() : { changes: [] }))
      .then((d) => setChanges(d.changes || []))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Link
        href="/settings/connections"
        className="mb-4 inline-flex items-center gap-1 text-sm text-foreground/60 hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Connections
      </Link>

      <h1 className="text-2xl font-semibold text-foreground">Address change history</h1>
      <p className="mt-1 text-sm text-foreground/60">
        Where each address change was sent, and whether the provider confirmed it.
      </p>

      {loading ? (
        <p className="mt-6 text-sm text-foreground/50">Loading…</p>
      ) : changes.length === 0 ? (
        <div className="mt-8 rounded-lg border border-foreground/10 p-8 text-center">
          <MapPin className="mx-auto h-6 w-6 text-foreground/30" />
          <p className="mt-3 text-sm font-medium text-foreground">No address changes yet</p>
          <p className="mt-1 text-xs text-foreground/50">
            When you change your address and have connected providers, each update appears here.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {changes.map((c) => (
            <div key={c.id} className="rounded-lg border border-foreground/10 p-4">
              <div className="flex items-center gap-2 text-xs text-foreground/50">
                <Clock className="h-3.5 w-3.5" />
                {new Date(c.createdAt).toLocaleDateString()}
                <span className="ml-auto">
                  {c.dispatchCount} provider{c.dispatchCount === 1 ? "" : "s"}
                </span>
              </div>
              {c.dispatches.length === 0 ? (
                <p className="mt-3 text-xs text-foreground/40">No connected providers for this change.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {c.dispatches.map((d, i) => (
                    <li key={`${d.connectorKey}-${i}`} className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">{d.connectorKey.toUpperCase()}</span>
                      <span className={statusClass(d.status)}>{STATUS_LABEL[d.status] ?? d.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
