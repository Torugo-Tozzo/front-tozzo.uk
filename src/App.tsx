import { Suspense } from 'react'
import { createBrowserRouter, RouterProvider, Outlet, useNavigation } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import DashboardLayout from './layouts/DashboardLayout'
import MainLayout from './layouts/MainLayout'
import { LoadingOverlay } from './components/LoadingOverlay'

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
      {isNavigating && <LoadingOverlay />}
      <Suspense fallback={<LoadingOverlay />}>
        <Outlet />
      </Suspense>
    </AuthProvider>
  )
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        element: <MainLayout />,
        children: [
          { path: "/", lazy: lazyPage(() => import('./pages/LandingPage')) },
          { path: "/login", lazy: lazyPage(() => import('./pages/LoginPage')) },
        ]
      },
      // Rotas que exigem autenticação mas permitem status PENDENTE_PAGAMENTO
      {
        element: <ProtectedRoute allowPending={true} />,
        children: [
          { path: "/plan", lazy: lazyPage(() => import('./pages/PlanSelectionPage')) },
          { path: "/payment/success", lazy: lazyPage(() => import('./pages/PaymentSuccessPage')) },
        ]
      },
      // Rotas do Dashboard (exigem status ATIVO)
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
