export const MAX_CSV_IMPORT_BYTES = 5 * 1024 * 1024;

const CSV_MIME_TYPES = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
]);

export function maskEmail(email: string | null | undefined): string {
  if (!email) return "Unknown";
  const [local, domain] = email.split("@");
  if (!local || !domain) return "Invalid email";

  const visible = local.length <= 2 ? 1 : 2;
  return `${local.slice(0, visible)}***@${domain}`;
}

export function maskProviderIdentifier(value: string | null | undefined): string {
  if (!value) return "-";
  const trimmed = value.trim();
  if (trimmed.length <= 8) return trimmed;

  const separatorIndex = trimmed.indexOf("_");
  const prefix =
    separatorIndex > 0
      ? trimmed.slice(0, separatorIndex + 1)
      : trimmed.slice(0, Math.min(4, trimmed.length));
  return `${prefix}****${trimmed.slice(-4)}`;
}

export function validateCsvFileMetadata(file: {
  name?: unknown;
  size?: unknown;
  type?: unknown;
} | null | undefined):
  | { ok: true }
  | { ok: false; status: 413 | 415; error: string } {
  if (!file) return { ok: true };

  const name = typeof file.name === "string" ? file.name.trim() : "";
  const type = typeof file.type === "string" ? file.type.trim().toLowerCase() : "";
  const size =
    typeof file.size === "number"
      ? file.size
      : typeof file.size === "string"
      ? Number.parseInt(file.size, 10)
      : Number.NaN;
  const hasCsvExtension = name.toLowerCase().endsWith(".csv");

  if (!Number.isFinite(size) || size < 0) {
    return { ok: false, status: 415, error: "CSV file metadata is invalid." };
  }

  if (size > MAX_CSV_IMPORT_BYTES) {
    return { ok: false, status: 413, error: "CSV import file must be 5 MB or smaller." };
  }

  const mimeAllowed =
    !type ||
    CSV_MIME_TYPES.has(type) ||
    ((type === "text/plain" || type === "application/octet-stream") && hasCsvExtension);

  if (!hasCsvExtension && !mimeAllowed) {
    return { ok: false, status: 415, error: "CSV import requires a .csv file." };
  }

  if (!mimeAllowed) {
    return { ok: false, status: 415, error: "CSV import file type is not supported." };
  }

  return { ok: true };
}
