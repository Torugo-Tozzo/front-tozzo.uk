import { Route } from '@solidjs/router'
import { screen, waitFor } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { toast } from 'solid-sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n/config'
import { json, mockApi, noContent, problem } from '@/test/api'
import { resetAuthMocks, setMockUser } from '@/test/auth-mock'
import { confirmDialog, renderDashboard } from '@/test/dashboard'
import DevicesPage from './DevicesPage'

vi.mock('@/contexts/AuthContext', () => import('@/test/auth-mock'))

const device = (overrides: Record<string, unknown> = {}) => ({
  id: 'dev-1', info: { platform: 'android' }, lastUserName: 'Ana', lastUserId: 'usr-1', lastSeen: null, createdAt: '2026-01-01T00:00:00Z', ...overrides,
})

const renderPage = () => renderDashboard('/dashboard/devices', () => <>
  <Route path="/dashboard/devices" component={DevicesPage} />
  <Route path="/dashboard" component={() => <div>Dashboard home</div>} />
</>)

describe('DevicesPage', () => {
  beforeEach(async () => {
    resetAuthMocks()
    await i18n.changeLanguage('en')
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('lists devices returned by the API, without the raw id column', async () => {
    setMockUser({ role: 'OWNER' })
    mockApi(({ path }) => (path === '/v1/devices' ? json(200, [device()]) : undefined))
    renderPage()
    expect(await screen.findByText('Android')).toBeInTheDocument()
    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(screen.queryByText('dev-1')).toBeNull()
  })

  it('shows the fallback label when platform or user is unknown', async () => {
    setMockUser({ role: 'OWNER' })
    mockApi(({ path }) => (path === '/v1/devices' ? json(200, [device({ info: {}, lastUserName: null })]) : undefined))
    renderPage()
    await waitFor(() => expect(screen.getAllByText('Unknown').length).toBeGreaterThan(0))
    expect(screen.getByText('Never synced')).toBeInTheDocument()
  })

  it('shows the empty state', async () => {
    setMockUser({ role: 'OWNER' })
    mockApi(({ path }) => (path === '/v1/devices' ? json(200, null) : undefined))
    renderPage()
    expect(await screen.findByText('No devices registered yet.')).toBeInTheDocument()
  })

  it('only owners see the remove button', async () => {
    setMockUser({ role: 'MANAGER' })
    mockApi(({ path }) => (path === '/v1/devices' ? json(200, [device()]) : undefined))
    renderPage()
    expect(await screen.findByText('Android')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /remove/i })).toBeNull()
  })

  it('owners can remove a device after confirming', async () => {
    setMockUser({ role: 'OWNER' })
    let devices = [device()]
    const api = mockApi(({ method, path }) => {
      if (path === '/v1/devices') return json(200, devices)
      if (method === 'DELETE' && path === '/v1/devices/dev-1') { devices = []; return noContent() }
      return undefined
    })
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: /remove/i }))
    await confirmDialog(user, 'Remove')
    await waitFor(() => expect(api.calls.some((call) => call.method === 'DELETE' && call.path === '/v1/devices/dev-1')).toBe(true))
    await waitFor(() => expect(screen.queryByText('Android')).toBeNull())
  })

  it('reports a failed removal and keeps the device', async () => {
    setMockUser({ role: 'OWNER' })
    mockApi(({ method, path }) => {
      if (path === '/v1/devices' && method === 'GET') return json(200, [device()])
      if (method === 'DELETE') return problem(404, 'DEVICE_NOT_FOUND')
      return undefined
    })
    const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: /remove/i }))
    await confirmDialog(user, 'Remove')
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Error removing device.'))
    expect(screen.getByText('Android')).toBeInTheDocument()
  })

  it('shows an error toast when loading fails', async () => {
    setMockUser({ role: 'OWNER' })
    mockApi(({ path }) => (path === '/v1/devices' ? problem(500, 'INTERNAL_ERROR') : undefined))
    const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')
    renderPage()
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Error loading devices.'))
  })

  it('shows one toast per failure (the real toaster, no loop)', async () => {
    setMockUser({ role: 'OWNER' })
    mockApi(({ path }) => (path === '/v1/devices' ? problem(500, 'INTERNAL_ERROR') : undefined))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    renderPage()
    expect(await screen.findByText('Error loading devices.')).toBeInTheDocument()
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(consoleError.mock.calls.filter(([message]) => message === 'Error fetching devices')).toHaveLength(1)
    expect(screen.getAllByText('Error loading devices.')).toHaveLength(1)
  })

  it('redirects EMPLOYEE away and never fetches devices', async () => {
    setMockUser({ role: 'EMPLOYEE' })
    const api = mockApi(() => json(200, []))
    renderPage()
    expect(await screen.findByText('Dashboard home')).toBeInTheDocument()
    expect(api.to('/v1/devices')).toHaveLength(0)
  })

  it('redirects CUSTOMER away', async () => {
    setMockUser({ role: 'CUSTOMER' })
    mockApi(() => json(200, []))
    renderPage()
    expect(await screen.findByText('Dashboard home')).toBeInTheDocument()
  })
})
