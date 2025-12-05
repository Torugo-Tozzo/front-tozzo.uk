import { Button } from "@/components/ui/button"
import { Link } from "react-router-dom"
import { UtensilsCrossed, ChefHat, Beer, Wifi, BarChart3, History, Rocket, Smartphone } from "lucide-react"

export default function LandingPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative py-20 md:py-32 overflow-hidden">
          <div className="absolute inset-0 z-0">
            <img 
              src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=2070&auto=format&fit=crop" 
              alt="Restaurant Interior" 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-white/75 dark:bg-background/75 backdrop-blur-[2px]"></div>
          </div>

          <div className="container relative z-10 mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              Gestão Inteligente para <br className="hidden md:block" />
              <span className="text-primary">Restaurantes e Bares</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              Simplifique seus pedidos, controle seu estoque e aumente suas vendas com nossa plataforma completa de gestão.
            </p>
            <div className="flex justify-center gap-4">
              <Link to="/login">
                <Button size="lg" className="h-12 px-8 text-lg">
                  Comece a usar
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="h-12 px-8 text-lg bg-background/50 backdrop-blur-sm">
                Saiba mais
              </Button>
            </div>
          </div>
        </section>

        {/* Features Preview */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="p-6 rounded-lg border bg-card text-card-foreground shadow-sm">
                <ChefHat className="h-10 w-10 mb-4 text-primary" />
                <h3 className="text-xl font-bold mb-2">Gestão de Cozinha</h3>
                <p className="text-muted-foreground">
                  Envie pedidos diretamente para a cozinha sem erros e atrasos.
                </p>
              </div>
              <div className="p-6 rounded-lg border bg-card text-card-foreground shadow-sm">
                <Beer className="h-10 w-10 mb-4 text-primary" />
                <h3 className="text-xl font-bold mb-2">Controle de Bar</h3>
                <p className="text-muted-foreground">
                  Gerencie bebidas e drinks com precisão e evite desperdícios.
                </p>
              </div>
              <div className="p-6 rounded-lg border bg-card text-card-foreground shadow-sm">
                <UtensilsCrossed className="h-10 w-10 mb-4 text-primary" />
                <h3 className="text-xl font-bold mb-2">Cardápio Digital</h3>
                <p className="text-muted-foreground">
                  Atualize seu cardápio em tempo real e facilite a escolha do cliente.
                </p>
              </div>
              <div className="p-6 rounded-lg border bg-card text-card-foreground shadow-sm">
                <Wifi className="h-10 w-10 mb-4 text-primary" />
                <h3 className="text-xl font-bold mb-2">Pedidos Conectados</h3>
                <p className="text-muted-foreground">
                  O pedido anotado pelo garçom aparece instantaneamente no sistema para o dono.
                </p>
              </div>
              <div className="p-6 rounded-lg border bg-card text-card-foreground shadow-sm">
                <BarChart3 className="h-10 w-10 mb-4 text-primary" />
                <h3 className="text-xl font-bold mb-2">Dashboards Intuitivos</h3>
                <p className="text-muted-foreground">
                  Visualize suas vendas e números através de gráficos detalhados.
                </p>
              </div>
              <div className="p-6 rounded-lg border bg-card text-card-foreground shadow-sm">
                <History className="h-10 w-10 mb-4 text-primary" />
                <h3 className="text-xl font-bold mb-2">Histórico Completo</h3>
                <p className="text-muted-foreground">
                  Consulte o histórico de todas as vendas realizadas para melhor controle.
                </p>
              </div>
              <div className="p-6 rounded-lg border bg-card text-card-foreground shadow-sm">
                <Rocket className="h-10 w-10 mb-4 text-primary" />
                <h3 className="text-xl font-bold mb-2">Gestão Inovadora</h3>
                <p className="text-muted-foreground">
                  Inove o gerenciamento do seu negócio com tecnologia e inteligência.
                </p>
              </div>
              <div className="p-6 rounded-lg border bg-card text-card-foreground shadow-sm">
                <Smartphone className="h-10 w-10 mb-4 text-primary" />
                <h3 className="text-xl font-bold mb-2">Apps Integrados</h3>
                <p className="text-muted-foreground">
                  Versões exclusivas para garçons e clientes realizarem pedidos.
                </p>
              </div>
            </div>
          </div>
        </section>
    </>
  )
}
