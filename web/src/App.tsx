import { Show, Suspense, type JSX } from 'solid-js'
import { Navigate, Route, Router, useIsRouting, type RouteSectionProps } from '@solidjs/router'
import { QueryClientProvider } from '@tanstack/solid-query'

import { createAppQueryClient } from '@/api/query'
import { BusinessModuleRoute, DashboardHome } from '@/components/BusinessModuleRoute'
import { LoadingOverlay } from '@/components/LoadingOverlay'
import ProtectedRoute from '@/components/ProtectedRoute'
import { AuthProvider } from '@/contexts/AuthContext'
import { ConfirmProvider } from '@/contexts/ConfirmContext'
import type { NavigationModule } from '@/domain/businessPreferences'
import MainLayout from '@/layouts/MainLayout'
import { lazyPage } from '@/lib/lazy-page'

const queryClient = createAppQueryClient()
const DashboardLayout = lazyPage(() => import('@/layouts/DashboardLayout'))
const LoginPage = lazyPage(() => import('@/pages/LoginPage'))
const ForgotPasswordPage = lazyPage(() => import('@/pages/ForgotPasswordPage'))
const ResetPasswordPage = lazyPage(() => import('@/pages/ResetPasswordPage'))
const VerifyEmailPage = lazyPage(() => import('@/pages/VerifyEmailPage'))
const ConfirmEmailPage = lazyPage(() => import('@/pages/ConfirmEmailPage'))
// S3: registration.
const ProductsPage = lazyPage(() => import('@/pages/dashboard/ProductsPage'))
const EmployeesPage = lazyPage(() => import('@/pages/dashboard/EmployeesPage'))
const DevicesPage = lazyPage(() => import('@/pages/dashboard/DevicesPage'))
const SettingsPage = lazyPage(() => import('@/pages/dashboard/SettingsPage'))

// solid-sonner (with its CSS) stays out of the initial chunk (plan S2). It
// loads right after boot, long before the first toast a user can trigger.
const Toaster = lazyPage(() => import('solid-sonner').then((module) => ({ default: module.Toaster })))

// Dev only: the condition is resolved at build time, so production has no chunk for it.
const UiShowcasePage = import.meta.env.DEV ? lazyPage(() => import('./pages/dev/UiShowcasePage')) : undefined

function RootLayout(props: RouteSectionProps) {
  const isRouting = useIsRouting()

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ConfirmProvider>
          <Suspense>
            <Toaster position="top-right" richColors closeButton />
          </Suspense>
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

const dashboardRoutes: [path: string, module: NavigationModule, page?: () => JSX.Element][] = [
  ['/orders', 'ORDERS'],
  ['/sales', 'SALES'],
  ['/products', 'PRODUCTS', ProductsPage],
  ['/services', 'SERVICES'],
  ['/estimates', 'ESTIMATES'],
  ['/estimates/:id', 'ESTIMATES'],
  ['/service-orders', 'SERVICE_ORDERS'],
  ['/service-orders/:id', 'SERVICE_ORDERS'],
  ['/employees', 'EMPLOYEES', EmployeesPage],
  ['/schedule', 'SCHEDULE'],
  ['/devices', 'DEVICES', DevicesPage],
  ['/charts', 'REPORTS'],
  ['/settings', 'SETTINGS', SettingsPage],
  ['/kitchen', 'KITCHEN'],
  ['/deliveries', 'DELIVERIES'],
]

export default function App() {
  return (
    <Router root={RootLayout}>
      <Route path="/" component={() => <Navigate href="/login" />} />
      {/* Public pages (S2: authentication). */}
      <Route component={MainLayout}>
        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={() => <LoginPage initialTab="register" />} />
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route path="/verify-email" component={VerifyEmailPage} />
        <Route path="/confirm-email" component={ConfirmEmailPage} />
      </Route>
      {/* Authenticated routes that also allow pending payment users (S7). */}
      <Route component={(props: RouteSectionProps) => <ProtectedRoute allowPending>{props.children}</ProtectedRoute>}>
        <Route path="/plan" component={NotPortedYet} />
        <Route path="/payment/success" component={NotPortedYet} />
      </Route>
      {/* Dashboard routes require an active establishment. */}
      <Route component={(props: RouteSectionProps) => <ProtectedRoute>{props.children}</ProtectedRoute>}>
        <Route path="/dashboard" component={DashboardLayout}>
          <Route path="/" component={DashboardHome} />
          {dashboardRoutes.map(([path, module, page]) => <Route path={path} component={modulePage(module, page)} />)}
        </Route>
      </Route>
      {/* Catalogue of the ui/ primitives (dev only; not in the production build). */}
      {UiShowcasePage && <Route path="/__ui" component={UiShowcasePage} />}
    </Router>
  )
}
