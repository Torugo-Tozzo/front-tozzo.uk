import { describe, it, expect } from 'bun:test'
import type { AxiosResponse } from 'axios'
import { parseListResponse } from './parseResponse'

function makeResponse(data: unknown, headers: Record<string, string> = {}): AxiosResponse {
  return { data, headers, status: 200, statusText: 'OK', config: {} as any } as AxiosResponse
}

describe('parseListResponse', () => {
  it('parses { data, total } shape', () => {
    const res = makeResponse({ data: [{ id: 1 }, { id: 2 }], total: 5 })
    expect(parseListResponse(res)).toEqual({ data: [{ id: 1 }, { id: 2 }], total: 5 })
  })

  it('falls back to count when total is missing', () => {
    const res = makeResponse({ data: [{ id: 1 }], count: 3 })
    expect(parseListResponse(res)).toEqual({ data: [{ id: 1 }], total: 3 })
  })

  it('parses a custom canonical arrayKey shape (e.g. sales/closing)', () => {
    const res = makeResponse({ sales: [{ id: 1 }], total: 7 })
    expect(parseListResponse(res, 'sales')).toEqual({ data: [{ id: 1 }], total: 7 })
  })

  it('parses a bare array with X-Total-Count header', () => {
    const res = makeResponse([{ id: 1 }, { id: 2 }, { id: 3 }], { 'x-total-count': '12' })
    expect(parseListResponse(res)).toEqual({ data: [{ id: 1 }, { id: 2 }, { id: 3 }], total: 12 })
  })

  it('parses a bare array without header, using array length as total', () => {
    const res = makeResponse([{ id: 1 }, { id: 2 }])
    expect(parseListResponse(res)).toEqual({ data: [{ id: 1 }, { id: 2 }], total: 2 })
  })

  it('returns empty result for an unrecognized shape', () => {
    const res = makeResponse({ unexpected: true })
    expect(parseListResponse(res)).toEqual({ data: [], total: 0 })
  })
})
