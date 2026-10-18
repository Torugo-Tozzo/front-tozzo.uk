import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { bindGoogleCredential, GSI_SCRIPT_URL, loadGoogleIdentity, resetGoogleIdentity, type GoogleAccountsId } from './google-identity'

const fakeGsi = (): GoogleAccountsId => ({ initialize: vi.fn(), renderButton: vi.fn(), prompt: vi.fn() })
const gsiScripts = () => document.querySelectorAll(`script[src="${GSI_SCRIPT_URL}"]`)

describe('loadGoogleIdentity', () => {
  // happy-dom would try to fetch the real script; the tests drive onload/onerror.
  let append: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    resetGoogleIdentity()
    delete window.google
    append = vi.spyOn(document.head, 'appendChild').mockImplementation((node) => node)
  })

  afterEach(() => {
    delete window.google
  })

  test('adds the GSI script once, only when asked, and resolves with google.accounts.id', async () => {
    const first = loadGoogleIdentity()
    const second = loadGoogleIdentity()

    expect(append).toHaveBeenCalledTimes(1)
    const script = append.mock.calls[0][0] as HTMLScriptElement
    expect(script.src).toBe(GSI_SCRIPT_URL)
    expect(script.async).toBe(true)

    const gsi = fakeGsi()
    window.google = { accounts: { id: gsi } }
    script.onload?.(new Event('load'))

    await expect(first).resolves.toBe(gsi)
    await expect(second).resolves.toBe(gsi)
  })

  test('a blocked script rejects, and the next call tries again', async () => {
    const first = loadGoogleIdentity()
    const script = append.mock.calls[0][0] as HTMLScriptElement
    script.onerror?.(new Event('error'))
    await expect(first).rejects.toThrow()

    void loadGoogleIdentity().catch(() => {})
    expect(append).toHaveBeenCalledTimes(2)
  })

  test('uses an already loaded GSI without another script', async () => {
    const gsi = fakeGsi()
    window.google = { accounts: { id: gsi } }

    await expect(loadGoogleIdentity()).resolves.toBe(gsi)
    expect(append).not.toHaveBeenCalled()
    expect(gsiScripts()).toHaveLength(0)
  })
})

describe('bindGoogleCredential', () => {
  beforeEach(() => { resetGoogleIdentity() })

  test('initializes once with the client ID and routes the credential to the last handler', () => {
    const gsi = fakeGsi()
    const first = vi.fn()
    const second = vi.fn()

    bindGoogleCredential(gsi, first)
    bindGoogleCredential(gsi, second)

    expect(gsi.initialize).toHaveBeenCalledTimes(1)
    const config = vi.mocked(gsi.initialize).mock.calls[0][0]
    expect(config.client_id).toMatch(/\.apps\.googleusercontent\.com$/)
    config.callback({ credential: 'id-token' })
    expect(second).toHaveBeenCalledWith('id-token')
    expect(first).not.toHaveBeenCalled()
  })
})
