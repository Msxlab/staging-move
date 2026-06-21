function sanitizeAttachmentFileName(value: string, fallback: string): string {
  const base = (value || fallback).split(/[\\/]/).pop() || fallback;
  const safe = base
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/["\\/:*?<>|\r\n\t]+/g, "-")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 180);
  return safe || fallback;
}

function encodeRfc5987Value(value: string): string {
  return encodeURIComponent(value).replace(/['()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export function contentDispositionAttachment(
  fileName: string,
  fallback = "download",
): string {
  const safeFileName = sanitizeAttachmentFileName(fileName, fallback);
  return `attachment; filename="${safeFileName}"; filename*=UTF-8''${encodeRfc5987Value(safeFileName)}`;
}
