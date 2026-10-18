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
// S4: operation.
const OrdersPage = lazyPage(() => import('@/pages/dashboard/OrdersPage'))
const SalesPage = lazyPage(() => import('@/pages/dashboard/SalesPage'))
const KitchenPage = lazyPage(() => import('@/pages/dashboard/KitchenPage'))
const DeliveriesPage = lazyPage(() => import('@/pages/dashboard/DeliveriesPage'))
// S5: services, quotes, execution and schedule.
const ServicesPage = lazyPage(() => import('@/pages/dashboard/ServicesPage'))
const EstimatesPage = lazyPage(() => import('@/pages/dashboard/ServiceOrdersList').then((module) => ({ default: () => <module.default stage="estimates" /> })))
const ServiceOrderPage = lazyPage(() => import('@/pages/dashboard/ServiceOrderPage'))
const ServiceExecutionPage = lazyPage(() => import('@/pages/dashboard/ServiceExecutionPage'))
const ServiceExecutionDetailPage = lazyPage(() => import('@/pages/dashboard/ServiceOrderPage').then((module) => ({ default: () => <module.default mode="execution" /> })))
const SchedulePage = lazyPage(() => import('@/pages/dashboard/SchedulePage'))

// S6: reports (ECharts loads inside this route).
const ChartsPage = lazyPage(() => import('@/pages/dashboard/ChartsPage'))

// S7: public pages and the payment return flow.
const LandingPage = lazyPage(() => import('@/pages/LandingPage'))
const PlanSelectionPage = lazyPage(() => import('@/pages/PlanSelectionPage'))
const PaymentSuccessPage = lazyPage(() => import('@/pages/PaymentSuccessPage'))
const PrivacyPolicyPage = lazyPage(() => import('@/pages/PrivacyPolicyPage'))
const TermsOfUsePage = lazyPage(() => import('@/pages/TermsOfUsePage'))
const NotFoundPage = lazyPage(() => import('@/pages/NotFoundPage'))

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

const modulePage = (module: NavigationModule, Page: () => JSX.Element) =>
  () => <BusinessModuleRoute module={module}><Page /></BusinessModuleRoute>

const dashboardRoutes: [path: string, module: NavigationModule, page: () => JSX.Element][] = [
  ['/orders', 'ORDERS', OrdersPage],
  ['/sales', 'SALES', SalesPage],
  ['/products', 'PRODUCTS', ProductsPage],
  ['/services', 'SERVICES', ServicesPage],
  ['/estimates', 'ESTIMATES', EstimatesPage],
  ['/estimates/:id', 'ESTIMATES', ServiceOrderPage],
  ['/service-orders', 'SERVICE_ORDERS', ServiceExecutionPage],
  ['/service-orders/:id', 'SERVICE_ORDERS', ServiceExecutionDetailPage],
  ['/employees', 'EMPLOYEES', EmployeesPage],
  ['/schedule', 'SCHEDULE', SchedulePage],
  ['/devices', 'DEVICES', DevicesPage],
  ['/charts', 'REPORTS', ChartsPage],
  ['/settings', 'SETTINGS', SettingsPage],
  ['/kitchen', 'KITCHEN', KitchenPage],
  ['/deliveries', 'DELIVERIES', DeliveriesPage],
]

export default function App() {
  return (
    <Router root={RootLayout}>
      {/* Public pages (S2: authentication). */}
      <Route component={MainLayout}>
        <Route path="/" component={LandingPage} />
        <Route path="/privacidade" component={PrivacyPolicyPage} />
        <Route path="/termos" component={TermsOfUsePage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={() => <LoginPage initialTab="register" />} />
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route path="/verify-email" component={VerifyEmailPage} />
        <Route path="/confirm-email" component={ConfirmEmailPage} />
      </Route>
      {/* Authenticated routes that also allow pending payment users (S7). */}
      <Route component={(props: RouteSectionProps) => <ProtectedRoute allowPending>{props.children}</ProtectedRoute>}>
        <Route path="/plan" component={PlanSelectionPage} />
        <Route path="/payment/success" component={PaymentSuccessPage} />
        {/* The Go API returns cancelled Stripe checkouts here. */}
        <Route path="/payment/cancel" component={() => <Navigate href="/plan" />} />
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
      <Route path="*404" component={NotFoundPage} />
    </Router>
  )
}
