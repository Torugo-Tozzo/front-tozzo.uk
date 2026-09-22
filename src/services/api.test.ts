import { describe, it, expect, vi } from 'bun:test'
import { authClient } from '@/lib/authClient'
import { replaceProperty } from '@/test/replace-property'
import api, { getErrorCode, getSseToken, normalizeResponseData, serializeRequestData } from './api'

describe('getErrorCode', () => {
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
})
