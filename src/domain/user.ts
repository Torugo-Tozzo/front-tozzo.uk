import type { Me } from '@/api/session'
import type { BusinessModule, BusinessProfile } from './businessPreferences'

export type Role = Me['role']

export interface Establishment {
  id: string
  tradeName: string
  status: Me['establishment']['status']
  plan: Me['establishment']['plan']
  category: Me['establishment']['category']
  /** undefined: an establishment from before business profiles (legacy menu). */
  businessProfiles?: BusinessProfile[]
  visibleModules?: BusinessModule[]
  preferencesRevision: number
}

export interface User {
  id: string
  name: string
  email: string
  role: Role
  establishment?: Establishment
}

/** GET /v1/me (or the session body) as the screens use it. */
export function toUser(me: Me): User {
  const establishment = me.establishment
  return {
    id: me.id,
    name: me.name,
    email: me.email,
    role: me.role,
    establishment: establishment
      ? {
          id: establishment.id,
          tradeName: establishment.tradeName,
          status: establishment.status,
          plan: establishment.plan,
          category: establishment.category,
          businessProfiles: (establishment.businessProfiles ?? undefined) as BusinessProfile[] | undefined,
          visibleModules: (establishment.visibleModules ?? undefined) as BusinessModule[] | undefined,
          preferencesRevision: establishment.preferencesRevision,
        }
      : undefined,
  }
}
