// React scenarios (../../../e2e/visual/scenarios.ts) whose screen the Solid app
// already renders. A page joins this list in the phase that ports it.
export const SOLID_SCENARIOS: readonly string[] = [
  // S1: ui/ primitives
  'ui',
  'ui-select-open',
  'ui-dialog',
  'ui-dropdown-open',
  // S2: authentication
  'login',
  'login-register',
  'forgot-password',
  'reset-password',
  // S3: registration (settings full-page, onboarding and devices-error: adjusted.visual.ts)
  'products',
  'products-empty',
  'products-loading',
  'products-error',
  'products-new',
  'products-edit',
  'products-types',
  'products-types-new',
  'employees',
  'employees-empty',
  'employees-loading',
  'employees-error',
  'employees-new',
  'employees-edit',
  'devices',
  'devices-empty',
  'devices-loading',
  'devices-delete-confirm',
  'settings-language-menu',
]
