import { api } from './client'
import { unwrap } from './errors'

export interface CheckoutRequest { plan: 'PAID' | 'ENTERPRISE'; interval: 'monthly' | 'annual' }
export async function createCheckout(body: CheckoutRequest, signal?: AbortSignal) {
  return unwrap(await api.POST('/v1/billing/checkout', { body, signal }))
}
/** Checkout is a top-level navigation, never an authenticated request to Stripe. */
export function stripeCheckoutUrl(value: unknown): string {
  if (typeof value !== 'string') throw new Error('PAYMENT_URL_INVALID')
  const url = new URL(value)
  if (url.origin !== 'https://checkout.stripe.com' || url.username || url.password) throw new Error('PAYMENT_URL_INVALID')
  return url.href
}
