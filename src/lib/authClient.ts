import { AuthClient } from '@supabase/auth-js'

const AUTH_URL = import.meta.env.VITE_AUTH_URL || 'http://localhost:9999'

export const authClient = new AuthClient({
  url: AUTH_URL,
  storage: window.localStorage,
  persistSession: true,
  autoRefreshToken: true,
})
