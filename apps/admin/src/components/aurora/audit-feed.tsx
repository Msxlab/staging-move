/**
 * Audit feed — compact "actor action target" rows with a tone halo dot and
 * a mono timestamp. Pure presentational server component: the dashboard
 * page owns the (permission-gated) query and passes pre-redacted strings,
 * so nothing sensitive ever reaches this layer.
 *
 * Tone classes follow the admin's semantic ramp: sage = positive change,
 * honey = security/caution (WARN only, per the corporate theme rules),
 * rose = destructive/failure, info = neutral corporate accent.
 */

export type AuditFeedTone = "sage" | "honey" | "rose" | "info";

export interface AuditFeedItem {
  id: string;
  /** Masked actor label, e.g. "ad***@locateflow.com" or "system". */
  actor: string;
  /** Humanized action, e.g. "updated feature flag". */
  action: string;
  /** Entity label, e.g. "Provider · cmbk****wxyz". */
  target: string;
  /** ISO timestamp of the row. */
  when: string;
  tone: AuditFeedTone;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return iso;
  const mins = Math.max(0, Math.floor((Date.now() - then) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(then).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function AuditFeed({ items }: { items: AuditFeedItem[] }) {
  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No audit activity yet.
      </p>
    );
  }

  return (
    <div className="au-feed">
      {items.map((item) => (
        <div className="au-fitem" key={item.id}>
          <span className={`au-fdot tone-${item.tone}`} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="au-fline">
              <b>{item.actor}</b> {item.action}{" "}
              <code className="au-ftarget">{item.target}</code>
            </p>
            <p className="au-fwhen">{relativeTime(item.when)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
