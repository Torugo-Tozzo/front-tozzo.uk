import { createSignal, Show, onMount, onCleanup } from 'solid-js';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle } from "lucide-solid";
import { useTranslation } from '@/i18n/solid';

export default function PaymentSuccessPage() {
  const { logout, isAuthenticated } = useAuth();
  const { t } = useTranslation('common');

  const [failed, setFailed] = createSignal(false)
  const [busy, setBusy] = createSignal(false)
  let disposed = false
  onCleanup(() => { disposed = true })
  async function finish() {
    if (busy() || disposed) return
    setBusy(true)
    setFailed(false)
    try {
      await logout()
      if (!disposed && isAuthenticated()) setFailed(true)
    } catch {
      if (!disposed) setFailed(true)
    } finally {
      if (!disposed) setBusy(false)
    }
  }

  onMount(() => {
    // Preserve the return flow: a fresh sign-in reads the server's plan.
    // session_id is never treated as proof of payment by the client.
    const timer = window.setTimeout(() => { void finish() }, 3000)
    onCleanup(() => window.clearTimeout(timer))
  })

  return (
    <div class="min-h-screen flex items-center justify-center bg-gray-50">
      <div class="text-center space-y-4 p-8">
        <div class="flex justify-center">
          <CheckCircle class="h-20 w-20 text-green-500" />
        </div>
        <h1 class="text-3xl font-bold text-gray-900">{t('paymentSuccess.title')}</h1>
        <p class="text-lg text-gray-600">{t('paymentSuccess.preparing')}</p>
        <p class="text-sm text-gray-500">{t('paymentSuccess.redirecting')}</p>
        <Show when={failed()}>
          <p role="alert">{t('logoutFailed')}</p>
          <Button disabled={busy()} onClick={() => void finish()}>{t('accessibility.logout')}</Button>
        </Show>
      </div>
    </div>
  );
}
