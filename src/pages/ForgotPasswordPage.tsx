import { createSignal, Show } from "solid-js"
import { createMutation } from "@tanstack/solid-query"
import { toast } from "solid-sonner"

import { forgotPassword } from "@/api/auth"
import { apiErrorOf } from "@/api/errors"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getErrorTranslationKey } from "@/i18n/error-keys"
import { useTranslation } from "@/i18n/solid"
import { normalizeEmail } from "@/lib/authValidation"

export default function ForgotPasswordPage() {
  const { t } = useTranslation("auth")
  const { t: tErrors } = useTranslation("errors")
  const [email, setEmail] = createSignal("")
  const [sentTo, setSentTo] = createSignal<string | null>(null)
  const mutation = createMutation(() => ({ mutationFn: forgotPassword }))

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault()
    const normalized = normalizeEmail(email())
    try {
      await mutation.mutateAsync(normalized)
      // The /v1 answers 202 for any email (no account enumeration), so the
      // message cannot say that the account exists.
      setSentTo(normalized)
    } catch (error) {
      const translation = getErrorTranslationKey("passwordReset", apiErrorOf(error).code)
      toast.error(translation.namespace === "auth" ? t(translation.key) : tErrors(translation.key))
    }
  }

  return (
    <div class="flex-1 flex items-center justify-center bg-muted/40 p-4 min-h-[calc(100vh-10rem)]">
      <Card class="w-full max-w-md">
        <CardHeader><CardTitle>{t("forgotPasswordTitle")}</CardTitle></CardHeader>
        <Show
          when={sentTo()}
          fallback={
            <form onSubmit={handleSubmit}>
              <CardContent class="space-y-2">
                <Label for="forgot-email">{t("email")}</Label>
                <Input id="forgot-email" type="email" required value={email()} onInput={(e) => setEmail(e.currentTarget.value)} />
                <p class="text-xs text-muted-foreground">{t("forgotPasswordHint")}</p>
              </CardContent>
              <CardFooter>
                <Button class="w-full" type="submit" disabled={mutation.isPending}>{t("sendResetLink")}</Button>
              </CardFooter>
            </form>
          }
        >
          {(address) => (
            <CardContent class="space-y-4">
              <p>{t("forgotPasswordEmailSent", { email: address() })}</p>
              <a href="/login" class="text-sm underline">{t("backToLogin")}</a>
            </CardContent>
          )}
        </Show>
      </Card>
    </div>
  )
}
