import { useTranslation } from "react-i18next"
import { Check } from "lucide-react"

import type { EstablishmentPlan } from "@/domain/models"
import { formatCurrencyBRL } from "@/i18n/format"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

type PricingCardsProps = {
  currentPlan?: EstablishmentPlan | null
  onSelectFree?: () => void
  onSelectMonthly: () => void
  onSelectAnnual: () => void
  onSelectEnterprise: () => void
  loading?: boolean
}

export function PricingCards({
  currentPlan,
  onSelectFree,
  onSelectMonthly,
  onSelectAnnual,
  onSelectEnterprise,
  loading = false,
}: PricingCardsProps) {
  const { t } = useTranslation("common")

  return (
    <div className="grid md:grid-cols-3 gap-8 mt-8">
      <Card className="relative flex flex-col border-2 border-transparent">
        <CardHeader>
          <CardTitle className="text-2xl">Free</CardTitle>
          <CardDescription>{t("plans.noPlanDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex-1">
          <span className="text-4xl font-bold">{formatCurrencyBRL(0)}</span>
          <ul className="mt-4 space-y-2 text-sm text-gray-600 dark:text-muted-foreground">
            <li className="flex items-center"><Check className="h-4 w-4 mr-2 text-green-500" /> {t("plans.features.fullAccess")}</li>
          </ul>
        </CardContent>
        {currentPlan === "FREE" ? <CardFooter><span className="text-sm font-medium">{t("plans.currentPlan")}</span></CardFooter> : null}
        {onSelectFree ? <CardFooter><Button onClick={onSelectFree} disabled={loading} className="w-full">{t("select")}</Button></CardFooter> : null}
      </Card>

      <Card className="relative flex flex-col border-2 border-transparent hover:border-primary/50 transition-all">
        <CardHeader>
          <CardTitle className="text-2xl">{t("plans.monthly")}</CardTitle>
          <CardDescription>{t("plans.monthlyDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex-1">
          <div className="mb-4">
            <span className="text-4xl font-bold">{formatCurrencyBRL(14.9)}</span>
            <span className="text-gray-500 dark:text-muted-foreground">{t("plans.monthlyUnit")}</span>
          </div>
          <ul className="space-y-2 text-sm text-gray-600 dark:text-muted-foreground">
            <li className="flex items-center"><Check className="h-4 w-4 mr-2 text-green-500" /> {t("plans.features.fullAccess")}</li>
            <li className="flex items-center"><Check className="h-4 w-4 mr-2 text-green-500" /> {t("plans.features.prioritySupport")}</li>
            <li className="flex items-center"><Check className="h-4 w-4 mr-2 text-green-500" /> {t("plans.features.cancelAnytime")}</li>
          </ul>
        </CardContent>
        {currentPlan === "PAGO" || currentPlan === "PAGO_LEGADO" ? <CardFooter><span className="text-sm font-medium">{t("plans.currentPlan")}</span></CardFooter> : null}
        <CardFooter><Button onClick={onSelectMonthly} disabled={loading} className="w-full">{loading ? t("processing") : t("plans.subscribeMonthly")}</Button></CardFooter>
      </Card>

      <Card className="relative flex flex-col border-2 border-green-500 shadow-lg scale-105 z-10">
        <div className="absolute top-0 right-0 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">{t("plans.popular")}</div>
        <CardHeader>
          <CardTitle className="text-2xl">{t("plans.annual")}</CardTitle>
          <CardDescription>{t("plans.annualDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex-1">
          <div className="mb-4">
            <span className="text-4xl font-bold">{formatCurrencyBRL(60.91)}</span>
            <span className="text-gray-500 dark:text-muted-foreground">{t("plans.annualUnit")}</span>
          </div>
          <p className="text-sm text-green-600 font-medium mb-4">{t("plans.equivalentMonthly", { price: formatCurrencyBRL(5.07) })}</p>
          <ul className="space-y-2 text-sm text-gray-600 dark:text-muted-foreground">
            <li className="flex items-center"><Check className="h-4 w-4 mr-2 text-green-500" /> {t("plans.features.sameAsMonthly")}</li>
            <li className="flex items-center"><Check className="h-4 w-4 mr-2 text-green-500" /> {t("plans.features.discount")}</li>
            <li className="flex items-center"><Check className="h-4 w-4 mr-2 text-green-500" /> {t("plans.features.annualBilling")}</li>
          </ul>
        </CardContent>
        {currentPlan === "PAGO" || currentPlan === "PAGO_LEGADO" ? <CardFooter><span className="text-sm font-medium">{t("plans.currentPlan")}</span></CardFooter> : null}
        <CardFooter><Button onClick={onSelectAnnual} disabled={loading} className="w-full bg-green-600 hover:bg-green-700">{loading ? t("processing") : t("plans.subscribeAnnual")}</Button></CardFooter>
      </Card>

      <Card className="relative flex flex-col border-2 border-primary/50">
        <CardHeader>
          <CardTitle className="text-2xl">{t("plans.enterpriseTitle")}</CardTitle>
          <CardDescription>{t("plans.enterpriseDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex-1">
          <div className="mb-4">
            <span className="text-4xl font-bold">{formatCurrencyBRL(79.9)}</span>
            <span className="text-gray-500 dark:text-muted-foreground">{t("plans.monthlyUnit")}</span>
          </div>
          <p className="text-sm text-gray-600 dark:text-muted-foreground">{t("plans.enterpriseExtraDevice")}</p>
        </CardContent>
        {currentPlan === "ENTERPRISE" ? <CardFooter><span className="text-sm font-medium">{t("plans.currentPlan")}</span></CardFooter> : null}
        <CardFooter><Button onClick={onSelectEnterprise} disabled={loading} className="w-full">{loading ? t("processing") : t("plans.subscribeEnterprise")}</Button></CardFooter>
      </Card>
    </div>
  )
}
