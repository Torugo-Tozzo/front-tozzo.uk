import { useSearchParams } from "react-router-dom"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ClipboardList } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { PedidosTab } from "@/components/atendimento/PedidosTab"
import { VendasTab } from "@/components/atendimento/VendasTab"

type TabKey = 'pedidos' | 'vendas'
const VALID_TABS: TabKey[] = ['pedidos', 'vendas']

export default function AtendimentoPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const activeTab: TabKey = VALID_TABS.includes(tabParam as TabKey) ? (tabParam as TabKey) : 'pedidos'

  const handleTabChange = (value: string) => {
    setSearchParams(value === 'pedidos' ? {} : { tab: value }, { replace: true })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
        <ClipboardList className="h-8 w-8" />
        {`Atendimento${user?.estabelecimento?.nomeFantasia ? ` — ${user.estabelecimento.nomeFantasia}` : ''}`}
      </h1>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full space-y-6">
        <TabsList>
          <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
          <TabsTrigger value="vendas">Vendas</TabsTrigger>
        </TabsList>

        <TabsContent value="pedidos">
          <PedidosTab />
        </TabsContent>
        <TabsContent value="vendas">
          <VendasTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
