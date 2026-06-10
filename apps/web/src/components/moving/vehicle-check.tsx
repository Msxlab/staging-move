"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Car, ChevronDown, ChevronUp, ExternalLink, Loader2 } from "lucide-react";
import { isValidVin, normalizeVin } from "@/lib/nhtsa";

/**
 * "CHECK YOUR VEHICLE" — compact inline helper for the vehicle-registration
 * move task (templateId P3_VEHICLE_REG) on the moving-plan checklist.
 *
 * Collapsed by default (a single small affordance under the task copy — no new
 * screens); expanding reveals a VIN input + "Check" that calls
 * GET /api/vehicles/decode and renders e.g. "2019 Honda CR-V — 2 open recalls"
 * with the top recall items, a link to the official NHTSA recalls site, and —
 * when the destination state has a DMV entry in the provider catalog
 * (GOVERNMENT_DMV) — the state's official DMV link.
 *
 * Honesty + graceful degradation:
 *  - VIN validation happens client-side first (17 chars, I/O/Q never occur),
 *    so a typo never spends a server/NHTSA call.
 *  - Sections degrade independently per the API contract: a decoded vehicle
 *    whose recall lookup failed still renders, with honest "recall info
 *    unavailable" copy. A failed request renders an error line, never a crash.
 *  - MANDATORY fine print: specs/recalls are NHTSA data — registration
 *    requirements come from the state DMV, and we never imply otherwise.
 */

export const NHTSA_RECALLS_URL = "https://www.nhtsa.gov/recalls";

/**
 * True when a move task is the relocation checklist's vehicle-registration
 * item. Primary signal is the stable template id (P3_VEHICLE_REG, see
 * packages/shared/src/constants.ts); older rows generated before templateId
 * existed fall back to a title match.
 */
export function isVehicleRegistrationTask(
  task: { templateId?: string | null; title?: string | null } | null | undefined,
): boolean {
  if (!task) return false;
  if (task.templateId === "P3_VEHICLE_REG") return true;
  return typeof task.title === "string" && /vehicle registration/i.test(task.title);
}

// ── API contracts ─────────────────────────────────────────────────────────────

interface DecodeResponse {
  vehicle?: {
    status: "ok" | "no_match" | "error";
    vin: string;
    year: number | null;
    make: string | null;
    model: string | null;
  };
  recalls?: {
    status: "ok" | "unavailable";
    count: number | null;
    items: Array<{ campaignNumber: string | null; component: string | null; summary: string | null }>;
  };
}

/** "2019 HONDA CR-V" from whichever decoded fields exist (never empty for ok). */
export function vehicleHeadline(
  vehicle: { year: number | null; make: string | null; model: string | null } | null | undefined,
): string {
  if (!vehicle) return "";
  return [vehicle.year, vehicle.make, vehicle.model].filter((v) => v !== null && v !== "").join(" ");
}

type CheckError = "invalid" | "no_match" | "request" | null;

export function VehicleCheck({ destinationState }: { destinationState?: string | null }) {
  const t = useTranslations("moving");
  const [open, setOpen] = useState(false);
  const [vin, setVin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<CheckError>(null);
  const [result, setResult] = useState<DecodeResponse | null>(null);
  // Official state DMV link from the provider catalog (GOVERNMENT_DMV). Omitted
  // entirely when the destination state has no catalog entry or the fetch fails.
  const [dmv, setDmv] = useState<{ name: string; website: string } | null>(null);
  const [dmvFetched, setDmvFetched] = useState(false);

  const state = destinationState?.trim().toUpperCase() || null;

  useEffect(() => {
    if (!open || !state || dmvFetched) return;
    setDmvFetched(true);
    let cancelled = false;
    fetch(`/api/providers?state=${encodeURIComponent(state)}&category=GOVERNMENT_DMV`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const providers: Array<{ name?: unknown; website?: unknown }> = Array.isArray(data.providers)
          ? data.providers
          : [];
        const match = providers.find(
          (p) => typeof p?.name === "string" && typeof p?.website === "string" && /^https?:\/\//.test(p.website),
        );
        if (match) setDmv({ name: match.name as string, website: match.website as string });
      })
      .catch(() => {
        // No DMV link is an acceptable outcome — the section is simply omitted.
      });
    return () => {
      cancelled = true;
    };
  }, [open, state, dmvFetched]);

  const handleCheck = async () => {
    const normalized = normalizeVin(vin);
    if (!isValidVin(normalized)) {
      setError("invalid");
      setResult(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/vehicles/decode?vin=${encodeURIComponent(normalized)}`);
      const data = (await res.json().catch(() => null)) as DecodeResponse | null;
      if (!res.ok || !data?.vehicle) {
        setError(res.status === 400 ? "invalid" : "request");
        setResult(null);
        return;
      }
      if (data.vehicle.status === "ok") {
        setResult(data);
        setError(null);
      } else {
        setResult(null);
        setError(data.vehicle.status === "no_match" ? "no_match" : "request");
      }
    } catch {
      setError("request");
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  const headline = result?.vehicle ? vehicleHeadline(result.vehicle) : "";
  const recalls = result?.recalls;
  const recallItems = recalls?.status === "ok" && Array.isArray(recalls.items) ? recalls.items : [];

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border bg-foreground/5 text-muted-foreground text-[11px] font-medium hover:bg-foreground/10 hover:text-foreground transition"
      >
        <Car className="h-3 w-3" />
        {t("vehicleCheckTitle")}
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {open && (
        <div className="mt-2 rounded-xl border border-border bg-foreground/[0.03] p-3 max-w-xl">
          <p className="text-[11px] text-muted-foreground">{t("vehicleCheckIntro")}</p>

          <div className="mt-2 flex items-center gap-2">
            <input
              type="text"
              value={vin}
              onChange={(e) => setVin(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !busy) void handleCheck();
              }}
              maxLength={17}
              autoComplete="off"
              spellCheck={false}
              placeholder={t("vehicleCheckVinPlaceholder")}
              aria-label={t("vehicleCheckVinAria")}
              className="flex-1 min-w-0 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-mono uppercase tracking-wider text-foreground placeholder:text-foreground/30 placeholder:normal-case placeholder:font-sans focus:outline-none focus:ring-1 focus:ring-tone-cyan-fg"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleCheck()}
              className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-tone-cyan-fg text-white text-[11px] font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              {busy ? t("vehicleCheckChecking") : t("vehicleCheckButton")}
            </button>
          </div>

          {error === "invalid" && (
            <p className="mt-2 text-[11px] text-destructive">{t("vehicleCheckInvalidVin")}</p>
          )}
          {error === "no_match" && (
            <p className="mt-2 text-[11px] text-muted-foreground">{t("vehicleCheckNoMatch")}</p>
          )}
          {error === "request" && (
            <p className="mt-2 text-[11px] text-muted-foreground">{t("vehicleCheckError")}</p>
          )}

          {result?.vehicle?.status === "ok" && (
            <div className="mt-3 space-y-1.5">
              <p className="text-sm font-semibold text-foreground">
                {headline}
                {recalls?.status === "ok" && typeof recalls.count === "number" && (
                  <span
                    className={
                      recalls.count > 0 ? "text-tone-honey-fg" : "text-tone-emerald-fg"
                    }
                  >
                    {" — "}
                    {t("vehicleCheckRecallCount", { count: recalls.count })}
                  </span>
                )}
              </p>
              {recalls?.status === "unavailable" && (
                <p className="text-[11px] text-muted-foreground">{t("vehicleCheckRecallsUnavailable")}</p>
              )}
              {recallItems.length > 0 && (
                <ul className="space-y-1">
                  {recallItems.map((item, i) => (
                    <li
                      key={item.campaignNumber || `recall-${i}`}
                      className="text-[11px] text-muted-foreground"
                    >
                      <span className="font-medium text-foreground/70">
                        {item.component || item.campaignNumber}
                      </span>
                      {item.summary ? ` — ${item.summary}` : ""}
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5">
                <a
                  href={NHTSA_RECALLS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-tone-cyan-fg underline underline-offset-2 hover:opacity-80 transition"
                >
                  {t("vehicleCheckRecallsLink")}
                  <ExternalLink className="h-3 w-3" />
                </a>
                {dmv && state && (
                  <a
                    href={dmv.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-tone-cyan-fg underline underline-offset-2 hover:opacity-80 transition"
                  >
                    {t("vehicleCheckDmvLink", { state, name: dmv.name })}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* MANDATORY fine print — NHTSA data, DMV owns the requirements */}
          <p className="mt-3 text-[10px] leading-4 text-foreground/40">{t("vehicleCheckFinePrint")}</p>
        </div>
      )}
    </div>
  );
}
