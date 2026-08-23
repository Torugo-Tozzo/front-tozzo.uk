import { describe, it, expect, vi, afterEach } from 'bun:test'
import api, { getSseToken } from './api'

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
