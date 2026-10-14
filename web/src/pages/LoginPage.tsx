import { createEffect, createSignal, onCleanup, Show } from "solid-js"
import { useNavigate, useSearchParams } from "@solidjs/router"
import { createMutation } from "@tanstack/solid-query"
import { toast } from "solid-sonner"

import * as authApi from "@/api/auth"
import { apiErrorOf } from "@/api/errors"
import { GoogleSignInButton } from "@/components/GoogleSignInButton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import logo from "@/assets/images/logo.svg"
import { useAuth } from "@/contexts/AuthContext"
import { getErrorTranslationKey } from "@/i18n/error-keys"
import { normalizeLocale } from "@/i18n/locale"
import { useTranslation } from "@/i18n/solid"
import { Trans } from "@/i18n/trans"
import { MIN_PASSWORD_LENGTH, normalizeEmail } from "@/lib/authValidation"
import { GOOGLE_CLIENT_ID } from "@/lib/google-identity"

type Tab = "login" | "register"

const RESEND_COOLDOWN_SECONDS = 60

export default function LoginPage(props: { initialTab?: Tab }) {
  const navigate = useNavigate()
  const { isAuthenticated, user, isLoading: isAuthLoading, establishSession } = useAuth()
  const { t: tAuth, language } = useTranslation("auth")
  const { t: tErrors } = useTranslation("errors")
  const [searchParams] = useSearchParams()
  const initialTab: Tab = props.initialTab ?? (searchParams.tab === "register" ? "register" : "login")
  const [activeTab, setActiveTab] = createSignal<Tab>(initialTab)

  const translateError = (context: "login" | "registration", error: unknown) => {
    const translation = getErrorTranslationKey(context, apiErrorOf(error).code)
    return translation.namespace === "auth"
      ? tAuth(translation.key)
      : tErrors(translation.key)
  }

  // Signed in (here, by Google, or by a session restored on boot): an active
  // establishment goes to the dashboard, any other status to plan selection.
  // Waits for the boot refresh, so the decision uses the loaded establishment.
  createEffect(() => {
    if (isAuthenticated() && !isAuthLoading()) {
      navigate(user()?.establishment?.status === "ACTIVE" ? "/dashboard" : "/plan", { replace: true })
    }
  })

  // Login state
  const [loginEmail, setLoginEmail] = createSignal("")
  const [loginPassword, setLoginPassword] = createSignal("")

  // Register state
  const [registerName, setRegisterName] = createSignal("") // owner's name
  const [registerEstablishment, setRegisterEstablishment] = createSignal("") // trade name
  const [registerEmail, setRegisterEmail] = createSignal("")
  const [registerPassword, setRegisterPassword] = createSignal("")
  const [registrationKey, setRegistrationKey] = createSignal("")
  const [hasKey, setHasKey] = createSignal(false)
  const [termsAccepted, setTermsAccepted] = createSignal(false)
  // Email waiting for confirmation (sign-up just sent, or login refused with
  // EMAIL_NOT_VERIFIED): shows the notice with the resend option.
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = createSignal<string | null>(null)
  const [resendCooldown, setResendCooldown] = createSignal(0)

  let cooldownTimer: ReturnType<typeof setInterval> | undefined
  const startCooldown = () => {
    setResendCooldown(RESEND_COOLDOWN_SECONDS)
    clearInterval(cooldownTimer)
    cooldownTimer = setInterval(() => {
      setResendCooldown((seconds) => {
        if (seconds <= 1) clearInterval(cooldownTimer)
        return Math.max(0, seconds - 1)
      })
    }, 1000)
  }
  onCleanup(() => clearInterval(cooldownTimer))

  const loginMutation = createMutation(() => ({
    mutationFn: (input: { email: string; password: string }) => authApi.login(input.email, input.password),
  }))
  const keyMutation = createMutation(() => ({ mutationFn: authApi.validateRegistrationKey }))
  const registerMutation = createMutation(() => ({ mutationFn: authApi.register }))
  const resendMutation = createMutation(() => ({ mutationFn: authApi.resendVerification }))
  const googleMutation = createMutation(() => ({ mutationFn: authApi.googleSignIn }))

  const isLoading = () =>
    loginMutation.isPending || keyMutation.isPending || registerMutation.isPending ||
    resendMutation.isPending || googleMutation.isPending

  const handleLogin = async (e: SubmitEvent) => {
    e.preventDefault()
    const email = normalizeEmail(loginEmail())
    try {
      establishSession(await loginMutation.mutateAsync({ email, password: loginPassword() }))
    } catch (error) {
      if (apiErrorOf(error).code === "EMAIL_NOT_VERIFIED") setPendingConfirmationEmail(email)
      toast.error(translateError("login", error))
    }
  }

  const goToLogin = (email: string) => {
    setLoginEmail(email)
    setLoginPassword("")
    setActiveTab("login")
  }

  const handleRegister = async (e: SubmitEvent) => {
    e.preventDefault()
    const email = normalizeEmail(registerEmail())
    const name = registerName().trim()
    const tradeName = registerEstablishment().trim()
    const key = hasKey() ? registrationKey().trim() : ""
    // HTML `required` accepts whitespace only.
    if (!name || !tradeName || (hasKey() && !key)) {
      toast.error(tAuth("requiredFieldsMissing"))
      return
    }
    if (registerPassword().length < MIN_PASSWORD_LENGTH) {
      toast.error(tAuth("weakPassword"))
      return
    }
    try {
      // Checks the key BEFORE creating the account: a wrong key used to become
      // a Free account without a warning.
      if (key && !(await keyMutation.mutateAsync(key))) {
        toast.error(tAuth("invalidRegistrationKey"))
        return
      }
      await registerMutation.mutateAsync({
        email,
        password: registerPassword(),
        name,
        tradeName,
        termsAccepted: termsAccepted(),
        locale: normalizeLocale(language()),
        ...(key ? { registrationKey: key } : {}),
      })
      // The /v1 answers 202 whether or not the email exists (it never says):
      // a new or unconfirmed account gets the link, a confirmed one a notice.
      setPendingConfirmationEmail(email)
      startCooldown()
      goToLogin(email)
      toast.success(tAuth("confirmEmailSent", { email }))
    } catch (error) {
      console.error("Registration failed", apiErrorOf(error).code)
      toast.error(translateError("registration", error))
    }
  }

  const handleResendConfirmation = async () => {
    const email = pendingConfirmationEmail()
    if (!email || resendCooldown() > 0) return
    try {
      await resendMutation.mutateAsync(email)
      startCooldown()
      toast.success(tAuth("confirmEmailResent", { email }))
    } catch (error) {
      toast.error(translateError("registration", error))
    }
  }

  // Google: the ID token goes to the API, which signs in or creates the
  // account. On the register tab, what the form already has goes along (it
  // only applies when the account is new).
  const handleGoogleCredential = async (idToken: string) => {
    if (googleMutation.isPending || keyMutation.isPending) return
    const key = hasKey() ? registrationKey().trim() : ""
    const tradeName = registerEstablishment().trim()
    const signUp = activeTab() === "register"
    // Without the terms the account is still created, like the React app.
    try {
      // Same rule as the form: a wrong key must not become a Free account.
      if (signUp && key && !(await keyMutation.mutateAsync(key))) {
        toast.error(tAuth("invalidRegistrationKey"))
        return
      }
      establishSession(await googleMutation.mutateAsync({
        idToken,
        locale: normalizeLocale(language()),
        ...(signUp && termsAccepted() ? { termsAccepted: true } : {}),
        ...(signUp && tradeName ? { tradeName } : {}),
        ...(signUp && key ? { registrationKey: key } : {}),
      }))
    } catch (error) {
      toast.error(translateError("login", error))
    }
  }

  const googleUnavailable = () => toast.error(tAuth("loginFailure"))

  return (
    <div class="flex-1 flex items-center justify-center bg-muted/40 p-4 min-h-[calc(100vh-10rem)]">
      <div class="w-full max-w-md space-y-6">
        <div class="flex flex-col items-center space-y-2 text-center">
          <div class="flex items-center gap-2 font-bold text-2xl">
            <img src={logo} alt="Tozzo.uk" class="h-16 w-16 object-contain" />
            <span>Tozzo.uk</span>
          </div>
          <p class="text-muted-foreground">
            {tAuth("subtitle")}
          </p>
        </div>

        <Tabs value={activeTab()} onChange={(value) => setActiveTab(value as Tab)} class="w-full">
          <TabsList class="grid w-full grid-cols-2">
            <TabsTrigger value="login">{tAuth("login")}</TabsTrigger>
            <TabsTrigger value="register">{tAuth("register")}</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <Show when={pendingConfirmationEmail()}>
              {(email) => (
                <Alert class="mb-4">
                  <AlertTitle>{tAuth("confirmEmailTitle")}</AlertTitle>
                  <AlertDescription class="space-y-3">
                    <span class="block">{tAuth("confirmEmailDescription", { email: email() })}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isLoading() || resendCooldown() > 0}
                      onClick={() => void handleResendConfirmation()}
                    >
                      {resendCooldown() > 0
                        ? tAuth("resendConfirmationIn", { seconds: resendCooldown() })
                        : tAuth("resendConfirmation")}
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
            </Show>
            <Card>
              <CardHeader>
                <CardTitle>{tAuth("login")}</CardTitle>
                <CardDescription>
                  {tAuth("loginDescription")}
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleLogin}>
                <CardContent class="space-y-4">
                  <div class="space-y-2">
                    <Label for="email">{tAuth("email")}</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder={tAuth("emailPlaceholder")}
                      required
                      value={loginEmail()}
                      onInput={(e) => setLoginEmail(e.currentTarget.value)}
                    />
                  </div>
                  <div class="space-y-2">
                    <Label for="password">{tAuth("password")}</Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      value={loginPassword()}
                      onInput={(e) => setLoginPassword(e.currentTarget.value)}
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button class="w-full" type="submit" disabled={isLoading()}>
                    {isLoading() ? tAuth("entering") : tAuth("enter")}
                  </Button>
                </CardFooter>
              </form>
              <div class="px-6 pb-6 space-y-4">
                <GoogleSignInButton onCredential={(idToken) => void handleGoogleCredential(idToken)} onError={googleUnavailable} />
                <a href="/forgot-password" class="text-sm text-muted-foreground underline block text-center">
                  {tAuth("forgotPasswordLink")}
                </a>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="register">
            <Card>
              <CardHeader>
                <CardTitle>{tAuth("createAccount")}</CardTitle>
                <CardDescription>
                  {tAuth("registerDescription")}
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleRegister}>
                <CardContent class="space-y-4">
                  <div class="space-y-2">
                    <Label for="register-name">{tAuth("responsibleName")}</Label>
                    <Input
                      id="register-name"
                      placeholder={tAuth("responsiblePlaceholder")}
                      required
                      value={registerName()}
                      onInput={(e) => setRegisterName(e.currentTarget.value)}
                    />
                  </div>

                  <div class="space-y-2">
                    <Label for="establishment-name">{tAuth("establishmentName")}</Label>
                    <Input
                      id="establishment-name"
                      placeholder={tAuth("establishmentPlaceholder")}
                      required
                      value={registerEstablishment()}
                      onInput={(e) => setRegisterEstablishment(e.currentTarget.value)}
                    />
                  </div>

                  <div class="space-y-2">
                    <Label for="register-email">{tAuth("email")}</Label>
                    <Input
                      id="register-email"
                      type="email"
                      placeholder={tAuth("emailPlaceholder")}
                      required
                      value={registerEmail()}
                      onInput={(e) => setRegisterEmail(e.currentTarget.value)}
                    />
                  </div>
                  <div class="space-y-2">
                    <Label for="register-password">{tAuth("password")}</Label>
                    <Input
                      id="register-password"
                      type="password"
                      required
                      minLength={MIN_PASSWORD_LENGTH}
                      aria-describedby="register-password-hint"
                      value={registerPassword()}
                      onInput={(e) => setRegisterPassword(e.currentTarget.value)}
                    />
                    <p id="register-password-hint" class="text-xs text-muted-foreground">{tAuth("passwordHint", { min: MIN_PASSWORD_LENGTH })}</p>
                  </div>

                  <div class="flex items-center space-x-2 py-2">
                    <input
                      type="checkbox"
                      id="has-key"
                      checked={hasKey()}
                      onChange={(e) => setHasKey(e.currentTarget.checked)}
                      class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <Label for="has-key" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      {tAuth("freeAccessLabel")}
                    </Label>
                  </div>

                  <div class="flex items-start space-x-2 py-2">
                    <input
                      type="checkbox"
                      id="terms-accepted"
                      checked={termsAccepted()}
                      onChange={(e) => setTermsAccepted(e.currentTarget.checked)}
                      class="h-4 w-4 mt-0.5 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <Label for="terms-accepted" class="text-sm font-normal leading-snug">
                      <Trans
                        text={tAuth("termsCheckboxLabel")}
                        components={{
                          privacyLink: (text) => <a href="/privacidade" target="_blank" rel="noopener noreferrer" class="underline">{text}</a>,
                          termsLink: (text) => <a href="/termos" target="_blank" rel="noopener noreferrer" class="underline">{text}</a>,
                        }}
                      />
                    </Label>
                  </div>

                  <Show when={hasKey()}>
                    <div class="space-y-2">
                      <Label for="registration-key">{tAuth("registrationKey")}</Label>
                      <Input
                        id="registration-key"
                        placeholder={tAuth("registrationKeyPlaceholder")}
                        required
                        value={registrationKey()}
                        onInput={(e) => setRegistrationKey(e.currentTarget.value)}
                      />
                    </div>
                  </Show>
                </CardContent>
                <CardFooter>
                  <Button class="w-full" type="submit" disabled={isLoading() || !termsAccepted()}>
                    {isLoading()
                      ? tAuth("createAccountLoading")
                      : (hasKey() ? tAuth("createAccount") : tAuth("createAndSubscribe"))}
                  </Button>
                </CardFooter>
              </form>
              <Show when={GOOGLE_CLIENT_ID}>
                <div class="px-6 pb-6">
                  <GoogleSignInButton onCredential={(idToken) => void handleGoogleCredential(idToken)} onError={googleUnavailable} />
                </div>
              </Show>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
