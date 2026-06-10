"use client";

import { useTranslations } from "next-intl";
import { Map } from "lucide-react";

/**
 * ROUTE MAP CARD — Aurora dashboard widget (Edition VII parity).
 *
 * A CSS/SVG-stylized mini "map" of the relocation route: decorative street
 * grid + city blocks + park/water tone blobs as terrain, with a dashed
 * accent route from the old home pin to the new home pin (teardrop pins +
 * mono labels). Pure presentation — no tiles, no geo, no network.
 *
 * The canvas is INTENTIONALLY DARK-FIXED (same decision as mobile's
 * AddressesMap stylized canvas): it reads as a night-mode map tile in both
 * app themes, so its base is neutral black with white-alpha linework rather
 * than theme tokens that would flip on `.light`. All chroma on top of the
 * canvas (route, pins, terrain) comes from brand CSS vars / the plan accent
 * (`--primary` via the AppShell `.plan-*` class) — never hardcoded hues.
 */

/** Teardrop map pin (rotated rounded square), colored via a CSS var string. */
function MapPin({ left, top, color }: { left: string; top: string; color: string }) {
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-full"
      style={{ left, top }}
      aria-hidden="true"
    >
      <span
        className="flex h-6 w-6 -rotate-45 items-center justify-center rounded-[50%_50%_50%_4px] border-2"
        style={{
          borderColor: color,
          background: `color-mix(in srgb, ${color} 24%, transparent)`,
        }}
      >
        <span className="h-2 w-2 rotate-45 rounded-full" style={{ background: color }} />
      </span>
    </div>
  );
}

/** Mono uppercase label chip pinned onto the dark canvas. */
function MapLabel({
  text,
  className,
}: {
  text: string;
  className: string;
}) {
  return (
    <span
      className={`absolute max-w-[45%] truncate rounded-md border border-white/10 bg-black/70 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-white/70 backdrop-blur-sm ${className}`}
    >
      {text}
    </span>
  );
}

export function RouteMapCard({ fromCity, toCity }: { fromCity: string; toCity: string }) {
  const td = useTranslations("dashboard");
  return (
    <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl overflow-hidden">
      <div className="flex items-baseline justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <Map className="h-4 w-4 text-tone-sky-fg" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">{td("widget_routeMap")}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{td("routeMap_sub")}</p>
          </div>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          {fromCity} → {toCity}
        </span>
      </div>

      {/* Dark-fixed stylized canvas (see header comment) */}
      <div className="relative mx-4 mb-4 h-56 overflow-hidden rounded-xl border border-border bg-black">
        {/* terrain — blurred tone blobs (brand CSS vars over the dark base) */}
        <div
          className="absolute -left-10 top-1/3 h-32 w-44 rounded-full blur-2xl"
          style={{ background: "color-mix(in srgb, var(--sage) 16%, transparent)" }}
        />
        <div
          className="absolute -right-8 -top-8 h-32 w-48 rounded-full blur-2xl"
          style={{ background: "color-mix(in srgb, var(--rose) 16%, transparent)" }}
        />
        {/* water — soft cool inlet, bottom-right */}
        <div
          className="absolute -bottom-12 -right-10 h-40 w-56 rounded-[50%_0_0_50%/60%_0_0_40%]"
          style={{ background: "color-mix(in srgb, var(--rose) 11%, transparent)" }}
        />
        {/* street grid — white-alpha linework on the dark-fixed tile */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 34px, rgba(255,255,255,0.05) 34px, rgba(255,255,255,0.05) 35px), repeating-linear-gradient(90deg, transparent, transparent 46px, rgba(255,255,255,0.05) 46px, rgba(255,255,255,0.05) 47px)",
          }}
        />
        {/* city blocks + parks */}
        <div className="absolute left-[6%] top-[10%] h-12 w-20 rounded-[5px] bg-white/[0.03]" />
        <div className="absolute left-[30%] top-[6%] h-20 w-16 rounded-[5px] bg-white/[0.03]" />
        <div className="absolute left-[52%] top-[40%] h-14 w-20 rounded-[5px] bg-white/[0.03]" />
        <div className="absolute left-[70%] top-[12%] h-16 w-24 rounded-[5px] bg-white/[0.03]" />
        <div
          className="absolute left-[12%] top-[48%] h-16 w-28 rounded-[14px]"
          style={{ background: "color-mix(in srgb, var(--sage) 8%, transparent)" }}
        />
        <div
          className="absolute left-[64%] top-[66%] h-12 w-20 rounded-xl"
          style={{ background: "color-mix(in srgb, var(--sage) 8%, transparent)" }}
        />
        {/* avenues */}
        <div className="absolute left-0 top-[72%] h-0.5 w-[64%] -rotate-[7deg] origin-top-left bg-white/[0.07]" />
        <div className="absolute left-[38%] top-0 h-[120%] w-0.5 rotate-[14deg] origin-top-left bg-white/[0.07]" />

        {/* dashed accent route — plan accent flows via .plan-* (--primary) */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 640 296"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M84 224 C 170 240, 220 150, 320 152 S 500 92, 556 78"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray="1 9"
          />
        </svg>

        {/* pins — origin in sage, destination in the plan accent */}
        <MapPin left="13%" top="76%" color="var(--sage)" />
        <MapPin left="87%" top="27%" color="hsl(var(--primary))" />
        <MapLabel text={`${td("routeMap_oldHome")} · ${fromCity}`} className="left-[8%] top-[79%]" />
        <MapLabel text={`${td("routeMap_newHome")} · ${toCity}`} className="right-[4%] top-[7%]" />

        <span className="absolute bottom-1.5 right-2 font-mono text-[8px] uppercase tracking-[0.08em] text-white/30">
          {td("routeMap_stylized")}
        </span>
      </div>
    </div>
  );
}
