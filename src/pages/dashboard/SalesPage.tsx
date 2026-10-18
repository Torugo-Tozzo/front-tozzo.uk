import { DollarSign } from "lucide-solid"

import { VendasTab } from "@/components/dashboard/VendasTab"
import { useAuth } from "@/contexts/AuthContext"
import { useTranslation } from "@/i18n/solid"

export default function SalesPage() {
  const { user } = useAuth()
  const { t } = useTranslation("sales")
  const title = () => {
    const tradeName = user()?.establishment?.tradeName
    return tradeName ? t("pageTitle", { establishment: tradeName }) : t("title")
  }

  return (
    <div class="space-y-6">
      <h1 class="text-3xl font-bold tracking-tight flex items-center gap-2">
        <DollarSign class="h-8 w-8" />
        {title()}
      </h1>

      <VendasTab />
    </div>
  )
}
