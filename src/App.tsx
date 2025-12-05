import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import DashboardLayout from './layouts/DashboardLayout'
import MainLayout from './layouts/MainLayout'
import SalesPage from './pages/dashboard/SalesPage'
import ProductsPage from './pages/dashboard/ProductsPage'
import HistoryPage from './pages/dashboard/HistoryPage'
import SettingsPage from './pages/dashboard/SettingsPage'
import OrdersPage from './pages/dashboard/OrdersPage'
import EmployeesPage from './pages/dashboard/EmployeesPage'
import ChartsPage from './pages/dashboard/ChartsPage'

function App() {
  return (
    <Router>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
        </Route>
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
      </Routes>
    </Router>
  )
}

export default App
