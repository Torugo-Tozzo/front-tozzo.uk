import { Suspense } from 'react'
import { createBrowserRouter, RouterProvider, Outlet, useNavigation } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ConfirmProvider } from './contexts/ConfirmContext'
import ProtectedRoute from './components/ProtectedRoute'
import DashboardLayout from './layouts/DashboardLayout'
import MainLayout from './layouts/MainLayout'
import { LoadingOverlay } from './components/LoadingOverlay'
import { Toaster } from 'sonner'

// Helper to convert default export to route.lazy object
// This enables React Router to know about the loading state
function lazyPage(importFn: () => Promise<any>) {
  return async () => {
    const module = await importFn();
    return { Component: module.default };
  };
}

function RootLayout() {
  const navigation = useNavigation();
  const isNavigating = navigation.state !== 'idle';

  return (
    <AuthProvider>
      <ConfirmProvider>
        <Toaster position="top-right" richColors closeButton />
        {isNavigating && <LoadingOverlay />}
        <Suspense fallback={<LoadingOverlay />}>
          <Outlet />
        </Suspense>
      </ConfirmProvider>
    </AuthProvider>
  )
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    HydrateFallback: LoadingOverlay,
    children: [
      {
        element: <MainLayout />,
        children: [
          { path: "/", lazy: lazyPage(() => import('./pages/LandingPage')) },
          { path: "/login", lazy: lazyPage(() => import('./pages/LoginPage')) },
          { path: "/forgot-password", lazy: lazyPage(() => import('./pages/ForgotPasswordPage')) },
          { path: "/reset-password", lazy: lazyPage(() => import('./pages/ResetPasswordPage')) },
          { path: "/privacidade", lazy: lazyPage(() => import('./pages/PrivacyPolicyPage')) },
          { path: "/termos", lazy: lazyPage(() => import('./pages/TermsOfUsePage')) },
        ]
      },
      // Authenticated routes that also allow pending payment users.
      {
        element: <ProtectedRoute allowPending={true} />,
        children: [
          { path: "/plan", lazy: lazyPage(() => import('./pages/PlanSelectionPage')) },
          { path: "/payment/success", lazy: lazyPage(() => import('./pages/PaymentSuccessPage')) },
        ]
      },
      // Dashboard routes require an active establishment.
      {
        element: <ProtectedRoute />,
        children: [
          {
            path: "/dashboard",
            element: <DashboardLayout />,
            children: [
              { index: true, lazy: lazyPage(() => import('./pages/dashboard/OrdersPage')) },
              { path: "orders", lazy: lazyPage(() => import('./pages/dashboard/OrdersPage')) },
              { path: "sales", lazy: lazyPage(() => import('./pages/dashboard/SalesPage')) },
              { path: "products", lazy: lazyPage(() => import('./pages/dashboard/ProductsPage')) },
              { path: "employees", lazy: lazyPage(() => import('./pages/dashboard/EmployeesPage')) },
              { path: "devices", lazy: lazyPage(() => import('./pages/dashboard/DevicesPage')) },
              { path: "charts", lazy: lazyPage(() => import('./pages/dashboard/ChartsPage')) },
              { path: "settings", lazy: lazyPage(() => import('./pages/dashboard/SettingsPage')) },
            ]
          }
        ]
      },
      // Rota 404
      { path: "*", lazy: lazyPage(() => import('./pages/NotFoundPage')) }
    ]
  }
])

function App() {
  return <RouterProvider router={router} />
}

export default App
