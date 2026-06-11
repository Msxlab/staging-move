import PDFDocument from "pdfkit";
import {
  drawFooter,
  drawHeader,
  drawKeyValueRow,
  drawSectionHeading,
  ensureRoom,
  formatCategory,
  formatUsd,
  PAGE_MARGIN,
  PDF_THEME,
} from "@/lib/pdf/layout";

/**
 * Owner-facing monthly business report (the PDF the admin-monthly-report
 * cron attaches to its email on the 1st of each month).
 *
 * Pure presentation: the cron route assembles every number from the same
 * sources the admin daily digest reads (shared computeMrr/movement/churn
 * helpers + Prisma aggregates) and passes the finished data in, so this
 * module stays unit-testable without a database. Reuses the pdfkit layout
 * stack the user-facing exports already ship (layout.ts) — same brand
 * header, typography, and footer.
 *
 * Localization note: operator-facing and English-only by design, matching
 * the admin daily digest email.
 */

export type MonthlyBusinessReportData = {
  /** Human label for the reported month, e.g. "May 2026". */
  monthLabel: string;
  kpis: {
    mrr: number;
    newMrr: number;
    churnedMrr: number;
    netMrr: number;
    churnPct: number;
    activeSubscriptions: number;
    newUsers: number;
    priorMonthNewUsers: number;
    totalUsers: number;
    canceledSubscriptions: number;
    supportTickets: number;
  };
  /** Trailing months, oldest first (YYYY-MM labels). */
  mrrTrend: Array<{ month: string; mrr: number }>;
  /** Trailing months, oldest first (YYYY-MM labels). */
  userGrowth: Array<{ month: string; newUsers: number }>;
  /** Active service categories, largest first. */
  topCategories: Array<{ category: string; services: number; monthlyCost: number }>;
  /** Per-source integration call counts for the reported month. */
  integrationHealth: Array<{ source: string; total: number; failures: number }>;
};

const signedUsd = (n: number) => `${n < 0 ? "−" : "+"}${formatUsd(Math.abs(n))}`;

/**
 * Horizontal label + bar + value row, shared by the trend/growth/category
 * sections. `fraction` is the bar fill relative to the section max.
 */
function drawBarRow(
  doc: typeof PDFDocument.prototype,
  label: string,
  valueText: string,
  fraction: number,
  y: number,
): number {
  const labelWidth = 120;
  const valueWidth = 120;
  const barWidth = doc.page.width - PAGE_MARGIN * 2 - labelWidth - valueWidth - 16;
  const barX = PAGE_MARGIN + labelWidth;

  doc.fillColor(PDF_THEME.text).font("Helvetica").fontSize(10)
    .text(label, PAGE_MARGIN, y, { width: labelWidth, ellipsis: true });

  doc.roundedRect(barX, y + 2, barWidth, 10, 5).fill(PDF_THEME.border);
  const clamped = Math.max(0, Math.min(1, fraction));
  doc.roundedRect(barX, y + 2, Math.max(2, barWidth * clamped), 10, 5)
    .fill(PDF_THEME.accent);

  doc.fillColor(PDF_THEME.text).font("Helvetica-Bold").fontSize(10);
  const valueX = doc.page.width - PAGE_MARGIN - doc.widthOfString(valueText);
  doc.text(valueText, valueX, y);
  return y + 18;
}

/** "2026-05" → "May 2026"; anything unparsable passes through unchanged. */
function monthKeyLabel(key: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) return key;
  const d = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

export async function generateMonthlyBusinessReportPdf(
  data: MonthlyBusinessReportData,
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "LETTER",
    margins: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN },
    info: {
      Title: `LocateFlow — Monthly Business Report (${data.monthLabel})`,
      Author: "LocateFlow",
      Subject: "Monthly Business Report",
      CreationDate: new Date(),
    },
  });

  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const { kpis } = data;

  // ── Page 1: revenue & business KPIs ─────────────────────────────────
  let y = drawHeader(doc, "Monthly Business Report", data.monthLabel);

  doc.fillColor(PDF_THEME.text).font("Helvetica-Bold").fontSize(20)
    .text(`Business summary — ${data.monthLabel}`, PAGE_MARGIN, y);
  y += 26;
  doc.fillColor(PDF_THEME.muted).font("Helvetica").fontSize(10)
    .text("Internal operator report. Figures use the same realized-MRR rules as the admin dashboard.", PAGE_MARGIN, y);
  y += 24;

  // KPI band card: MRR / net new / churn / signups.
  const cardHeight = 64;
  doc.roundedRect(PAGE_MARGIN, y, doc.page.width - PAGE_MARGIN * 2, cardHeight, 10)
    .fill(PDF_THEME.accentSoft);
  doc.strokeColor(PDF_THEME.border).lineWidth(0.75)
    .roundedRect(PAGE_MARGIN, y, doc.page.width - PAGE_MARGIN * 2, cardHeight, 10)
    .stroke();
  const bandStats: Array<{ value: string; label: string }> = [
    { value: formatUsd(kpis.mrr), label: "MRR" },
    { value: signedUsd(kpis.netMrr), label: "Net new MRR" },
    { value: `${kpis.churnPct.toFixed(1)}%`, label: "Churn" },
    { value: String(kpis.newUsers), label: "New users" },
  ];
  const bandColWidth = (doc.page.width - PAGE_MARGIN * 2) / bandStats.length;
  bandStats.forEach((stat, idx) => {
    const x = PAGE_MARGIN + idx * bandColWidth;
    doc.fillColor(PDF_THEME.accent).font("Helvetica-Bold").fontSize(16)
      .text(stat.value, x, y + 14, { width: bandColWidth, align: "center" });
    doc.fillColor(PDF_THEME.muted).font("Helvetica").fontSize(8)
      .text(stat.label.toUpperCase(), x, y + 38, {
        width: bandColWidth,
        align: "center",
        characterSpacing: 0.8,
      });
  });
  y += cardHeight + 18;

  // KPI table.
  y = ensureRoom(doc, 140, y);
  y = drawSectionHeading(doc, "Key performance indicators", y);
  y = drawKeyValueRow(doc, "Monthly recurring revenue (end of month)", formatUsd(kpis.mrr), y);
  y = drawKeyValueRow(doc, "Active subscriptions", String(kpis.activeSubscriptions), y);
  y = drawKeyValueRow(doc, "Monthly churn rate", `${kpis.churnPct.toFixed(1)}%`, y);
  y = drawKeyValueRow(doc, "New users", `${kpis.newUsers} (prior month ${kpis.priorMonthNewUsers})`, y);
  y = drawKeyValueRow(doc, "Total users", String(kpis.totalUsers), y);
  y = drawKeyValueRow(doc, "Canceled subscriptions", String(kpis.canceledSubscriptions), y);
  y = drawKeyValueRow(doc, "Support tickets opened", String(kpis.supportTickets), y);
  y += 8;

  // MRR movement.
  y = ensureRoom(doc, 90, y);
  y = drawSectionHeading(doc, "MRR movement", y);
  y = drawKeyValueRow(doc, "New MRR (subscriptions started this month)", `+${formatUsd(kpis.newMrr)}`, y);
  y = drawKeyValueRow(doc, "Churned MRR (subscriptions canceled this month)", `−${formatUsd(kpis.churnedMrr)}`, y);
  y = drawKeyValueRow(doc, "Net new MRR", signedUsd(kpis.netMrr), y);
  y += 8;

  // MRR trend bars.
  if (data.mrrTrend.length > 0) {
    y = ensureRoom(doc, 40 + data.mrrTrend.length * 18, y);
    y = drawSectionHeading(doc, "MRR trend", y);
    const maxMrr = Math.max(...data.mrrTrend.map((p) => p.mrr), 1);
    for (const point of data.mrrTrend) {
      y = ensureRoom(doc, 22, y);
      y = drawBarRow(doc, monthKeyLabel(point.month), formatUsd(point.mrr), point.mrr / maxMrr, y);
    }
  }

  // ── Page 2: growth, categories, integration health ──────────────────
  drawFooter(doc);
  doc.addPage();
  y = drawHeader(doc, "Monthly Business Report", data.monthLabel);

  if (data.userGrowth.length > 0) {
    y = drawSectionHeading(doc, "User growth (new signups per month)", y);
    const maxUsers = Math.max(...data.userGrowth.map((p) => p.newUsers), 1);
    for (const point of data.userGrowth) {
      y = ensureRoom(doc, 22, y);
      y = drawBarRow(doc, monthKeyLabel(point.month), String(point.newUsers), point.newUsers / maxUsers, y);
    }
    y += 6;
  }

  if (data.topCategories.length > 0) {
    y = ensureRoom(doc, 60, y);
    y = drawSectionHeading(doc, "Top service categories", y);
    const maxServices = Math.max(...data.topCategories.map((c) => c.services), 1);
    for (const cat of data.topCategories) {
      y = ensureRoom(doc, 22, y);
      y = drawBarRow(
        doc,
        formatCategory(cat.category),
        `${cat.services} svc · ${formatUsd(cat.monthlyCost)}/mo`,
        cat.services / maxServices,
        y,
      );
    }
    y += 6;
  }

  // Integration health table.
  y = ensureRoom(doc, 70, y);
  y = drawSectionHeading(doc, "Integration health", y);
  if (data.integrationHealth.length === 0) {
    doc.fillColor(PDF_THEME.muted).font("Helvetica").fontSize(10)
      .text("No integration telemetry recorded this month.", PAGE_MARGIN, y);
    y += 18;
  } else {
    const cols = { source: 170, total: 110, failures: 110, rate: 90 };
    const tableLeft = PAGE_MARGIN;
    const drawTableHeader = (yy: number) => {
      doc.fillColor(PDF_THEME.muted).font("Helvetica-Bold").fontSize(9);
      doc.text("Source", tableLeft, yy);
      doc.text("Calls", tableLeft + cols.source, yy, { width: cols.total, align: "right" });
      doc.text("Failures", tableLeft + cols.source + cols.total, yy, { width: cols.failures, align: "right" });
      doc.text("Success", tableLeft + cols.source + cols.total + cols.failures, yy, { width: cols.rate, align: "right" });
      const lineY = yy + 14;
      doc.strokeColor(PDF_THEME.border).lineWidth(0.5)
        .moveTo(PAGE_MARGIN, lineY)
        .lineTo(doc.page.width - PAGE_MARGIN, lineY)
        .stroke();
      return lineY + 6;
    };
    y = drawTableHeader(y);
    for (const row of data.integrationHealth) {
      y = ensureRoom(doc, 20, y);
      if (y === PAGE_MARGIN) y = drawTableHeader(y);
      const successPct = row.total > 0 ? ((row.total - row.failures) / row.total) * 100 : 100;
      doc.fillColor(PDF_THEME.text).font("Helvetica-Bold").fontSize(10)
        .text(row.source, tableLeft, y, { width: cols.source - 8, ellipsis: true });
      doc.fillColor(PDF_THEME.muted).font("Helvetica").fontSize(10)
        .text(row.total.toLocaleString("en-US"), tableLeft + cols.source, y, { width: cols.total, align: "right" });
      doc.text(row.failures.toLocaleString("en-US"), tableLeft + cols.source + cols.total, y, { width: cols.failures, align: "right" });
      doc.fillColor(row.failures > 0 ? PDF_THEME.text : PDF_THEME.positive)
        .font("Helvetica-Bold").fontSize(10)
        .text(`${successPct.toFixed(1)}%`, tableLeft + cols.source + cols.total + cols.failures, y, { width: cols.rate, align: "right" });
      y += 18;
    }
  }

  drawFooter(doc);
  doc.end();
  return done;
}
