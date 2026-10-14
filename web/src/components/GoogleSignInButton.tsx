import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js"

import { GoogleIcon } from "@/components/icons/GoogleIcon"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { normalizeLocale } from "@/i18n/locale"
import { useTranslation } from "@/i18n/solid"
import {
  bindGoogleCredential,
  GOOGLE_CLIENT_ID,
  loadGoogleIdentity,
  type GoogleAccountsId,
} from "@/lib/google-identity"

interface GoogleSignInButtonProps {
  /** Receives the Google ID token (for POST /v1/auth/google). */
  onCredential: (idToken: string) => void
  /** The script did not load or the prompt failed. */
  onError?: () => void
}

/**
 * Google Identity Services button. Until GSI draws its own button, the React
 * app's button stands in its place (same size, so the card does not jump);
 * clicking it opens the GSI prompt. Without a client ID nothing renders.
 */
export function GoogleSignInButton(props: GoogleSignInButtonProps) {
  return (
    <Show when={GOOGLE_CLIENT_ID}>
      <GsiButton {...props} />
    </Show>
  )
}

function GsiButton(props: GoogleSignInButtonProps) {
  const { t, language } = useTranslation("auth")
  const { theme } = useTheme()
  const [gsi, setGsi] = createSignal<GoogleAccountsId>()
  const [rendered, setRendered] = createSignal(false)
  let wrapper!: HTMLDivElement
  let slot!: HTMLDivElement
  let disposed = false
  onCleanup(() => { disposed = true })

  onMount(() => {
    loadGoogleIdentity()
      .then((id) => {
        if (disposed) return
        bindGoogleCredential(id, (idToken) => props.onCredential(idToken))
        setGsi(id)
      })
      .catch(() => {
        // Blocked or offline: the stand-in button stays and reports on click.
      })
  })

  // Draws (and redraws on a language or theme change) Google's button.
  createEffect(() => {
    const id = gsi()
    if (!id) return
    theme()
    const dark = document.documentElement.classList.contains("dark")
    slot.replaceChildren()
    id.renderButton(slot, {
      type: "standard",
      theme: dark ? "filled_black" : "outline",
      size: "large",
      text: "signin_with",
      shape: "rectangular",
      logo_alignment: "center",
      // GSI accepts 200 to 400 px.
      width: Math.max(200, Math.min(400, wrapper.offsetWidth || 400)),
      locale: normalizeLocale(language()),
    })
    setRendered(slot.childElementCount > 0)
  })

  const promptFallback = () => {
    const id = gsi()
    if (id) id.prompt()
    else props.onError?.()
  }

  return (
    <div ref={wrapper} class="w-full">
      <Show when={!rendered()}>
        <Button type="button" variant="outline" class="w-full" onClick={promptFallback}>
          <GoogleIcon class="h-4 w-4 mr-2" />
          {t("continueWithGoogle")}
        </Button>
      </Show>
      <div ref={slot} class={rendered() ? "flex w-full justify-center" : "hidden"} data-testid="google-signin-slot" />
    </div>
  )
}
