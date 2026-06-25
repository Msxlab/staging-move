// Used value import: Turbopack can drop side-effect-only imports in standalone.
// Call before creating PDFDocument so pdfkit's baked /ROOT font reads are patched.
import { ensurePdfkitStandardFonts } from "@/lib/pdf/standard-font-data";
import PDFDocument from "pdfkit";
import {
  drawFooter,
  drawHeader,
  drawKeyValueRow,
  drawSectionHeading,
  ensureRoom,
  PAGE_MARGIN,
  PDF_THEME,
} from "@/lib/pdf/layout";
import type { PdfDossier } from "@/lib/pdf/types";

/**
 * Generate the New Home Dossier PDF (Pro `dossierPdf` export) as a buffer.
 *
 * Renders the same seven public-data sections the dashboard dossier card
 * shows — flood / school / move-day weather / hazards / radon / water / air —
 * for a destination address. The data comes straight from the dossier route's
 * JSON (single source of the aggregation); this file only lays it out.
 *
 * HONESTY (mirrors the on-screen card): every figure is sourced public data,
 * not advice. A "—" is shown for any section that didn't resolve (no
 * coordinates, source down, or not configured) rather than a guess, and the
 * footnote names the providers.
 *
 * Localization note: English-only v1, same as the other generators — all
 * user-facing strings stay inline for now.
 */
export async function generateDossierReportPdf(
  dossier: PdfDossier,
  userName: string,
): Promise<Buffer> {
  ensurePdfkitStandardFonts();

  const location = `${dossier?.address?.city ?? ""}, ${dossier?.address?.state ?? ""}`.replace(/^, |, $/g, "");
  const doc = new PDFDocument({
    size: "LETTER",
    margins: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN },
    info: {
      Title: `LocateFlow — New Home Dossier (${location})`,
      Author: "LocateFlow",
      Subject: "New Home Dossier",
      CreationDate: new Date(),
    },
  });

  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  // A section that didn't resolve shows "—", never a fabricated value.
  // `status` is read off a possibly-undefined section: the data route is the
  // single source of the payload and its shape can drift (new/renamed/omitted
  // sections, summary-vs-full branches, stale cached payloads). The PDF must
  // NEVER throw on a missing section — it renders that section as unavailable
  // instead. So every section access below goes through a defensive read and
  // `ok()` treats an absent section as not-ok.
  const ok = (status: string | null | undefined) => status === "ok";
  const dash = (value: string | number | null | undefined): string =>
    value === null || value === undefined || value === "" ? "—" : String(value);

  // Defensive section accessors: a missing section degrades to an empty object
  // so `.status` (and any field read) is `undefined` rather than a thrown
  // "Cannot read properties of undefined". Typed loosely on purpose — the data
  // route owns the real contract; here we only need not-to-throw + render "—".
  const d = (dossier ?? {}) as Partial<PdfDossier>;
  const flood = d.flood ?? ({} as Partial<NonNullable<PdfDossier["flood"]>>);
  const school = d.school ?? ({} as Partial<NonNullable<PdfDossier["school"]>>);
  const weather = d.weather ?? ({} as Partial<NonNullable<PdfDossier["weather"]>>);
  const hazards = d.hazards ?? ({} as Partial<NonNullable<PdfDossier["hazards"]>>);
  const radon = d.radon ?? ({} as Partial<NonNullable<PdfDossier["radon"]>>);
  const water = d.water ?? ({} as Partial<NonNullable<PdfDossier["water"]>>);
  const air = d.air ?? ({} as Partial<NonNullable<PdfDossier["air"]>>);

  // ── Header ──────────────────────────────────────────────────────────
  let y = drawHeader(doc, "New Home Dossier", location);

  // ── Title block ─────────────────────────────────────────────────────
  doc.fillColor(PDF_THEME.text).font("Helvetica-Bold").fontSize(20).text(location, PAGE_MARGIN, y);
  y += 26;
  doc.fillColor(PDF_THEME.muted).font("Helvetica").fontSize(10)
    .text(`Prepared for: ${userName || "Account Holder"}`, PAGE_MARGIN, y);
  y += 22;

  // ── Flood ───────────────────────────────────────────────────────────
  y = ensureRoom(doc, 60, y);
  y = drawSectionHeading(doc, "Flood risk (FEMA NFHL)", y);
  y = drawKeyValueRow(doc, "Flood zone", ok(flood.status) ? dash(flood.zone) : "—", y);
  y = drawKeyValueRow(
    doc,
    "High-risk zone",
    ok(flood.status) && flood.isHighRisk !== null && flood.isHighRisk !== undefined ? (flood.isHighRisk ? "Yes" : "No") : "—",
    y,
  );
  y += 6;

  // ── School district ─────────────────────────────────────────────────
  y = ensureRoom(doc, 50, y);
  y = drawSectionHeading(doc, "School district (NCES)", y);
  y = drawKeyValueRow(doc, "District", ok(school.status) ? dash(school.districtName) : "—", y);
  y += 6;

  // ── Move-day weather ────────────────────────────────────────────────
  y = ensureRoom(doc, 70, y);
  y = drawSectionHeading(doc, "Move-day forecast (NWS)", y);
  if (ok(weather.status)) {
    y = drawKeyValueRow(doc, "Forecast date", dash(weather.forecastDate), y);
    y = drawKeyValueRow(doc, "Summary", dash(weather.summary), y);
    const num = (v: number | null | undefined): number | null =>
      typeof v === "number" && Number.isFinite(v) ? v : null;
    const high = num(weather.tempHighF);
    const low = num(weather.tempLowF);
    const precip = num(weather.precipChancePct);
    y = drawKeyValueRow(
      doc,
      "High / Low",
      high === null && low === null ? "—" : `${high === null ? "—" : `${Math.round(high)}°F`} / ${low === null ? "—" : `${Math.round(low)}°F`}`,
      y,
    );
    y = drawKeyValueRow(
      doc,
      "Precip chance",
      precip === null ? "—" : `${Math.round(precip)}%`,
      y,
    );
  } else {
    y = drawKeyValueRow(doc, "Forecast", "Available within ~7 days of your move date", y);
  }
  y += 6;

  // ── Hazards ─────────────────────────────────────────────────────────
  y = ensureRoom(doc, 60, y);
  y = drawSectionHeading(doc, "Natural hazard risk (FEMA NRI)", y);
  y = drawKeyValueRow(doc, "Overall rating", ok(hazards.status) ? dash(hazards.overallRating) : "—", y);
  if (ok(hazards.status)) {
    const topRisks = Array.isArray(hazards.topRisks) ? hazards.topRisks : [];
    for (const risk of topRisks.slice(0, 5)) {
      y = ensureRoom(doc, 16, y);
      y = drawKeyValueRow(doc, `  ${risk?.hazard ?? "—"}`, dash(risk?.rating), y);
    }
  }
  y += 6;

  // ── Radon ───────────────────────────────────────────────────────────
  y = ensureRoom(doc, 40, y);
  y = drawSectionHeading(doc, "Radon zone (EPA)", y);
  y = drawKeyValueRow(doc, "EPA radon zone", ok(radon.status) ? dash(radon.zone) : "—", y);
  y += 6;

  // ── Water ───────────────────────────────────────────────────────────
  y = ensureRoom(doc, 50, y);
  y = drawSectionHeading(doc, "Drinking water (EPA SDWIS)", y);
  y = drawKeyValueRow(doc, "Water system", ok(water.status) ? dash(water.systemName) : "—", y);
  y = drawKeyValueRow(
    doc,
    "Violations (5y)",
    ok(water.status) ? dash(water.violations5y) : "—",
    y,
  );
  y += 6;

  // ── Air quality ─────────────────────────────────────────────────────
  y = ensureRoom(doc, 50, y);
  y = drawSectionHeading(doc, "Air quality (AirNow)", y);
  y = drawKeyValueRow(doc, "Current AQI", ok(air.status) ? dash(air.aqi) : "—", y);
  y = drawKeyValueRow(doc, "Category", ok(air.status) ? dash(air.category) : "—", y);
  y += 10;

  // ── Neighborhood (Pro: Census ACS + EPA walkability + NCES schools) ──
  // Present on Pro payloads — the only tier that reaches this PDF. Area
  // medians for the surrounding census tract, NOT a valuation of this home.
  const neighborhood = d.neighborhood;
  if (neighborhood && ok(neighborhood.status)) {
    const usd = (v: number | null | undefined): string =>
      typeof v === "number" && Number.isFinite(v) && v > 0 ? `$${Math.round(v).toLocaleString("en-US")}` : "—";
    const pct = (v: number | null | undefined): string =>
      typeof v === "number" && Number.isFinite(v) ? `${Math.round(v)}%` : "—";
    const walkBandLabel: Record<string, string> = {
      least: "Least walkable",
      below_average: "Below average",
      above_average: "Above average",
      most: "Most walkable",
    };
    const walk =
      typeof neighborhood.walkScore === "number" && Number.isFinite(neighborhood.walkScore) && neighborhood.walkScore > 0
        ? `${Math.round(neighborhood.walkScore * 10) / 10}/20${
            neighborhood.walkBand && walkBandLabel[neighborhood.walkBand]
              ? ` — ${walkBandLabel[neighborhood.walkBand]}`
              : ""
          }`
        : "—";

    y = ensureRoom(doc, 90, y);
    y = drawSectionHeading(doc, "Neighborhood (Census ACS, EPA, NCES)", y);
    y = drawKeyValueRow(doc, "Median home value", usd(neighborhood.medianHomeValue), y);
    y = drawKeyValueRow(
      doc,
      "Median gross rent",
      neighborhood.medianGrossRent ? `${usd(neighborhood.medianGrossRent)}/mo` : "—",
      y,
    );
    y = drawKeyValueRow(doc, "Median household income", usd(neighborhood.medianHouseholdIncome), y);
    y = drawKeyValueRow(doc, "Owner-occupied homes", pct(neighborhood.ownerOccupiedPct), y);
    y = drawKeyValueRow(doc, "Walkability", walk, y);
    const schools = Array.isArray(neighborhood.schools) ? neighborhood.schools.slice(0, 5) : [];
    if (schools.length > 0) {
      y = drawKeyValueRow(doc, "Nearby schools", "", y);
      for (const school of schools) {
        const name = (school?.name || "").trim();
        if (!name) continue;
        const level = (school?.level || "").trim();
        y = ensureRoom(doc, 16, y);
        y = drawKeyValueRow(doc, `  ${name}`, level || "—", y);
      }
    }
    y += 10;
  }

  // ── Sources footnote ────────────────────────────────────────────────
  y = ensureRoom(doc, 40, y);
  doc.fillColor(PDF_THEME.muted).font("Helvetica").fontSize(8)
    .text(
      "Sources: FEMA National Flood Hazard Layer & National Risk Index, NCES EDGE & Public Schools, National Weather Service, EPA (radon, SDWIS & National Walkability Index), AirNow, U.S. Census Bureau (ACS). Public data for informational purposes only — not professional advice, not a valuation of this home. Figures, forecasts, and ratings can change.",
      PAGE_MARGIN,
      y,
      { width: doc.page.width - PAGE_MARGIN * 2 },
    );

  drawFooter(doc);
  doc.end();
  return done;
}
