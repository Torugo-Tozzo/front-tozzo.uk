import { api } from './client'
import { unwrap } from './errors'
import type { components } from './schema'
import type { SessionBody } from './session'

type RegisterRequest = components['schemas']['RegisterRequest']
type GoogleSignInRequest = components['schemas']['GoogleSignInRequest']

// Calls that open a session must send credentials: the answer sets the
// HttpOnly refresh cookie (tozzo_rt), which a cross-site fetch drops otherwise.
const withCookie = { credentials: 'include' } as const

export async function login(email: string, password: string): Promise<SessionBody> {
  return unwrap(await api.POST('/v1/auth/login', { body: { email, password, client: 'web' }, ...withCookie }))
}

export async function register(body: Omit<RegisterRequest, 'client'>): Promise<void> {
  unwrap(await api.POST('/v1/auth/register', { body: { ...body, client: 'web' } }))
}

export async function googleSignIn(body: Omit<GoogleSignInRequest, 'client'>): Promise<SessionBody> {
  return unwrap(await api.POST('/v1/auth/google', { body: { ...body, client: 'web' }, ...withCookie }))
}

export async function verifyEmail(token: string): Promise<SessionBody> {
  return unwrap(await api.POST('/v1/auth/verify-email', { body: { token, client: 'web' }, ...withCookie }))
}

export async function resendVerification(email: string): Promise<void> {
  unwrap(await api.POST('/v1/auth/resend-verification', { body: { email } }))
}

export async function validateRegistrationKey(registrationKey: string): Promise<boolean> {
  return unwrap(await api.POST('/v1/auth/registration-key/validate', { body: { registrationKey } })).valid
}

export async function forgotPassword(email: string): Promise<void> {
  unwrap(await api.POST('/v1/auth/password/forgot', { body: { email } }))
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  unwrap(await api.POST('/v1/auth/password/reset', { body: { token, newPassword } }))
}

export async function confirmEmailChange(token: string): Promise<void> {
  unwrap(await api.POST('/v1/auth/email/confirm', { body: { token } }))
}

/** Revokes this session and clears the refresh cookie (needs the bearer token). */
export async function logout(): Promise<void> {
  unwrap(await api.POST('/v1/auth/logout', { body: {}, ...withCookie }))
}
