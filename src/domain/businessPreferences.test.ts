import { describe, expect, it } from 'bun:test'
import { canAccessBusinessModule, resolveNavigationModules, suggestedBusinessModules } from './businessPreferences'

describe('business module navigation', () => {
  it('keeps the current restaurant menu for a legacy establishment', () => {
    expect(resolveNavigationModules('OWNER', { category: 'HAMBURGUERIA' })).toEqual([
      'ORDERS', 'KITCHEN', 'DELIVERIES', 'SALES', 'PRODUCTS',
      'EMPLOYEES', 'SCHEDULE', 'DEVICES', 'REPORTS', 'SETTINGS',
    ])
  })

  it('suggests both food and service modules for combined profiles', () => {
    expect(suggestedBusinessModules(['FOOD', 'SERVICES'])).toContain('KITCHEN')
    expect(suggestedBusinessModules(['FOOD', 'SERVICES'])).toContain('SERVICES')
    expect(suggestedBusinessModules(['FOOD', 'SERVICES'])).toContain('ESTIMATES')
    expect(suggestedBusinessModules(['SERVICES'])).toContain('SERVICE_ORDERS')
    expect(suggestedBusinessModules(['STORE'])).toEqual(['SALES', 'PRODUCTS', 'EMPLOYEES', 'DEVICES', 'REPORTS', 'SETTINGS'])
  })

  it('leaves store and ingredient stock unchecked until the owner selects them', () => {
    expect(suggestedBusinessModules(['FOOD', 'STORE'])).not.toContain('INGREDIENT_INVENTORY')
    expect(suggestedBusinessModules(['FOOD', 'STORE'])).not.toContain('STORE_INVENTORY')
  })

  it('shows only available store and shared modules selected by the owner', () => {
    expect(resolveNavigationModules('OWNER', {
      businessProfiles: ['STORE'],
      visibleModules: ['SALES', 'SETTINGS'],
    })).toEqual(['SALES', 'PRODUCTS', 'EMPLOYEES', 'DEVICES', 'REPORTS', 'SETTINGS'])
  })

  it('adds Services and Estimates for service profiles without granting them to specialist roles', () => {
    const establishment = { businessProfiles: ['SERVICES'] as const, visibleModules: ['SERVICES', 'ESTIMATES'] as const }
    expect(resolveNavigationModules('OWNER', establishment)).toContain('SERVICES')
    expect(resolveNavigationModules('MANAGER', establishment)).toContain('ESTIMATES')
    expect(resolveNavigationModules('EMPLOYEE', establishment)).toContain('SERVICES')
    expect(canAccessBusinessModule('COOK', 'SERVICES')).toBe(false)
    expect(canAccessBusinessModule('DRIVER', 'ESTIMATES')).toBe(false)
  })

  it('does not show food modules left in saved preferences after food is disabled', () => {
    expect(resolveNavigationModules('OWNER', {
      businessProfiles: ['STORE'],
      visibleModules: ['ORDERS', 'KITCHEN', 'DELIVERIES', 'SALES', 'SCHEDULE'],
    })).toEqual(['SALES', 'PRODUCTS', 'EMPLOYEES', 'SCHEDULE', 'DEVICES', 'REPORTS', 'SETTINGS'])
  })

  it('keeps all standard modules when a member hides the food modules', () => {
    expect(resolveNavigationModules('MANAGER', {
      businessProfiles: ['FOOD'], visibleModules: ['SALES', 'SETTINGS'],
    })).toEqual(['SALES', 'PRODUCTS', 'EMPLOYEES', 'DEVICES', 'REPORTS', 'SETTINGS'])
  })

  it('keeps specialised roles restricted to their operational screen', () => {
    const establishment = { businessProfiles: ['STORE'] as const, visibleModules: ['SALES', 'SETTINGS'] as const }
    expect(resolveNavigationModules('COOK', establishment)).toEqual([])
    expect(resolveNavigationModules('DRIVER', establishment)).toEqual([])
    expect(resolveNavigationModules('COOK', { businessProfiles: ['FOOD'] })).toEqual(['KITCHEN'])
    expect(resolveNavigationModules('DRIVER', { businessProfiles: ['FOOD'] })).toEqual(['DELIVERIES'])
  })

  it('keeps direct URLs role protected even when a module is visible to the establishment', () => {
    expect(canAccessBusinessModule('COOK', 'SERVICE_ORDERS')).toBe(false)
    expect(canAccessBusinessModule('DRIVER', 'SERVICE_ORDERS')).toBe(false)
    expect(canAccessBusinessModule('EMPLOYEE', 'SERVICE_ORDERS')).toBe(true)
    expect(canAccessBusinessModule('COOK', 'ORDERS')).toBe(false)
    expect(canAccessBusinessModule('COOK', 'KITCHEN')).toBe(true)
    expect(canAccessBusinessModule('DRIVER', 'KITCHEN')).toBe(false)
    expect(canAccessBusinessModule('DRIVER', 'DELIVERIES')).toBe(true)
    expect(canAccessBusinessModule('EMPLOYEE', 'REPORTS')).toBe(false)
    expect(canAccessBusinessModule('OWNER', 'REPORTS')).toBe(true)
    expect(canAccessBusinessModule('CUSTOMER', 'ORDERS')).toBe(false)
    expect(canAccessBusinessModule('UNKNOWN', 'SALES')).toBe(false)
  })

  it('allows execution independently of catalog visibility and respects owner opt-out', () => {
    expect(resolveNavigationModules('OWNER', {
      businessProfiles: ['SERVICES'], visibleModules: ['ESTIMATES', 'SERVICE_ORDERS'],
    })).toContain('SERVICE_ORDERS')
    expect(resolveNavigationModules('OWNER', {
      businessProfiles: ['SERVICES'], visibleModules: ['ESTIMATES'],
    })).not.toContain('SERVICE_ORDERS')
  })
})
