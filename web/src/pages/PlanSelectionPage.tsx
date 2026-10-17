import { createSignal, onCleanup, Show } from 'solid-js'
import { Navigate, useNavigate } from '@solidjs/router'
import { createMutation } from '@tanstack/solid-query'
import { toast } from 'solid-sonner'
import { useAuth } from '@/contexts/AuthContext'
import { useTranslation } from '@/i18n/solid'
import { useErrorMessage } from '@/i18n/error-message'
import { PricingCards } from '@/components/PricingCards'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
import { createCheckout, stripeCheckoutUrl, type CheckoutRequest } from '@/api/billing'

export default function PlanSelectionPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t } = useTranslation('common')
  const { t: tErrors } = useTranslation('errors')
  const localizedError = useErrorMessage()
  const [loading, setLoading] = createSignal(false)
  let disposed = false
  const abort = new AbortController()
  onCleanup(() => { disposed = true; abort.abort() })
  const checkout = createMutation(() => ({ mutationFn: (body: CheckoutRequest) => createCheckout(body, abort.signal), retry: false }))
  const hasPaidPlan = () => user()?.establishment?.status === 'ACTIVE' && Boolean(user()?.establishment?.plan && user()?.establishment?.plan !== 'FREE')
  const handleCheckout = async (plan: CheckoutRequest['plan'], interval: CheckoutRequest['interval']) => {
    if (disposed || loading() || user()?.role !== 'OWNER') return
    setLoading(true)
    try {
      const response = await checkout.mutateAsync({ plan, interval })
      if (disposed) return
      let url: string
      try { url = stripeCheckoutUrl(response.url) }
      catch { toast.error(tErrors('paymentUrl')); return }
      window.location.assign(url)
    } catch (error) {
      if (!disposed) toast.error(localizedError('payment', error))
    } finally { if (!disposed) setLoading(false) }
  }
  return <Show when={!hasPaidPlan()} fallback={<Navigate href="/dashboard" />}>
    <div class="min-h-screen flex flex-col bg-gray-50 dark:bg-muted/40">
      <Navbar />
      <main class="flex-1 flex items-center justify-center p-4">
        <div class="max-w-4xl w-full space-y-8">
          <div class="text-center">
            <h1 class="text-3xl font-bold tracking-tight text-gray-900 dark:text-foreground">{t('plans.noPlanTitle')}</h1>
            <p class="mt-4 text-lg text-gray-600 dark:text-muted-foreground">{t('plans.noPlanDescription')}</p>
          </div>
          <Show when={user()?.role !== 'OWNER'}><p role="status" class="text-center text-sm text-muted-foreground">{tErrors('askOwnerCta')}</p></Show>
          <PricingCards currentPlan={user()?.establishment?.plan}
            onSelectFree={() => navigate('/dashboard')}
            onSelectPaid={interval => void handleCheckout('PAID', interval)}
            onSelectEnterprise={() => void handleCheckout('ENTERPRISE', 'monthly')}
            loading={loading()} checkoutDisabled={user()?.role !== 'OWNER'} />
        </div>
      </main>
      <Footer />
    </div>
  </Show>
}
