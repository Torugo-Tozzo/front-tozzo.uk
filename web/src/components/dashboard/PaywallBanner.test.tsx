import { Route } from '@solidjs/router'
import { screen } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { i18n } from '@/i18n/config'
import { renderAt } from '@/test/router'
import { PaywallBanner, type PaywallCode } from './PaywallBanner'

function renderBanner(code: PaywallCode, role: string) {
  return renderAt('/', () => <>
    <Route path="/" component={() => <PaywallBanner code={code} role={role} />} />
    <Route path="/plan" component={() => <p>Plan page</p>} />
  </>)
}

describe('PaywallBanner', () => {
  beforeEach(async () => { await i18n.changeLanguage('en') })

  it('shows the upgrade message and the upgrade CTA to the OWNER', async () => {
    renderBanner('PLAN_UPGRADE_REQUIRED', 'OWNER')
    expect(screen.getByText(/only available on paid plans/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /upgrade plan/i }))
    expect(await screen.findByText('Plan page')).toBeInTheDocument()
  })

  it('tells anyone else to ask the owner', () => {
    renderBanner('PLAN_UPGRADE_REQUIRED', 'MANAGER')
    expect(screen.getByText(/ask the owner/i)).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('has its own message for REPORT_QUOTA_EXCEEDED', () => {
    renderBanner('REPORT_QUOTA_EXCEEDED', 'OWNER')
    expect(screen.getByText(/monthly report limit/i)).toBeInTheDocument()
  })

  it('tells anyone else to ask the owner when the report quota is over', () => {
    renderBanner('REPORT_QUOTA_EXCEEDED', 'MANAGER')
    expect(screen.getByText(/ask the owner/i)).toBeInTheDocument()
  })
})
