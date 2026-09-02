import { describe, expect, it } from 'bun:test'
import { authClient } from './authClient'

describe('authClient', () => {
  it('expõe os métodos principais do auth-js', () => {
    expect(typeof authClient.signInWithPassword).toBe('function')
    expect(typeof authClient.signUp).toBe('function')
    expect(typeof authClient.signInWithOAuth).toBe('function')
    expect(typeof authClient.getSession).toBe('function')
    expect(typeof authClient.onAuthStateChange).toBe('function')
    expect(typeof authClient.resetPasswordForEmail).toBe('function')
    expect(typeof authClient.updateUser).toBe('function')
    expect(typeof authClient.mfa.enroll).toBe('function')
  })
})
