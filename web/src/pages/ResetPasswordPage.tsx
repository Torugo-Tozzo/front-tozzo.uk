import { createSignal, Show } from "solid-js"
import { useNavigate, useSearchParams } from "@solidjs/router"
import { createMutation } from "@tanstack/solid-query"
import { toast } from "solid-sonner"

import { resetPassword } from "@/api/auth"
import { apiErrorOf } from "@/api/errors"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/contexts/AuthContext"
import { getErrorTranslationKey } from "@/i18n/error-keys"
import { useTranslation } from "@/i18n/solid"
import { MIN_PASSWORD_LENGTH } from "@/lib/authValidation"

type LinkState = "ready" | "invalid"

export default function ResetPasswordPage() {
  const { t } = useTranslation("auth")
  const { t: tErrors } = useTranslation("errors")
  const navigate = useNavigate()
  const { clearSession } = useAuth()
  const [searchParams] = useSearchParams()
  // The email link is FRONTEND_URL/reset-password?token=…; without a token the
  // page says the link is no longer valid, like the React one.
  const token = typeof searchParams.token === "string" ? searchParams.token : ""
  const [password, setPassword] = createSignal("")
  const [confirmPassword, setConfirmPassword] = createSignal("")
  const [linkState, setLinkState] = createSignal<LinkState>(token ? "ready" : "invalid")
  const mutation = createMutation(() => ({
    mutationFn: (newPassword: string) => resetPassword(token, newPassword),
  }))

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault()
    if (password() !== confirmPassword()) { toast.error(t("passwordsDontMatch")); return }
    try {
      await mutation.mutateAsync(password())
    } catch (error) {
      const { code } = apiErrorOf(error)
      // Expired or used: the API only checks it on submit.
      if (code === "TOKEN_INVALID") { setLinkState("invalid"); return }
      const translation = getErrorTranslationKey("passwordReset", code)
      toast.error(translation.namespace === "auth" ? t(translation.key) : tErrors(translation.key))
      return
    }
    // The reset revokes every session of the user, this one included.
    clearSession()
    toast.success(t("resetPasswordSuccess"))
    navigate("/login")
  }

  return (
    <div class="flex-1 flex items-center justify-center bg-muted/40 p-4 min-h-[calc(100vh-10rem)]">
      <Card class="w-full max-w-md">
        <CardHeader><CardTitle>{t("resetPasswordTitle")}</CardTitle></CardHeader>
        <Show
          when={linkState() === "ready"}
          fallback={
            <CardContent class="space-y-4">
              <p>{t("resetLinkInvalid")}</p>
              <a href="/forgot-password" class="text-sm underline">{t("requestNewResetLink")}</a>
            </CardContent>
          }
        >
          <form onSubmit={handleSubmit}>
            <CardContent class="space-y-2">
              <Label for="new-password">{t("newPassword")}</Label>
              <Input id="new-password" type="password" required minLength={MIN_PASSWORD_LENGTH} aria-describedby="new-password-hint" value={password()} onInput={(e) => setPassword(e.currentTarget.value)} />
              <p id="new-password-hint" class="text-xs text-muted-foreground">{t("passwordHint", { min: MIN_PASSWORD_LENGTH })}</p>
              <Label for="confirm-password">{t("confirmPassword")}</Label>
              <Input id="confirm-password" type="password" required minLength={MIN_PASSWORD_LENGTH} value={confirmPassword()} onInput={(e) => setConfirmPassword(e.currentTarget.value)} />
            </CardContent>
            <CardFooter>
              <Button class="w-full" type="submit" disabled={mutation.isPending}>{t("resetPassword")}</Button>
            </CardFooter>
          </form>
        </Show>
      </Card>
    </div>
  )
}
