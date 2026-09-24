import { expect, test } from '@playwright/test'

test('turno local reúne funcionários e mostra exceção individual', async ({ page, baseURL }) => {
  const email = process.env.E2E_EMAIL
  const password = process.env.E2E_PASSWORD
  const host = new URL(baseURL ?? 'http://localhost:5173').hostname
  test.skip(!['localhost', '127.0.0.1'].includes(host) || !email || !password, 'Fluxo de escrita somente no ambiente local com credenciais de teste')
  test.setTimeout(90_000)
  let createdId: string | null = null

  try {
    await page.goto('/login')
    await page.locator('#email').fill(email!)
    await page.locator('#password').fill(password!)
    await page.locator('form:has(#password) button[type="submit"]').click()
    await expect(page).toHaveURL(/\/dashboard(?:\/orders)?$/)
    const listResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/calendar' && response.request().method() === 'GET')
    await page.goto('/dashboard/schedule')
    const { employees } = await (await listResponse).json()
    expect(employees.length).toBeGreaterThanOrEqual(2)
    const [first, second] = employees
    const title = `Turno E2E ${Date.now()}`

    await page.getByRole('button', { name: /New shift|Novo turno/i }).click()
    const editor = page.getByRole('dialog')
    await editor.locator('#shift-title').fill(title)
    await editor.locator('#shift-start-time').fill('18:00')
    await editor.locator('#shift-end-time').fill('23:00')
    await editor.getByRole('checkbox', { name: first.name, exact: true }).check()
    await editor.getByRole('checkbox', { name: second.name, exact: true }).check()
    await editor.getByRole('checkbox', { name: new RegExp(`Different hours for ${second.name}|Horário diferente para ${second.name}`) }).check()
    await editor.getByLabel(new RegExp(`Start time for ${second.name}|Entrada de ${second.name}`)).fill('00:00')
    await editor.getByLabel(new RegExp(`End time for ${second.name}|Saída de ${second.name}`)).fill('20:00')
    const createResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/calendar/shifts' && response.request().method() === 'POST')
    await editor.getByRole('button', { name: /Save shift|Salvar turno/i }).click()
    const created = await createResponse
    expect(created.status(), await created.text()).toBe(201)
    createdId = (await created.json()).id
    await expect(page.locator('.fc-event').filter({ hasText: title }).first()).toBeVisible()
    await page.locator('.fc-event').filter({ hasText: title }).click()
    const details = page.getByRole('dialog')
    await expect(details.getByText(first.name)).toBeVisible()
    await expect(details.getByText(second.name)).toBeVisible()
    await expect(details.getByText('00:00–20:00')).toBeVisible()
    await details.getByRole('button', { name: /Edit shift|Editar turno/i }).click()
    const editDialog = page.getByRole('dialog', { name: /Edit shift|Editar turno/i })
    const startDate = await editDialog.locator('#shift-start-date').inputValue()
    const nextDate = new Date(`${startDate}T12:00:00.000Z`)
    nextDate.setUTCDate(nextDate.getUTCDate() + 1)
    await editDialog.locator('#shift-end-date').fill(nextDate.toISOString().slice(0, 10))
    await editDialog.locator('#shift-end-time').fill('01:00')
    const updateResponse = page.waitForResponse(response => new URL(response.url()).pathname === `/calendar/shifts/${createdId}` && response.request().method() === 'PUT')
    await editDialog.getByRole('button', { name: /Save shift|Salvar turno/i }).click()
    expect((await updateResponse).status()).toBe(200)
    await expect(page.locator('.fc-event').filter({ hasText: title }).first()).toBeVisible()
    expect(await page.locator('.fc-timegrid-slot-lane').count()).toBeLessThanOrEqual(48)
    const calendarHeight = await page.locator('.schedule-calendar .fc').evaluate(element => element.getBoundingClientRect().height)
    expect(calendarHeight).toBeLessThanOrEqual(740)
  } finally {
    if (createdId) {
      const token = await page.evaluate(async () => {
        const { authClient } = await import('/src/lib/authClient.ts')
        return (await authClient.getSession()).data.session?.access_token ?? null
      })
      if (!token) throw new Error('Sessão de teste indisponível para remover o turno criado')
      const deleted = await page.request.delete(`http://localhost:3001/calendar/shifts/${createdId}`, { headers: { Authorization: `Bearer ${token}` } })
      expect(deleted.ok()).toBeTruthy()
    }
  }
})
