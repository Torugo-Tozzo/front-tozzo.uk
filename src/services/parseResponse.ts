import type { AxiosResponse } from 'axios';

interface ParsedListResponse<T> {
  data: T[];
  total: number;
}

/**
 * Parses a paginated list response from the API.
 * Handles multiple response formats:
 * - { data: T[], total: number }
 * - T[] with X-Total-Count header
 * - { orders: T[] } / { sales: T[] } (canonical response after wire normalization)
 */
export function parseListResponse<T>(
  response: AxiosResponse,
  arrayKey?: string
): ParsedListResponse<T> {
  const body = response.data;
  const isObjectBody = body !== null && typeof body === 'object' && !Array.isArray(body);

  const canonicalKey = arrayKey ?? (
    isObjectBody && Array.isArray(body.orders) ? 'orders' :
    isObjectBody && Array.isArray(body.sales) ? 'sales' :
    isObjectBody && Array.isArray(body.products) ? 'products' :
    isObjectBody && Array.isArray(body.types) ? 'types' :
    undefined
  )
  if (canonicalKey && isObjectBody && Array.isArray(body[canonicalKey])) {
    return {
      data: body[canonicalKey] as T[],
      total: (body.total ?? body.count ?? parseInt(response.headers['x-total-count'] || '0', 10)) || 0,
    };
  }

  if (isObjectBody && Array.isArray(body.data)) {
    return {
      data: body.data as T[],
      total: body.total ?? body.count ?? 0,
    };
  }

  if (Array.isArray(body)) {
    const totalHeader = response.headers['x-total-count'];
    return {
      data: body as T[],
      total: totalHeader ? parseInt(totalHeader, 10) : body.length,
    };
  }

  return { data: [], total: 0 };
}
