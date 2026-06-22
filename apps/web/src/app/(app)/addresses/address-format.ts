export function formatAddressStartMonth(value: string, locale: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
