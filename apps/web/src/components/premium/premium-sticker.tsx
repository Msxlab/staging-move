"use client";

import { useId, type ReactElement } from "react";

export type StickerTier = "individual" | "family" | "pro";
export type StickerStyle = "hex" | "medal" | "minimal" | "stamp";

interface SizeProps {
  size?: number;
}

/* ─── HEX ────────────────────────────────────────────────────────────── */

function HexIndividual({ size = 80 }: SizeProps) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 80 80">
      <defs>
        <linearGradient id={`hi-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#A5C9F0" />
          <stop offset="100%" stopColor="#5C9DDC" />
        </linearGradient>
      </defs>
      <polygon
        points="40,8 66,22 66,58 40,72 14,58 14,22"
        fill={`url(#hi-${id})`}
        stroke="#fff"
        strokeWidth="1.5"
      />
      <polygon
        points="40,8 66,22 66,58 40,72 14,58 14,22"
        fill="none"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="0.5"
      />
      <text
        x="40"
        y="48"
        textAnchor="middle"
        fill="#fff"
        style={{
          fontFamily: "var(--font-display, Fraunces, Georgia, serif)",
          fontSize: 22,
          fontWeight: 400,
          fontStyle: "italic",
        }}
      >
        i
      </text>
    </svg>
  );
}

function HexFamily({ size = 80 }: SizeProps) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 80 80">
      <defs>
        <linearGradient id={`hf-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#DDE7F5" />
          <stop offset="50%" stopColor="#B49BFF" />
          <stop offset="100%" stopColor="#5C9DDC" />
        </linearGradient>
      </defs>
      <polygon points="40,4 70,20 70,60 40,76 10,60 10,20" fill={`url(#hf-${id})`} />
      <polygon
        points="40,12 62,24 62,56 40,68 18,56 18,24"
        fill="#0E1521"
        stroke="rgba(180,155,255,0.4)"
        strokeWidth="0.5"
      />
      <text
        x="40"
        y="49"
        textAnchor="middle"
        fill="#B49BFF"
        style={{
          fontFamily: "var(--font-display, Fraunces, Georgia, serif)",
          fontSize: 22,
          fontWeight: 400,
          fontStyle: "italic",
        }}
      >
        F
      </text>
      <circle cx="40" cy="14" r="2" fill="#7FB6E8" />
    </svg>
  );
}

function HexPro({ size = 80 }: SizeProps) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" className="ps-pro">
      <defs>
        <linearGradient id={`hp-foil-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#DDE7F5" />
          <stop offset="40%" stopColor="#B49BFF" />
          <stop offset="100%" stopColor="#1F5FA0" />
        </linearGradient>
        <linearGradient id={`hp-shine-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#DDE7F5" stopOpacity="0.7" />
          <stop offset="50%" stopColor="#DDE7F5" stopOpacity="0" />
          <stop offset="100%" stopColor="#DDE7F5" stopOpacity="0.3" />
        </linearGradient>
        <radialGradient id={`hp-glow-${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#B49BFF" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#B49BFF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="40" cy="40" r="38" fill={`url(#hp-glow-${id})`} />
      <polygon points="40,2 72,20 72,60 40,78 8,60 8,20" fill={`url(#hp-foil-${id})`} />
      <polygon
        points="40,2 72,20 72,60 40,78 8,60 8,20"
        fill={`url(#hp-shine-${id})`}
        className="ps-pro-shine"
      />
      <polygon points="40,10 65,24 65,56 40,70 15,56 15,24" fill="#0E1521" />
      <polygon
        points="40,15 60,26 60,54 40,65 20,54 20,26"
        fill="none"
        stroke="#B49BFF"
        strokeOpacity="0.5"
        strokeWidth="0.5"
      />
      <text
        x="40"
        y="38"
        textAnchor="middle"
        fill="#B49BFF"
        style={{
          fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace)",
          fontSize: 8,
          fontWeight: 600,
          letterSpacing: "0.3em",
        }}
      >
        PRO
      </text>
      <circle cx="40" cy="48" r="5" fill="#7FB6E8" />
      <circle cx="40" cy="48" r="5" fill={`url(#hp-shine-${id})`} />
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

/* ─── MEDAL ──────────────────────────────────────────────────────────── */

function MedalIndividual({ size = 80 }: SizeProps) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 80 80">
      <defs>
        <linearGradient id={`mi-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#A5C9F0" />
          <stop offset="100%" stopColor="#5C9DDC" />
        </linearGradient>
      </defs>
      <circle cx="40" cy="40" r="30" fill={`url(#mi-${id})`} stroke="#fff" strokeWidth="1.5" />
      <circle
        cx="40"
        cy="40"
        r="24"
        fill="none"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="0.5"
      />
      <text
        x="40"
        y="48"
        textAnchor="middle"
        fill="#fff"
        style={{
          fontFamily: "var(--font-display, Fraunces, Georgia, serif)",
          fontSize: 22,
          fontStyle: "italic",
          fontWeight: 400,
        }}
      >
        i
      </text>
    </svg>
  );
}

function MedalFamily({ size = 80 }: SizeProps) {
  const id = useId();
  const bumps = Array.from({ length: 24 }, (_, i) => {
    const angle = (i / 24) * Math.PI * 2;
    const r = i % 2 === 0 ? 36 : 32;
    return `${40 + Math.cos(angle) * r},${40 + Math.sin(angle) * r}`;
  }).join(" ");
  return (
    <svg width={size} height={size} viewBox="0 0 80 80">
      <defs>
        <linearGradient id={`mf-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#DDE7F5" />
          <stop offset="50%" stopColor="#B49BFF" />
          <stop offset="100%" stopColor="#5C9DDC" />
        </linearGradient>
      </defs>
      <polygon points={bumps} fill={`url(#mf-${id})`} />
      <circle
        cx="40"
        cy="40"
        r="26"
        fill="#0E1521"
        stroke="rgba(180,155,255,0.4)"
        strokeWidth="0.5"
      />
      <text
        x="40"
        y="49"
        textAnchor="middle"
        fill="#B49BFF"
        style={{
          fontFamily: "var(--font-display, Fraunces, Georgia, serif)",
          fontSize: 22,
          fontStyle: "italic",
          fontWeight: 400,
        }}
      >
        F
      </text>
      <circle cx="40" cy="18" r="1.8" fill="#7FB6E8" />
    </svg>
  );
}

function MedalPro({ size = 80 }: SizeProps) {
  const id = useId();
  const bumps = Array.from({ length: 32 }, (_, i) => {
    const angle = (i / 32) * Math.PI * 2;
    const r = i % 2 === 0 ? 38 : 34;
    return `${40 + Math.cos(angle) * r},${40 + Math.sin(angle) * r}`;
  }).join(" ");
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" className="ps-pro">
      <defs>
        <linearGradient id={`mp-foil-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#DDE7F5" />
          <stop offset="40%" stopColor="#B49BFF" />
          <stop offset="100%" stopColor="#1F5FA0" />
        </linearGradient>
        <linearGradient id={`mp-shine-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#DDE7F5" stopOpacity="0.7" />
          <stop offset="50%" stopColor="#DDE7F5" stopOpacity="0" />
          <stop offset="100%" stopColor="#DDE7F5" stopOpacity="0.4" />
        </linearGradient>
        <radialGradient id={`mp-glow-${id}`}>
          <stop offset="0%" stopColor="#B49BFF" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#B49BFF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="40" cy="40" r="38" fill={`url(#mp-glow-${id})`} />
      <polygon points={bumps} fill={`url(#mp-foil-${id})`} />
      <polygon points={bumps} fill={`url(#mp-shine-${id})`} className="ps-pro-shine" />
      <circle cx="40" cy="40" r="28" fill="#0E1521" />
      <circle
        cx="40"
        cy="40"
        r="24"
        fill="none"
        stroke="#B49BFF"
        strokeOpacity="0.5"
        strokeWidth="0.5"
      />
      <text
        x="40"
        y="38"
        textAnchor="middle"
        fill="#B49BFF"
        style={{
          fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace)",
          fontSize: 7.5,
          fontWeight: 600,
          letterSpacing: "0.3em",
        }}
      >
        PRO
      </text>
      <circle cx="40" cy="48" r="5" fill="#7FB6E8" />
      <circle cx="40" cy="48" r="5" fill={`url(#mp-shine-${id})`} />
      <circle cx="38.5" cy="46.5" r="1.5" fill="#DDE7F5" opacity="0.8" />
    </svg>
  );
}

/* ─── MINIMAL ────────────────────────────────────────────────────────── */

function MinimalIndividual({ size = 80 }: SizeProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80">
      <circle cx="40" cy="40" r="30" fill="none" stroke="#7FB6E8" strokeWidth="1.5" />
      <text
        x="40"
        y="46"
        textAnchor="middle"
        fill="#7FB6E8"
        style={{
          fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace)",
          fontSize: 7,
          fontWeight: 600,
          letterSpacing: "0.25em",
        }}
      >
        INDV
      </text>
    </svg>
  );
}

function MinimalFamily({ size = 80 }: SizeProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80">
      <circle cx="40" cy="40" r="32" fill="none" stroke="#B49BFF" strokeWidth="0.5" />
      <circle cx="40" cy="40" r="28" fill="none" stroke="#B49BFF" strokeWidth="1.5" />
      <text
        x="40"
        y="46"
        textAnchor="middle"
        fill="#B49BFF"
        style={{
          fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace)",
          fontSize: 7,
          fontWeight: 600,
          letterSpacing: "0.25em",
        }}
      >
        FAM
      </text>
    </svg>
  );
}

function MinimalPro({ size = 80 }: SizeProps) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" className="ps-pro">
      <defs>
        <linearGradient id={`mnp-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#DDE7F5" />
          <stop offset="50%" stopColor="#B49BFF" />
          <stop offset="100%" stopColor="#5C9DDC" />
        </linearGradient>
      </defs>
      <circle
        cx="40"
        cy="40"
        r="34"
        fill="none"
        stroke="#B49BFF"
        strokeOpacity="0.3"
        strokeWidth="0.5"
      />
      <circle cx="40" cy="40" r="30" fill={`url(#mnp-${id})`} />
      <circle
        cx="40"
        cy="40"
        r="30"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.3"
        strokeWidth="0.5"
        className="ps-pro-shine"
      />
      <text
        x="40"
        y="46"
        textAnchor="middle"
        fill="#0E1521"
        style={{
          fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace)",
          fontSize: 7,
          fontWeight: 700,
          letterSpacing: "0.3em",
        }}
      >
        PRO
      </text>
    </svg>
  );
}

/* ─── STAMP ──────────────────────────────────────────────────────────── */

function stampPath(notches = 14) {
  const r = 3;
  const inner = 8;
  const size = 80 - inner * 2;
  const segs = notches;
  const step = size / segs;
  let d = `M ${inner},${inner}`;
  for (let i = 0; i < segs; i++) {
    const x = inner + step * (i + 0.5);
    d += ` L ${x - r},${inner} A ${r} ${r} 0 0 1 ${x + r},${inner}`;
  }
  d += ` L ${80 - inner},${inner}`;
  for (let i = 0; i < segs; i++) {
    const y = inner + step * (i + 0.5);
    d += ` L ${80 - inner},${y - r} A ${r} ${r} 0 0 1 ${80 - inner},${y + r}`;
  }
  d += ` L ${80 - inner},${80 - inner}`;
  for (let i = segs - 1; i >= 0; i--) {
    const x = inner + step * (i + 0.5);
    d += ` L ${x + r},${80 - inner} A ${r} ${r} 0 0 1 ${x - r},${80 - inner}`;
  }
  d += ` L ${inner},${80 - inner}`;
  for (let i = segs - 1; i >= 0; i--) {
    const y = inner + step * (i + 0.5);
    d += ` L ${inner},${y + r} A ${r} ${r} 0 0 1 ${inner},${y - r}`;
  }
  d += " Z";
  return d;
}

function StampIndividual({ size = 80 }: SizeProps) {
  const id = useId();
  const d = stampPath(10);
  return (
    <svg width={size} height={size} viewBox="0 0 80 80">
      <defs>
        <linearGradient id={`si-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#A5C9F0" />
          <stop offset="100%" stopColor="#5C9DDC" />
        </linearGradient>
      </defs>
      <path d={d} fill={`url(#si-${id})`} />
      <text
        x="40"
        y="36"
        textAnchor="middle"
        fill="rgba(255,255,255,0.7)"
        style={{
          fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace)",
          fontSize: 5,
          fontWeight: 600,
          letterSpacing: "0.2em",
        }}
      >
        VERIFIED
      </text>
      <text
        x="40"
        y="52"
        textAnchor="middle"
        fill="#fff"
        style={{
          fontFamily: "var(--font-display, Fraunces, Georgia, serif)",
          fontSize: 16,
          fontStyle: "italic",
          fontWeight: 400,
        }}
      >
        i
      </text>
    </svg>
  );
}

function StampFamily({ size = 80 }: SizeProps) {
  const id = useId();
  const d = stampPath(12);
  return (
    <svg width={size} height={size} viewBox="0 0 80 80">
      <defs>
        <linearGradient id={`sf-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#DDE7F5" />
          <stop offset="50%" stopColor="#B49BFF" />
          <stop offset="100%" stopColor="#5C9DDC" />
        </linearGradient>
      </defs>
      <path d={d} fill={`url(#sf-${id})`} />
      <rect x="14" y="14" width="52" height="52" fill="#0E1521" rx="1" />
      <text
        x="40"
        y="34"
        textAnchor="middle"
        fill="#B49BFF"
        style={{
          fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace)",
          fontSize: 5,
          fontWeight: 600,
          letterSpacing: "0.2em",
        }}
      >
        VERIFIED
      </text>
      <text
        x="40"
        y="52"
        textAnchor="middle"
        fill="#B49BFF"
        style={{
          fontFamily: "var(--font-display, Fraunces, Georgia, serif)",
          fontSize: 16,
          fontStyle: "italic",
          fontWeight: 400,
        }}
      >
        F
      </text>
    </svg>
  );
}

function StampPro({ size = 80 }: SizeProps) {
  const id = useId();
  const d = stampPath(14);
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" className="ps-pro">
      <defs>
        <linearGradient id={`sp-foil-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#DDE7F5" />
          <stop offset="40%" stopColor="#B49BFF" />
          <stop offset="100%" stopColor="#1F5FA0" />
        </linearGradient>
        <linearGradient id={`sp-shine-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#DDE7F5" stopOpacity="0.6" />
          <stop offset="50%" stopColor="#DDE7F5" stopOpacity="0" />
          <stop offset="100%" stopColor="#DDE7F5" stopOpacity="0.4" />
        </linearGradient>
        <radialGradient id={`sp-glow-${id}`}>
          <stop offset="0%" stopColor="#B49BFF" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#B49BFF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="40" cy="40" r="38" fill={`url(#sp-glow-${id})`} />
      <path d={d} fill={`url(#sp-foil-${id})`} />
      <path d={d} fill={`url(#sp-shine-${id})`} className="ps-pro-shine" />
      <rect x="14" y="14" width="52" height="52" fill="#0E1521" rx="1" />
      <rect
        x="17"
        y="17"
        width="46"
        height="46"
        fill="none"
        stroke="#B49BFF"
        strokeOpacity="0.4"
        strokeWidth="0.5"
        rx="1"
      />
      <text
        x="40"
        y="32"
        textAnchor="middle"
        fill="#B49BFF"
        style={{
          fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace)",
          fontSize: 5,
          fontWeight: 600,
          letterSpacing: "0.25em",
        }}
      >
        LOCATEFLOW
      </text>
      <text
        x="40"
        y="46"
        textAnchor="middle"
        fill="#B49BFF"
        style={{
          fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace)",
          fontSize: 7,
          fontWeight: 700,
          letterSpacing: "0.4em",
        }}
      >
        PRO
      </text>
      <line x1="20" y1="50" x2="60" y2="50" stroke="#B49BFF" strokeOpacity="0.3" strokeWidth="0.3" />
      <text
        x="40"
        y="58"
        textAnchor="middle"
        fill="#A8B5C9"
        style={{
          fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace)",
          fontSize: 4,
          fontWeight: 500,
          letterSpacing: "0.15em",
        }}
      >
        EST · 2026
      </text>
      <circle cx="40" cy="40" r="38" fill="none" stroke="rgba(127,182,232,0.15)" strokeWidth="1" />
    </svg>
  );
}

const STICKER_MAP: Record<
  StickerStyle,
  Record<StickerTier, (props: SizeProps) => ReactElement>
> = {
  hex: { individual: HexIndividual, family: HexFamily, pro: HexPro },
  medal: { individual: MedalIndividual, family: MedalFamily, pro: MedalPro },
  minimal: { individual: MinimalIndividual, family: MinimalFamily, pro: MinimalPro },
  stamp: { individual: StampIndividual, family: StampFamily, pro: StampPro },
};

interface PremiumStickerProps {
  tier: StickerTier;
  style?: StickerStyle;
  size?: number;
  withShimmer?: boolean;
  className?: string;
}

export function PremiumSticker({
  tier,
  style = "hex",
  size = 80,
  withShimmer = true,
  className,
}: PremiumStickerProps) {
  const Comp = STICKER_MAP[style][tier];
  return (
    <span
      className={`premium-sticker tier-${tier} style-${style} ${withShimmer ? "shimmer" : ""} ${className ?? ""}`}
      style={{ display: "inline-flex", position: "relative", width: size, height: size }}
    >
      <Comp size={size} />
      {withShimmer && <span className="ps-shimmer-overlay" aria-hidden="true" />}
    </span>
  );
}

interface AvatarWithStickerProps {
  name?: string | null;
  src?: string | null;
  tier: StickerTier | null;
  style?: StickerStyle;
  size?: number;
  stickerScale?: number;
}

export function AvatarWithSticker({
  name,
  src,
  tier,
  style = "hex",
  size = 44,
  stickerScale = 0.45,
}: AvatarWithStickerProps) {
  const initials = (name || "?")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const stickerSize = Math.round(size * stickerScale);
  return (
    <span
      className="avatar-wrap inline-flex"
      style={{ width: size, height: size, position: "relative" }}
    >
      <span
        className="avatar-img inline-flex items-center justify-center rounded-full bg-foreground/10 text-foreground/80 text-xs font-bold overflow-hidden"
        style={{ width: size, height: size }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={name ?? ""} width={size} height={size} className="object-cover" />
        ) : (
          <span>{initials}</span>
        )}
      </span>
      {tier && (
        <span
          className="avatar-sticker absolute"
          style={{
            width: stickerSize,
            height: stickerSize,
            right: -Math.round(stickerSize * 0.18),
            bottom: -Math.round(stickerSize * 0.18),
          }}
        >
          <PremiumSticker tier={tier} style={style} size={stickerSize} />
        </span>
      )}
    </span>
  );
}

/** Map our internal billing-plan code to a sticker tier; null if no sticker. */
export function planToStickerTier(plan: string | null | undefined): StickerTier | null {
  if (!plan) return null;
  const upper = plan.toUpperCase();
  if (upper === "PRO") return "pro";
  if (upper === "FAMILY") return "family";
  if (upper === "INDIVIDUAL") return "individual";
  return null;
}
