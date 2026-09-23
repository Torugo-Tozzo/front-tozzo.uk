import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'bun:test'

import * as AuthContext from '@/contexts/AuthContext'
import * as RealtimeHooks from '@/hooks/useRealtimeEvents'
import { i18n } from '@/i18n/config'
import { I18nProvider } from '@/i18n/provider'
import api from '@/services/api'
import { replaceProperty } from '@/test/replace-property'
import KitchenPage from './KitchenPage'

let restoreGet: (() => void) | undefined
let restoreAuth: (() => void) | undefined
let restoreRealtime: (() => void) | undefined

describe('KitchenPage translations', () => {
  beforeEach(async () => {
    const authSpy = vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: { establishment: { tradeName: 'Bistro' } } } as ReturnType<typeof AuthContext.useAuth>)
    restoreAuth = () => authSpy.mockRestore()
    const realtimeSpy = vi.spyOn(RealtimeHooks, 'useRealtimeEvents').mockImplementation(() => undefined)
    restoreRealtime = () => realtimeSpy.mockRestore()
    restoreGet = replaceProperty(api, 'get', vi.fn().mockResolvedValue({ data: {
      orders: [{
        id: 'order-123', customerName: null, openedAt: '2026-09-23T12:00:00.000Z',
        updatedAt: '2026-09-23T12:00:00.000Z',
        items: [{ id: 'item-1', productId: 'product-1', productName: '', quantity: 2, stage: 'REQUESTED', kitchenReadyAt: null }],
      }],
      totalPages: 1,
    } }) as typeof api.get)
    await act(async () => { await i18n.changeLanguage('en') })
  })

  afterEach(() => { restoreGet?.(); restoreAuth?.(); restoreRealtime?.() })

  test('translates the board and item details when the language changes', async () => {
    render(<I18nProvider><KitchenPage /></I18nProvider>)

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Kitchen — Bistro' })).toBeInTheDocument())
    expect(screen.getByText('Kitchen orders')).toBeInTheDocument()
    expect(screen.getByText('Waiting')).toBeInTheDocument()
    expect(screen.getByText('2× Unavailable product')).toBeInTheDocument()
    expect(screen.getByText('Order order-')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous' })).toBeInTheDocument()
    expect(screen.getByText('Orders on this page · 1/1')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Drag an item to another column with a pointer.')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'View item details' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Order details')
    expect(screen.getByRole('dialog')).toHaveTextContent('Not informed')
    expect(screen.getByRole('dialog')).toHaveTextContent('Placed at')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    const headings = {
      'pt-BR': 'Cozinha — Bistro',
      es: 'Cocina — Bistro',
      fr: 'Cuisine — Bistro',
      zh: '厨房 — Bistro',
      hi: 'रसोई — Bistro',
    } as const
    for (const [locale, heading] of Object.entries(headings)) {
      await act(async () => { await i18n.changeLanguage(locale) })
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    }
  })

  test('translates the initial loading and load error states', async () => {
    restoreGet?.()
    restoreGet = replaceProperty(api, 'get', vi.fn().mockRejectedValue(new Error('offline')) as typeof api.get)

    render(<I18nProvider><KitchenPage /></I18nProvider>)

    expect(screen.getByRole('status')).toHaveTextContent('Loading kitchen…')
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not load the kitchen.'))
  })
})
