import { Show, type JSX } from 'solid-js'
import { Navigate } from '@solidjs/router'

import { useAuth } from '@/contexts/AuthContext'
import { canAccessBusinessModule, resolveNavigationModules, type NavigationModule } from '@/domain/businessPreferences'

const MODULE_PATHS: Record<NavigationModule, string> = {
  ORDERS: 'orders', KITCHEN: 'kitchen', DELIVERIES: 'deliveries', SALES: 'sales',
  PRODUCTS: 'products', SERVICES: 'services', ESTIMATES: 'estimates', SERVICE_ORDERS: 'service-orders', EMPLOYEES: 'employees', SCHEDULE: 'schedule',
  DEVICES: 'devices', REPORTS: 'charts', SETTINGS: 'settings',
}

export function DashboardHome() {
  const { user } = useAuth()
  const target = () => {
    const modules = resolveNavigationModules(user()?.role, user()?.establishment)
    if (modules.length === 0) return '/'
    const preferred = modules.includes('ORDERS') ? 'ORDERS' : modules.includes('SALES') ? 'SALES' : modules[0]
    return `/dashboard/${MODULE_PATHS[preferred ?? 'SETTINGS']}`
  }
  return <Navigate href={target()} />
}

export function BusinessModuleRoute(props: { children?: JSX.Element; module: NavigationModule }) {
  const { user } = useAuth()
  const fallback = () => {
    const role = user()?.role
    if (resolveNavigationModules(role, user()?.establishment).length === 0) return '/'
    return role === 'COOK' ? '/dashboard/kitchen'
      : role === 'DRIVER' ? '/dashboard/deliveries'
        : '/dashboard/sales'
  }
  return (
    <Show when={canAccessBusinessModule(user()?.role, props.module)} fallback={<Navigate href={fallback()} />}>
      {props.children}
    </Show>
  )
}
