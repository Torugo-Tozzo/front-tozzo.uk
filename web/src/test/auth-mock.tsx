import { createSignal, type JSX } from 'solid-js'
import { vi } from 'vitest'

import type { AuthContextType } from '@/contexts/AuthContext'
import type { User } from '@/domain/user'

// A stand-in for @/contexts/AuthContext in page tests:
//   vi.mock('@/contexts/AuthContext', () => import('@/test/auth-mock'))
// then setMockUser(...) in the test.
const [mockUser, setMockUserSignal] = createSignal<User | null>(null)

export const authMocks = {
  logout: vi.fn(async () => {}),
  refreshUserProfile: vi.fn(async () => {}),
  establishSession: vi.fn(),
  clearSession: vi.fn(),
}

export function setMockUser(user: Partial<User> & { role: User['role'] } | null) {
  setMockUserSignal(() => (user ? ({ id: 'usr-test', name: 'Ana', email: 'ana@example.test', ...user } as User) : null))
}

export function resetAuthMocks() {
  for (const mock of Object.values(authMocks)) mock.mockClear()
  authMocks.refreshUserProfile.mockImplementation(async () => {})
  setMockUser(null)
}

export function useAuth(): AuthContextType {
  return {
    isAuthenticated: () => mockUser() !== null,
    user: mockUser,
    isLoading: () => false,
    ...authMocks,
  }
}

export function AuthProvider(props: { children?: JSX.Element }) {
  return props.children
}
