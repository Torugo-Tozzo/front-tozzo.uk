import { Match, Switch, type JSX } from 'solid-js'
import { Navigate, useLocation } from '@solidjs/router'

import { useAuth } from '@/contexts/AuthContext'
import { useTranslation } from '@/i18n/solid'

interface ProtectedRouteProps {
  allowPending?: boolean
  children?: JSX.Element
}

// Hiding a route is not security: the API checks every request again.
export default function ProtectedRoute(props: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth()
  const { t } = useTranslation('common')
  const location = useLocation()

  // Pending payment users may access only routes explicitly marked as allowed.
  const blockedByPayment = () => {
    const establishment = user()?.establishment
    return !props.allowPending && !!establishment && establishment.status !== 'ACTIVE'
  }

  return (
    <Switch fallback={props.children}>
      <Match when={isLoading()}>
        <div class="flex items-center justify-center min-h-screen" role="status" aria-label={t('loading')}>
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Match>
      <Match when={!isAuthenticated()}>
        <Navigate href="/login" />
      </Match>
      <Match when={blockedByPayment()}>
        <Navigate href="/plan" />
      </Match>
      <Match when={user()?.role === 'COOK' && !location.pathname.startsWith('/dashboard/kitchen')}>
        <Navigate href="/dashboard/kitchen" />
      </Match>
      <Match when={user()?.role === 'DRIVER' && !location.pathname.startsWith('/dashboard/deliveries')}>
        <Navigate href="/dashboard/deliveries" />
      </Match>
    </Switch>
  )
}
