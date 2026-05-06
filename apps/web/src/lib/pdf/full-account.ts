import PDFDocument from "pdfkit";
import {
  drawFooter,
  drawHeader,
  drawKeyValueRow,
  drawSectionHeading,
  ensureRoom,
  formatLongDate,
  formatUsd,
  PAGE_MARGIN,
  PDF_THEME,
} from "@/lib/pdf/layout";
import type { PdfAccountSnapshot } from "@/lib/pdf/types";

/**
 * Generate the full-account export PDF.
 *
 * Unlike the per-address report this is a record-keeping document — a
 * snapshot of the account's profile, subscription, addresses, services,
 * and moving plans suitable for personal archives or audit hand-off.
 *
 * Sensitive fields (account numbers, full phone numbers, passwords) are
 * intentionally absent here; if a user needs the raw masked data they
 * can use the JSON/CSV export, which already runs through the same field
 * masking we've used in `/api/export`.
 */
export async function generateFullAccountPdf(
  snapshot: PdfAccountSnapshot,
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "LETTER",
    margins: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN },
    info: {
      Title: `LocateFlow — Account Snapshot (${snapshot.user.email})`,
      Author: "LocateFlow",
      Subject: "Full Account Export",
      CreationDate: new Date(),
    },
  });

  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const fullName = [snapshot.user.firstName, snapshot.user.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const totalServices = snapshot.addresses.reduce(
    (sum, a) => sum + (a.services?.length || 0),
    0,
  );
  const totalMonthly = snapshot.addresses.reduce(
    (sum, a) => sum + a.services.reduce((s, sv) => s + (sv.monthlyCost || 0), 0),
    0,
  );

  // ── Header ──────────────────────────────────────────────────────────
  let y = drawHeader(doc, "Account snapshot", fullName || snapshot.user.email);

  // ── Profile section ────────────────────────────────────────────────
  y = drawSectionHeading(doc, "Profile", y);
  y = drawKeyValueRow(doc, "Name", fullName || "—", y);
  y = drawKeyValueRow(doc, "Email", snapshot.user.email, y);
  y = drawKeyValueRow(doc, "Account created", formatLongDate(snapshot.user.createdAt), y);
  if (snapshot.user.preferredLocale) {
    y = drawKeyValueRow(doc, "Preferred language", snapshot.user.preferredLocale.toUpperCase(), y);
  }
  y += 6;

  // ── Subscription ────────────────────────────────────────────────────
  y = ensureRoom(doc, 80, y);
  y = drawSectionHeading(doc, "Subscription", y);
  if (snapshot.subscription) {
    y = drawKeyValueRow(doc, "Plan", snapshot.subscription.plan, y);
    y = drawKeyValueRow(doc, "Status", snapshot.subscription.status, y);
    y = drawKeyValueRow(
      doc,
      "Current period ends",
      formatLongDate(snapshot.subscription.currentPeriodEndsAt),
      y,
    );
  } else {
    doc.fillColor(PDF_THEME.muted).font("Helvetica-Oblique").fontSize(10)
      .text("No active subscription on file.", PAGE_MARGIN, y);
    y += 16;
  }
  y += 6;

  // ── Totals card ─────────────────────────────────────────────────────
  y = ensureRoom(doc, 70, y);
  const cardHeight = 56;
  doc.roundedRect(PAGE_MARGIN, y, doc.page.width - PAGE_MARGIN * 2, cardHeight, 10)
    .fill(PDF_THEME.accentSoft);
  doc.strokeColor(PDF_THEME.border).lineWidth(0.75)
    .roundedRect(PAGE_MARGIN, y, doc.page.width - PAGE_MARGIN * 2, cardHeight, 10)
    .stroke();
  const stats = [
    { value: String(snapshot.addresses.length), label: "Addresses" },
    { value: String(totalServices), label: "Services" },
    { value: formatUsd(totalMonthly), label: "Monthly spend" },
    { value: formatUsd(totalMonthly * 12), label: "Annual estimate" },
  ];
  const colWidth = (doc.page.width - PAGE_MARGIN * 2) / stats.length;
  stats.forEach((stat, idx) => {
    const x = PAGE_MARGIN + idx * colWidth;
    doc.fillColor(PDF_THEME.accent).font("Helvetica-Bold").fontSize(15)
      .text(stat.value, x, y + 12, { width: colWidth, align: "center" });
    doc.fillColor(PDF_THEME.muted).font("Helvetica").fontSize(8)
      .text(stat.label.toUpperCase(), x, y + 34, {
        width: colWidth,
        align: "center",
        characterSpacing: 0.8,
      });
  });
  y += cardHeight + 18;

  // ── Addresses + services ────────────────────────────────────────────
  y = ensureRoom(doc, 60, y);
  y = drawSectionHeading(doc, "Addresses", y);
  if (snapshot.addresses.length === 0) {
    doc.fillColor(PDF_THEME.muted).font("Helvetica-Oblique").fontSize(10)
      .text("No addresses recorded.", PAGE_MARGIN, y);
    y += 16;
  }
  for (const addr of snapshot.addresses) {
    y = ensureRoom(doc, 80, y);
    doc.fillColor(PDF_THEME.text).font("Helvetica-Bold").fontSize(12)
      .text(addr.nickname || addr.street, PAGE_MARGIN, y, {
        width: doc.page.width - PAGE_MARGIN * 2 - 80,
      });
    if (addr.isPrimary) {
      doc.fillColor(PDF_THEME.accent).font("Helvetica-Bold").fontSize(8);
      const tag = "PRIMARY";
      const tagWidth = doc.widthOfString(tag) + 12;
      doc.roundedRect(
        doc.page.width - PAGE_MARGIN - tagWidth,
        y,
        tagWidth,
        14,
        7,
      ).fill(PDF_THEME.accentSoft);
      doc.fillColor(PDF_THEME.accent).text(
        tag,
        doc.page.width - PAGE_MARGIN - tagWidth,
        y + 3,
        { width: tagWidth, align: "center" },
      );
    }
    y += 16;
    doc.fillColor(PDF_THEME.muted).font("Helvetica").fontSize(9)
      .text(
        `${addr.street}, ${addr.city}, ${addr.state} ${addr.zip}  ·  ${addr.type}  ·  ${addr.ownership === "OWNER" ? "Owner" : "Renter"}`,
        PAGE_MARGIN,
        y,
      );
    y += 14;

    if (addr.services.length === 0) {
      doc.fillColor(PDF_THEME.muted).font("Helvetica-Oblique").fontSize(9)
        .text("No services on this address.", PAGE_MARGIN + 12, y);
      y += 14;
    } else {
      const colP = 220;
      const colC = 160;
      doc.fillColor(PDF_THEME.muted).font("Helvetica-Bold").fontSize(8);
      doc.text("Provider", PAGE_MARGIN, y);
      doc.text("Category", PAGE_MARGIN + colP, y);
      doc.text("Monthly", doc.page.width - PAGE_MARGIN - 80, y, {
        width: 80,
        align: "right",
      });
      y += 12;
      doc.strokeColor(PDF_THEME.border).lineWidth(0.5)
        .moveTo(PAGE_MARGIN, y - 2)
        .lineTo(doc.page.width - PAGE_MARGIN, y - 2)
        .stroke();
      const sorted = [...addr.services].sort(
        (a, b) => (b.monthlyCost || 0) - (a.monthlyCost || 0),
      );
      for (const svc of sorted) {
        y = ensureRoom(doc, 16, y);
        doc.fillColor(PDF_THEME.text).font("Helvetica").fontSize(9)
          .text(svc.providerName, PAGE_MARGIN, y, { width: colP - 8, ellipsis: true });
        doc.fillColor(PDF_THEME.muted)
          .text(svc.category.replace(/_/g, " "), PAGE_MARGIN + colP, y, {
            width: colC - 8,
            ellipsis: true,
          });
        doc.fillColor(PDF_THEME.positive).font("Helvetica-Bold")
          .text(
            formatUsd(svc.monthlyCost || 0),
            doc.page.width - PAGE_MARGIN - 80,
            y,
            { width: 80, align: "right" },
          );
        y += 14;
      }
    }
    y += 8;
  }

  // ── Moving plans ────────────────────────────────────────────────────
  y = ensureRoom(doc, 60, y);
  y = drawSectionHeading(doc, "Moving plans", y);
  if (snapshot.movingPlans.length === 0) {
    doc.fillColor(PDF_THEME.muted).font("Helvetica-Oblique").fontSize(10)
      .text("No moving plans on file.", PAGE_MARGIN, y);
    y += 16;
  } else {
    for (const plan of snapshot.movingPlans) {
      y = ensureRoom(doc, 22, y);
      const from =
        plan.fromCity && plan.fromState
          ? `${plan.fromCity}, ${plan.fromState}`
          : "—";
      const to =
        plan.toCity && plan.toState
          ? `${plan.toCity}, ${plan.toState}`
          : "—";
      doc.fillColor(PDF_THEME.text).font("Helvetica").fontSize(10)
        .text(`${from} → ${to}`, PAGE_MARGIN, y, {
          width: doc.page.width - PAGE_MARGIN * 2 - 180,
        });
      const right = `${plan.status}  ·  ${formatLongDate(plan.moveDate)}`;
      doc.fillColor(PDF_THEME.muted).font("Helvetica").fontSize(9);
      doc.text(
        right,
        doc.page.width - PAGE_MARGIN - doc.widthOfString(right),
        y + 1,
      );
      y += 18;
    }
  }
  y += 6;

  // ── Tasks summary ───────────────────────────────────────────────────
  y = ensureRoom(doc, 50, y);
  y = drawSectionHeading(doc, "Tasks", y);
  y = drawKeyValueRow(doc, "Open tasks", String(snapshot.taskSummary.open), y);
  y = drawKeyValueRow(doc, "Completed tasks", String(snapshot.taskSummary.completed), y);
  y = drawKeyValueRow(doc, "Dismissed tasks", String(snapshot.taskSummary.dismissed), y);

  drawFooter(doc);
  doc.end();
  return done;
}
