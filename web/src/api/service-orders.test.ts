import { afterEach, expect, it, vi } from 'vitest'
import { json, mockApi } from '@/test/api'
import { servicesApi, serviceOrderErrorKey } from './service-orders'
import { ApiError } from './errors'
afterEach(() => vi.unstubAllGlobals())
it('serializes cursor filters and integer cents with the current revision', async () => {
  const api = mockApi(() => json(200, {items: [], nextCursor: null, total: 0}))
  await servicesApi.listOrders({stage:'services', open:true, status:'QUOTED', dueBefore:'2026-10-03', cursor:'next', limit:10})
  expect(api.calls[0].query.get('dueBefore')).toBe(new Date('2026-10-03T23:59:59.999').toISOString())
  expect(api.calls[0].query.get('cursor')).toBe('next')
  await servicesApi.replaceQuote('o1','revision',[{description:'Labor',quantity:1,unitPriceCents:1245}])
  expect(api.calls[1]).toMatchObject({method:'PUT',path:'/v1/service-orders/o1/quote',body:{expectedUpdatedAt:'revision',items:[{description:'Labor',quantity:1,unitPriceCents:1245}]}})
})
for (const verb of ['approve','start','complete','cancel','reopen'] as const) it(`sends revision to ${verb}`, async () => {
  const api=mockApi(() => json(200,{id:'o1'}))
  await servicesApi.action('o1',verb,'revision')
  expect(api.calls[0]).toMatchObject({method:'POST',path:`/v1/service-orders/o1/${verb}`,body:{expectedUpdatedAt:'revision'}})
})
it('uses only documented v1 create, patch, supplements and delete contracts',async()=>{
  const api=mockApi(()=>json(200,{id:'o1'}))
  await servicesApi.createOrder({customerName:'Ana',description:'Repair'})
  await servicesApi.updateOrder('o1',{description:'Revised',expectedUpdatedAt:'v1'})
  await servicesApi.replaceSupplements('o1','v2',[{serviceId:'s1',quantity:2,unitPriceCents:2490}])
  await servicesApi.approveSupplements('o1','v3')
  await servicesApi.deleteOrder('o1','v4')
  expect(api.calls.map(call=>[call.method,call.path,call.body])).toEqual([
    ['POST','/v1/service-orders',{customerName:'Ana',description:'Repair'}],
    ['PATCH','/v1/service-orders/o1',{description:'Revised',expectedUpdatedAt:'v1'}],
    ['PUT','/v1/service-orders/o1/supplements',{expectedUpdatedAt:'v2',items:[{serviceId:'s1',quantity:2,unitPriceCents:2490}]}],
    ['POST','/v1/service-orders/o1/supplements/approve',{expectedUpdatedAt:'v3'}],
    ['DELETE','/v1/service-orders/o1',{expectedUpdatedAt:'v4'}],
  ])
})
it('chooses translated errors from problem code without exposing detail',()=>{
  expect(serviceOrderErrorKey(new ApiError(409,{code:'SERVICE_ORDER_CONFLICT',status:409,title:'Conflict',detail:'private'}))).toBe('conflict')
  expect(serviceOrderErrorKey(new ApiError(409,{code:'INVALID_STATUS',status:409,title:'Invalid'}))).toBe('saveError')
})
