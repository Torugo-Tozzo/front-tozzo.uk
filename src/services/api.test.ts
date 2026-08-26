import { describe, it, expect, vi } from 'bun:test'
import api, { getSseToken, normalizeResponseData, serializeRequestData } from './api'

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
})
