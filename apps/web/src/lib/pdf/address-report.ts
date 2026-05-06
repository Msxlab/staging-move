import PDFDocument from "pdfkit";
import {
  drawFooter,
  drawHeader,
  drawSectionHeading,
  ensureRoom,
  formatCategory,
  formatLongDate,
  formatUsd,
  PAGE_MARGIN,
  PDF_THEME,
} from "@/lib/pdf/layout";
import type { PdfAddress } from "@/lib/pdf/types";

/**
 * Generate the per-address monthly expense PDF as a buffer.
 *
 * Mirrors the layout the previous `window.print()` HTML version produced
 * (header, address card, category bars, service table, footer) but runs
 * server-side via pdfkit so:
 *
 *   1. The download is a real PDF byte stream — no print dialog, no
 *      pop-up blockers.
 *   2. The output is reproducible and can be hashed/audited.
 *   3. Sensitive numbers never leave the server unless the user actually
 *      requests the export.
 */
export async function generateAddressReportPdf(
  address: PdfAddress,
  userName: string,
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "LETTER",
    margins: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN },
    info: {
      Title: `LocateFlow — Monthly Expense Report (${address.nickname || address.street})`,
      Author: "LocateFlow",
      Subject: "Monthly Expense Report",
      CreationDate: new Date(),
    },
  });

  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const services = address.services || [];
  const totalMonthly = services.reduce(
    (sum, s) => sum + (s.monthlyCost || 0),
    0,
  );
  const annualEstimate = totalMonthly * 12;
  const monthYear = new Date().toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  // ── Header ──────────────────────────────────────────────────────────
  let y = drawHeader(doc, "Monthly Expense Report", monthYear);

  // ── Title block ─────────────────────────────────────────────────────
  doc.fillColor(PDF_THEME.text)
    .font("Helvetica-Bold").fontSize(20)
    .text(address.nickname || address.street, PAGE_MARGIN, y);
  y += 26;
  doc.fillColor(PDF_THEME.muted).font("Helvetica").fontSize(10)
    .text(
      `${address.street}, ${address.city}, ${address.state} ${address.zip}`,
      PAGE_MARGIN,
      y,
    );
  y += 22;

  // ── Address card ────────────────────────────────────────────────────
  const cardHeight = 88;
  doc.roundedRect(PAGE_MARGIN, y, doc.page.width - PAGE_MARGIN * 2, cardHeight, 10)
    .fill(PDF_THEME.accentSoft);
  doc.strokeColor(PDF_THEME.border).lineWidth(0.75)
    .roundedRect(PAGE_MARGIN, y, doc.page.width - PAGE_MARGIN * 2, cardHeight, 10)
    .stroke();

  const cardPadX = PAGE_MARGIN + 16;
  let cardY = y + 14;
  doc.fillColor(PDF_THEME.muted).font("Helvetica").fontSize(9)
    .text(`Type: ${address.type}  ·  Ownership: ${address.ownership === "OWNER" ? "Owner" : "Renter"}`, cardPadX, cardY);
  cardY += 14;
  doc.text(`Move-in: ${formatLongDate(address.startDate)}`, cardPadX, cardY);
  cardY += 14;
  doc.text(`Prepared for: ${userName || "Account Holder"}`, cardPadX, cardY);

  const stats: Array<{ value: string; label: string }> = [
    { value: String(services.length), label: "Services" },
    { value: formatUsd(totalMonthly), label: "Monthly" },
    { value: formatUsd(annualEstimate), label: "Annual est." },
  ];
  const statsRightPad = 18;
  const statColWidth = 90;
  const statsStartX =
    doc.page.width - PAGE_MARGIN - statsRightPad - statColWidth * stats.length;
  stats.forEach((stat, idx) => {
    const x = statsStartX + idx * statColWidth;
    doc.fillColor(PDF_THEME.accent).font("Helvetica-Bold").fontSize(16)
      .text(stat.value, x, y + 18, { width: statColWidth, align: "center" });
    doc.fillColor(PDF_THEME.muted).font("Helvetica").fontSize(8)
      .text(stat.label.toUpperCase(), x, y + 42, {
        width: statColWidth,
        align: "center",
        characterSpacing: 0.8,
      });
  });

  y += cardHeight + 18;

  // ── Category breakdown ─────────────────────────────────────────────
  if (services.length > 0 && totalMonthly > 0) {
    y = ensureRoom(doc, 80, y);
    y = drawSectionHeading(doc, "Category breakdown", y);

    const grouped = new Map<string, number>();
    for (const svc of services) {
      const prefix = (svc.category || "OTHER").split("_")[0];
      grouped.set(prefix, (grouped.get(prefix) || 0) + (svc.monthlyCost || 0));
    }
    const sorted = [...grouped.entries()].sort((a, b) => b[1] - a[1]);

    for (const [prefix, total] of sorted) {
      y = ensureRoom(doc, 22, y);
      const pct = totalMonthly > 0 ? (total / totalMonthly) * 100 : 0;
      const labelWidth = 110;
      const valueWidth = 110;
      const barWidth =
        doc.page.width - PAGE_MARGIN * 2 - labelWidth - valueWidth - 16;
      const barX = PAGE_MARGIN + labelWidth;

      doc.fillColor(PDF_THEME.text).font("Helvetica").fontSize(10)
        .text(formatCategory(prefix), PAGE_MARGIN, y, { width: labelWidth });

      doc.roundedRect(barX, y + 2, barWidth, 10, 5)
        .fill(PDF_THEME.border);
      doc.roundedRect(barX, y + 2, Math.max(2, (barWidth * pct) / 100), 10, 5)
        .fill(PDF_THEME.accent);

      const valueText = `${formatUsd(total)} (${Math.round(pct)}%)`;
      doc.fillColor(PDF_THEME.text).font("Helvetica-Bold").fontSize(10);
      const valueX =
        doc.page.width - PAGE_MARGIN - doc.widthOfString(valueText);
      doc.text(valueText, valueX, y);
      y += 18;
    }
    y += 6;
  }

  // ── Service details table ───────────────────────────────────────────
  y = ensureRoom(doc, 60, y);
  y = drawSectionHeading(doc, "Service details", y);

  const colWidths = {
    provider: 200,
    category: 130,
    billDay: 70,
    cost: 80,
  };
  const tableLeft = PAGE_MARGIN;
  const drawTableHeader = (yy: number) => {
    doc.fillColor(PDF_THEME.muted).font("Helvetica-Bold").fontSize(9);
    doc.text("Provider", tableLeft, yy);
    doc.text("Category", tableLeft + colWidths.provider, yy);
    doc.text("Bill day", tableLeft + colWidths.provider + colWidths.category, yy, {
      width: colWidths.billDay,
      align: "center",
    });
    doc.text(
      "Monthly cost",
      tableLeft + colWidths.provider + colWidths.category + colWidths.billDay,
      yy,
      { width: colWidths.cost, align: "right" },
    );
    const lineY = yy + 14;
    doc.strokeColor(PDF_THEME.border).lineWidth(0.5)
      .moveTo(PAGE_MARGIN, lineY)
      .lineTo(doc.page.width - PAGE_MARGIN, lineY)
      .stroke();
    return lineY + 6;
  };
  y = drawTableHeader(y);

  const sortedServices = [...services].sort(
    (a, b) => (b.monthlyCost || 0) - (a.monthlyCost || 0),
  );
  for (const svc of sortedServices) {
    y = ensureRoom(doc, 20, y);
    if (y === PAGE_MARGIN) {
      // Just paged — re-draw the table header on the new page.
      y = drawTableHeader(y);
    }

    doc.fillColor(PDF_THEME.text).font("Helvetica-Bold").fontSize(10)
      .text(svc.providerName || "—", tableLeft, y, {
        width: colWidths.provider - 8,
        ellipsis: true,
      });
    doc.fillColor(PDF_THEME.muted).font("Helvetica").fontSize(10)
      .text(formatCategory(svc.category), tableLeft + colWidths.provider, y, {
        width: colWidths.category - 8,
        ellipsis: true,
      });
    doc.text(
      svc.billingDay ? `Day ${svc.billingDay}` : "—",
      tableLeft + colWidths.provider + colWidths.category,
      y,
      { width: colWidths.billDay, align: "center" },
    );
    doc.fillColor(PDF_THEME.positive).font("Helvetica-Bold").fontSize(10)
      .text(
        formatUsd(svc.monthlyCost || 0),
        tableLeft + colWidths.provider + colWidths.category + colWidths.billDay,
        y,
        { width: colWidths.cost, align: "right" },
      );
    y += 18;
  }

  // ── Total row ───────────────────────────────────────────────────────
  y = ensureRoom(doc, 30, y) + 4;
  doc.strokeColor(PDF_THEME.positive).lineWidth(1.5)
    .moveTo(PAGE_MARGIN, y)
    .lineTo(doc.page.width - PAGE_MARGIN, y)
    .stroke();
  y += 6;
  doc.fillColor(PDF_THEME.text).font("Helvetica-Bold").fontSize(11)
    .text("Total monthly expenses", tableLeft, y);
  doc.fillColor(PDF_THEME.positive).font("Helvetica-Bold").fontSize(11);
  const totalText = formatUsd(totalMonthly);
  doc.text(
    totalText,
    doc.page.width - PAGE_MARGIN - doc.widthOfString(totalText),
    y,
  );

  drawFooter(doc);
  doc.end();
  return done;
}
