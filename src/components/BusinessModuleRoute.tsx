import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { canAccessBusinessModule, resolveNavigationModules, type NavigationModule } from '@/domain/businessPreferences'

const MODULE_PATHS: Record<NavigationModule, string> = {
  ORDERS: 'orders', KITCHEN: 'kitchen', DELIVERIES: 'deliveries', SALES: 'sales',
  PRODUCTS: 'products', EMPLOYEES: 'employees', SCHEDULE: 'schedule',
  DEVICES: 'devices', REPORTS: 'charts', SETTINGS: 'settings',
}

export function DashboardHome() {
  const { user } = useAuth()
  const modules = resolveNavigationModules(user?.role, user?.establishment)
  if (modules.length === 0) return <Navigate to="/" replace />
  const preferred = modules.includes('ORDERS') ? 'ORDERS' : modules.includes('SALES') ? 'SALES' : modules[0]
  return <Navigate to={`/dashboard/${MODULE_PATHS[preferred ?? 'SETTINGS']}`} replace />
}

export function BusinessModuleRoute({ children, module }: { children: ReactNode; module: NavigationModule }) {
  const { user } = useAuth()
  if (!canAccessBusinessModule(user?.role, module)) {
    if (resolveNavigationModules(user?.role, user?.establishment).length === 0) return <Navigate to="/" replace />
    const fallback = user?.role === 'COOK' ? '/dashboard/kitchen'
      : user?.role === 'DRIVER' ? '/dashboard/deliveries'
        : '/dashboard/sales'
    return <Navigate to={fallback} replace />
  }
  return <>{children}</>
}
