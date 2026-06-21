import { useId } from "react";

type Tier = "INDIVIDUAL" | "FAMILY" | "PRO";

interface TierMedallionProps {
  tier: Tier;
  size?: number;
}

/**
 * A larger sticker rendition for dashboard panels (Plan distribution,
 * Premium upgrades). Smaller cousin of the full PremiumSticker library
 * shipped to apps/web — admin only needs the Hex variant at one size,
 * so we keep the dependency surface tiny.
 */
export function TierMedallion({ tier, size = 56 }: TierMedallionProps) {
  const id = useId();
  if (tier === "INDIVIDUAL") {
    return (
      <svg width={size} height={size} viewBox="0 0 80 80" aria-hidden="true">
        <defs>
          <linearGradient id={`tm-i-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#DCBC7C" />
            <stop offset="100%" stopColor="#B0852F" />
          </linearGradient>
        </defs>
        <polygon
          points="40,8 66,22 66,58 40,72 14,58 14,22"
          fill={`url(#tm-i-${id})`}
          stroke="#fff"
          strokeWidth="1.5"
        />
        <text
          x="40"
          y="49"
          textAnchor="middle"
          fill="#fff"
          fontFamily="var(--font-display), Georgia, serif"
          fontSize="22"
          fontStyle="italic"
        >
          i
        </text>
      </svg>
    );
  }
  if (tier === "FAMILY") {
    return (
      <svg width={size} height={size} viewBox="0 0 80 80" aria-hidden="true">
        <defs>
          <linearGradient id={`tm-f-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#DDE7F5" />
            <stop offset="50%" stopColor="#4FD1B5" />
            <stop offset="100%" stopColor="#B0852F" />
          </linearGradient>
        </defs>
        <polygon points="40,4 70,20 70,60 40,76 10,60 10,20" fill={`url(#tm-f-${id})`} />
        <polygon
          points="40,12 62,24 62,56 40,68 18,56 18,24"
          fill="#0E1521"
          stroke="rgba(79,209,181,0.4)"
          strokeWidth="0.5"
        />
        <text
          x="40"
          y="50"
          textAnchor="middle"
          fill="#4FD1B5"
          fontFamily="var(--font-display), Georgia, serif"
          fontSize="22"
          fontStyle="italic"
        >
          F
        </text>
        <circle cx="40" cy="14" r="2" fill="#CBA45E" />
      </svg>
    );
  }
  // PRO
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" aria-hidden="true" className="tm-pro">
      <defs>
        <linearGradient id={`tm-p-foil-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#DDE7F5" />
          <stop offset="40%" stopColor="#CBA45E" />
          <stop offset="100%" stopColor="#765514" />
        </linearGradient>
        <radialGradient id={`tm-p-glow-${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#CBA45E" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#CBA45E" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="40" cy="40" r="38" fill={`url(#tm-p-glow-${id})`} />
      <polygon points="40,2 72,20 72,60 40,78 8,60 8,20" fill={`url(#tm-p-foil-${id})`} />
      <polygon points="40,10 65,24 65,56 40,70 15,56 15,24" fill="#0E1521" />
      <polygon
        points="40,15 60,26 60,54 40,65 20,54 20,26"
        fill="none"
        stroke="#CBA45E"
        strokeOpacity="0.5"
        strokeWidth="0.5"
      />
      <text
        x="40"
        y="38"
        textAnchor="middle"
        fill="#CBA45E"
        fontFamily="var(--font-mono, 'Geist Mono', ui-monospace)"
        fontSize="8"
        fontWeight="600"
        letterSpacing="0.3em"
      >
        PRO
      </text>
      <circle cx="40" cy="48" r="5" fill="#CBA45E" />
      <circle cx="38.5" cy="46.5" r="1.5" fill="#DDE7F5" opacity="0.8" />
      {([
        [40, 10],
        [65, 24],
        [65, 56],
        [40, 70],
        [15, 56],
        [15, 24],
      ] as const).map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1" fill="#DDE7F5" />
      ))}
    </svg>
  );
}
