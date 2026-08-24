import { describe, it, expect, vi, afterEach } from 'bun:test'
import api, { getSseToken, normalizeResponseData, serializeRequestData } from './api'

describe('getSseToken', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('faz POST /auth/sse-token e retorna o token da resposta', async () => {
    vi.spyOn(api, 'post').mockResolvedValue({ data: { token: 'token-curto' } } as any)

    const token = await getSseToken()

    expect(api.post).toHaveBeenCalledWith('/auth/sse-token')
    expect(token).toBe('token-curto')
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
