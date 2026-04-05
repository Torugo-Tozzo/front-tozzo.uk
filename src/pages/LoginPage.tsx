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
import logo from "@/assets/images/logo.png"
import api from "@/services/api"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, isAuthenticated, user } = useAuth()
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      if (user?.estabelecimento?.status === 'ATIVO') {
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
        senha: loginPassword,
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

      toast.error("Falha no login. Verifique suas credenciais.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const payload = {
        nome: registerName,
        email: registerEmail,
        senha: registerPassword,
        nomeFantasia: registerEstablishment,
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
        toast.success("Cadastro realizado com sucesso! Faça login para continuar.")
      }
    } catch (error) {
      console.error("Registration failed", error)
      toast.error("Falha no cadastro. Verifique os dados.")
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
            Gerencie seu estabelecimento com facilidade
          </p>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="register">Cadastrar</TabsTrigger>
          </TabsList>
          
          <TabsContent value="login">
            <Card>
              <CardHeader>
                <CardTitle>Login</CardTitle>
                <CardDescription>
                  Entre com suas credenciais para acessar o sistema.
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleLogin}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder="seu@email.com" 
                      required 
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
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
                    {isLoading ? "Entrando..." : "Entrar"}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>
          
          <TabsContent value="register">
            <Card>
              <CardHeader>
                <CardTitle>Criar conta</CardTitle>
                <CardDescription>
                  Preencha os dados abaixo para começar.
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleRegister}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-name">Nome do Responsável</Label>
                    <Input 
                      id="register-name" 
                      placeholder="Seu nome" 
                      required 
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="establishment-name">Nome do Estabelecimento</Label>
                    <Input 
                      id="establishment-name" 
                      placeholder="Bar do Zé" 
                      required 
                      value={registerEstablishment}
                      onChange={(e) => setRegisterEstablishment(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-email">Email</Label>
                    <Input 
                      id="register-email" 
                      type="email" 
                      placeholder="seu@email.com" 
                      required 
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Senha</Label>
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
                      Possuo chave de registro (Acesso Gratuito)
                    </Label>
                  </div>

                  {hasKey && (
                    <div className="space-y-2">
                      <Label htmlFor="registration-key">Chave de Registro</Label>
                      <Input 
                        id="registration-key" 
                        placeholder="Chave de acesso" 
                        required={hasKey}
                        value={registrationKey}
                        onChange={(e) => setRegistrationKey(e.target.value)}
                      />
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  <Button className="w-full" type="submit" disabled={isLoading}>
                    {isLoading ? "Criando conta..." : (hasKey ? "Criar conta" : "Criar e Assinar")}
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
