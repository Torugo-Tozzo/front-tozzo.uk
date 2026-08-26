import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Link, useNavigate } from "react-router-dom"
import { UtensilsCrossed, ChefHat, Beer, Wifi, BarChart3, History, Rocket, Smartphone, Check } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useTranslation } from "react-i18next"
import { formatCurrencyBRL } from "@/i18n/format"

export default function LandingPage() {
  const { isAuthenticated, user } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation("common")

  const handleSubscribe = () => {
    if (isAuthenticated) {
      if (user?.establishment?.status === 'ACTIVE') {
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
              alt={t("landing.heroImageAlt")}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-white/75 dark:bg-background/75 backdrop-blur-[2px]"></div>
          </div>

          <div className="container relative z-10 mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              {t("landing.heroTitle")} <br className="hidden md:block" />
              <span className="text-primary">{t("landing.heroHighlight")}</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              {t("landing.heroDescription")}
            </p>
            <div className="flex justify-center gap-4">
              <Link to="/login">
                <Button size="lg" className="h-12 px-8 text-lg">
                  {t("landing.startUsing")}
                </Button>
              </Link>
              <Button 
                size="lg" 
                variant="outline" 
                className="h-12 px-8 text-lg bg-background/50 backdrop-blur-sm"
                onClick={scrollToPricing}
              >
                {t("landing.viewPlans")}
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
                <h3 className="text-3xl md:text-4xl font-bold">{t("landing.features.kitchen.title")}</h3>
                <p className="text-xl text-muted-foreground leading-relaxed">
                  {t("landing.features.kitchen.description")}
                </p>
              </div>
              <div className="flex-1">
                <img 
                  src="https://images.unsplash.com/photo-1577106263724-2c8e03bfe9cf?q=80&w=2070&auto=format&fit=crop" 
                  alt={t("landing.features.kitchen.imageAlt")}
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
                <h3 className="text-3xl md:text-4xl font-bold">{t("landing.features.bar.title")}</h3>
                <p className="text-xl text-muted-foreground leading-relaxed">
                  {t("landing.features.bar.description")}
                </p>
              </div>
              <div className="flex-1">
                <img 
                  src="https://images.unsplash.com/photo-1470337458703-46ad1756a187?q=80&w=2069&auto=format&fit=crop" 
                  alt={t("landing.features.bar.imageAlt")}
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
                <h3 className="text-3xl md:text-4xl font-bold">{t("landing.features.menu.title")}</h3>
                <p className="text-xl text-muted-foreground leading-relaxed">
                  {t("landing.features.menu.description")}
                </p>
              </div>
              <div className="flex-1">
                <img 
                  src="https://images.unsplash.com/photo-1559339352-11d035aa65de?q=80&w=1974&auto=format&fit=crop" 
                  alt={t("landing.features.menu.imageAlt")}
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
                <h3 className="text-3xl md:text-4xl font-bold">{t("landing.features.orders.title")}</h3>
                <p className="text-xl text-muted-foreground leading-relaxed">
                  {t("landing.features.orders.description")}
                </p>
              </div>
              <div className="flex-1">
                <img 
                  src="https://images.unsplash.com/photo-1556740738-b6a63e27c4df?q=80&w=2070&auto=format&fit=crop" 
                  alt={t("landing.features.orders.imageAlt")}
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
                <h3 className="text-3xl md:text-4xl font-bold">{t("landing.features.dashboard.title")}</h3>
                <p className="text-xl text-muted-foreground leading-relaxed">
                  {t("landing.features.dashboard.description")}
                </p>
              </div>
              <div className="flex-1">
                <img 
                  src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop" 
                  alt={t("landing.features.dashboard.imageAlt")}
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
                <h3 className="text-3xl md:text-4xl font-bold">{t("landing.features.history.title")}</h3>
                <p className="text-xl text-muted-foreground leading-relaxed">
                  {t("landing.features.history.description")}
                </p>
              </div>
              <div className="flex-1">
                <img 
                  src="https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=2070&auto=format&fit=crop" 
                  alt={t("landing.features.history.imageAlt")}
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
                <h3 className="text-3xl md:text-4xl font-bold">{t("landing.features.innovation.title")}</h3>
                <p className="text-xl text-muted-foreground leading-relaxed">
                  {t("landing.features.innovation.description")}
                </p>
              </div>
              <div className="flex-1">
                <img 
                  src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=2070&auto=format&fit=crop" 
                  alt={t("landing.features.innovation.imageAlt")}
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
                <h3 className="text-3xl md:text-4xl font-bold">{t("landing.features.apps.title")}</h3>
                <p className="text-xl text-muted-foreground leading-relaxed">
                  {t("landing.features.apps.description")}
                </p>
              </div>
              <div className="flex-1">
                <img 
                  src="https://images.unsplash.com/photo-1556742031-c6961e8560b0?q=80&w=2070&auto=format&fit=crop" 
                  alt={t("landing.features.apps.imageAlt")}
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
              <h2 className="text-3xl font-bold tracking-tight mb-4">{t("plans.title")}</h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                {t("plans.description")}
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto items-start">
              {/* Monthly Plan */}
              <Card className="relative flex flex-col border-2 border-transparent hover:border-primary/50 transition-all duration-300 hover:scale-105 hover:shadow-xl bg-card">
                <CardHeader>
                  <CardTitle className="text-2xl">{t("plans.monthly")}</CardTitle>
                  <CardDescription>{t("plans.monthlyDescription")}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="mb-4">
                    <span className="text-4xl font-bold">{formatCurrencyBRL(6.9)}</span>
                    <span className="text-muted-foreground ml-2">{t("plans.monthlyUnit")}</span>
                  </div>
                  <ul className="space-y-3 mb-8">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <span>{t("plans.features.fullAccess")}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <span>{t("plans.features.prioritySupport")}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <span>{t("plans.features.cancelAnytime")}</span>
                    </li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button size="lg" className="w-full" onClick={handleSubscribe}>
                    {t("plans.subscribeMonthly")}
                  </Button>
                </CardFooter>
              </Card>

              {/* Annual Plan */}
              <Card className="relative flex flex-col border-2 border-green-500 shadow-lg z-10 transition-all duration-300 hover:scale-110 hover:shadow-2xl bg-card">
                <div className="absolute top-0 right-0 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">
                  {t("plans.popular")}
                </div>
                <CardHeader>
                  <CardTitle className="text-2xl">{t("plans.annual")}</CardTitle>
                  <CardDescription>{t("plans.annualDescription")}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="mb-4">
                    <span className="text-4xl font-bold">{formatCurrencyBRL(60.91)}</span>
                    <span className="text-muted-foreground ml-2">{t("plans.annualUnit")}</span>
                  </div>
                  <p className="text-sm text-green-600 font-medium mb-4">
                    {t("plans.equivalentMonthly", { price: formatCurrencyBRL(5.07) })}
                  </p>
                  <ul className="space-y-3 mb-8">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>{t("plans.features.sameAsMonthly")}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>{t("plans.features.discount")}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>{t("plans.features.annualBilling")}</span>
                    </li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button size="lg" className="w-full bg-green-600 hover:bg-green-700" onClick={handleSubscribe}>
                    {t("plans.subscribeAnnual")}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </section>
    </>
  )
}
