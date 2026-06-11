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
  const location = `${dossier.address.city}, ${dossier.address.state}`;
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
  const ok = (status: string) => status === "ok";
  const dash = (value: string | number | null | undefined): string =>
    value === null || value === undefined || value === "" ? "—" : String(value);

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
  y = drawKeyValueRow(doc, "Flood zone", ok(dossier.flood.status) ? dash(dossier.flood.zone) : "—", y);
  y = drawKeyValueRow(
    doc,
    "High-risk zone",
    ok(dossier.flood.status) && dossier.flood.isHighRisk !== null ? (dossier.flood.isHighRisk ? "Yes" : "No") : "—",
    y,
  );
  y += 6;

  // ── School district ─────────────────────────────────────────────────
  y = ensureRoom(doc, 50, y);
  y = drawSectionHeading(doc, "School district (NCES)", y);
  y = drawKeyValueRow(doc, "District", ok(dossier.school.status) ? dash(dossier.school.districtName) : "—", y);
  y += 6;

  // ── Move-day weather ────────────────────────────────────────────────
  y = ensureRoom(doc, 70, y);
  y = drawSectionHeading(doc, "Move-day forecast (NWS)", y);
  if (ok(dossier.weather.status)) {
    y = drawKeyValueRow(doc, "Forecast date", dash(dossier.weather.forecastDate), y);
    y = drawKeyValueRow(doc, "Summary", dash(dossier.weather.summary), y);
    const high = dossier.weather.tempHighF;
    const low = dossier.weather.tempLowF;
    y = drawKeyValueRow(
      doc,
      "High / Low",
      high === null && low === null ? "—" : `${high === null ? "—" : `${Math.round(high)}°F`} / ${low === null ? "—" : `${Math.round(low)}°F`}`,
      y,
    );
    y = drawKeyValueRow(
      doc,
      "Precip chance",
      dossier.weather.precipChancePct === null ? "—" : `${Math.round(dossier.weather.precipChancePct)}%`,
      y,
    );
  } else {
    y = drawKeyValueRow(doc, "Forecast", "Available within ~7 days of your move date", y);
  }
  y += 6;

  // ── Hazards ─────────────────────────────────────────────────────────
  y = ensureRoom(doc, 60, y);
  y = drawSectionHeading(doc, "Natural hazard risk (FEMA NRI)", y);
  y = drawKeyValueRow(doc, "Overall rating", ok(dossier.hazards.status) ? dash(dossier.hazards.overallRating) : "—", y);
  if (ok(dossier.hazards.status)) {
    for (const risk of dossier.hazards.topRisks.slice(0, 5)) {
      y = ensureRoom(doc, 16, y);
      y = drawKeyValueRow(doc, `  ${risk.hazard}`, dash(risk.rating), y);
    }
  }
  y += 6;

  // ── Radon ───────────────────────────────────────────────────────────
  y = ensureRoom(doc, 40, y);
  y = drawSectionHeading(doc, "Radon zone (EPA)", y);
  y = drawKeyValueRow(doc, "EPA radon zone", ok(dossier.radon.status) ? dash(dossier.radon.zone) : "—", y);
  y += 6;

  // ── Water ───────────────────────────────────────────────────────────
  y = ensureRoom(doc, 50, y);
  y = drawSectionHeading(doc, "Drinking water (EPA SDWIS)", y);
  y = drawKeyValueRow(doc, "Water system", ok(dossier.water.status) ? dash(dossier.water.systemName) : "—", y);
  y = drawKeyValueRow(
    doc,
    "Violations (5y)",
    ok(dossier.water.status) ? dash(dossier.water.violations5y) : "—",
    y,
  );
  y += 6;

  // ── Air quality ─────────────────────────────────────────────────────
  y = ensureRoom(doc, 50, y);
  y = drawSectionHeading(doc, "Air quality (AirNow)", y);
  y = drawKeyValueRow(doc, "Current AQI", ok(dossier.air.status) ? dash(dossier.air.aqi) : "—", y);
  y = drawKeyValueRow(doc, "Category", ok(dossier.air.status) ? dash(dossier.air.category) : "—", y);
  y += 10;

  // ── Sources footnote ────────────────────────────────────────────────
  y = ensureRoom(doc, 40, y);
  doc.fillColor(PDF_THEME.muted).font("Helvetica").fontSize(8)
    .text(
      "Sources: FEMA National Flood Hazard Layer & National Risk Index, NCES EDGE, National Weather Service, EPA (radon & SDWIS), AirNow. Public data for informational purposes only — not professional advice. Forecasts and ratings can change.",
      PAGE_MARGIN,
      y,
      { width: doc.page.width - PAGE_MARGIN * 2 },
    );

  drawFooter(doc);
  doc.end();
  return done;
}
