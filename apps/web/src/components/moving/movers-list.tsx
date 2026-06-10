"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronUp, ExternalLink, Loader2, Lock, Sparkles, Truck } from "lucide-react";

/**
 * FIND LICENSED MOVERS — opt-in section on the moving-plan detail page.
 *
 * Honest framing by design: these are FMCSA-registered household-goods
 * carriers from the public U.S. DOT registry — NOT endorsements, NOT vetted
 * recommendations. Every row carries its USDOT number and a link to the
 * official protectyourmove.gov mover search so users verify complaints and
 * licensing themselves. The mandated disclaimer copy renders above results.
 *
 * OPT-IN: the section ships COLLAPSED and fetches nothing until the user
 * explicitly expands it — no mover data (and no sponsored impression) is
 * ever auto-shown.
 *
 * Plan gate (GATE-API contract, mirrors the dossier): the API answers 200
 * { entitled:false, upgradeRequired } for FREE/INDIVIDUAL plans and this
 * component renders the value-first upgrade teaser instead of data.
 *
 * Sponsored slot: when the API includes `sponsored` (SPONSORED_ENABLED flag
 * on + an active placement for the state), ONE clearly-labeled card renders
 * ABOVE the organic results. The label comes from the placement (FTC ad
 * disclosure — never render the card without it). Clicks fire a beacon POST;
 * the beacon is fire-and-forget and can never block the outbound link.
 */

// ── API contract types (GET /api/movers) ─────────────────────────────────────

export interface MoverRow {
  id: string;
  usdotNumber: number;
  name: string;
  legalName: string;
  dbaName: string | null;
  city: string | null;
  state: string;
  phone: string | null;
  fleetSize: number | null;
  complaintCount2y: number;
  safetyRating: string | null;
  dataAsOf: string;
  protectYourMoveUrl: string;
}

export interface SponsoredMover {
  placementId: string;
  label: string;
  mover: MoverRow;
}

export interface MoversResponse {
  configured: boolean;
  entitled?: boolean;
  upgradeRequired?: string;
  state?: string;
  city?: string | null;
  movers?: MoverRow[];
  sponsored?: SponsoredMover | null;
}

/** 200-with-gate payload → render the upgrade teaser (never real-looking rows). */
export function isMoversGated(data: MoversResponse | null | undefined): boolean {
  return !!data && data.configured === true && (data.entitled === false || !!data.upgradeRequired);
}

/** Fire-and-forget click beacon — must never block or fail the outbound link. */
function sendSponsoredClick(placementId: string): void {
  try {
    void fetch("/api/movers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placementId }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Beacons are best-effort by contract.
  }
}

// ── Presentational pieces (exported for tests — render-pure) ─────────────────

function MoverRowCard({
  mover,
  sponsoredLabel,
  onSponsoredClick,
}: {
  mover: MoverRow;
  sponsoredLabel?: string;
  onSponsoredClick?: () => void;
}) {
  const t = useTranslations("moving");
  const sponsored = typeof sponsoredLabel === "string" && sponsoredLabel.trim().length > 0;
  return (
    <div
      className={`p-3 rounded-xl border ${
        sponsored ? "border-tone-honey-br bg-tone-honey-bg/40" : "border-border bg-foreground/[0.02]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* FTC disclosure label — mandatory on sponsored cards. */}
            {sponsored && (
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-tone-honey-br bg-tone-honey-bg text-tone-honey-fg font-semibold uppercase tracking-wider">
                {sponsoredLabel}
              </span>
            )}
            <p className="text-sm font-semibold text-foreground truncate">{mover.name}</p>
          </div>
          <div className="mt-1 flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
            <span className="font-mono">{t("movers_usdot", { number: mover.usdotNumber })}</span>
            {typeof mover.fleetSize === "number" && (
              <span>{t("movers_fleet", { count: mover.fleetSize })}</span>
            )}
            {mover.safetyRating && <span>{t("movers_safetyRating", { rating: mover.safetyRating })}</span>}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {mover.complaintCount2y > 0
              ? t("movers_complaints", { count: mover.complaintCount2y })
              : t("movers_complaintsUnknown")}
          </p>
        </div>
        <a
          href={mover.protectYourMoveUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onSponsoredClick}
          className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-foreground/5 text-[11px] text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition"
        >
          <ExternalLink className="h-3 w-3" />
          {t("movers_verifyLink")}
        </a>
      </div>
    </div>
  );
}

export function MoversListCard({ data }: { data: MoversResponse | null }) {
  const t = useTranslations("moving");

  if (isMoversGated(data)) return <MoversTeaser />;
  if (!data || data.configured !== true || !Array.isArray(data.movers)) {
    return <p className="text-xs text-muted-foreground">{t("movers_error")}</p>;
  }

  const movers = data.movers;
  const sponsored = data.sponsored ?? null;
  const dataAsOf = sponsored?.mover.dataAsOf ?? movers[0]?.dataAsOf ?? null;

  return (
    <div className="space-y-2">
      {/* MANDATORY honest framing — registry data, not endorsements. */}
      <p className="text-[11px] leading-4 text-muted-foreground">{t("movers_disclaimer")}</p>

      {/* Sponsored slot — always ABOVE organic results, always labeled. */}
      {sponsored && (
        <MoverRowCard
          mover={sponsored.mover}
          sponsoredLabel={sponsored.label || "Sponsored"}
          onSponsoredClick={() => sendSponsoredClick(sponsored.placementId)}
        />
      )}

      {movers.length === 0 && !sponsored ? (
        <p className="text-xs text-muted-foreground">
          {t("movers_empty", { state: data.state ?? "" })}
        </p>
      ) : (
        movers.map((mover) => <MoverRowCard key={mover.id} mover={mover} />)
      )}

      {dataAsOf && (
        <p className="text-[10px] text-foreground/35">{t("movers_dataAsOf", { date: dataAsOf })}</p>
      )}
    </div>
  );
}

/**
 * Value-first upgrade teaser (FREE/INDIVIDUAL): same pattern as the dossier
 * teaser — honest locked pitch, no fabricated mover rows, /pricing CTA.
 */
export function MoversTeaser() {
  const t = useTranslations("moving");
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 p-3 rounded-xl border border-border bg-foreground/[0.02]">
        <Lock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-xs text-muted-foreground">{t("movers_teaser_pitch")}</p>
      </div>
      <Link
        href="/pricing"
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-tone-orange-fg text-white text-sm font-semibold hover:opacity-90 transition whitespace-nowrap"
      >
        <Sparkles className="h-4 w-4" /> {t("movers_teaser_cta")}
      </Link>
    </div>
  );
}

// ── Opt-in collapsed section (default entry for the plan detail page) ────────

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "done"; data: MoversResponse | null };

export function MoversSection({ state, city }: { state: string; city?: string | null }) {
  const t = useTranslations("moving");
  const [open, setOpen] = useState(false);
  const [fetchState, setFetchState] = useState<FetchState>({ status: "idle" });

  const loadMovers = async () => {
    setFetchState({ status: "loading" });
    try {
      const params = new URLSearchParams({ state });
      if (city?.trim()) params.set("city", city.trim());
      const res = await fetch(`/api/movers?${params.toString()}`);
      if (!res.ok) {
        setFetchState({ status: "error" });
        return;
      }
      setFetchState({ status: "done", data: (await res.json()) as MoversResponse });
    } catch {
      setFetchState({ status: "error" });
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    // Fetch only on the FIRST explicit expand — nothing auto-loads.
    if (next && fetchState.status === "idle") void loadMovers();
  };

  return (
    <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-foreground/[0.03] transition"
        onClick={toggle}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 text-left">
          <Truck className="h-4 w-4 text-tone-umber-fg" />
          <div>
            <span className="text-sm font-semibold text-foreground block">
              {t("movers_title", { state })}
            </span>
            <span className="text-[11px] text-muted-foreground block">{t("movers_subtitle")}</span>
          </div>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-foreground/40 shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-foreground/40 shrink-0" />
        )}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-border pt-4">
          {fetchState.status === "loading" && (
            <p className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t("movers_loading")}
            </p>
          )}
          {fetchState.status === "error" && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{t("movers_error")}</p>
              <button
                type="button"
                onClick={() => void loadMovers()}
                className="px-2.5 py-1 rounded-lg bg-foreground/5 text-[11px] text-muted-foreground hover:bg-foreground/10 transition"
              >
                {t("movers_retry")}
              </button>
            </div>
          )}
          {fetchState.status === "done" && <MoversListCard data={fetchState.data} />}
        </div>
      )}
    </div>
  );
}
