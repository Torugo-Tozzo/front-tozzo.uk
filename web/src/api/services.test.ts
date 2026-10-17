import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './errors'
import { createService, deleteService, listServices, serviceReferences, updateService } from './services'
import { json, mockApi, noContent } from '@/test/api'

describe('services /v1 boundary', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('serializes cents and nullable fields without legacy names', async () => {
    const api = mockApi(({ method }) => method === 'DELETE' ? noContent() : json(200, { id: 's1' }))
    await createService({ name: 'Repair', referencePriceCents: 1245 })
    await updateService('s1', { description: null, referencePriceCents: null })
    await deleteService('s1')
    expect(api.calls.map(({ method, path, body }) => ({ method, path, body }))).toEqual([
      { method: 'POST', path: '/v1/services', body: { name: 'Repair', referencePriceCents: 1245 } },
      { method: 'PATCH', path: '/v1/services/s1', body: { description: null, referencePriceCents: null } },
      { method: 'DELETE', path: '/v1/services/s1', body: undefined },
    ])
  })
  it('normalizes null pages and preserves cursor and total', async () => {
    const api = mockApi(() => json(200, { items: null, nextCursor: 'c2', total: 11 }))
    expect(await listServices({ search: 'Repair', cursor: 'c1', limit: 10 })).toEqual({ items: [], nextCursor: 'c2', total: 11 })
    expect(Object.fromEntries(api.calls[0].query)).toEqual({ search: 'Repair', cursor: 'c1', limit: '10' })
  })
  it('only accepts valid real references from SERVICE_IN_USE', () => {
    const valid = { id: 'o1', customerName: 'Jo', status: 'QUOTED' }
    const extension = { title: 'Conflict', status: 409, code: 'SERVICE_IN_USE', references: [valid, null, { id: 2 }, { id: 'o2', customerName: 'Sam' }] }
    expect(serviceReferences(new ApiError(409, extension))).toEqual([valid])
    expect(serviceReferences(new ApiError(409, { ...extension, code: 'OTHER' }))).toEqual([])
    expect(serviceReferences(new Error('network'))).toEqual([])
  })
})
