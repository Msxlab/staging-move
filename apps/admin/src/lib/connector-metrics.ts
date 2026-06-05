export interface ConnectorMetricSummary {
  connectorKey: string;
  total: number;
  queued: number;
  dispatching: number;
  submitted: number;
  confirmed: number;
  needsUser: number;
  failed: number;
  /** confirmed / (confirmed + needsUser + failed). Null when nothing is terminal yet. */
  confirmRate: number | null;
}

/**
 * Fold the admin /api/connectors `dispatchByConnector` breakdown
 * ({ [connectorKey]: { [status]: count } }, already shadow-excluded server-side)
 * into a per-connector health summary with a confirm rate over terminal
 * outcomes. Pure + side-effect free for unit testing.
 */
export function summarizeConnectorMetrics(
  byConnector: Record<string, Record<string, number>>,
): ConnectorMetricSummary[] {
  return Object.entries(byConnector)
    .map(([connectorKey, counts]) => {
      const get = (status: string) => counts[status] ?? 0;
      const confirmed = get("CONFIRMED");
      const needsUser = get("NEEDS_USER");
      const failed = get("FAILED");
      const terminal = confirmed + needsUser + failed;
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      return {
        connectorKey,
        total,
        queued: get("QUEUED"),
        dispatching: get("DISPATCHING"),
        submitted: get("SUBMITTED"),
        confirmed,
        needsUser,
        failed,
        confirmRate: terminal > 0 ? confirmed / terminal : null,
      };
    })
    .sort((a, b) => a.connectorKey.localeCompare(b.connectorKey));
}
