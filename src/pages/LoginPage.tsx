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
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"
import { useTranslation } from "react-i18next"
import { getErrorTranslationKey } from "@/i18n/error-keys"

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, isAuthenticated, user } = useAuth()
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const response = await api.post("/auth/login", {
        email: loginEmail,
        password: loginPassword,
      })
      await login(response.data.token)
      navigate("/dashboard")
    } catch (error: any) {
      console.error("Login failed", error)
      
      if (error.response && error.response.status === 402) {
        // Se o erro for 402, verifica se o token veio na resposta de erro
        const token = error.response.data?.token;
        if (token) {
          await login(token);
          navigate("/plan");
          return;
        }
      }

      toast.error(translateError("login", error))
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const payload = {
        name: registerName,
        email: registerEmail,
        password: registerPassword,
        establishmentName: registerEstablishment,
        registrationKey: hasKey ? registrationKey : ""
      }

      const response = await api.post("/auth/register", payload)
      
      if (response.data.token) {
        await login(response.data.token)
        if (hasKey) {
          navigate("/dashboard")
        } else {
          navigate("/plan")
        }
      } else {
        toast.success(tAuth("registrationSuccess"))
      }
    } catch (error) {
      console.error("Registration failed", error)
      toast.error(translateError("registration", error))
    } finally {
      setIsLoading(false)
    }
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
                  <Button className="w-full" type="submit" disabled={isLoading}>
                    {isLoading ? tAuth("entering") : tAuth("enter")}
                  </Button>
                </CardFooter>
              </form>
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
                  <Button className="w-full" type="submit" disabled={isLoading}>
                    {isLoading
                      ? tAuth("createAccountLoading")
                      : (hasKey ? tAuth("createAccount") : tAuth("createAndSubscribe"))}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
