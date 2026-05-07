"use client";

import { useEffect, useState } from "react";
import { DollarSign, MapPin, Tag, Loader2, Lock } from "lucide-react";

interface CellRow {
  state: string;
  category: string;
  totalSpend: number;
  userCount: number;
  serviceCount: number;
}

interface CategoryRow {
  category: string;
  totalSpend: number;
  userCount: number;
}

interface StateRow {
  state: string;
  totalSpend: number;
  userCount: number;
}

interface SpendingResponse {
  byStateCategory: CellRow[];
  byState: StateRow[];
  byCategory: CategoryRow[];
  total: { totalSpend: number; userCount: number; serviceCount: number };
  privacyFloor: number;
}

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatCategory(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

export function SpendingByRegionWidget() {
  const [data, setData] = useState<SpendingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics/user-spending")
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        return res.json() as Promise<SpendingResponse>;
      })
      .then((d) => setData(d))
      .catch((err) => setError(err.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-tone-orange-fg" /> User-reported spending by region & category
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Aggregated from `Service.monthlyCost`. Cells with fewer than{" "}
            {data?.privacyFloor ?? 5} distinct users are hidden for k-anonymity.
          </p>
        </div>
        {data && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total monthly</p>
            <p className="text-lg font-bold text-foreground">{USD.format(data.total.totalSpend)}</p>
            <p className="text-xs text-muted-foreground">
              {data.total.userCount} users Â· {data.total.serviceCount} services
            </p>
          </div>
        )}
      </div>

      {loading && (
        <div className="py-8 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {error && (
        <div className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {data && data.total.userCount === 0 && !loading && (
        <div className="py-6 text-center text-sm text-muted-foreground">
          No users have entered service costs yet.
        </div>
      )}

      {data && data.total.userCount > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Top states
            </h3>
            {data.byState.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                <Lock className="h-3 w-3 inline-block" /> Below privacy floor
              </p>
            ) : (
              <ul className="space-y-1.5">
                {data.byState.slice(0, 8).map((row) => (
                  <li
                    key={row.state}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="font-medium">{row.state}</span>
                    <span className="text-muted-foreground text-xs">
                      {row.userCount} users
                    </span>
                    <span className="font-mono text-sm">{USD.format(row.totalSpend)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
              <Tag className="h-3 w-3" /> Top categories
            </h3>
            {data.byCategory.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                <Lock className="h-3 w-3 inline-block" /> Below privacy floor
              </p>
            ) : (
              <ul className="space-y-1.5">
                {data.byCategory.slice(0, 8).map((row) => (
                  <li
                    key={row.category}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="font-medium">{formatCategory(row.category)}</span>
                    <span className="text-muted-foreground text-xs">
                      {row.userCount} users
                    </span>
                    <span className="font-mono text-sm">{USD.format(row.totalSpend)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {data && data.byStateCategory.length > 0 && (
        <details className="rounded border border-border">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium hover:bg-muted">
            State Ã— category breakdown ({data.byStateCategory.length} cells)
          </summary>
          <div className="px-3 py-2 max-h-96 overflow-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="text-left py-1">State</th>
                  <th className="text-left py-1">Category</th>
                  <th className="text-right py-1">Users</th>
                  <th className="text-right py-1">Spend / mo</th>
                </tr>
              </thead>
              <tbody>
                {data.byStateCategory.map((row) => (
                  <tr key={`${row.state}-${row.category}`} className="border-t">
                    <td className="py-1 font-medium">{row.state}</td>
                    <td className="py-1">{formatCategory(row.category)}</td>
                    <td className="py-1 text-right">{row.userCount}</td>
                    <td className="py-1 text-right font-mono">
                      {USD.format(row.totalSpend)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
