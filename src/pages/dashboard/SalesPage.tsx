import { DollarSign } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { VendasTab } from "@/components/dashboard/VendasTab"

export default function SalesPage() {
  const { user } = useAuth()

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
        <DollarSign className="h-8 w-8" />
        {`Vendas${user?.estabelecimento?.nomeFantasia ? ` do ${user.estabelecimento.nomeFantasia}` : ''}`}
      </h1>

      <VendasTab />
    </div>
  )
}
