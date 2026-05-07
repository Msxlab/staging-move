/**
 * Animated northern-lights background. Four GPU-only radial layers drift on
 * independent timelines; CSS keyframes do the work. The grain layer adds the
 * "real glass" texture. Both layers respect prefers-reduced-motion and are
 * pinned to the viewport so they sit behind any scrollable admin content.
 *
 * Pure presentational — no client hooks needed.
 */
export function AuroraBackground() {
  return (
    <>
      <div className="au-aurora" aria-hidden="true">
        <div className="au-aurora__layer l1" />
        <div className="au-aurora__layer l2" />
        <div className="au-aurora__layer l3" />
        <div className="au-aurora__layer l4" />
      </div>
      <div className="au-grain" aria-hidden="true" />
    </>
  );
}
