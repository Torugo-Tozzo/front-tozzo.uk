import { Route, useLocation } from '@solidjs/router'
import { fireEvent, screen, waitFor, within } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { toast } from 'solid-sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n/config'
import { json, mockApi, noContent, problem, type RecordedCall } from '@/test/api'
import { resetAuthMocks, setMockUser } from '@/test/auth-mock'
import { confirmDialog, dialogClosed, renderDashboard } from '@/test/dashboard'
import EmployeesPage from './EmployeesPage'

vi.mock('@/contexts/AuthContext', () => import('@/test/auth-mock'))

const member = (id: string, name: string, role = 'EMPLOYEE') => ({ id, name, email: `${id}@example.test`, phone: null, role, createdAt: '2026-01-01T00:00:00Z', photoUrl: null })
const page = (items: unknown[], total = items.length, nextCursor: string | null = null) => json(200, { items, nextCursor, total })
const establishment = { id: 'est-1', tradeName: 'Café da Nina', status: 'ACTIVE' as const, plan: 'PAID' as const, category: null, preferencesRevision: 0 }

function Destination() {
  const location = useLocation()
  return <p>{location.search}</p>
}

const renderPage = () => renderDashboard('/dashboard/employees', () => <>
  <Route path="/dashboard/employees" component={EmployeesPage} />
  <Route path="/dashboard/schedule" component={Destination} />
</>)

describe('EmployeesPage', () => {
  beforeEach(async () => {
    resetAuthMocks()
    await i18n.changeLanguage('en')
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('shows the PaywallBanner for a manager on the free plan', async () => {
    setMockUser({ role: 'MANAGER' })
    mockApi(({ path }) => (path === '/v1/users' ? problem(403, 'PLAN_UPGRADE_REQUIRED') : undefined))
    const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')
    renderPage()

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Ask the owner to upgrade the plan to unlock this.'))
    expect(screen.queryByText('Team')).toBeNull()
    expect(toastError).not.toHaveBeenCalled()
  })

  it('opens the selected employee\'s schedule from the edit dialog', async () => {
    setMockUser({ role: 'OWNER' })
    mockApi(({ path }) => (path === '/v1/users' ? page([member('employee-1', 'Ana')]) : undefined))
    renderPage()
    expect(await screen.findByText('Ana')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(await screen.findByRole('button', { name: 'View schedule' }))
    expect(await screen.findByText('?employeeId=employee-1')).toBeInTheDocument()
  })

  it('renders translated roles, the total and the page chrome', async () => {
    setMockUser({ role: 'OWNER', establishment })
    mockApi(({ path }) => (path === '/v1/users' ? page([member('7', 'Ana'), member('8', 'Victor', 'OWNER')], 12, 'next') : undefined))
    const user = userEvent.setup()
    renderPage()

    expect(screen.getByRole('heading', { name: 'Employees — Café da Nina' })).toBeInTheDocument()
    expect(await screen.findByText('Ana')).toBeInTheDocument()
    expect(screen.getByText('Employee')).toBeInTheDocument()
    expect(screen.getByText('Total records: 12')).toBeInTheDocument()
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
    // Nobody manages the owner here: only Ana's row has actions.
    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'New employee' }))
    expect(await screen.findByRole('button', { name: /^Role/ })).toBeInTheDocument()
  })

  it('pages with the cursor and searches by name from page 1', async () => {
    setMockUser({ role: 'OWNER' })
    const api = mockApi(({ path, query }) => {
      if (path !== '/v1/users') return undefined
      if (query.get('cursor') === 'c2') return page([member('2', 'Bia')], 11)
      if (query.get('search') === 'jo') return page([member('3', 'João')], 1)
      return page([member('1', 'Ana')], 11, 'c2')
    })
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText('Ana')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Bia')).toBeInTheDocument()
    expect(screen.getByText('11')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Search employees...'), 'jo')
    expect(await screen.findByText('João')).toBeInTheDocument()
    const last = api.to('/v1/users').at(-1)!
    expect(last.query.get('search')).toBe('jo')
    expect(last.query.get('cursor')).toBeNull()
    expect(last.query.get('limit')).toBe('10')
  })

  it('creates an employee with the chosen role and reloads the list', async () => {
    setMockUser({ role: 'MANAGER' })
    let created = false
    const api = mockApi(({ method, path }) => {
      if (path !== '/v1/users') return undefined
      if (method === 'POST') { created = true; return json(201, member('9', 'Caio', 'COOK')) }
      return page(created ? [member('9', 'Caio', 'COOK')] : [])
    })
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText('No employees found.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'New employee' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Name'), 'Caio')
    await user.type(within(dialog).getByLabelText('Email'), 'caio@example.test')
    await user.type(within(dialog).getByLabelText('Password'), 'secret123')
    await user.click(within(dialog).getByRole('button', { name: /^Role/ }))
    // A manager cannot give MANAGER.
    expect(screen.queryByRole('option', { name: 'Manager' })).toBeNull()
    await user.click(await screen.findByRole('option', { name: 'Cook' }))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(api.calls.find((call) => call.method === 'POST')?.body).toEqual({
      name: 'Caio', email: 'caio@example.test', password: 'secret123', role: 'COOK',
    }))
    expect(await screen.findByText('Caio')).toBeInTheDocument()
    await dialogClosed()
  })

  it('keeps the form and explains a failed creation', async () => {
    setMockUser({ role: 'OWNER' })
    mockApi(({ method, path }) => {
      if (path !== '/v1/users') return undefined
      return method === 'POST' ? problem(409, 'USER_EMAIL_EXISTS') : page([])
    })
    const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'New employee' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Name'), 'Caio')
    await user.type(within(dialog).getByLabelText('Email'), 'caio@example.test')
    await user.type(within(dialog).getByLabelText('Password'), 'secret123')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Error creating employee.'))
    expect(within(screen.getByRole('dialog')).getByLabelText('Name')).toHaveValue('Caio')
  })

  it('edits an employee and sends the password only when typed', async () => {
    setMockUser({ role: 'OWNER' })
    const api = mockApi(({ method, path }) => {
      if (method === 'PATCH' && path === '/v1/users/1') return json(200, member('1', 'Ana Maria'))
      return path === '/v1/users' ? page([member('1', 'Ana')]) : undefined
    })
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    const dialog = await screen.findByRole('dialog')
    const nameInput = within(dialog).getByLabelText('Name')
    await user.clear(nameInput)
    await user.type(nameInput, 'Ana Maria')
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(api.calls.find((call: RecordedCall) => call.method === 'PATCH')?.body).toEqual({
      name: 'Ana Maria', email: '1@example.test', role: 'EMPLOYEE',
    }))
  })

  it('deletes an employee after confirming', async () => {
    setMockUser({ role: 'OWNER' })
    let deleted = false
    const api = mockApi(({ method, path }) => {
      if (method === 'DELETE' && path === '/v1/users/1') { deleted = true; return noContent() }
      return path === '/v1/users' ? page(deleted ? [] : [member('1', 'Ana')]) : undefined
    })
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    await confirmDialog(user, 'Delete')
    await waitFor(() => expect(api.calls.some((call) => call.method === 'DELETE')).toBe(true))
    expect(await screen.findByText('No employees found.')).toBeInTheDocument()
  })

  it('shows a load error as a toast with the empty table', async () => {
    setMockUser({ role: 'OWNER' })
    mockApi(({ path }) => (path === '/v1/users' ? problem(500, 'INTERNAL_ERROR') : undefined))
    const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')
    renderPage()
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Error loading employees.'))
    expect(await screen.findByText('No employees found.')).toBeInTheDocument()
  })

  it('shows its own skeleton while the list loads, not the suspense fallback', async () => {
    setMockUser({ role: 'OWNER' })
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Employees' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Loading...')
    expect(screen.getByText('Total records: 0')).toBeInTheDocument()
    expect(screen.queryByText('Suspended')).toBeNull()
  })

  describe('actions per row', () => {
    const everyone = [member('o', 'Olga', 'OWNER'), member('m', 'Mario', 'MANAGER'), member('e', 'Eva', 'EMPLOYEE'), member('c', 'Caio', 'COOK'), member('d', 'Davi', 'DRIVER'), member('u', 'Ugo', 'CUSTOMER')]
    const rowOf = (name: string) => screen.getByText(name).closest('tr')!

    it('a manager edits and deletes only employees, cooks, drivers and customers', async () => {
      setMockUser({ role: 'MANAGER' })
      mockApi(({ path }) => (path === '/v1/users' ? page(everyone) : undefined))
      renderPage()
      await screen.findByText('Olga')
      for (const name of ['Olga', 'Mario']) {
        expect(within(rowOf(name)).queryByRole('button', { name: 'Edit' })).toBeNull()
        expect(within(rowOf(name)).queryByRole('button', { name: 'Delete' })).toBeNull()
      }
      for (const name of ['Eva', 'Caio', 'Davi', 'Ugo']) {
        expect(within(rowOf(name)).getByRole('button', { name: 'Edit' })).toBeInTheDocument()
        expect(within(rowOf(name)).getByRole('button', { name: 'Delete' })).toBeInTheDocument()
      }
    })

    it('an owner manages everyone but the owner', async () => {
      setMockUser({ role: 'OWNER' })
      mockApi(({ path }) => (path === '/v1/users' ? page(everyone) : undefined))
      renderPage()
      await screen.findByText('Olga')
      expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeInTheDocument()
      expect(within(rowOf('Olga')).queryByRole('button')).toBeNull()
      expect(within(rowOf('Mario')).getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    })

    for (const role of ['EMPLOYEE', 'COOK'] as const) {
      it(`${role} sees no actions column and cannot add`, async () => {
        setMockUser({ role })
        mockApi(({ path }) => (path === '/v1/users' ? page(everyone) : undefined))
        renderPage()
        await screen.findByText('Olga')
        expect(screen.queryByRole('columnheader', { name: 'Actions' })).toBeNull()
        expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
        expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
        expect(screen.queryByRole('button', { name: 'New employee' })).toBeNull()
      })
    }
  })
})
