// Minimum of the /v1 (api-tozzo.uk, auth phase 2): 8 to 128 characters.
// The React app used GoTrue's 6.
export const MIN_PASSWORD_LENGTH = 8

export const normalizeEmail = (email: string) => email.trim().toLowerCase()
