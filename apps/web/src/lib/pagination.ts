/**
 * Shared pagination utilities for API routes.
 * Provides consistent pagination parameter parsing and response formatting.
 */

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Parse pagination parameters from URL search params.
 * Returns safe, clamped values. If no params provided, returns defaults
 * that fetch all results (backward-compatible).
 */
export function parsePaginationParams(
  searchParams: URLSearchParams,
  defaults?: { page?: number; limit?: number }
): PaginationParams {
  const rawPage = searchParams.get("page");
  const rawLimit = searchParams.get("limit");

  // If no pagination params provided, return large limit for backward compatibility
  if (!rawPage && !rawLimit) {
    return {
      page: defaults?.page ?? DEFAULT_PAGE,
      limit: defaults?.limit ?? DEFAULT_LIMIT,
      skip: 0,
    };
  }

  const page = Math.max(1, parseInt(rawPage || String(defaults?.page ?? DEFAULT_PAGE), 10) || DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(rawLimit || String(defaults?.limit ?? DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

/**
 * Build a paginated response object.
 */
export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginatedResult<T> {
  return {
    data,
    total,
    page: params.page,
    limit: params.limit,
    hasMore: params.skip + data.length < total,
  };
}
