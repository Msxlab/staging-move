export function parseClampedPositiveInt(
  value: string | null | undefined,
  fallback: number,
  max = Number.MAX_SAFE_INTEGER,
): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

export function parsePaginationParams(
  searchParams: URLSearchParams,
  options: {
    pageParam?: string;
    perPageParam?: string;
    defaultPerPage?: number;
    maxPerPage?: number;
  } = {},
) {
  const pageParam = options.pageParam || "page";
  const perPageParam = options.perPageParam || "perPage";
  const defaultPerPage = options.defaultPerPage || 20;
  const maxPerPage = options.maxPerPage || 100;
  const page = parseClampedPositiveInt(searchParams.get(pageParam), 1);
  const perPage = parseClampedPositiveInt(
    searchParams.get(perPageParam),
    defaultPerPage,
    maxPerPage,
  );

  return {
    page,
    perPage,
    skip: (page - 1) * perPage,
  };
}
