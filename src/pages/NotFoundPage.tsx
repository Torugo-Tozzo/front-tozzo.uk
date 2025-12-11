import { Button } from "@/components/ui/button"
import { Ghost } from "lucide-react"
import { useNavigate } from "react-router-dom"

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/40 p-4 text-center">
      <div className="space-y-6 max-w-md">
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute -inset-4 bg-primary/20 rounded-full blur-xl animate-pulse"></div>
            <Ghost className="h-32 w-32 text-primary relative z-10 animate-bounce" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Ops... 404</h1>
          <h2 className="text-2xl font-semibold text-muted-foreground">
            Página não encontrada
          </h2>
          <p className="text-muted-foreground">
            Parece que a página que você está procurando sumiu do mapa ou nunca existiu.
          </p>
        </div>

        <div className="flex gap-4 justify-center">
          <Button onClick={() => navigate(-1)} variant="outline">
            Voltar
          </Button>
          <Button onClick={() => navigate("/")}>
            Ir para o Início
          </Button>
        </div>
      </div>
    </div>
  )
}
