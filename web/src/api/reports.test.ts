import { afterEach, expect, it, vi } from 'vitest'
import { json, mockApi, problem } from '@/test/api'
import { getTopProducts, listProductReport, getSalesByHour, createReportExport, getReportExport } from './reports'

afterEach(() => vi.unstubAllGlobals())
it('serializes report filters, cents, cursors, dates and export formats with the v1 contract', async () => {
  const mock = mockApi(({ path }) => json(path.endsWith('/exports') ? 202 : 200, path.endsWith('/products') ? { items: null, nextCursor: 'next', total: 21 } : { id: 'job', status: 'pending' }))
  const filters = { from: '2026-10-01T03:00:00Z', to: '2026-10-02T02:59:59Z', productTypeId: 't1' }
  await getTopProducts(filters)
  expect(await listProductReport({ ...filters, cursor: 'cursor', limit: 10 })).toEqual({ items: [], nextCursor: 'next', total: 21 })
  await getSalesByHour({ date: '2026-10-01', tzOffsetMinutes: '-180' })
  await createReportExport({ ...filters, format: 'xlsx', locale: 'pt-BR', tzOffsetMinutes: -180 })
  await getReportExport('job')
  expect(mock.calls.map(c => [c.method, c.path])).toEqual([
    ['GET', '/v1/reports/top-products'], ['GET', '/v1/reports/products'], ['GET', '/v1/reports/sales-by-hour'], ['POST', '/v1/reports/exports'], ['GET', '/v1/reports/exports/job'],
  ])
  expect(Object.fromEntries(mock.calls[1].query)).toEqual({ ...filters, cursor: 'cursor', limit: '10' })
  expect(Object.fromEntries(mock.calls[2].query)).toEqual({ date: '2026-10-01', tzOffsetMinutes: '-180' })
  expect(mock.calls[3].body).toEqual({ ...filters, format: 'xlsx', locale: 'pt-BR', tzOffsetMinutes: -180 })
})
it('preserves the API problem code', async () => {
  mockApi(() => problem(403, 'REPORT_QUOTA_EXCEEDED'))
  await expect(createReportExport({ format: 'pdf' })).rejects.toMatchObject({ code: 'REPORT_QUOTA_EXCEEDED' })
})
