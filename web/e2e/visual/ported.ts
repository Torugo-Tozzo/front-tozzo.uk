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
]
