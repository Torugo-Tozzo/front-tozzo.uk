import { createSignal, Match, onMount, Switch } from "solid-js"
import { useSearchParams } from "@solidjs/router"
import { createMutation } from "@tanstack/solid-query"

import { confirmEmailChange } from "@/api/auth"
import { apiErrorOf } from "@/api/errors"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/contexts/AuthContext"
import { getErrorTranslationKey } from "@/i18n/error-keys"
import { useTranslation } from "@/i18n/solid"

/**
 * The link of the email-change email (FRONTEND_URL/confirm-email?token=…),
 * sent to the new address. Works signed in or out. Same layout as
 * ForgotPasswordPage.
 */
export default function ConfirmEmailPage() {
  const { t } = useTranslation("auth")
  const { t: tErrors } = useTranslation("errors")
  const { isAuthenticated, refreshUserProfile } = useAuth()
  const [searchParams] = useSearchParams()
  const token = typeof searchParams.token === "string" ? searchParams.token : ""
  const mutation = createMutation(() => ({ mutationFn: confirmEmailChange }))
  const [done, setDone] = createSignal(false)
  const [failedCode, setFailedCode] = createSignal<string | undefined>(token ? undefined : "TOKEN_INVALID")

  const failureMessage = (code: string) => {
    const translation = getErrorTranslationKey("emailChange", code)
    return translation.namespace === "auth" ? t(translation.key) : tErrors(translation.key)
  }

  onMount(() => {
    if (!token) return
    mutation.mutateAsync(token)
      .then(() => {
        setDone(true)
        // A signed-in user sees the new address right away.
        if (isAuthenticated()) void refreshUserProfile()
      })
      .catch((error) => setFailedCode(apiErrorOf(error).code))
  })

  return (
    <div class="flex-1 flex items-center justify-center bg-muted/40 p-4 min-h-[calc(100vh-10rem)]">
      <Card class="w-full max-w-md">
        <CardHeader><CardTitle>{t("confirmEmailChangeTitle")}</CardTitle></CardHeader>
        <CardContent class="space-y-4">
          <Switch fallback={<p role="status">{t("confirmEmailChangeChecking")}</p>}>
            <Match when={done()}>
              <p>{t("confirmEmailChangeSuccess")}</p>
              <a href="/login" class="text-sm underline">{t("backToLogin")}</a>
            </Match>
            <Match when={failedCode()}>
              {(code) => (
                <>
                  <p>{failureMessage(code())}</p>
                  <a href="/login" class="text-sm underline">{t("backToLogin")}</a>
                </>
              )}
            </Match>
          </Switch>
        </CardContent>
      </Card>
    </div>
  )
}
