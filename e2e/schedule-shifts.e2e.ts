import { expect, test, type Page } from '@playwright/test'
import { mockV1Api } from './visual/support/mock-v1'

async function backend(page: Page, failSave = false, role: 'OWNER' | 'EMPLOYEE' = 'OWNER') {
  await mockV1Api(page, { role })
  const employees = [{ id: 'ana', name: 'Ana', role: 'EMPLOYEE' }, { id: 'bia', name: 'Bia', role: 'EMPLOYEE' }]
  let shifts: Record<string, unknown>[] = []
  let events: Record<string, unknown>[] = []
  const calls: { method: string; path: string; body: any }[] = []
  await page.route(url => url.hostname === 'api.visual.test' && (url.pathname.startsWith('/v1/calendar') || url.pathname === '/v1/business-hours'), async route => {
    const request = route.request(), method = request.method(), path = new URL(request.url()).pathname
    if (method === 'OPTIONS') return route.fallback()
    let status = 200, reply: unknown
    const body = request.postDataJSON()
    if (path === '/v1/business-hours') { if (method !== 'GET') calls.push({ method, path, body }); reply = { hours: body?.hours ?? [{ daysOfWeek: [0,1,2,3,4,5,6], startTime: '18:00', endTime: '01:00' }] } }
    else if (method === 'GET') reply = { employees, events, shifts }
    else {
      calls.push({ method, path, body })
      if (failSave) { failSave = false; status = 409; reply = { code: 'CALENDAR_CONFLICT', status, title: 'Conflict' } }
      else if (path.startsWith('/v1/calendar/events')) { if (method === 'DELETE') { events = []; status = 204 } else { const event = { ...body, id: 'event-1', employeeId: null, employee: null, repeatUntil: null }; events = [event]; reply = event; status = method === 'POST' ? 201 : 200 } }
      else if (method === 'DELETE') { shifts = []; status = 204 }
      else { const shift = { ...body, id: 'shift-1', repeatUntil: body.repeatUntil ?? null, assignments: body.members.map((member: any, index: number) => ({ ...body, ...member, id: `a-${index}`, employee: employees.find(employee => employee.id === member.employeeId) })) }; shifts = [shift]; reply = shift; status = method === 'POST' ? 201 : 200 }
    }
    await route.fulfill({ status, contentType: status >= 400 ? 'application/problem+json' : 'application/json', headers: { 'Access-Control-Allow-Origin': request.headers().origin ?? '*', 'Access-Control-Allow-Credentials': 'true' }, body: reply === undefined ? '' : JSON.stringify(reply) })
  })
  return calls
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tozzo.locale', 'pt-BR'))
  await page.clock.setFixedTime(new Date('2026-10-01T18:00:00Z'))
})

test('agenda: cria turno recorrente noturno com exceção, edita a série e exclui', async ({ page }) => {
  const calls = await backend(page)
  await page.goto('/dashboard/schedule')
  await expect(page.locator('.fc')).toBeVisible()
  await expect(page.getByRole('status')).toHaveCount(0)
  await page.getByRole('button', { name: 'Novo turno', exact: true }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByLabel('Nome do turno (opcional)').fill('Noite')
  await dialog.getByLabel('Ana', { exact: true }).check()
  await dialog.getByLabel('Bia', { exact: true }).check()
  await dialog.getByLabel('Horário diferente para Bia').check()
  await dialog.getByLabel('Entrada de Bia', { exact: true }).fill('17:00')
  await dialog.getByLabel('Saída de Bia', { exact: true }).fill('00:30')
  await dialog.getByLabel('Repetir toda semana').check()
  await dialog.getByRole('button', { name: 'Salvar turno' }).click()
  await expect(dialog).toHaveCount(0)
  expect(calls[0].body).toMatchObject({ startDate: '2026-10-01', endDate: '2026-10-02', repeatWeekly: true, members: [{ employeeId: 'ana' }, { employeeId: 'bia', startTime: '17:00', endTime: '00:30' }] })
  await page.locator('.fc-event').filter({ hasText: 'Noite (2)' }).first().click()
  dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Bia', { exact: true })).toBeVisible()
  await expect(dialog.getByText('17:00–00:30')).toBeVisible()
  await dialog.getByRole('button', { name: 'Editar série semanal' }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByLabel('Data inicial', { exact: true }).fill('2026-10-08')
  await expect(dialog.getByLabel('Data final', { exact: true })).toHaveValue('2026-10-09')
  await expect(dialog.getByLabel('Data de saída de Bia')).toHaveValue('2026-10-09')
  await dialog.getByRole('button', { name: 'Salvar turno' }).click()
  await expect(dialog).toHaveCount(0)
  expect(calls[1].method).toBe('PUT')
  await page.locator('.fc-next-button').click()
  await page.locator('.fc-event').filter({ hasText: 'Noite (2)' }).first().click()
  await page.getByRole('button', { name: 'Editar série semanal' }).click()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('dialog').getByRole('button', { name: 'Excluir', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(calls[2].method).toBe('DELETE')
  expect(await page.locator('.fc-timegrid-slot-lane').count()).toBeLessThanOrEqual(48)
})

test('agenda: conflito mantém o turno preenchido para nova tentativa', async ({ page }) => {
  const calls = await backend(page, true)
  await page.goto('/dashboard/schedule')
  await expect(page.getByRole('status')).toHaveCount(0)
  await page.getByRole('button', { name: 'Novo turno', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Ana', { exact: true }).check()
  await dialog.getByLabel('Nome do turno (opcional)').fill('Preservado')
  await dialog.getByRole('button', { name: 'Salvar turno' }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  await expect(dialog.getByLabel('Nome do turno (opcional)')).toHaveValue('Preservado')
  await dialog.getByRole('button', { name: 'Salvar turno' }).click()
  await expect(dialog).toHaveCount(0)
  expect(calls).toHaveLength(2)
})

test('agenda: funcionário consulta e filtra sem controles de alteração', async ({ page }) => {
  await backend(page, false, 'EMPLOYEE')
  await page.goto('/dashboard/schedule')
  await expect(page.locator('.fc')).toBeVisible()
  await expect(page.getByRole('status')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Novo turno|Novo horário especial|Editar funcionamento/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Filtrar por Funcionário' }).click()
  await page.getByRole('dialog').getByLabel('Ana', { exact: true }).check()
  const filtered = page.waitForRequest(request => request.url().includes('/v1/calendar?') && request.url().includes('userIds=ana'))
  await page.getByRole('button', { name: 'Aplicar filtro' }).click()
  await filtered
})

test('agenda: salva funcionamento e horário especial de dia inteiro', async ({ page }) => {
  const calls = await backend(page)
  await page.goto('/dashboard/schedule')
  await expect(page.locator('.fc')).toBeVisible()
  await expect(page.getByRole('status')).toHaveCount(0)
  await page.getByRole('button', { name: 'Editar funcionamento' }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByLabel('Abertura padrão').fill('12:00')
  await dialog.getByRole('button', { name: 'Salvar funcionamento' }).click()
  await expect(dialog).toHaveCount(0)
  expect(calls[0]).toMatchObject({ method: 'PUT', path: '/v1/business-hours', body: { hours: expect.arrayContaining([{ daysOfWeek: [1], startTime: '12:00', endTime: '01:00' }]) } })
  await page.getByRole('button', { name: 'Novo horário especial' }).click()
  dialog = page.getByRole('dialog')
  await dialog.locator('#schedule-title').fill('Feriado E2E')
  await dialog.getByRole('checkbox').check()
  await dialog.getByRole('button', { name: 'Salvar horário', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(calls[1]).toMatchObject({ method: 'POST', path: '/v1/calendar/events', body: { title: 'Feriado E2E', startTime: '00:00', endDate: '2026-10-02', endTime: '00:00' } })
  await page.locator('.fc-event').filter({ hasText: 'Feriado E2E' }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: 'Excluir', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(calls[2]).toMatchObject({ method: 'DELETE', path: '/v1/calendar/events/event-1' })
})
