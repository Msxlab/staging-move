import PDFDocument from "pdfkit";
import {
  drawFooter,
  drawHeader,
  drawSectionHeading,
  ensureRoom,
  formatLongDate,
  formatUsd,
  PAGE_MARGIN,
  PDF_THEME,
} from "@/lib/pdf/layout";
import type { TaxReportData } from "@/lib/tax-report-data";

/**
 * Server-rendered "Tax & Property" PDF (Pro). A per-property summary an
 * accountant can use: occupancy, service count, monthly-equivalent and
 * annualized cost per property, plus a grand total and an explicit
 * "not tax advice" disclaimer. Same pdfkit/layout primitives as the address and
 * full-account reports so it stays visually consistent.
 */
export async function generateTaxReportPdf(data: TaxReportData, userName: string): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "LETTER",
    margins: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN },
    info: {
      Title: "LocateFlow — Tax & Property Report",
      Author: "LocateFlow",
      Subject: "Tax & Property Report",
      CreationDate: new Date(),
    },
  });

  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const generatedOn = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  // ── Header + title ──────────────────────────────────────────────────
  let y = drawHeader(doc, "Tax & Property Report", generatedOn);
  doc.fillColor(PDF_THEME.text).font("Helvetica-Bold").fontSize(20)
    .text("Tax & property summary", PAGE_MARGIN, y);
  y += 26;
  doc.fillColor(PDF_THEME.muted).font("Helvetica").fontSize(10)
    .text(`Prepared for: ${userName || "Account Holder"}`, PAGE_MARGIN, y);
  y += 22;

  // ── Totals card ─────────────────────────────────────────────────────
  const t = data.taxTotals;
  const cardHeight = 70;
  doc.roundedRect(PAGE_MARGIN, y, doc.page.width - PAGE_MARGIN * 2, cardHeight, 10).fill(PDF_THEME.accentSoft);
  doc.strokeColor(PDF_THEME.border).lineWidth(0.75)
    .roundedRect(PAGE_MARGIN, y, doc.page.width - PAGE_MARGIN * 2, cardHeight, 10).stroke();
  const stats: Array<{ value: string; label: string }> = [
    { value: String(t.propertyCount), label: "Properties" },
    { value: String(t.serviceCount), label: "Services" },
    { value: formatUsd(t.totalMonthlyEquivalent), label: "Monthly equiv." },
    { value: formatUsd(t.totalAnnualizedCost), label: "Annualized" },
  ];
  const colW = (doc.page.width - PAGE_MARGIN * 2) / stats.length;
  stats.forEach((s, i) => {
    const x = PAGE_MARGIN + i * colW;
    doc.fillColor(PDF_THEME.accent).font("Helvetica-Bold").fontSize(16).text(s.value, x, y + 16, { width: colW, align: "center" });
    doc.fillColor(PDF_THEME.muted).font("Helvetica").fontSize(8).text(s.label.toUpperCase(), x, y + 40, { width: colW, align: "center", characterSpacing: 0.8 });
  });
  y += cardHeight + 18;

  // ── Per-property table ──────────────────────────────────────────────
  y = ensureRoom(doc, 60, y);
  y = drawSectionHeading(doc, "By property", y);

  const cols = { property: 170, type: 90, services: 60, monthly: 90, annual: 100 };
  const left = PAGE_MARGIN;
  const drawTableHeader = (yy: number) => {
    doc.fillColor(PDF_THEME.muted).font("Helvetica-Bold").fontSize(9);
    doc.text("Property", left, yy, { width: cols.property });
    doc.text("Type / ownership", left + cols.property, yy, { width: cols.type });
    doc.text("Services", left + cols.property + cols.type, yy, { width: cols.services, align: "center" });
    doc.text("Monthly", left + cols.property + cols.type + cols.services, yy, { width: cols.monthly, align: "right" });
    doc.text("Annualized", left + cols.property + cols.type + cols.services + cols.monthly, yy, { width: cols.annual, align: "right" });
    const lineY = yy + 14;
    doc.strokeColor(PDF_THEME.border).lineWidth(0.5).moveTo(PAGE_MARGIN, lineY).lineTo(doc.page.width - PAGE_MARGIN, lineY).stroke();
    return lineY + 6;
  };
  y = drawTableHeader(y);

  const sorted = [...data.taxByProperty].sort((a, b) => b.totalAnnualizedCost - a.totalAnnualizedCost);
  for (const p of sorted) {
    y = ensureRoom(doc, 30, y);
    if (y === PAGE_MARGIN) y = drawTableHeader(y);
    doc.fillColor(PDF_THEME.text).font("Helvetica-Bold").fontSize(10)
      .text(p.property || "—", left, y, { width: cols.property - 8, ellipsis: true });
    const ownership = p.ownership === "OWNER" ? "Owner" : p.ownership === "RENT" || p.ownership === "RENTER" ? "Renter" : p.ownership || "—";
    doc.fillColor(PDF_THEME.muted).font("Helvetica").fontSize(9)
      .text(`${p.propertyType || "—"} · ${ownership}`, left + cols.property, y + 1, { width: cols.type - 8, ellipsis: true });
    doc.fillColor(PDF_THEME.text).font("Helvetica").fontSize(10)
      .text(String(p.serviceCount), left + cols.property + cols.type, y, { width: cols.services, align: "center" });
    doc.text(formatUsd(p.totalMonthlyEquivalent), left + cols.property + cols.type + cols.services, y, { width: cols.monthly, align: "right" });
    doc.fillColor(PDF_THEME.positive).font("Helvetica-Bold").fontSize(10)
      .text(formatUsd(p.totalAnnualizedCost), left + cols.property + cols.type + cols.services + cols.monthly, y, { width: cols.annual, align: "right" });
    // Occupancy sub-line.
    if (p.occupancyStart) {
      y += 14;
      doc.fillColor(PDF_THEME.muted).font("Helvetica").fontSize(8)
        .text(`Occupancy: ${formatLongDate(p.occupancyStart)}${p.occupancyEnd ? ` – ${formatLongDate(p.occupancyEnd)}` : " – present"}`, left, y, { width: cols.property + cols.type });
    }
    y += 18;
  }

  // ── Grand total ─────────────────────────────────────────────────────
  y = ensureRoom(doc, 30, y) + 4;
  doc.strokeColor(PDF_THEME.positive).lineWidth(1.5).moveTo(PAGE_MARGIN, y).lineTo(doc.page.width - PAGE_MARGIN, y).stroke();
  y += 6;
  doc.fillColor(PDF_THEME.text).font("Helvetica-Bold").fontSize(11).text("Total annualized cost", left, y);
  doc.fillColor(PDF_THEME.positive).font("Helvetica-Bold").fontSize(11);
  const totalText = formatUsd(t.totalAnnualizedCost);
  doc.text(totalText, doc.page.width - PAGE_MARGIN - doc.widthOfString(totalText), y);
  y += 24;

  // ── Disclaimer ──────────────────────────────────────────────────────
  y = ensureRoom(doc, 40, y);
  doc.fillColor(PDF_THEME.muted).font("Helvetica-Oblique").fontSize(8)
    .text(
      "This report summarizes the costs and properties you tracked in LocateFlow. It is provided for your records only and is not tax, legal, or financial advice. Verify all figures and consult a qualified professional before filing.",
      PAGE_MARGIN,
      y,
      { width: doc.page.width - PAGE_MARGIN * 2 },
    );

  drawFooter(doc);
  doc.end();
  return done;
}
