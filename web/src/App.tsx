import { Show, Suspense, type JSX } from 'solid-js'
import { Route, Router, useIsRouting, type RouteSectionProps } from '@solidjs/router'
import { QueryClientProvider } from '@tanstack/solid-query'
import { Toaster } from 'solid-sonner'

import { createAppQueryClient } from '@/api/query'
import { BusinessModuleRoute, DashboardHome } from '@/components/BusinessModuleRoute'
import { LoadingOverlay } from '@/components/LoadingOverlay'
import ProtectedRoute from '@/components/ProtectedRoute'
import { AuthProvider } from '@/contexts/AuthContext'
import { ConfirmProvider } from '@/contexts/ConfirmContext'
import type { NavigationModule } from '@/domain/businessPreferences'
import { lazyPage } from '@/lib/lazy-page'

const queryClient = createAppQueryClient()
const DashboardLayout = lazyPage(() => import('@/layouts/DashboardLayout'))

// Dev only: the condition is resolved at build time, so production has no chunk for it.
const UiShowcasePage = import.meta.env.DEV ? lazyPage(() => import('./pages/dev/UiShowcasePage')) : undefined

function RootLayout(props: RouteSectionProps) {
  const isRouting = useIsRouting()

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ConfirmProvider>
          <Toaster position="top-right" richColors closeButton />
          <Show when={isRouting()}>
            <LoadingOverlay />
          </Show>
          <Suspense fallback={<LoadingOverlay />}>
            {props.children}
          </Suspense>
        </ConfirmProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

// The pages arrive phase by phase (plan S2-S7); until then a route renders the
// shell only. Each one stays behind the same guards as in the React app.
function NotPortedYet(): JSX.Element {
  return null
}

const modulePage = (module: NavigationModule, Page: () => JSX.Element = NotPortedYet) =>
  () => <BusinessModuleRoute module={module}><Page /></BusinessModuleRoute>

const dashboardRoutes: [path: string, module: NavigationModule][] = [
  ['/orders', 'ORDERS'],
  ['/sales', 'SALES'],
  ['/products', 'PRODUCTS'],
  ['/services', 'SERVICES'],
  ['/estimates', 'ESTIMATES'],
  ['/estimates/:id', 'ESTIMATES'],
  ['/service-orders', 'SERVICE_ORDERS'],
  ['/service-orders/:id', 'SERVICE_ORDERS'],
  ['/employees', 'EMPLOYEES'],
  ['/schedule', 'SCHEDULE'],
  ['/devices', 'DEVICES'],
  ['/charts', 'REPORTS'],
  ['/settings', 'SETTINGS'],
  ['/kitchen', 'KITCHEN'],
  ['/deliveries', 'DELIVERIES'],
]

export default function App() {
  return (
    <Router root={RootLayout}>
      {/* Authenticated routes that also allow pending payment users (S7). */}
      <Route component={(props: RouteSectionProps) => <ProtectedRoute allowPending>{props.children}</ProtectedRoute>}>
        <Route path="/plan" component={NotPortedYet} />
        <Route path="/payment/success" component={NotPortedYet} />
      </Route>
      {/* Dashboard routes require an active establishment. */}
      <Route component={(props: RouteSectionProps) => <ProtectedRoute>{props.children}</ProtectedRoute>}>
        <Route path="/dashboard" component={DashboardLayout}>
          <Route path="/" component={DashboardHome} />
          {dashboardRoutes.map(([path, module]) => <Route path={path} component={modulePage(module)} />)}
        </Route>
      </Route>
      {/* Catalogue of the ui/ primitives (dev only; not in the production build). */}
      {UiShowcasePage && <Route path="/__ui" component={UiShowcasePage} />}
    </Router>
  )
}
