export type BusinessProfile = 'FOOD' | 'STORE' | 'SERVICES'
export type BusinessModule = 'ORDERS' | 'KITCHEN' | 'DELIVERIES' | 'INGREDIENT_INVENTORY' | 'SALES' | 'PRODUCTS' | 'STORE_INVENTORY' | 'SERVICES' | 'ESTIMATES' | 'EMPLOYEES' | 'SCHEDULE' | 'DEVICES' | 'REPORTS' | 'SETTINGS'
export type NavigationModule = Exclude<BusinessModule, 'SERVICES' | 'ESTIMATES' | 'INGREDIENT_INVENTORY' | 'STORE_INVENTORY'>

export const BUSINESS_PROFILES: readonly BusinessProfile[] = ['FOOD', 'STORE', 'SERVICES']
export const BUSINESS_MODULES: readonly BusinessModule[] = [
  'ORDERS', 'KITCHEN', 'DELIVERIES', 'INGREDIENT_INVENTORY', 'SALES', 'PRODUCTS', 'STORE_INVENTORY',
  'SERVICES', 'ESTIMATES', 'EMPLOYEES', 'SCHEDULE', 'DEVICES', 'REPORTS', 'SETTINGS',
]
export const NAVIGATION_MODULES: readonly NavigationModule[] = [
  'ORDERS', 'KITCHEN', 'DELIVERIES', 'SALES', 'PRODUCTS',
  'EMPLOYEES', 'SCHEDULE', 'DEVICES', 'REPORTS', 'SETTINGS',
]

export function canAccessBusinessModule(role: string | undefined, module: NavigationModule): boolean {
  if (role === 'COOK') return module === 'KITCHEN'
  if (role === 'DRIVER') return module === 'DELIVERIES'
  if (role !== 'OWNER' && role !== 'MANAGER' && role !== 'EMPLOYEE') return false
  if (module === 'DEVICES') return role === 'OWNER' || role === 'MANAGER'
  if (module === 'REPORTS') return role !== 'EMPLOYEE'
  return true
}

export const REQUIRED_MODULES: readonly BusinessModule[] = ['SALES', 'PRODUCTS', 'EMPLOYEES', 'DEVICES', 'REPORTS', 'SETTINGS']
export const PROFILE_MODULES: Record<BusinessProfile, readonly BusinessModule[]> = {
  FOOD: ['ORDERS', 'KITCHEN', 'DELIVERIES', 'INGREDIENT_INVENTORY'],
  STORE: ['STORE_INVENTORY'],
  SERVICES: ['SERVICES', 'ESTIMATES'],
}
const OPT_IN_MODULES: readonly BusinessModule[] = ['INGREDIENT_INVENTORY', 'STORE_INVENTORY']

export function modulesForProfiles(profiles: readonly BusinessProfile[], modules: readonly BusinessModule[]): BusinessModule[] {
  const allowed = new Set<BusinessModule>([...REQUIRED_MODULES, 'SCHEDULE'])
  for (const profile of profiles) for (const module of PROFILE_MODULES[profile]) allowed.add(module)
  const selected = new Set<BusinessModule>([...REQUIRED_MODULES, ...modules])
  return BUSINESS_MODULES.filter((module) => allowed.has(module) && selected.has(module))
}

export function suggestedBusinessModules(profiles: readonly BusinessProfile[]): BusinessModule[] {
  const selected = new Set<BusinessModule>(REQUIRED_MODULES)
  for (const profile of profiles) {
    for (const module of PROFILE_MODULES[profile]) if (!OPT_IN_MODULES.includes(module)) selected.add(module)
  }
  if (profiles.includes('FOOD')) selected.add('SCHEDULE')
  return BUSINESS_MODULES.filter((module) => selected.has(module))
}

export function resolveNavigationModules(
  role: string | undefined,
  establishment: { category?: string | null; businessProfiles?: readonly BusinessProfile[]; visibleModules?: readonly BusinessModule[] } | undefined,
): NavigationModule[] {
  if (role === 'COOK') return establishment?.businessProfiles?.includes('FOOD') === false ? [] : ['KITCHEN']
  if (role === 'DRIVER') return establishment?.businessProfiles?.includes('FOOD') === false ? [] : ['DELIVERIES']

  const selected = establishment?.businessProfiles === undefined
    ? new Set<BusinessModule>(NAVIGATION_MODULES)
    : new Set<BusinessModule>(modulesForProfiles(establishment.businessProfiles, establishment.visibleModules?.length
      ? establishment.visibleModules
      : suggestedBusinessModules(establishment.businessProfiles)))
  for (const module of REQUIRED_MODULES) selected.add(module)

  return NAVIGATION_MODULES.filter((module) => {
    if (!selected.has(module)) return false
    return canAccessBusinessModule(role, module)
  })
}
