import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import PlanSelectionPage from './pages/PlanSelectionPage'
import PaymentSuccessPage from './pages/PaymentSuccessPage'
import DashboardLayout from './layouts/DashboardLayout'
import MainLayout from './layouts/MainLayout'
import SalesPage from './pages/dashboard/SalesPage'
import ProductsPage from './pages/dashboard/ProductsPage'
import HistoryPage from './pages/dashboard/HistoryPage'
import SettingsPage from './pages/dashboard/SettingsPage'
import OrdersPage from './pages/dashboard/OrdersPage'
import EmployeesPage from './pages/dashboard/EmployeesPage'
import ChartsPage from './pages/dashboard/ChartsPage'
import NotFoundPage from './pages/NotFoundPage'

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
          </Route>
          
          {/* Rotas que exigem autenticação mas permitem status PENDENTE_PAGAMENTO */}
          <Route element={<ProtectedRoute allowPending={true} />}>
            <Route path="/plan" element={<PlanSelectionPage />} />
            <Route path="/payment/success" element={<PaymentSuccessPage />} />
          </Route>

          {/* Rotas do Dashboard (exigem status ATIVO) */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<OrdersPage />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="sales" element={<SalesPage />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="employees" element={<EmployeesPage />} />
              <Route path="charts" element={<ChartsPage />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>

          {/* Rota 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App
