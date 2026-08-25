import { ClipboardList } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { PedidosTab } from "@/components/dashboard/PedidosTab"
import { useTranslation } from "react-i18next"

export default function OrdersPage() {
  const { user } = useAuth()
  const { t } = useTranslation("orders")
  const title = user?.establishment?.tradeName
    ? t("pageTitle", { establishment: user.establishment.tradeName })
    : t("title")

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
        <ClipboardList className="h-8 w-8" />
        {title}
      </h1>

      <PedidosTab />
    </div>
  )
}
