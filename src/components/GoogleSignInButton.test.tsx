import { render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { i18n } from '@/i18n/config'

describe('GoogleSignInButton', () => {
  beforeEach(async () => {
    vi.resetModules()
    await i18n.changeLanguage('en')
  })

  afterEach(() => {
    vi.doUnmock('@/lib/google-identity')
    delete window.google
  })

  test('without a client ID (VITE_GOOGLE_CLIENT_ID empty) nothing renders and GSI is not loaded', async () => {
    const loadGoogleIdentity = vi.fn()
    vi.doMock('@/lib/google-identity', async (importOriginal) => ({
      ...(await importOriginal<typeof import('@/lib/google-identity')>()),
      GOOGLE_CLIENT_ID: '',
      loadGoogleIdentity,
    }))
    const { GoogleSignInButton } = await import('./GoogleSignInButton')
    // After resetModules, the provider must come from the same module graph.
    const { ThemeProvider } = await import('@/components/theme-provider')

    render(() => <ThemeProvider><GoogleSignInButton onCredential={() => {}} /></ThemeProvider>)

    expect(screen.queryByRole('button')).toBeNull()
    expect(loadGoogleIdentity).not.toHaveBeenCalled()
  })

  test('swaps the stand-in for the button GSI draws, in the page language and theme', async () => {
    const renderButton = vi.fn((parent: HTMLElement) => {
      const drawn = document.createElement('div')
      drawn.textContent = 'drawn by GSI'
      parent.appendChild(drawn)
    })
    window.google = { accounts: { id: { initialize: vi.fn(), renderButton, prompt: vi.fn() } } }
    const { GoogleSignInButton } = await import('./GoogleSignInButton')
    const { resetGoogleIdentity } = await import('@/lib/google-identity')
    const { ThemeProvider } = await import('@/components/theme-provider')
    resetGoogleIdentity()

    render(() => <ThemeProvider defaultTheme="light"><GoogleSignInButton onCredential={() => {}} /></ThemeProvider>)

    expect(await screen.findByText('drawn by GSI')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Sign in with Google' })).toBeNull()
    expect(renderButton).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({
      theme: 'outline', size: 'large', text: 'signin_with', locale: 'en',
    }))
  })
})
