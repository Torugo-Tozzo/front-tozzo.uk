import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import logo from "@/assets/images/logo.svg"
import api, { getErrorCode } from "@/services/api"
import { authClient } from "@/lib/authClient"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"
import { Trans, useTranslation } from "react-i18next"
import { getErrorTranslationKey } from "@/i18n/error-keys"

export default function LoginPage() {
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const { t: tAuth } = useTranslation("auth")
  const { t: tErrors } = useTranslation("errors")
  const [isLoading, setIsLoading] = useState(false)

  const translateError = (context: "login" | "registration", error: unknown) => {
    const translation = getErrorTranslationKey(context, getErrorCode(error))
    return translation.namespace === "auth"
      ? tAuth(translation.key)
      : tErrors(translation.key)
  }

  useEffect(() => {
    if (isAuthenticated) {
      if (user?.establishment?.status === 'ACTIVE') {
        navigate('/dashboard')
      } else {
        navigate('/plan')
      }
    }
  }, [isAuthenticated, user, navigate])

  // Login States
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")

  // Register States
  const [registerName, setRegisterName] = useState("") // Nome do usuário (dono)
  const [registerEstablishment, setRegisterEstablishment] = useState("") // Nome Fantasia
  const [registerEmail, setRegisterEmail] = useState("")
  const [registerPassword, setRegisterPassword] = useState("")
  const [registrationKey, setRegistrationKey] = useState("")
  const [hasKey, setHasKey] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [mfaChallenge, setMfaChallenge] = useState<{ factorId: string; challengeId: string } | null>(null)
  const [mfaCode, setMfaCode] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const { error } = await authClient.signInWithPassword({ email: loginEmail, password: loginPassword })
      if (error) {
        toast.error(translateError("login", { response: { data: { code: error.code } } }))
        return
      }

      // auth-js não devolve um "código de erro de MFA" no signIn — a senha já autentica numa
      // sessão AAL1 normal. Pra saber se falta o desafio TOTP, é preciso perguntar o AAL depois.
      const { data: aal } = await authClient.mfa.getAuthenticatorAssuranceLevel()
      if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
        const { data: factors } = await authClient.mfa.listFactors()
        const factorId = factors?.totp?.[0]?.id
        if (factorId) {
          const { data: challenge } = await authClient.mfa.challenge({ factorId })
          if (challenge) setMfaChallenge({ factorId, challengeId: challenge.id })
        }
        return
      }

      navigate("/dashboard")
    } catch (error: any) {
      console.error("Login failed", error)
      
      toast.error(translateError("login", error))
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const { data, error } = await authClient.signUp({ email: registerEmail, password: registerPassword })
      if (error) {
        toast.error(translateError("registration", { response: { data: { code: error?.code } } }))
        return
      }
      // Com a confirmação de e-mail habilitada, o GoTrue cria o usuário sem sessão.
      // A finalização depende de uma sessão autenticada e só deve ocorrer após a confirmação.
      if (!data.session) {
        navigate("/login")
        return
      }
      await api.post("/auth/complete-signup", {
        name: registerName,
        termsAccepted,
        tradeName: registerEstablishment,
        registrationKey: hasKey ? registrationKey : "",
      })
      navigate(hasKey ? "/dashboard" : "/plan")
    } catch (error) {
      console.error("Registration failed", error)
      toast.error(translateError("registration", error))
    } finally {
      setIsLoading(false)
    }
  }

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mfaChallenge) return
    setIsLoading(true)
    const { error } = await authClient.mfa.verify({ ...mfaChallenge, code: mfaCode })
    setIsLoading(false)
    if (error) { toast.error(tAuth('invalidTotpCode')); return }
    navigate('/dashboard')
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-muted/40 p-4 min-h-[calc(100vh-10rem)]">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="flex items-center gap-2 font-bold text-2xl">
            <img src={logo} alt="Tozzo.uk" className="h-16 w-16 object-contain" />
            <span>Tozzo.uk</span>
          </div>
          <p className="text-muted-foreground">
            {tAuth("subtitle")}
          </p>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">{tAuth("login")}</TabsTrigger>
            <TabsTrigger value="register">{tAuth("register")}</TabsTrigger>
          </TabsList>
          
          <TabsContent value="login">
            <Card>
              <CardHeader>
                <CardTitle>{tAuth("login")}</CardTitle>
                <CardDescription>
                  {tAuth("loginDescription")}
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleLogin}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">{tAuth("email")}</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder={tAuth("emailPlaceholder")}
                      required 
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">{tAuth("password")}</Label>
                    <Input 
                      id="password" 
                      type="password" 
                      required 
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <a href="/forgot-password" className="text-sm text-muted-foreground underline mb-2 block text-center">
                    {tAuth("forgotPasswordLink")}
                  </a>
                  <Button className="w-full" type="submit" disabled={isLoading}>
                    {isLoading ? tAuth("entering") : tAuth("enter")}
                  </Button>
                </CardFooter>
              </form>
              <div className="px-6 pb-6"><Button type="button" variant="outline" className="w-full" onClick={() => void authClient.signInWithOAuth({ provider: 'google' })}>{tAuth('continueWithGoogle')}</Button></div>
              {mfaChallenge && <form onSubmit={handleMfaVerify} className="border-t p-6 space-y-4">
                <Label htmlFor="mfa-code">{tAuth('totpCode')}</Label>
                <Input id="mfa-code" value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} required inputMode="numeric" />
                <Button className="w-full" type="submit" disabled={isLoading}>{tAuth('confirmTotp')}</Button>
              </form>}
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
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-name">{tAuth("responsibleName")}</Label>
                    <Input 
                      id="register-name" 
                      placeholder={tAuth("responsiblePlaceholder")}
                      required 
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="establishment-name">{tAuth("establishmentName")}</Label>
                    <Input 
                      id="establishment-name" 
                      placeholder={tAuth("establishmentPlaceholder")}
                      required 
                      value={registerEstablishment}
                      onChange={(e) => setRegisterEstablishment(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-email">{tAuth("email")}</Label>
                    <Input 
                      id="register-email" 
                      type="email" 
                      placeholder={tAuth("emailPlaceholder")}
                      required 
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">{tAuth("password")}</Label>
                    <Input 
                      id="register-password" 
                      type="password" 
                      required 
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center space-x-2 py-2">
                    <input
                      type="checkbox"
                      id="has-key"
                      checked={hasKey}
                      onChange={(e) => setHasKey(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <Label htmlFor="has-key" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      {tAuth("freeAccessLabel")}
                    </Label>
                  </div>

                  <div className="flex items-start space-x-2 py-2">
                    <input
                      type="checkbox"
                      id="terms-accepted"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      className="h-4 w-4 mt-0.5 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <Label htmlFor="terms-accepted" className="text-sm font-normal leading-snug">
                      <Trans
                        i18nKey="termsCheckboxLabel"
                        ns="auth"
                        components={{
                          privacyLink: <a href="/privacidade" target="_blank" rel="noreferrer" className="underline" />,
                          termsLink: <a href="/termos" target="_blank" rel="noreferrer" className="underline" />,
                        }}
                      />
                    </Label>
                  </div>

                  {hasKey && (
                    <div className="space-y-2">
                      <Label htmlFor="registration-key">{tAuth("registrationKey")}</Label>
                      <Input 
                        id="registration-key" 
                        placeholder={tAuth("registrationKeyPlaceholder")}
                        required={hasKey}
                        value={registrationKey}
                        onChange={(e) => setRegistrationKey(e.target.value)}
                      />
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  <Button className="w-full" type="submit" disabled={isLoading || !termsAccepted}>
                    {isLoading
                      ? tAuth("createAccountLoading")
                      : (hasKey ? tAuth("createAccount") : tAuth("createAndSubscribe"))}
                  </Button>
                </CardFooter>
              </form>
              <div className="px-6 pb-6"><Button type="button" variant="outline" className="w-full" onClick={() => void authClient.signInWithOAuth({ provider: 'google' })}>{tAuth('continueWithGoogle')}</Button></div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
