import type PDFDocumentType from "pdfkit";

/**
 * Shared layout helpers for the server-side PDF generators.
 *
 * pdfkit's API is imperative and mutates a global cursor — these helpers
 * keep the call sites readable and ensure consistent typography across
 * the per-address and full-account reports. Anything report-specific (the
 * actual content) stays in the generator file.
 *
 * Localization note: the generators stick to English for v1, but they
 * accept all user-facing strings as parameters so a future locale layer
 * can swap them without touching layout code.
 */

export const PDF_THEME = {
  /** Move Gold — used for the wordmark accent and primary highlights. */
  accent: "#765514",
  /** Soft brand background tint for cards. */
  accentSoft: "#EAF1F9",
  /** Default text color (matches `slate-800`). */
  text: "#1E293B",
  /** Secondary text (matches `slate-500`). */
  muted: "#64748B",
  /** Hairline borders (matches `slate-200`). */
  border: "#E2E8F0",
  /** Success green for cost totals. */
  positive: "#059669",
  /** Page background — kept white for printing. */
  background: "#FFFFFF",
} as const;

export const PAGE_MARGIN = 48;

/** Format a number as USD with `$` and thousands separators. */
export function formatUsd(value: number): string {
  return `$${(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

/** Format a date input as e.g. "May 6, 2026". */
export function formatLongDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** Format a category enum (e.g. `UTILITY_ELECTRIC` → `Utility Electric`). */
export function formatCategory(category: string): string {
  if (!category) return "Other";
  return category
    .split("_")
    .map((part) => (part ? part[0] + part.slice(1).toLowerCase() : ""))
    .join(" ");
}

/**
 * Draw the LocateFlow wordmark + report metadata header at the top of a
 * page. Returns the y position the caller should resume drawing from.
 */
export function drawHeader(
  doc: typeof PDFDocumentType.prototype,
  reportTitle: string,
  reportSubtitle: string,
): number {
  const startY = PAGE_MARGIN;

  doc.fillColor(PDF_THEME.text)
    .font("Helvetica-Bold")
    .fontSize(18)
    .text("Locate", PAGE_MARGIN, startY, { continued: true });
  doc.fillColor(PDF_THEME.accent)
    .font("Helvetica-Oblique")
    .fontSize(18)
    .text("flow", { continued: false });

  const rightX = doc.page.width - PAGE_MARGIN;
  const generatedAt = new Date();
  const metaLines = [
    { text: reportTitle, font: "Helvetica-Bold", color: PDF_THEME.text, size: 11 },
    { text: reportSubtitle, font: "Helvetica", color: PDF_THEME.muted, size: 10 },
    {
      text: `Generated ${formatLongDate(generatedAt)}`,
      font: "Helvetica",
      color: PDF_THEME.muted,
      size: 10,
    },
  ];

  let metaY = startY;
  for (const line of metaLines) {
    doc.fillColor(line.color).font(line.font).fontSize(line.size);
    const width = doc.widthOfString(line.text);
    doc.text(line.text, rightX - width, metaY);
    metaY += line.size + 2;
  }

  const dividerY = Math.max(startY + 28, metaY + 6);
  doc.strokeColor(PDF_THEME.border).lineWidth(1)
    .moveTo(PAGE_MARGIN, dividerY)
    .lineTo(doc.page.width - PAGE_MARGIN, dividerY)
    .stroke();

  return dividerY + 16;
}

/**
 * Draw a section heading (uppercase, muted) at the current cursor.
 * Mutates the document cursor so the next draw call resumes below it.
 */
export function drawSectionHeading(
  doc: typeof PDFDocumentType.prototype,
  text: string,
  y: number,
): number {
  doc.fillColor(PDF_THEME.muted)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(text.toUpperCase(), PAGE_MARGIN, y, { characterSpacing: 1.2 });
  const nextY = y + 14;
  doc.strokeColor(PDF_THEME.border).lineWidth(0.5)
    .moveTo(PAGE_MARGIN, nextY)
    .lineTo(doc.page.width - PAGE_MARGIN, nextY)
    .stroke();
  return nextY + 10;
}

/**
 * Draw a centered footer (page number + confidentiality) at the bottom.
 * Called once per page right before adding the next page or finalizing.
 */
export function drawFooter(doc: typeof PDFDocumentType.prototype): void {
  const y = doc.page.height - PAGE_MARGIN + 16;
  doc.fillColor(PDF_THEME.muted).font("Helvetica").fontSize(8);
  doc.text(
    "LocateFlow — Relocation Management Platform",
    PAGE_MARGIN,
    y,
    { width: doc.page.width - PAGE_MARGIN * 2, align: "left" },
  );
  doc.text(
    "Confidential",
    PAGE_MARGIN,
    y,
    { width: doc.page.width - PAGE_MARGIN * 2, align: "right" },
  );
}

/**
 * Draw a key/value row with the label on the left and the value on the
 * right. Returns the y position after the row.
 */
export function drawKeyValueRow(
  doc: typeof PDFDocumentType.prototype,
  label: string,
  value: string,
  y: number,
): number {
  doc.fillColor(PDF_THEME.muted).font("Helvetica").fontSize(9)
    .text(label, PAGE_MARGIN, y);
  doc.fillColor(PDF_THEME.text).font("Helvetica-Bold").fontSize(10);
  const valueWidth = doc.widthOfString(value);
  doc.text(value, doc.page.width - PAGE_MARGIN - valueWidth, y);
  return y + 14;
}

/**
 * Make sure there's enough vertical room for the next block; otherwise
 * push to a new page. Returns the y position to resume from.
 */
export function ensureRoom(
  doc: typeof PDFDocumentType.prototype,
  requiredHeight: number,
  currentY: number,
): number {
  const bottomLimit = doc.page.height - PAGE_MARGIN - 24;
  if (currentY + requiredHeight > bottomLimit) {
    drawFooter(doc);
    doc.addPage();
    return PAGE_MARGIN;
  }
  return currentY;
}
