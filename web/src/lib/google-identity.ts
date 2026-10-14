// Google Identity Services (GSI): the button returns an ID token, which goes to
// POST /v1/auth/google. The script loads only on the auth pages, on demand.

// Public by nature (it identifies the app to Google); VITE_GOOGLE_CLIENT_ID
// overrides it, and an empty value hides the button.
export const GOOGLE_CLIENT_ID: string =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '344765290986-k2pdrbu5g90hi2b2bpr84olbe3q8nrak.apps.googleusercontent.com'

export const GSI_SCRIPT_URL = 'https://accounts.google.com/gsi/client'

export interface GsiButtonOptions {
  type?: 'standard' | 'icon'
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  size?: 'large' | 'medium' | 'small'
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
  shape?: 'rectangular' | 'pill' | 'circle' | 'square'
  logo_alignment?: 'left' | 'center'
  width?: number
  locale?: string
}

export interface GoogleAccountsId {
  initialize(config: {
    client_id: string
    callback: (response: { credential: string }) => void
    ux_mode?: 'popup' | 'redirect'
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
    use_fedcm_for_prompt?: boolean
  }): void
  renderButton(parent: HTMLElement, options: GsiButtonOptions): void
  prompt(): void
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } }
  }
}

let loading: Promise<GoogleAccountsId> | null = null

/** Loads the GSI script once; a failed load can be retried. */
export function loadGoogleIdentity(): Promise<GoogleAccountsId> {
  const ready = window.google?.accounts?.id
  if (ready) return Promise.resolve(ready)
  loading ??= new Promise<GoogleAccountsId>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GSI_SCRIPT_URL
    script.async = true
    script.defer = true
    const fail = () => {
      loading = null
      script.remove()
      reject(new Error('Google Identity Services did not load'))
    }
    script.onload = () => {
      const id = window.google?.accounts?.id
      if (id) resolve(id)
      else fail()
    }
    script.onerror = fail
    document.head.appendChild(script)
  })
  return loading
}

// One initialize per page load, whose callback reaches the button mounted last
// (the login and register tabs each have one, but only one is on screen).
let initializedFor: GoogleAccountsId | null = null
let onCredential: ((idToken: string) => void) | null = null

export function bindGoogleCredential(id: GoogleAccountsId, handler: (idToken: string) => void) {
  onCredential = handler
  if (initializedFor === id) return
  initializedFor = id
  id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (response) => onCredential?.(response.credential),
    ux_mode: 'popup',
    use_fedcm_for_prompt: true,
  })
}

/** Test hook: forget the loaded script and the initialized client. */
export function resetGoogleIdentity() {
  loading = null
  initializedFor = null
  onCredential = null
}
