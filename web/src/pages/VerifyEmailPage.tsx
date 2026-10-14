import { createEffect, createSignal, on, Show } from "solid-js"
import { useNavigate, useSearchParams } from "@solidjs/router"
import { createMutation } from "@tanstack/solid-query"

import { verifyEmail } from "@/api/auth"
import { apiErrorOf } from "@/api/errors"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/contexts/AuthContext"
import { getErrorTranslationKey } from "@/i18n/error-keys"
import { useTranslation } from "@/i18n/solid"

/**
 * The link of the sign-up email (FRONTEND_URL/verify-email?token=…). The /v1
 * confirms the email and opens the session in one call; then the user goes
 * where the login would send them. Same layout as ForgotPasswordPage.
 */
export default function VerifyEmailPage() {
  const { t } = useTranslation("auth")
  const { t: tErrors } = useTranslation("errors")
  const navigate = useNavigate()
  const { isLoading: isAuthLoading, establishSession } = useAuth()
  const [searchParams] = useSearchParams()
  const token = typeof searchParams.token === "string" ? searchParams.token : ""
  const mutation = createMutation(() => ({ mutationFn: verifyEmail }))
  // The API code of the failure (a missing token reads as an invalid one).
  const [failedCode, setFailedCode] = createSignal<string | undefined>(token ? undefined : "TOKEN_INVALID")

  const failureMessage = (code: string) => {
    const translation = getErrorTranslationKey("emailVerification", code)
    return translation.namespace === "auth" ? t(translation.key) : tErrors(translation.key)
  }

  // The token is single use: it is sent once, after the boot refresh settled
  // (a refresh failing late would otherwise sign the new session out).
  let sent = false
  createEffect(on(isAuthLoading, (loading) => {
    if (loading || !token || sent) return
    sent = true
    mutation.mutateAsync(token)
      .then((session) => {
        establishSession(session)
        navigate(session.user.establishment?.status === "ACTIVE" ? "/dashboard" : "/plan", { replace: true })
      })
      .catch((error) => setFailedCode(apiErrorOf(error).code))
  }))

  return (
    <div class="flex-1 flex items-center justify-center bg-muted/40 p-4 min-h-[calc(100vh-10rem)]">
      <Card class="w-full max-w-md">
        <CardHeader><CardTitle>{t("confirmEmailTitle")}</CardTitle></CardHeader>
        <CardContent class="space-y-4">
          <Show when={failedCode()} fallback={<p role="status">{t("verifyEmailChecking")}</p>}>
            {(code) => (
              <>
                <p>{failureMessage(code())}</p>
                <a href="/login" class="text-sm underline">{t("backToLogin")}</a>
              </>
            )}
          </Show>
        </CardContent>
      </Card>
    </div>
  )
}
