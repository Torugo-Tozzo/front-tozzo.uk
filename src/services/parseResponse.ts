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
 * - { vendas: T[], fechamento: number } (sales-specific)
 */
export function parseListResponse<T>(
  response: AxiosResponse,
  arrayKey?: string
): ParsedListResponse<T> {
  const body = response.data;

  if (arrayKey && body[arrayKey]) {
    return {
      data: body[arrayKey] as T[],
      total: body.total || body.count || parseInt(response.headers['x-total-count'] || '0') || 0,
    };
  }

  if (body.data && Array.isArray(body.data)) {
    return {
      data: body.data as T[],
      total: body.total || body.count || 0,
    };
  }

  if (Array.isArray(body)) {
    const totalHeader = response.headers['x-total-count'];
    return {
      data: body as T[],
      total: totalHeader ? parseInt(totalHeader) : body.length,
    };
  }

  return { data: [], total: 0 };
}
