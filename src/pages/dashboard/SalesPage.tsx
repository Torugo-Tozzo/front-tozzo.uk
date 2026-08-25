import { DollarSign } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { VendasTab } from "@/components/dashboard/VendasTab"
import { useTranslation } from "react-i18next"

export default function SalesPage() {
  const { user } = useAuth()
  const { t } = useTranslation("sales")
  const title = user?.establishment?.tradeName
    ? t("pageTitle", { establishment: user.establishment.tradeName })
    : t("title")

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
        <DollarSign className="h-8 w-8" />
        {title}
      </h1>

      <VendasTab />
    </div>
  )
}
