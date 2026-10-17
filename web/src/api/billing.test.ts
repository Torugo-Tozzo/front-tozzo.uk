import { afterEach, expect, it, vi } from 'vitest'
import { json, mockApi, problem } from '@/test/api'
import { createCheckout, stripeCheckoutUrl } from './billing'
afterEach(() => vi.unstubAllGlobals())
it.each([{ plan: 'PAID', interval: 'monthly' }, { plan: 'PAID', interval: 'annual' }, { plan: 'ENTERPRISE', interval: 'monthly' }] as const)('sends the Go checkout contract %j without legacy tier names', async body => {
  const mock = mockApi(() => json(200, { url: 'https://checkout.stripe.com/c/pay/cs_test' }))
  expect(await createCheckout(body)).toEqual({ url: 'https://checkout.stripe.com/c/pay/cs_test' })
  expect(mock.calls[0]).toMatchObject({ method: 'POST', path: '/v1/billing/checkout', body })
})
it('preserves problem codes and never retries a payment write', async () => {
  const mock = mockApi(() => problem(502, 'BILLING_CHECKOUT_FAILED'))
  await expect(createCheckout({ plan: 'PAID', interval: 'annual' })).rejects.toMatchObject({ code: 'BILLING_CHECKOUT_FAILED' })
  expect(mock.calls).toHaveLength(1)
})
it.each(['javascript:alert(1)', 'http://checkout.stripe.com/x', 'https://checkout.stripe.com.evil.test/x', 'https://user:password@checkout.stripe.com/x', '', undefined])('rejects unsafe or missing checkout URLs: %s', url => {
  expect(() => stripeCheckoutUrl(url)).toThrow()
})
it('accepts the HTTPS Stripe checkout URL without modifying its session path', () => {
  expect(stripeCheckoutUrl('https://checkout.stripe.com/c/pay/cs_test#session')).toBe('https://checkout.stripe.com/c/pay/cs_test#session')
})
