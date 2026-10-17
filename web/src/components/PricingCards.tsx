import { createSignal } from "solid-js"
import { useTranslation } from "@/i18n/solid"
import { Check } from "lucide-solid"

import type { Establishment } from "@/domain/user"
import { formatCents } from "@/lib/money"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

type PricingCardsProps = {
  currentPlan?: Establishment['plan'] | null
  onSelectFree?: () => void
  onSelectPaid: (interval: 'monthly' | 'annual') => void
  onSelectEnterprise: () => void
  loading?: boolean
  checkoutDisabled?: boolean
}

export function PricingCards(props: PricingCardsProps) {
  const { t, language } = useTranslation("common")
  const { t: tSettings } = useTranslation("settings")
  const [interval, setInterval] = createSignal<'monthly' | 'annual'>('monthly')
  const isAnnual = () => interval() === 'annual'

  return (
    <div class="mt-8">
      <div class="mb-6 flex justify-center gap-2" role="group" aria-label={t("plans.title")}>
        <Button
          type="button"
          variant={isAnnual() ? "outline" : "default"}
          aria-pressed={!isAnnual()}
          onClick={() => setInterval('monthly')}
        >
          {t("plans.monthly")}
        </Button>
        <Button
          type="button"
          variant={isAnnual() ? "default" : "outline"}
          aria-pressed={isAnnual()}
          onClick={() => setInterval('annual')}
        >
          {t("plans.annual")}
        </Button>
      </div>

      <div class="grid md:grid-cols-3 gap-8">
      <Card class="relative flex flex-col border-2 border-transparent">
        <CardHeader>
          <CardTitle class="text-2xl">{tSettings("plan.tiers.FREE")}</CardTitle>
          <CardDescription>{t("plans.noPlanDescription")}</CardDescription>
        </CardHeader>
        <CardContent class="flex-1">
          <span class="text-4xl font-bold">{formatCents(0, language())}</span>
          <ul class="mt-4 space-y-2 text-sm text-gray-600 dark:text-muted-foreground">
            <li class="flex items-center"><Check class="h-4 w-4 mr-2 text-green-500" /> {t("plans.features.freeProducts")}</li>
            <li class="flex items-center"><Check class="h-4 w-4 mr-2 text-green-500" /> {t("plans.features.freeDevices")}</li>
            <li class="flex items-center"><Check class="h-4 w-4 mr-2 text-green-500" /> {t("plans.features.freePrints")}</li>
            <li class="flex items-center"><Check class="h-4 w-4 mr-2 text-green-500" /> {t("plans.features.freeReports")}</li>
          </ul>
        </CardContent>
        {props.currentPlan === "FREE" ? <CardFooter><span class="text-sm font-medium">{t("plans.currentPlan")}</span></CardFooter> : null}
        {props.onSelectFree ? <CardFooter><Button onClick={() => props.onSelectFree?.()} disabled={props.loading} class="w-full">{t("plans.continueFree")}</Button></CardFooter> : null}
      </Card>

      <Card class={isAnnual() ? "relative flex flex-col border-2 border-green-500 shadow-lg transition-all" : "relative flex flex-col border-2 border-transparent hover:border-primary/50 transition-all"}>
        {isAnnual() ? <div class="absolute top-0 right-0 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">{t("plans.popular")}</div> : null}
        <CardHeader>
          <CardTitle class="text-2xl">{isAnnual() ? t("plans.annual") : t("plans.monthly")}</CardTitle>
          <CardDescription>{isAnnual() ? t("plans.annualDescription") : t("plans.monthlyDescription")}</CardDescription>
        </CardHeader>
        <CardContent class="flex-1">
          <div class="mb-4">
            <span class="text-4xl font-bold">{formatCents(isAnnual() ? 6091 : 1490, language())}</span>
            <span class="text-gray-500 dark:text-muted-foreground">{isAnnual() ? t("plans.annualUnit") : t("plans.monthlyUnit")}</span>
          </div>
          {isAnnual() ? <p class="text-sm text-green-600 font-medium mb-4">{t("plans.equivalentMonthly", { price: formatCents(507, language()) })}</p> : null}
          <ul class="space-y-2 text-sm text-gray-600 dark:text-muted-foreground">
            <li class="flex items-center"><Check class="h-4 w-4 mr-2 text-green-500" /> {t("plans.features.unlimitedAll")}</li>
            <li class="flex items-center"><Check class="h-4 w-4 mr-2 text-green-500" /> {t("plans.features.pagoDevices")}</li>
            <li class="flex items-center"><Check class="h-4 w-4 mr-2 text-green-500" /> {t("plans.features.prioritySupport")}</li>
            <li class="flex items-center"><Check class="h-4 w-4 mr-2 text-green-500" /> {isAnnual() ? t("plans.features.discount") : t("plans.features.cancelAnytime")}</li>
          </ul>
        </CardContent>
        {props.currentPlan === "PAID" || props.currentPlan === "LEGACY_PAID" ? <CardFooter><span class="text-sm font-medium">{t("plans.currentPlan")}</span></CardFooter> : null}
        <CardFooter><Button onClick={() => props.onSelectPaid(interval())} disabled={props.loading || props.checkoutDisabled} class={isAnnual() ? "w-full bg-green-600 hover:bg-green-700" : "w-full"}>{props.loading ? t("processing") : isAnnual() ? t("plans.subscribeAnnual") : t("plans.subscribeMonthly")}</Button></CardFooter>
      </Card>

      <Card class="relative flex flex-col border-2 border-primary/50">
        <CardHeader>
          <CardTitle class="text-2xl">{t("plans.enterpriseTitle")}</CardTitle>
          <CardDescription>{t("plans.enterpriseDescription")}</CardDescription>
        </CardHeader>
        <CardContent class="flex-1">
          <div class="mb-4">
            <span class="text-4xl font-bold">{formatCents(7990, language())}</span>
            <span class="text-gray-500 dark:text-muted-foreground">{t("plans.monthlyUnit")}</span>
          </div>
          <ul class="space-y-2 text-sm text-gray-600 dark:text-muted-foreground">
            <li class="flex items-center"><Check class="h-4 w-4 mr-2 text-green-500" /> {t("plans.features.unlimitedAll")}</li>
            <li class="flex items-center"><Check class="h-4 w-4 mr-2 text-green-500" /> {t("plans.features.enterpriseDevices")}</li>
          </ul>
          <p class="mt-2 text-sm text-gray-600 dark:text-muted-foreground">{t("plans.enterpriseExtraDevice")}</p>
        </CardContent>
        {props.currentPlan === "ENTERPRISE" ? <CardFooter><span class="text-sm font-medium">{t("plans.currentPlan")}</span></CardFooter> : null}
        <CardFooter><Button onClick={() => props.onSelectEnterprise()} disabled={props.loading || props.checkoutDisabled} class="w-full">{props.loading ? t("processing") : t("plans.subscribeEnterprise")}</Button></CardFooter>
      </Card>
      </div>
    </div>
  )
}
