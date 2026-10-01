import { describe, it, expect, vi } from 'bun:test'
import { authClient } from '@/lib/authClient'
import { replaceProperty } from '@/test/replace-property'
import type { ServiceOrder } from '@/domain/services'
import api, { getErrorCode, getSseToken, normalizeResponseData, serializeRequestData, servicesApi } from './api'

describe('getErrorCode', () => {
  it('normalizes raw order action responses and keeps close sale envelopes', async () => {
    const originalAdapter = api.defaults.adapter
    const order: ServiceOrder = { id: 'o1', establishmentId: 'e1', customerName: 'Ana', description: 'Repair', status: 'EM_EXECUCAO', updatedAt: 'new-version', items: [], dueAt: null, responsibleId: null, completedAt: null }
    api.defaults.adapter = (async (config: any) => ({data: config.url.endsWith('/fechar') ? {order, sale:{id:'sale1',total:12.45},retried:false} : order, status:200, statusText:'OK',headers:{},config})) as typeof api.defaults.adapter
    try {
      expect(await servicesApi.action('o1','iniciar','version')).toEqual({order})
      expect(await servicesApi.action('o1','fechar','version')).toEqual({order,sale:{id:'sale1',total:12.45},retried:false})
    } finally { api.defaults.adapter = originalAdapter }
  })
  it('serializes supplemental labor and optimistic quote deletion over HTTP', async () => {
    const originalAdapter = api.defaults.adapter
    const requests: Array<{method?: string; url?: string; data?: string}> = []
    api.defaults.adapter = (async (config: any) => { requests.push(config); return {data: {}, status: 200, statusText: 'OK', headers: {}, config} }) as typeof api.defaults.adapter
    try {
      await servicesApi.replaceSupplements('o1', 'version', [{description:'Labor',details:'Long scope',quantity:1,unitPrice:12.45}])
      await servicesApi.approveSupplements('o1', 'version')
      await servicesApi.deleteOrder('o1', 'version')
      await servicesApi.delete('s1')
      expect(requests.map(({method,url,data}) => ({method,url,body:data ? JSON.parse(data) : undefined}))).toEqual([
        {method:'put',url:'/ordens-servico/o1/adicionais',body:{expectedUpdatedAt:'version',items:[{description:'Labor',details:'Long scope',quantity:1,unitPrice:12.45}]}},
        {method:'post',url:'/ordens-servico/o1/aprovar-adicionais',body:{expectedUpdatedAt:'version'}},
        {method:'delete',url:'/ordens-servico/o1',body:{expectedUpdatedAt:'version'}},
        {method:'delete',url:'/servicos/s1',body:undefined},
      ])
    } finally { api.defaults.adapter = originalAdapter }
  })
  it('reads native auth-js codes while retaining legacy API codes', () => {
    expect(getErrorCode({ code: 'invalid_credentials' })).toBe('invalid_credentials')
    expect(getErrorCode({ response: { data: { code: 'AUTH_INVALID_CREDENTIALS' } } })).toBe('AUTH_INVALID_CREDENTIALS')
  })
})

describe('401 handling', () => {
  it('does not sign out when the caller expects a 401 (profile bootstrap before complete-signup)', async () => {
    // Regressão: no 1o login com Google, /usuarios/me dava 401 e o interceptor
    // deslogava antes do complete-signup — só funcionava na 2a tentativa.
    const originalAdapter = api.defaults.adapter
    const signOutMock = vi.fn().mockResolvedValue({ error: null })
    const restoreSignOut = replaceProperty(authClient, 'signOut', signOutMock as typeof authClient.signOut)
    api.defaults.adapter = (async (config: any) => {
      throw Object.assign(new Error('Unauthorized'), { config, response: { status: 401, data: {}, config } })
    }) as typeof api.defaults.adapter

    try {
      await expect(api.get('/usuarios/me', { skipAuthRedirect: true })).rejects.toMatchObject({ response: { status: 401 } })
      expect(signOutMock).not.toHaveBeenCalled()
    } finally {
      api.defaults.adapter = originalAdapter
      restoreSignOut()
    }
  })
})

describe('getSseToken', () => {
  it('faz POST /auth/sse-token e retorna o token da resposta', async () => {
    const originalAdapter = api.defaults.adapter
    const adapter = vi.fn().mockResolvedValue({
      data: { token: 'token-curto' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as any)
    api.defaults.adapter = adapter as typeof api.defaults.adapter

    try {
      const token = await getSseToken()

      expect(adapter).toHaveBeenCalledWith(expect.objectContaining({ method: 'post', url: '/auth/sse-token' }))
      expect(token).toBe('token-curto')
    } finally {
      api.defaults.adapter = originalAdapter
    }
  })
})

describe('wire normalization at the service boundary', () => {
  it('serializes canonical authentication fields for the legacy endpoint', () => {
    expect(serializeRequestData('/auth/register', {
      name: 'Ana',
      password: 'secret',
      establishmentName: 'Bar da Ana',
    })).toEqual({
      nome: 'Ana',
      senha: 'secret',
      nomeFantasia: 'Bar da Ana',
    })
  })

  it('normalizes a legacy order response before the page consumes it', () => {
    expect(normalizeResponseData('/pedidos', {
      pedidos: [{ id: 1, cliente: 'Mesa 1', status: 'ABERTO' }],
    })).toEqual({
      orders: [{ id: 1, customerName: 'Mesa 1', status: 'OPEN' }],
    })
  })

  it('preserves the new order openness and item status fields', () => {
    expect(normalizeResponseData('/pedidos', {
      orders: [{
        id: 1,
        isOpen: true,
        items: [{ id: 9, productId: 3, status: 'DELIVERED' }],
      }],
    })).toEqual({
      orders: [{
        id: 1,
        isOpen: true,
        items: [{ id: 9, productId: 3, status: 'DELIVERED' }],
      }],
    })
  })

  it('serializes the canonical order close and item status requests unchanged', () => {
    expect(serializeRequestData('/pedidos/1/status', { isOpen: false })).toEqual({ isOpen: false })
    expect(serializeRequestData('/pedidos/1/items/9', { status: 'IN_PREPARATION' })).toEqual({ status: 'IN_PREPARATION' })
  })

  it('keeps calendar shift members in the API contract', () => {
    const body = { members: [{ employeeId: 'ana' }] }
    expect(serializeRequestData('/calendar/shifts', body)).toEqual(body)
    expect(normalizeResponseData('/calendar', { shifts: [{ assignments: [{ employeeId: 'ana' }] }] })).toEqual({ shifts: [{ assignments: [{ employeeId: 'ana' }] }] })
  })

  it('keeps service and estimate endpoints in their native English contract', () => {
    const service = { name: 'Repair', referencePrice: 25 }
    expect(serializeRequestData('/servicos', service)).toEqual(service)
    const order = { customerName: 'Ana', description: 'Repair', items: [{ serviceOfferingId: 's1', quantity: 1, unitPrice: 25 }] }
    expect(serializeRequestData('/ordens-servico', order)).toEqual(order)
    expect(normalizeResponseData('/ordens-servico/1', { customerName: 'Ana', status: 'ORCADA' })).toEqual({ customerName: 'Ana', status: 'ORCADA' })
  })

  it('keeps service lines in a mixed sale canonical while retaining legacy product serialization', () => {
    expect(serializeRequestData('/vendas', { customerName: 'Ana', items: [{ productId: 'p1', quantity: 1 }] })).toEqual({
      cliente: 'Ana', itens: [{ produtoId: 'p1', quantidade: 1 }],
    })
    const request = { customerName: 'Ana', items: [
      { productId: 'p1', quantity: 1 },
      { serviceId: 's1', quantity: 2, unitPriceAtSale: 30 },
    ] }
    expect(serializeRequestData('/vendas', request)).toEqual(request)
    expect(normalizeResponseData('/vendas', { itens: [{ produtoId: 'p1', quantidade: 1, precoHistorico: 10 }], serviceItems: [{ serviceOfferingId: 's1', description: 'Repair', quantity: 2, unitPriceAtSale: 30 }] })).toEqual({
      items: [{ productId: 'p1', quantity: 1, unitPriceAtSale: 10 }],
      serviceItems: [{ serviceOfferingId: 's1', description: 'Repair', quantity: 2, unitPriceAtSale: 30 }],
    })
    expect(request).toEqual({ customerName: 'Ana', items: [
      { productId: 'p1', quantity: 1 },
      { serviceId: 's1', quantity: 2, unitPriceAtSale: 30 },
    ] })
  })
})
