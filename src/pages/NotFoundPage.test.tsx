import { Route } from '@solidjs/router'
import { fireEvent, screen } from '@solidjs/testing-library'
import { beforeEach, expect, it } from 'vitest'
import { renderAt } from '@/test/router'
import { i18n } from '@/i18n/config'
import NotFoundPage from './NotFoundPage'
beforeEach(async () => { await i18n.changeLanguage('en') })
it('shows the translated 404 and returns to the landing page', async () => {
  renderAt('/missing', () => <><Route path="/missing" component={NotFoundPage}/><Route path="/" component={() => <p>Home destination</p>}/></>)
  expect(screen.getByRole('heading', { name: '404' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: /home/i }))
  expect(await screen.findByText('Home destination')).toBeVisible()
})
