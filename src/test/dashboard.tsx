import { screen, waitFor, within } from '@solidjs/testing-library'
import { expect } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/solid-query'
import { Toaster } from 'solid-sonner'
import { Suspense, type JSX } from 'solid-js'

import { ThemeProvider } from '@/components/theme-provider'
import { ConfirmProvider } from '@/contexts/ConfirmContext'
import { I18nProvider } from '@/i18n/solid'
import { renderAt } from './router'

/** Renders dashboard routes at `path` with what a page needs: query client, theme, confirm dialog, toasts and a Suspense boundary. */
export function renderDashboard(path: string, routes: () => JSX.Element) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const result = renderAt(path, routes, (router) => (
    <I18nProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <ConfirmProvider>
            {/* Like the app: a page must not suspend while its data loads. */}
            <Suspense fallback={<p>Suspended</p>}>{router()}</Suspense>
            <Toaster />
          </ConfirmProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </I18nProvider>
  ))
  return { ...result, queryClient }
}

/** Clicks the confirm button of the ConfirmProvider dialog once it is open. */
export async function confirmDialog(user: { click: (element: Element) => Promise<void> }, name: string | RegExp) {
  const dialog = await screen.findByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name }))
}

/**
 * Waits until no dialog is open and the page is accessible again: Kobalte
 * lifts the aria-hidden it put outside a modal one timer and one frame later.
 */
export async function dialogClosed() {
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.body.querySelector(':scope > [aria-hidden="true"]')).toBeNull()
  })
}
