"use client";

import { FeedbackAction } from "@/components/ui/feedback-action";
import { ViewOnMap } from "@/components/ui/view-on-map";
import { TimedUndoAction } from "@/components/ui/timed-undo-action";

/**
 * Preview sections for the sync/map/undo trio of the shadcn batch:
 *   - feedback-action   -> inline provider/import sync status
 *   - view-on-map       -> LocateFlow address / provider map
 *   - timed-undo-action -> timed-undo for destructive actions
 *
 * Kept in its own file so it can be appended to the shared
 * /dev/shadcn-batch preview with a single import + render line. Each component
 * is re-themed onto the sapphire (no-gold) tokens and fed realistic LocateFlow
 * sample data. The parent page already wraps everything in a `.light` container.
 */
export function SyncMapUndoSections() {
  return (
    <>
      {/* ---------------------------------------------------------------- */}
      <section className="mb-12 rounded-xl border border-border bg-card p-8">
        <div className="mb-1 text-sm font-semibold uppercase tracking-wide text-primary">
          feedback-action
        </div>
        <h2 className="mb-1 text-lg font-semibold text-foreground">
          Inline sync / import status
        </h2>
        <p className="mb-8 text-sm text-muted-foreground">
          Inline status for a provider connection or the statement → AI
          subscription import. Self-cycles through Sync failed → Importing
          subscriptions → Synced; tap the retry pill to re-run. Error uses the
          destructive token, the spinner uses sapphire primary, and Synced uses
          the success token.
        </p>
        <div className="flex min-h-[80px] items-center justify-center">
          <FeedbackAction
            initialStatus="error"
            errorMessage="Sync failed"
            loadingMessage="Importing subscriptions"
            successMessage="Synced"
          />
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="mb-12 rounded-xl border border-border bg-card p-8">
        <div className="mb-1 text-sm font-semibold uppercase tracking-wide text-primary">
          view-on-map
        </div>
        <h2 className="mb-1 text-lg font-semibold text-foreground">
          Address / provider map
        </h2>
        <p className="mb-8 text-sm text-muted-foreground">
          &quot;View on map&quot; trigger for a LocateFlow address — here the new
          home. Tap to expand the embedded Google Map with the loading +
          map-invert treatment; the pill, surfaces, and close button resolve
          through card / muted / border tokens.
        </p>
        <div className="flex min-h-[120px] items-center justify-center">
          <ViewOnMap
            address="1242 Beacon St, Brookline, MA 02446"
            triggerLabel="View on map"
          />
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="mb-12 rounded-xl border border-border bg-card p-8">
        <div className="mb-1 text-sm font-semibold uppercase tracking-wide text-primary">
          timed-undo-action
        </div>
        <h2 className="mb-1 text-lg font-semibold text-foreground">
          Timed-undo for destructive actions
        </h2>
        <p className="mb-8 text-sm text-muted-foreground">
          Undo-with-countdown for deleting an address, service, provider, or
          reminder. Tap to delete; a 5-second window lets you undo before it
          commits. Re-themed onto the destructive token — no hardcoded red.
        </p>
        <div className="flex min-h-[100px] items-center justify-center">
          <TimedUndoAction
            initialSeconds={5}
            deleteLabel="Delete address"
            undoLabel="Undo delete"
          />
        </div>
      </section>
    </>
  );
}

export default SyncMapUndoSections;
