import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Link, useNavigate } from "react-router-dom"
import { UtensilsCrossed, ChefHat, Beer, Wifi, BarChart3, History, Rocket, Smartphone, Check } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"

export default function LandingPage() {
  const { isAuthenticated, user } = useAuth()
  const navigate = useNavigate()

  const handleSubscribe = () => {
    if (isAuthenticated) {
      if (user?.estabelecimento?.status === 'ATIVO') {
        navigate('/dashboard')
      } else {
        navigate('/plan')
      }
    } else {
      navigate('/login')
    }
  }

  const scrollToPricing = () => {
    const element = document.getElementById('pricing');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }

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
              <Button 
                size="lg" 
                variant="outline" 
                className="h-12 px-8 text-lg bg-background/50 backdrop-blur-sm"
                onClick={scrollToPricing}
              >
                Ver Planos
              </Button>
            </div>
          </div>
        </section>

        {/* Features Sections */}
        <section className="py-20 space-y-32">
          <div className="container mx-auto px-4">
            {/* Feature 1: Gestão de Cozinha */}
            <div className="flex flex-col md:flex-row items-center gap-12">
              <div className="flex-1 space-y-6">
                <div className="inline-flex items-center justify-center p-4 bg-primary/10 rounded-2xl">
                  <ChefHat className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-3xl md:text-4xl font-bold">Gestão de Cozinha</h3>
                <p className="text-xl text-muted-foreground leading-relaxed">
                  Envie pedidos diretamente para a cozinha sem erros e atrasos. 
                  Otimize o fluxo de trabalho da sua equipe e garanta que cada pedido saia perfeito e no tempo certo.
                </p>
              </div>
              <div className="flex-1">
                <img 
                  src="https://images.unsplash.com/photo-1577106263724-2c8e03bfe9cf?q=80&w=2070&auto=format&fit=crop" 
                  alt="Gestão de Cozinha" 
                  className="rounded-2xl shadow-2xl w-full object-cover h-[400px] hover:scale-105 transition-transform duration-500"
                />
              </div>
            </div>

            {/* Feature 2: Controle de Bar */}
            <div className="flex flex-col md:flex-row-reverse items-center gap-12">
              <div className="flex-1 space-y-6">
                <div className="inline-flex items-center justify-center p-4 bg-primary/10 rounded-2xl">
                  <Beer className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-3xl md:text-4xl font-bold">Controle de Bar</h3>
                <p className="text-xl text-muted-foreground leading-relaxed">
                  Gerencie bebidas e drinks com precisão e evite desperdícios. 
                  Tenha controle total sobre o estoque do seu bar e aumente sua lucratividade.
                </p>
              </div>
              <div className="flex-1">
                <img 
                  src="https://images.unsplash.com/photo-1470337458703-46ad1756a187?q=80&w=2069&auto=format&fit=crop" 
                  alt="Controle de Bar" 
                  className="rounded-2xl shadow-2xl w-full object-cover h-[400px] hover:scale-105 transition-transform duration-500"
                />
              </div>
            </div>

            {/* Feature 3: Cardápio Digital */}
            <div className="flex flex-col md:flex-row items-center gap-12">
              <div className="flex-1 space-y-6">
                <div className="inline-flex items-center justify-center p-4 bg-primary/10 rounded-2xl">
                  <UtensilsCrossed className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-3xl md:text-4xl font-bold">Cardápio Digital</h3>
                <p className="text-xl text-muted-foreground leading-relaxed">
                  Atualize seu cardápio em tempo real e facilite a escolha do cliente.
                  Adicione fotos, descrições detalhadas e altere preços instantaneamente.
                </p>
              </div>
              <div className="flex-1">
                <img 
                  src="https://images.unsplash.com/photo-1559339352-11d035aa65de?q=80&w=1974&auto=format&fit=crop" 
                  alt="Cardápio Digital" 
                  className="rounded-2xl shadow-2xl w-full object-cover h-[400px] hover:scale-105 transition-transform duration-500"
                />
              </div>
            </div>

            {/* Feature 4: Pedidos Conectados */}
            <div className="flex flex-col md:flex-row-reverse items-center gap-12">
              <div className="flex-1 space-y-6">
                <div className="inline-flex items-center justify-center p-4 bg-primary/10 rounded-2xl">
                  <Wifi className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-3xl md:text-4xl font-bold">Pedidos Conectados</h3>
                <p className="text-xl text-muted-foreground leading-relaxed">
                  O pedido anotado pelo garçom aparece instantaneamente no sistema para o dono e na cozinha.
                  Agilidade e comunicação integrada para seu restaurante.
                </p>
              </div>
              <div className="flex-1">
                <img 
                  src="https://images.unsplash.com/photo-1556740738-b6a63e27c4df?q=80&w=2070&auto=format&fit=crop" 
                  alt="Pedidos Conectados" 
                  className="rounded-2xl shadow-2xl w-full object-cover h-[400px] hover:scale-105 transition-transform duration-500"
                />
              </div>
            </div>

            {/* Feature 5: Dashboards Intuitivos */}
            <div className="flex flex-col md:flex-row items-center gap-12">
              <div className="flex-1 space-y-6">
                <div className="inline-flex items-center justify-center p-4 bg-primary/10 rounded-2xl">
                  <BarChart3 className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-3xl md:text-4xl font-bold">Dashboards Intuitivos</h3>
                <p className="text-xl text-muted-foreground leading-relaxed">
                  Visualize suas vendas e números através de gráficos detalhados.
                  Tome decisões baseadas em dados reais e acompanhe o crescimento do seu negócio.
                </p>
              </div>
              <div className="flex-1">
                <img 
                  src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop" 
                  alt="Dashboards Intuitivos" 
                  className="rounded-2xl shadow-2xl w-full object-cover h-[400px] hover:scale-105 transition-transform duration-500"
                />
              </div>
            </div>

            {/* Feature 6: Histórico Completo */}
            <div className="flex flex-col md:flex-row-reverse items-center gap-12">
              <div className="flex-1 space-y-6">
                <div className="inline-flex items-center justify-center p-4 bg-primary/10 rounded-2xl">
                  <History className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-3xl md:text-4xl font-bold">Histórico Completo</h3>
                <p className="text-xl text-muted-foreground leading-relaxed">
                  Consulte o histórico de todas as vendas realizadas para melhor controle.
                  Acesse dados antigos e entenda o comportamento dos seus clientes ao longo do tempo.
                </p>
              </div>
              <div className="flex-1">
                <img 
                  src="https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=2070&auto=format&fit=crop" 
                  alt="Histórico Completo" 
                  className="rounded-2xl shadow-2xl w-full object-cover h-[400px] hover:scale-105 transition-transform duration-500"
                />
              </div>
            </div>

            {/* Feature 7: Gestão Inovadora */}
            <div className="flex flex-col md:flex-row items-center gap-12">
              <div className="flex-1 space-y-6">
                <div className="inline-flex items-center justify-center p-4 bg-primary/10 rounded-2xl">
                  <Rocket className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-3xl md:text-4xl font-bold">Gestão Inovadora</h3>
                <p className="text-xl text-muted-foreground leading-relaxed">
                  Inove o gerenciamento do seu negócio com tecnologia e inteligência.
                  Esteja à frente da concorrência com ferramentas modernas e eficientes.
                </p>
              </div>
              <div className="flex-1">
                <img 
                  src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=2070&auto=format&fit=crop" 
                  alt="Gestão Inovadora" 
                  className="rounded-2xl shadow-2xl w-full object-cover h-[400px] hover:scale-105 transition-transform duration-500"
                />
              </div>
            </div>

            {/* Feature 8: Apps Integrados */}
            <div className="flex flex-col md:flex-row-reverse items-center gap-12">
              <div className="flex-1 space-y-6">
                <div className="inline-flex items-center justify-center p-4 bg-primary/10 rounded-2xl">
                  <Smartphone className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-3xl md:text-4xl font-bold">Apps Integrados</h3>
                <p className="text-xl text-muted-foreground leading-relaxed">
                  Versões exclusivas para garçons e clientes realizarem pedidos.
                  Facilite a vida do seu cliente e da sua equipe com aplicativos dedicados.
                </p>
              </div>
              <div className="flex-1">
                <img 
                  src="https://images.unsplash.com/photo-1556742031-c6961e8560b0?q=80&w=2070&auto=format&fit=crop" 
                  alt="Apps Integrados" 
                  className="rounded-2xl shadow-2xl w-full object-cover h-[400px] hover:scale-105 transition-transform duration-500"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-20 bg-muted/50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight mb-4">Planos Flexíveis</h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                Escolha o plano ideal para o seu negócio crescer.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto items-start">
              {/* Monthly Plan */}
              <Card className="relative flex flex-col border-2 border-transparent hover:border-primary/50 transition-all duration-300 hover:scale-105 hover:shadow-xl bg-card">
                <CardHeader>
                  <CardTitle className="text-2xl">Mensal</CardTitle>
                  <CardDescription>Flexibilidade total para seu negócio</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="mb-4">
                    <span className="text-4xl font-bold">R$ 6,90</span>
                    <span className="text-muted-foreground ml-2">/mês</span>
                  </div>
                  <ul className="space-y-3 mb-8">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <span>Acesso completo ao sistema</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <span>Suporte prioritário</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <span>Cancele quando quiser</span>
                    </li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button size="lg" className="w-full" onClick={handleSubscribe}>
                    Assinar Mensal
                  </Button>
                </CardFooter>
              </Card>

              {/* Annual Plan */}
              <Card className="relative flex flex-col border-2 border-green-500 shadow-lg z-10 transition-all duration-300 hover:scale-110 hover:shadow-2xl bg-card">
                <div className="absolute top-0 right-0 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">
                  MAIS POPULAR
                </div>
                <CardHeader>
                  <CardTitle className="text-2xl">Anual</CardTitle>
                  <CardDescription>Economize com pagamento anual</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="mb-4">
                    <span className="text-4xl font-bold">R$ 60,91</span>
                    <span className="text-muted-foreground ml-2">/ano</span>
                  </div>
                  <p className="text-sm text-green-600 font-medium mb-4">Equivalente a R$ 5,07/mês</p>
                  <ul className="space-y-3 mb-8">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>Tudo do plano mensal</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>Desconto de ~27%</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>Cobrança anual</span>
                    </li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button size="lg" className="w-full bg-green-600 hover:bg-green-700" onClick={handleSubscribe}>
                    Assinar Anual
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </section>
    </>
  )
}
