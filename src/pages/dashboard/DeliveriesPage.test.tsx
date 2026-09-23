import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'bun:test'
import * as AuthContext from '@/contexts/AuthContext'
import * as RealtimeHooks from '@/hooks/useRealtimeEvents'
import { ConfirmProvider } from '@/contexts/ConfirmContext'
import { I18nProvider } from '@/i18n/provider'
import { i18n } from '@/i18n/config'
import api from '@/services/api'
import { replaceProperty } from '@/test/replace-property'
import DeliveriesPage from './DeliveriesPage'

const restores: (() => void)[] = []
afterEach(() => { while (restores.length) restores.pop()?.() })

test('assigns a fixed driver and starts only a ready order', async () => {
  await act(async () => { await i18n.changeLanguage('pt-BR') })
  const auth = vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: { role: 'OWNER', establishment: { tradeName: 'Bistro' } } } as ReturnType<typeof AuthContext.useAuth>)
  const realtime = vi.spyOn(RealtimeHooks, 'useRealtimeEvents').mockImplementation(() => undefined)
  restores.push(() => auth.mockRestore(), () => realtime.mockRestore())
  const get = replaceProperty(api, 'get', vi.fn().mockResolvedValue({ data: { orders: [{ id: 'order-1', customerName: 'Ana', address: 'Rua A', total: 20, openedAt: '2026-09-23T12:00:00.000Z', updatedAt: '2026-09-23T12:00:00.000Z', stage: 'WAITING', driverId: null, driverName: null, items: [{ id: 'item-1', name: 'Burger', quantity: 1, status: 'READY' }] }], drivers: [{ id: 'driver-1', name: 'João', phone: '123', available: true }], totalPages: 1 } }) as typeof api.get)
  const patch = replaceProperty(api, 'patch', vi.fn().mockResolvedValue({ data: {} }) as typeof api.patch)
  restores.push(get, patch)
  render(<I18nProvider><ConfirmProvider><DeliveriesPage /></ConfirmProvider></I18nProvider>)
  await waitFor(() => expect(screen.getByText('Ana')).toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: /atribuir/i }))
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).queryByRole('combobox', { name: /entregador fixo/i })).not.toBeInTheDocument()
  fireEvent.click(within(dialog).getByRole('button', { name: /João.*Disponível/i }))
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /salvar entregador/i })) })
  await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/entregas/pedidos/order-1', expect.objectContaining({ action: 'ASSIGN', driverId: 'driver-1' })))
})

test('shows busy drivers as disabled in the assignment dialog', async () => {
  await act(async () => { await i18n.changeLanguage('pt-BR') })
  const auth = vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: { role: 'OWNER', establishment: { tradeName: 'Bistro' } } } as ReturnType<typeof AuthContext.useAuth>)
  const realtime = vi.spyOn(RealtimeHooks, 'useRealtimeEvents').mockImplementation(() => undefined)
  restores.push(() => auth.mockRestore(), () => realtime.mockRestore())
  restores.push(replaceProperty(api, 'get', vi.fn().mockResolvedValue({ data: { orders: [{ id: 'order-1', customerName: 'Ana', address: 'Rua A', total: 20, openedAt: '2026-09-23T12:00:00.000Z', updatedAt: '2026-09-23T12:00:00.000Z', stage: 'WAITING', driverId: null, driverName: null, items: [] }], drivers: [{ id: 'driver-1', name: 'João', phone: '123', available: false }], totalPages: 1 } }) as typeof api.get))
  render(<I18nProvider><ConfirmProvider><DeliveriesPage /></ConfirmProvider></I18nProvider>)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Atribuir entregador' })).toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: 'Atribuir entregador' }))
  expect(within(screen.getByRole('dialog')).getByRole('button', { name: /João.*Ocupado/i })).toBeDisabled()
})

test('keeps large orders compact and opens all items in the existing order modal', async () => {
  await act(async () => { await i18n.changeLanguage('pt-BR') })
  const auth = vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: { role: 'OWNER', establishment: { tradeName: 'Bistro' } } } as ReturnType<typeof AuthContext.useAuth>)
  const realtime = vi.spyOn(RealtimeHooks, 'useRealtimeEvents').mockImplementation(() => undefined)
  restores.push(() => auth.mockRestore(), () => realtime.mockRestore())
  const items = Array.from({ length: 10 }, (_, index) => ({ id: `item-${index + 1}`, productId: `product-${index + 1}`, name: `Item ${index + 1}`, quantity: 1, unitPriceAtOrder: 2, status: 'READY' }))
  restores.push(replaceProperty(api, 'get', vi.fn().mockResolvedValue({ data: { orders: [{ id: 'order-1', customerName: 'Ana', address: 'Rua A', total: 20, openedAt: '2026-09-23T12:00:00.000Z', updatedAt: '2026-09-23T12:00:00.000Z', stage: 'WAITING', driverId: null, driverName: null, items }], drivers: [], totalPages: 1 } }) as typeof api.get))
  render(<I18nProvider><ConfirmProvider><DeliveriesPage /></ConfirmProvider></I18nProvider>)
  await waitFor(() => expect(screen.getByText(/Item 3/)).toBeInTheDocument())
  expect(screen.queryByText(/Item 4/)).not.toBeInTheDocument()
  expect(screen.getByText('…')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Ver pedido' }))
  const dialog = screen.getByRole('dialog', { name: 'Detalhes do pedido' })
  expect(within(dialog).getByText('Item 10')).toBeInTheDocument()
  expect(within(dialog).getByText('Rua A')).toBeInTheDocument()
})

test('starting delivery does not close the order; finishing explicitly closes it with payment', async () => {
  await act(async () => { await i18n.changeLanguage('pt-BR') })
  const auth = vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: { role: 'OWNER', establishment: { tradeName: 'Bistro' } } } as ReturnType<typeof AuthContext.useAuth>)
  const realtime = vi.spyOn(RealtimeHooks, 'useRealtimeEvents').mockImplementation(() => undefined)
  restores.push(() => auth.mockRestore(), () => realtime.mockRestore())
  let stage = 'WAITING'
  const order = { id: 'order-1', customerName: 'Ana', address: 'Rua A', total: 20, openedAt: '2026-09-23T12:00:00.000Z', updatedAt: '2026-09-23T12:00:00.000Z', driverId: 'driver-1', driverName: 'João', items: [{ id: 'item-1', name: 'Burger', quantity: 1, status: 'READY' }] }
  restores.push(replaceProperty(api, 'get', vi.fn().mockImplementation(async () => ({ data: { orders: [{ ...order, stage }], drivers: [], totalPages: 1 } })) as typeof api.get))
  restores.push(replaceProperty(api, 'patch', vi.fn().mockImplementation(async () => { stage = 'DELIVERING'; return { data: {} } }) as typeof api.patch))
  restores.push(replaceProperty(api, 'post', vi.fn().mockResolvedValue({ data: {} }) as typeof api.post))
  render(<I18nProvider><ConfirmProvider><DeliveriesPage /></ConfirmProvider></I18nProvider>)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Saiu para entrega' })).toBeEnabled())
  expect(screen.getByRole('button', { name: 'Editar entregador' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Atribuir entregador' })).not.toBeInTheDocument()
  expect(screen.getByText('Entregadores')).toBeInTheDocument()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Saiu para entrega' })) })
  await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/entregas/pedidos/order-1', expect.objectContaining({ action: 'START' })))
  expect(api.post).not.toHaveBeenCalled()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Finalizar entrega' })).toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: 'Finalizar entrega' }))
  fireEvent.change(screen.getByRole('combobox', { name: 'Método de pagamento' }), { target: { value: 'PIX' } })
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Fechar pedido e gerar venda' })) })
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/pedidos/order-1/status', { isOpen: false, paymentMethod: 'PIX' }))
})

test('registers a temporary third-party driver on the order', async () => {
  await act(async () => { await i18n.changeLanguage('pt-BR') })
  const auth = vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: { role: 'OWNER', establishment: { tradeName: 'Bistro' } } } as ReturnType<typeof AuthContext.useAuth>)
  const realtime = vi.spyOn(RealtimeHooks, 'useRealtimeEvents').mockImplementation(() => undefined)
  restores.push(() => auth.mockRestore(), () => realtime.mockRestore())
  restores.push(replaceProperty(api, 'get', vi.fn().mockResolvedValue({ data: { orders: [{ id: 'order-1', customerName: 'Ana', address: 'Rua A', total: 20, openedAt: '2026-09-23T12:00:00.000Z', updatedAt: '2026-09-23T12:00:00.000Z', stage: 'WAITING', driverId: null, driverName: null, items: [{ id: 'item-1', name: 'Burger', quantity: 1, status: 'READY' }] }], drivers: [], totalPages: 1 } }) as typeof api.get))
  restores.push(replaceProperty(api, 'patch', vi.fn().mockResolvedValue({ data: {} }) as typeof api.patch))
  render(<I18nProvider><ConfirmProvider><DeliveriesPage /></ConfirmProvider></I18nProvider>)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Atribuir entregador' })).toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: 'Atribuir entregador' }))
  fireEvent.click(screen.getByRole('radio', { name: 'Terceirizado' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Nome do entregador' }), { target: { value: 'João iFood' } })
  fireEvent.change(screen.getByRole('textbox', { name: 'Contato do entregador' }), { target: { value: '999' } })
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Salvar entregador' })) })
  await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/entregas/pedidos/order-1', expect.objectContaining({ action: 'ASSIGN', externalDriverName: 'João iFood', externalDriverPhone: '999' })))
})
