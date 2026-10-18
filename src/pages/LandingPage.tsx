import { Button, buttonVariants } from "@/components/ui/button"
import { A, useNavigate } from "@solidjs/router"
import { UtensilsCrossed, ChefHat, Beer, Wifi, BarChart3, History, Rocket, Smartphone } from "lucide-solid"
import { useAuth } from "@/contexts/AuthContext"
import { useTranslation } from "@/i18n/solid"
import { PricingCards } from "@/components/PricingCards"

export default function LandingPage() {
  const { isAuthenticated, user } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation("common")

  const handleSubscribe = (_interval: 'monthly' | 'annual') => {
    if (isAuthenticated()) {
      if (user()?.establishment?.status === 'ACTIVE') {
        navigate('/dashboard')
      } else {
        navigate('/plan')
      }
    } else {
      navigate('/login?tab=register')
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
      <section class="relative py-20 md:py-32 overflow-hidden">
          <div class="absolute inset-0 z-0">
            <img fetchpriority="high" decoding="async"
              src="/images/landing/01.jpg"
              alt={t("landing.heroImageAlt")}
              class="w-full h-full object-cover"
            />
            <div class="absolute inset-0 bg-white/75 dark:bg-background/75 backdrop-blur-[2px]"></div>
          </div>

          <div class="container relative z-10 mx-auto px-4 text-center">
            <h1 class="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              {t("landing.heroTitle")} <br class="hidden md:block" />
              <span class="text-primary">{t("landing.heroHighlight")}</span>
            </h1>
            <p class="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              {t("landing.heroDescription")}
            </p>
            <div class="flex justify-center gap-4">
              <A href="/login" class={buttonVariants({ size: "lg", className: "h-12 px-8 text-lg" })}>
                  {t("landing.startUsing")}
                </A>
              <Button
                size="lg"
                variant="outline"
                class="h-12 px-8 text-lg bg-background/50 backdrop-blur-sm"
                onClick={scrollToPricing}
              >
                {t("landing.viewPlans")}
              </Button>
            </div>
          </div>
        </section>

        {/* Features Sections */}
        <section class="py-20 space-y-32">
          <div class="container mx-auto px-4">
            {/* Feature 1: Gestão de Cozinha */}
            <div class="flex flex-col md:flex-row items-center gap-12">
              <div class="flex-1 space-y-6">
                <div class="inline-flex items-center justify-center p-4 bg-primary/10 rounded-2xl">
                  <ChefHat class="h-10 w-10 text-primary" />
                </div>
                <h3 class="text-3xl md:text-4xl font-bold">{t("landing.features.kitchen.title")}</h3>
                <p class="text-xl text-muted-foreground leading-relaxed">
                  {t("landing.features.kitchen.description")}
                </p>
              </div>
              <div class="flex-1">
                <img loading="lazy" decoding="async"
                  src="/images/landing/02.jpg"
                  alt={t("landing.features.kitchen.imageAlt")}
                  class="rounded-2xl shadow-2xl w-full object-cover h-[400px] hover:scale-105 transition-transform duration-500"
                />
              </div>
            </div>

            {/* Feature 2: Controle de Bar */}
            <div class="flex flex-col md:flex-row-reverse items-center gap-12">
              <div class="flex-1 space-y-6">
                <div class="inline-flex items-center justify-center p-4 bg-primary/10 rounded-2xl">
                  <Beer class="h-10 w-10 text-primary" />
                </div>
                <h3 class="text-3xl md:text-4xl font-bold">{t("landing.features.bar.title")}</h3>
                <p class="text-xl text-muted-foreground leading-relaxed">
                  {t("landing.features.bar.description")}
                </p>
              </div>
              <div class="flex-1">
                <img loading="lazy" decoding="async"
                  src="/images/landing/03.jpg"
                  alt={t("landing.features.bar.imageAlt")}
                  class="rounded-2xl shadow-2xl w-full object-cover h-[400px] hover:scale-105 transition-transform duration-500"
                />
              </div>
            </div>

            {/* Feature 3: Cardápio Digital */}
            <div class="flex flex-col md:flex-row items-center gap-12">
              <div class="flex-1 space-y-6">
                <div class="inline-flex items-center justify-center p-4 bg-primary/10 rounded-2xl">
                  <UtensilsCrossed class="h-10 w-10 text-primary" />
                </div>
                <h3 class="text-3xl md:text-4xl font-bold">{t("landing.features.menu.title")}</h3>
                <p class="text-xl text-muted-foreground leading-relaxed">
                  {t("landing.features.menu.description")}
                </p>
              </div>
              <div class="flex-1">
                <img loading="lazy" decoding="async"
                  src="/images/landing/04.jpg"
                  alt={t("landing.features.menu.imageAlt")}
                  class="rounded-2xl shadow-2xl w-full object-cover h-[400px] hover:scale-105 transition-transform duration-500"
                />
              </div>
            </div>

            {/* Feature 4: Pedidos Conectados */}
            <div class="flex flex-col md:flex-row-reverse items-center gap-12">
              <div class="flex-1 space-y-6">
                <div class="inline-flex items-center justify-center p-4 bg-primary/10 rounded-2xl">
                  <Wifi class="h-10 w-10 text-primary" />
                </div>
                <h3 class="text-3xl md:text-4xl font-bold">{t("landing.features.orders.title")}</h3>
                <p class="text-xl text-muted-foreground leading-relaxed">
                  {t("landing.features.orders.description")}
                </p>
              </div>
              <div class="flex-1">
                <img loading="lazy" decoding="async"
                  src="/images/landing/05.jpg"
                  alt={t("landing.features.orders.imageAlt")}
                  class="rounded-2xl shadow-2xl w-full object-cover h-[400px] hover:scale-105 transition-transform duration-500"
                />
              </div>
            </div>

            {/* Feature 5: Dashboards Intuitivos */}
            <div class="flex flex-col md:flex-row items-center gap-12">
              <div class="flex-1 space-y-6">
                <div class="inline-flex items-center justify-center p-4 bg-primary/10 rounded-2xl">
                  <BarChart3 class="h-10 w-10 text-primary" />
                </div>
                <h3 class="text-3xl md:text-4xl font-bold">{t("landing.features.dashboard.title")}</h3>
                <p class="text-xl text-muted-foreground leading-relaxed">
                  {t("landing.features.dashboard.description")}
                </p>
              </div>
              <div class="flex-1">
                <img loading="lazy" decoding="async"
                  src="/images/landing/06.jpg"
                  alt={t("landing.features.dashboard.imageAlt")}
                  class="rounded-2xl shadow-2xl w-full object-cover h-[400px] hover:scale-105 transition-transform duration-500"
                />
              </div>
            </div>

            {/* Feature 6: Histórico Completo */}
            <div class="flex flex-col md:flex-row-reverse items-center gap-12">
              <div class="flex-1 space-y-6">
                <div class="inline-flex items-center justify-center p-4 bg-primary/10 rounded-2xl">
                  <History class="h-10 w-10 text-primary" />
                </div>
                <h3 class="text-3xl md:text-4xl font-bold">{t("landing.features.history.title")}</h3>
                <p class="text-xl text-muted-foreground leading-relaxed">
                  {t("landing.features.history.description")}
                </p>
              </div>
              <div class="flex-1">
                <img loading="lazy" decoding="async"
                  src="/images/landing/07.jpg"
                  alt={t("landing.features.history.imageAlt")}
                  class="rounded-2xl shadow-2xl w-full object-cover h-[400px] hover:scale-105 transition-transform duration-500"
                />
              </div>
            </div>

            {/* Feature 7: Gestão Inovadora */}
            <div class="flex flex-col md:flex-row items-center gap-12">
              <div class="flex-1 space-y-6">
                <div class="inline-flex items-center justify-center p-4 bg-primary/10 rounded-2xl">
                  <Rocket class="h-10 w-10 text-primary" />
                </div>
                <h3 class="text-3xl md:text-4xl font-bold">{t("landing.features.innovation.title")}</h3>
                <p class="text-xl text-muted-foreground leading-relaxed">
                  {t("landing.features.innovation.description")}
                </p>
              </div>
              <div class="flex-1">
                <img loading="lazy" decoding="async"
                  src="/images/landing/08.jpg"
                  alt={t("landing.features.innovation.imageAlt")}
                  class="rounded-2xl shadow-2xl w-full object-cover h-[400px] hover:scale-105 transition-transform duration-500"
                />
              </div>
            </div>

            {/* Feature 8: Apps Integrados */}
            <div class="flex flex-col md:flex-row-reverse items-center gap-12">
              <div class="flex-1 space-y-6">
                <div class="inline-flex items-center justify-center p-4 bg-primary/10 rounded-2xl">
                  <Smartphone class="h-10 w-10 text-primary" />
                </div>
                <h3 class="text-3xl md:text-4xl font-bold">{t("landing.features.apps.title")}</h3>
                <p class="text-xl text-muted-foreground leading-relaxed">
                  {t("landing.features.apps.description")}
                </p>
              </div>
              <div class="flex-1">
                <img loading="lazy" decoding="async"
                  src="/images/landing/09.jpg"
                  alt={t("landing.features.apps.imageAlt")}
                  class="rounded-2xl shadow-2xl w-full object-cover h-[400px] hover:scale-105 transition-transform duration-500"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" class="py-20 bg-muted/50">
          <div class="container mx-auto px-4">
            <div class="text-center mb-16">
              <h2 class="text-3xl font-bold tracking-tight mb-4">{t("plans.title")}</h2>
              <p class="text-muted-foreground text-lg max-w-2xl mx-auto">
                {t("plans.description")}
              </p>
            </div>

            <PricingCards
              currentPlan={isAuthenticated() ? user()?.establishment?.plan : null}
              onSelectPaid={handleSubscribe}
              onSelectEnterprise={() => handleSubscribe('monthly')}
            />
          </div>
        </section>
    </>
  )
}
