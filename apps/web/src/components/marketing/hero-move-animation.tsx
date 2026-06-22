"use client";

import * as React from "react";
import {
  motion,
  useReducedMotion,
  useAnimationControls,
  type Transition,
} from "framer-motion";
import {
  Landmark,
  ShieldCheck,
  Zap,
  Building2,
  CreditCard,
  Mail,
  MapPin,
  Check,
} from "lucide-react";
import { RaccoonHero } from "@/components/illustrations/RaccoonHero";
import { cn } from "@/lib/utils";

/**
 * HeroMoveAnimation — the homepage hero "scene".
 *
 * A faithful React recreation of the design bundle's `hero-animation.html`
 * prototype: an OLD address pin (bottom-left, dims/greys as services leave)
 * and a NEW address pin (top-right, Move Sapphire, breathing aura). Six service
 * chips travel one-by-one along S-curve paths from the old pin up to a tidy
 * 3×2 grid beside the new pin, bounce on arrival, pop a sage checkmark, and
 * a counter ticks 0→6. A welcoming raccoon fades in and hops on each arrival.
 * Faint guide lines carry traveling pulse dots ("data flowing"). The whole
 * cycle loops.
 *
 * Theming: uses the homepage's existing token ramp — `hsl(var(--primary))`
 * is Move Sapphire, `var(--sage)` / `--success-soft` is the success green. No
 * amber here; the homepage stays in the Sapphire look. The whole scene tracks
 * light/dark automatically.
 *
 * Coordinate system: everything is laid out in a fixed 1120×600 logical box
 * and positioned by percentage, so the SVG guide layer and the HTML chip
 * overlay scale together inside a responsive aspect-ratio container without
 * the paths drifting from the chips.
 *
 * Accessibility / robustness:
 *  - aria-hidden — purely decorative; the real headline + CTAs live in page.tsx.
 *  - prefers-reduced-motion → renders the STATIC END STATE (all 6 chips in the
 *    grid with checks, raccoon shown, counter "6 moved · 0 left behind"); no
 *    loop, no motion, no timers, no pulse.
 *  - SSR-safe: "use client" + framer's useReducedMotion (matchMedia is guarded
 *    by the hook and only reads on the client); no work at module scope.
 *  - All timers are tracked and cleared on unmount (no leaks).
 */

const VIEW_W = 1120;
const VIEW_H = 600;

const OLD = { x: 180, y: 520 };
const NEW = { x: 838, y: 150 };

type Service = {
  id: string;
  Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  /** Target (grid slot) coordinates in the logical box. */
  tx: number;
  ty: number;
};

// Tidy 3×2 settle grid to the lower-right of the new pin.
const SERVICES: Service[] = [
  { id: "bank", Icon: Landmark, tx: 770, ty: 286 },
  { id: "shield", Icon: ShieldCheck, tx: 838, ty: 286 },
  { id: "zap", Icon: Zap, tx: 906, ty: 286 },
  { id: "gov", Icon: Building2, tx: 770, ty: 352 },
  { id: "card", Icon: CreditCard, tx: 838, ty: 352 },
  { id: "mail", Icon: Mail, tx: 906, ty: 352 },
];

type Cubic = {
  p0: { x: number; y: number };
  c1: { x: number; y: number };
  c2: { x: number; y: number };
  p1: { x: number; y: number };
};

/** S-curve control points — old pin up to the grid slot (mirrors the prototype). */
function curveFor(tx: number, ty: number): Cubic {
  return {
    p0: { x: OLD.x, y: OLD.y },
    c1: { x: OLD.x + 260, y: OLD.y - 40 },
    c2: { x: tx - 230, y: ty + 70 },
    p1: { x: tx, y: ty },
  };
}

/** Cubic-bezier point at t. */
function cb(p: Cubic, t: number): { x: number; y: number } {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * p.p0.x + b * p.c1.x + c * p.c2.x + d * p.p1.x,
    y: a * p.p0.y + b * p.c1.y + c * p.c2.y + d * p.p1.y,
  };
}

/** SVG path "d" string for a cubic. */
function pathD(p: Cubic): string {
  return `M ${p.p0.x} ${p.p0.y} C ${p.c1.x} ${p.c1.y}, ${p.c2.x} ${p.c2.y}, ${p.p1.x} ${p.p1.y}`;
}

const pct = (v: number, axis: "x" | "y") =>
  axis === "x" ? (v / VIEW_W) * 100 : (v / VIEW_H) * 100;

// Timing (ms) — matches the prototype's cadence.
const START = 500;
const STAGGER = 300;
const TRAVEL = 1300;
const HOLD = 3200;
const FADE = 600;

const CURVES = SERVICES.map((s) => curveFor(s.tx, s.ty));
// Sample each curve into waypoints, expressed as PERCENT of the logical box
// so that animating a chip's left/top in % stays aligned with the SVG guide
// layer at any rendered size (fully scale-safe / responsive).
const SAMPLES = 24;
const PATHS_LEFT = CURVES.map((c) =>
  Array.from(
    { length: SAMPLES + 1 },
    (_, k) => `${pct(cb(c, k / SAMPLES).x, "x")}%`,
  ),
);
const PATHS_TOP = CURVES.map((c) =>
  Array.from(
    { length: SAMPLES + 1 },
    (_, k) => `${pct(cb(c, k / SAMPLES).y, "y")}%`,
  ),
);

export function HeroMoveAnimation({ className }: { className?: string }) {
  const reduce = useReducedMotion();

  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative mx-auto w-full max-w-[640px] select-none",
        className,
      )}
    >
      {/* Aspect-ratio stage. Everything inside is positioned by % of this box
          so the SVG guide layer and the HTML chip overlay scale in lockstep. */}
      <div
        className="relative w-full overflow-visible"
        style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}`, containerType: "inline-size" }}
      >
        {/* Soft ambient wash — Move Sapphire + a hint of mint, matches the hero glow */}
        <div
          className="pointer-events-none absolute inset-0 -z-10 rounded-[40px]"
          style={{
            background:
              "radial-gradient(60% 55% at 22% 22%, hsl(var(--primary) / 0.16), transparent 62%), radial-gradient(55% 50% at 82% 78%, var(--success-soft), transparent 64%)",
          }}
        />

        {/* Guide lines + traveling pulse dots (SVG, shares the logical box) */}
        <GuideLayer reduce={!!reduce} />

        {/* The animated overlay (pins, chips, raccoon, counter) */}
        {reduce ? <StaticScene /> : <AnimatedScene />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Guide layer — faint S-curves with a cool→mint gradient stroke and a */
/* traveling pulse dot per line (CSS offset-path; disabled under reduce) */
/* ------------------------------------------------------------------ */

function GuideLayer({ reduce }: { reduce: boolean }) {
  const gradId = React.useId();
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="hsl(var(--primary) / 0.6)" />
          <stop offset="55%" stopColor="hsl(var(--primary))" />
          <stop offset="100%" stopColor="var(--sage)" />
        </linearGradient>
      </defs>
      {CURVES.map((c, i) => (
        <path
          key={i}
          d={pathD(c)}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={1.5}
          strokeLinecap="round"
          opacity={0.16}
        />
      ))}
      {!reduce &&
        CURVES.map((c, i) => (
          <circle
            key={`dot-${i}`}
            r={2.6}
            className="lf-hero-flowdot"
            style={{
              // offset-path drives the dot along the same curve; per-line
              // duration + delay so the dots don't march in lockstep.
              offsetPath: `path('${pathD(c)}')`,
              animationDuration: `${(2.6 + i * 0.18).toFixed(2)}s`,
              animationDelay: `${(i * 0.32).toFixed(2)}s`,
            }}
          />
        ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

function Pin({
  variant,
  place,
  label,
  spent,
}: {
  variant: "old" | "new";
  place: string;
  label: string;
  spent?: boolean;
}) {
  const at = variant === "old" ? OLD : NEW;
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-full text-center"
      style={{ left: `${pct(at.x, "x")}%`, top: `${pct(at.y, "y")}%` }}
    >
      <div
        className={cn(
          "relative mx-auto h-[clamp(32px,7.5cqw,52px)] w-[clamp(32px,7.5cqw,52px)]",
          variant === "new" ? "text-primary" : "text-muted-foreground",
        )}
      >
        {variant === "new" && (
          // Softly breathing radial aura behind the new-home pin.
          <span className="lf-hero-aura pointer-events-none absolute left-1/2 top-[42%] -z-10 h-[2.4em] w-[2.4em] -translate-x-1/2 -translate-y-1/2 rounded-full" />
        )}
        <MapPin
          className={cn(
            "h-full w-full transition-[opacity,filter] duration-700",
            variant === "old" &&
              (spent ? "opacity-25 grayscale" : "opacity-60 grayscale-[.4]"),
          )}
          strokeWidth={2}
          aria-hidden
        />
      </div>
      <div
        className={cn(
          "mt-2 font-mono text-[clamp(8px,1.5cqw,11px)] uppercase tracking-wide transition-opacity duration-700",
          variant === "new" ? "text-primary/80" : "text-muted-foreground",
          variant === "old" && spent && "opacity-50",
        )}
      >
        {place}
        <span className="mt-0.5 block font-sans text-[clamp(10px,2cqw,13px)] font-semibold normal-case tracking-normal text-foreground/80">
          {label}
        </span>
      </div>
    </div>
  );
}

function Counter({ count, done }: { count: number; done: boolean }) {
  return (
    <div
      className="absolute z-10 text-left"
      style={{ left: `${pct(566, "x")}%`, top: `${pct(250, "y")}%` }}
    >
      <div className="font-display text-[clamp(22px,6cqw,40px)] font-light leading-none text-primary tabular-nums">
        {count}
      </div>
      <div className="mt-1 font-mono text-[clamp(7px,1.4cqw,10px)] uppercase tracking-wider text-muted-foreground">
        {done ? "6 moved · 0 left behind" : "moving…"}
      </div>
    </div>
  );
}

/** A single service chip glyph (icon tile + sage check). `checked` pops the check. */
function ChipGlyph({
  Icon,
  checked,
}: {
  Icon: Service["Icon"];
  checked: boolean;
}) {
  return (
    <div
      className="relative flex h-[clamp(26px,6.5cqw,44px)] w-[clamp(26px,6.5cqw,44px)] items-center justify-center rounded-[28%] border border-primary/30 text-primary shadow-lg"
      style={{
        background:
          "linear-gradient(160deg, hsl(var(--card)), hsl(var(--muted)))",
        boxShadow:
          "0 10px 24px hsl(var(--foreground) / 0.18), 0 0 18px hsl(var(--primary) / 0.18)",
      }}
    >
      <Icon className="h-[48%] w-[48%]" aria-hidden />
      <span
        className={cn(
          "absolute -bottom-1 -right-1 flex h-[40%] w-[40%] items-center justify-center rounded-full bg-success text-background transition-transform duration-300",
          checked ? "scale-100" : "scale-0",
        )}
        style={{ transitionTimingFunction: "cubic-bezier(.34,1.56,.64,1)" }}
      >
        <Check className="h-[60%] w-[60%]" strokeWidth={3} aria-hidden />
      </span>
    </div>
  );
}

function Raccoon({ className }: { className?: string }) {
  // Reuse the existing welcoming mover-raccoon illustration (box-hugging pose).
  // It themes off --primary/--foreground tokens already, so it tracks the
  // Move Sapphire homepage look. Width scales with the stage.
  return (
    <RaccoonHero
      size={118}
      className={cn("h-auto w-full text-foreground/40", className)}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Static end-state (reduced-motion + SSR-stable baseline)             */
/* ------------------------------------------------------------------ */

function StaticScene() {
  return (
    <>
      <Pin variant="old" place="OLD ADDRESS" label="412 Larkspur Ln" spent />
      <Pin variant="new" place="NEW ADDRESS" label="88 Cedar Hill Dr" />
      <Counter count={SERVICES.length} done />
      {SERVICES.map((s) => (
        <div
          key={s.id}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${pct(s.tx, "x")}%`, top: `${pct(s.ty, "y")}%` }}
        >
          <ChipGlyph Icon={s.Icon} checked />
        </div>
      ))}
      <div
        className="absolute w-[clamp(52px,11cqw,86px)] -translate-x-1/2 -translate-y-full"
        style={{ left: `${pct(1016, "x")}%`, top: `${pct(300, "y")}%` }}
      >
        <Raccoon />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Animated scene                                                      */
/* ------------------------------------------------------------------ */

function AnimatedScene() {
  // cycle key forces a full remount of the chip set each loop, which resets
  // every chip's framer animation cleanly without manual transform juggling.
  const [cycle, setCycle] = React.useState(0);
  const [count, setCount] = React.useState(0);
  const [spent, setSpent] = React.useState(false);
  const [racVisible, setRacVisible] = React.useState(false);
  const [fading, setFading] = React.useState(false);

  const raccoonControls = useAnimationControls();
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);

  const settleAt = START + (SERVICES.length - 1) * STAGGER + TRAVEL;

  React.useEffect(() => {
    const after = (ms: number, fn: () => void) => {
      timers.current.push(setTimeout(fn, ms));
    };

    // reset visible state for this cycle
    setCount(0);
    setSpent(false);
    setRacVisible(false);
    setFading(false);

    // old address empties out as services leave
    after(START + Math.round((SERVICES.length - 1) * STAGGER * 0.6), () =>
      setSpent(true),
    );

    // hold, then fade everything out and start the next cycle
    const fadeAt = settleAt + HOLD;
    after(fadeAt, () => setFading(true));
    after(fadeAt + FADE + 250, () => setCycle((c) => c + 1));

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
    // re-run the whole schedule on each new cycle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycle, settleAt]);

  // Called by each chip when it arrives at its slot.
  const handleArrive = React.useCallback(
    (index: number) => {
      setCount(index + 1);
      setRacVisible(true);
      // hop on each arrival
      raccoonControls.start({
        y: [0, -28, 0],
        transition: { duration: 0.5, ease: [0.34, 1.56, 0.64, 1] },
      });
    },
    [raccoonControls],
  );

  return (
    <motion.div
      className="absolute inset-0"
      animate={{ opacity: fading ? 0 : 1 }}
      transition={{ duration: FADE / 1000, ease: "easeInOut" }}
    >
      <Pin variant="old" place="OLD ADDRESS" label="412 Larkspur Ln" spent={spent} />
      <Pin variant="new" place="NEW ADDRESS" label="88 Cedar Hill Dr" />
      <Counter count={count} done={count >= SERVICES.length} />

      {/* Welcoming raccoon — fades in once services start arriving, hops each time */}
      <motion.div
        className="absolute w-[clamp(52px,11cqw,86px)] -translate-x-1/2 -translate-y-full"
        style={{ left: `${pct(1016, "x")}%`, top: `${pct(300, "y")}%` }}
        initial={{ opacity: 0 }}
        animate={{ opacity: racVisible ? 1 : 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <motion.div animate={raccoonControls}>
          <Raccoon />
        </motion.div>
      </motion.div>

      {/* Service chips — keyed by cycle so each loop fully remounts/resets */}
      {SERVICES.map((s, i) => (
        <TravelingChip
          key={`${cycle}-${s.id}`}
          service={s}
          index={i}
          onArrive={handleArrive}
        />
      ))}
    </motion.div>
  );
}

/** A chip that travels its S-curve from the old pin to its grid slot, bounces, checks. */
function TravelingChip({
  service,
  index,
  onArrive,
}: {
  service: Service;
  index: number;
  onArrive: (index: number) => void;
}) {
  const [checked, setChecked] = React.useState(false);
  const controls = useAnimationControls();
  const mounted = React.useRef(true);

  React.useEffect(() => {
    mounted.current = true;
    const delay = (START + index * STAGGER) / 1000;
    const dur = TRAVEL / 1000;

    // Animate left/top in % of the logical box so the chip stays glued to the
    // SVG guide curve at every viewport size. The wrapper's -translate-1/2
    // centers the glyph on the path point.
    const travel: Transition = {
      left: { delay, duration: dur, ease: "easeInOut" },
      top: { delay, duration: dur, ease: "easeInOut" },
      opacity: { delay, duration: 0.22 },
    };

    void controls
      .start({
        left: PATHS_LEFT[index],
        top: PATHS_TOP[index],
        opacity: 1,
        transition: travel,
      })
      .then(() => {
        if (!mounted.current) return;
        // arrival bounce
        void controls.start({
          scale: [1, 1.16, 1],
          transition: { duration: 0.4, ease: [0.34, 1.56, 0.64, 1] },
        });
        setChecked(true);
        onArrive(index);
      });

    return () => {
      mounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  return (
    <motion.div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      initial={{
        left: `${pct(OLD.x, "x")}%`,
        top: `${pct(OLD.y, "y")}%`,
        opacity: 0,
        scale: 1,
      }}
      animate={controls}
    >
      <ChipGlyph Icon={service.Icon} checked={checked} />
    </motion.div>
  );
}

export default HeroMoveAnimation;
