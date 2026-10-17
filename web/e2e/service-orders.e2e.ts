import { expect, test, type Page } from '@playwright/test'
import type { components } from '../src/api/schema'
import { mockV1Api } from './visual/support/mock-v1'

type Order = components['schemas']['ServiceOrder']
type Line = components['schemas']['ServiceOrderLineBody']
async function backend(page: Page, conflict = false) {
  await mockV1Api(page, {role:'OWNER'})
  await page.addInitScript(() => localStorage.setItem('tozzo.locale','en'))
  let order: Order = {id:'service-e2e',customerName:'Ana',description:'Repair',status:'OPEN',createdAt:'2026-10-01T12:00:00Z',updatedAt:'2026-10-01T12:00:00Z',dueAt:null,responsibleId:null,completedAt:null,items:[],acceptedQuote:null,pendingItems:[],sale:null!,events:[],totalCents:0}
  let exists=false,revision=0
  const calls: {method:string;path:string;body: any}[]=[]
  const stamp=()=>{order={...order,updatedAt:`2026-10-01T12:00:${String(++revision).padStart(2,'0')}Z`}}
  const lines=(items:Line[])=>items.map((item,index)=>({id:'line-'+index,isSupplement:false,kind:item.productId?'PRODUCT' as const:'SERVICE' as const,productId:item.productId??null,serviceId:item.serviceId??null,description:item.description??'Labor',details:item.details??null,quantity:item.quantity,unitPriceCents:item.unitPriceCents??0}))
  await page.route(url=>url.hostname==='api.visual.test' && url.pathname.startsWith('/v1/service-orders'),async route=>{
    const request=route.request(),path=new URL(request.url()).pathname,method=request.method()
    if(method==='OPTIONS') return route.fallback()
    const body=request.postDataJSON()??{}
    if(method!=='GET') calls.push({method,path,body})
    const respond=(status:number,value:unknown)=>route.fulfill({status,contentType:status>=400?'application/problem+json':'application/json',headers:{'Access-Control-Allow-Origin':request.headers().origin??'*','Access-Control-Allow-Credentials':'true'},body:JSON.stringify(value)})
    if(path==='/v1/service-orders'){
      if(method==='GET') return respond(200,{items:exists?[order]:[],nextCursor:null,total:exists?1:0})
      order={...order,...body};exists=true;return respond(201,order)
    }
    if(method==='GET') return respond(200,order)
    if(body.expectedUpdatedAt!==order.updatedAt || (conflict && method==='PATCH')) return respond(409,{status:409,code:'SERVICE_ORDER_CONFLICT'})
    if(method==='PATCH') order={...order,...body}
    if(method==='DELETE'){exists=false;return respond(200,{deleted:true})}
    if(path.endsWith('/quote')) order={...order,items:lines(body.items),status:'QUOTED'}
    else if(path.endsWith('/supplements/approve')) order={...order,items:[...(order.items??[]),...lines(order.pendingItems??[]).map(item=>({...item,isSupplement:true}))],pendingItems:[]}
    else if(path.endsWith('/supplements')) order={...order,pendingItems:lines(body.items)}
    else if(path.endsWith('/approve')) order={...order,status:'APPROVED',acceptedQuote:order.items}
    else if(path.endsWith('/start')) order={...order,status:'IN_PROGRESS'}
    else if(path.endsWith('/cancel')) order={...order,status:'CANCELLED'}
    else if(path.endsWith('/reopen')) order={...order,status:order.acceptedQuote?'APPROVED':'OPEN'}
    else if(path.endsWith('/complete')) order={...order,status:'COMPLETED',sale:{id:'sale-service-e2e',isCancelled:false,totalCents:1245}}
    stamp()
    return respond(200,path.endsWith('/complete')?{order,sale:order.sale,retried:false}:order)
  })
  return {calls}
}

test('quote and execute with approved supplements, completion and reopening',async({page})=>{
  const {calls}=await backend(page)
  await page.goto('/dashboard/estimates')
  await page.getByRole('button',{name:'Create estimate'}).click()
  await page.getByLabel('Customer name').fill('Ana')
  await page.getByLabel('Work description').fill('Repair')
  await page.getByRole('button',{name:'Create estimate'}).click()
  await expect(page).toHaveURL(/estimates\/service-e2e/)
  await page.getByRole('button',{name:'Add service',exact:true}).click()
  await page.getByRole('button',{name:'Add one-off labor'}).click()
  await page.getByLabel('Item name').fill('Labor')
  await page.getByLabel('Unit price').fill('1245')
  await page.getByRole('button',{name:'Save estimate'}).click()
  await expect(page.getByRole('button',{name:'Approve estimate'})).toBeEnabled()
  expect(calls.find(call=>call.path.endsWith('/quote'))?.body.items).toEqual([{description:'Labor',details:null,quantity:1,unitPriceCents:1245}])
  await page.getByRole('button',{name:'Approve estimate'}).click()
  await expect(page).toHaveURL(/service-orders\/service-e2e/)
  await page.getByRole('button',{name:'Start work'}).click()
  await page.getByRole('button',{name:'Edit additional work'}).click()
  await page.getByRole('button',{name:'Add service',exact:true}).click()
  await page.getByRole('button',{name:'Add one-off labor'}).click()
  await page.getByLabel('Item name').fill('Extra labor')
  await page.getByRole('button',{name:'Request client approval'}).click()
  await expect(page.getByRole('button',{name:'Close order and record sale'})).toBeDisabled()
  await page.getByRole('button',{name:'Confirm client approval'}).click()
  await page.getByRole('button',{name:'Close order and record sale'}).click()
  await page.getByRole('dialog').getByRole('button',{name:'Close order and record sale'}).click()
  await expect(page.getByText('Linked sale: #sale-service-e2e')).toBeVisible()
  await page.getByRole('button',{name:'Reopen order'}).click()
  await expect(page.getByRole('button',{name:'Start work'})).toBeVisible()
  expect(calls.filter(call=>call.path.endsWith('/complete'))).toHaveLength(1)
  expect(calls.filter(call=>call.method!=='GET'&&call.path!=='/v1/service-orders').every(call=>typeof call.body.expectedUpdatedAt==='string')).toBe(true)
})

test('detail conflicts preserve edits; cancellation, reopening and deletion remain usable',async({page})=>{
  const {calls}=await backend(page,true)
  await page.goto('/dashboard/estimates')
  await page.getByRole('button',{name:'Create estimate'}).click()
  await page.getByLabel('Customer name').fill('Ana')
  await page.getByLabel('Work description').fill('Repair')
  await page.getByRole('button',{name:'Create estimate'}).click()
  await expect(page).toHaveURL(/estimates\/service-e2e/)
  await page.getByLabel('Customer name').fill('Edited Ana')
  await page.getByRole('button',{name:'Save details'}).click()
  await expect(page.getByRole('alert')).toContainText('This order changed elsewhere')
  await expect(page.getByLabel('Customer name')).toHaveValue('Edited Ana')
  await page.getByRole('button',{name:'Cancel editing'}).click()
  await page.getByRole('button',{name:'Cancel order'}).click()
  await page.getByRole('button',{name:'Reopen order'}).click()
  await page.goto('/dashboard/estimates')
  await page.getByRole('button',{name:'Delete quote Ana'}).click()
  await page.getByRole('dialog').getByRole('button',{name:'Delete quote'}).click()
  await expect(page.getByText('No estimates yet.')).toBeVisible()
  expect(calls.some(call=>call.method==='DELETE')).toBe(true)
})
