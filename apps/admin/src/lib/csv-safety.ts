/**
 * CSV-injection-safe value formatter.
 *
 * Spreadsheet apps (Excel, Google Sheets, LibreOffice) auto-execute any
 * cell that starts with `=`, `+`, `-`, `@`, `\t`, or `\r`. An attacker
 * who can inject one of those characters into a CSV row turns "open the
 * exported file" into "run my formula" — which can be a `WEBSERVICE`
 * exfiltration call or a DDE-style RCE on older Excel.
 *
 * Wrap any field that starts with one of those characters with a
 * leading single quote; quote anything containing `,`, `"`, or newlines.
 */
export function csvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  let str = typeof value === "string" ? value : String(value);
  // Neutralize formula-trigger leading characters.
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  // Quote when needed.
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Build a CSV row from an array of cell values. */
export function csvRow(values: ReadonlyArray<unknown>): string {
  return values.map((v) => csvField(v)).join(",");
}

/** Build a CSV document from a header row + data rows. */
export function buildCsv(
  header: ReadonlyArray<string>,
  rows: ReadonlyArray<ReadonlyArray<unknown>>,
): string {
  const lines: string[] = [];
  lines.push(csvRow(header));
  for (const row of rows) {
    lines.push(csvRow(row));
  }
  // Use CRLF line endings — RFC 4180 and what spreadsheet apps expect.
  return lines.join("\r\n");
}
