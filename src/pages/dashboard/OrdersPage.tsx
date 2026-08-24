import { ClipboardList } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { PedidosTab } from "@/components/dashboard/PedidosTab"

export default function OrdersPage() {
  const { user } = useAuth()

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
        <ClipboardList className="h-8 w-8" />
        {`Pedidos${user?.establishment?.tradeName ? ` do ${user.establishment.tradeName}` : ''}`}
      </h1>

      <PedidosTab />
    </div>
  )
}
