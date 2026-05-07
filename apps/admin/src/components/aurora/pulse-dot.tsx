type PulseTone = "mint" | "coral" | "amber" | "cool";

const TONE: Record<PulseTone, string> = {
  mint: "var(--au-mint)",
  coral: "var(--au-coral)",
  amber: "var(--au-amber)",
  cool: "var(--au-cool)",
};

/** Solid dot with a soft pulsing ring — used for "live" indicators. */
export function PulseDot({ tone = "mint" }: { tone?: PulseTone }) {
  const c = TONE[tone];
  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        width: 8,
        height: 8,
      }}
    >
      <span
        className="au-pulse-ping"
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 999,
          background: c,
          opacity: 0.6,
          animation: "au-pulse 1.6s ease-out infinite",
        }}
      />
      <span
        style={{
          position: "relative",
          width: 8,
          height: 8,
          borderRadius: 999,
          background: c,
        }}
      />
    </span>
  );
}
