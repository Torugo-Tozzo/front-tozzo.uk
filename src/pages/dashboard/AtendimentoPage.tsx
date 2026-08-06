import { useState, useCallback } from "react"
import { useSearchParams } from "react-router-dom"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Plus, ClipboardList } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { PedidosTab } from "@/components/atendimento/PedidosTab"
import { VendasTab } from "@/components/atendimento/VendasTab"
import { ProdutosQuickTab } from "@/components/atendimento/ProdutosQuickTab"

type TabKey = 'pedidos' | 'vendas' | 'produtos'
const VALID_TABS: TabKey[] = ['pedidos', 'vendas', 'produtos']

const TAB_ACTION_LABEL: Record<TabKey, string> = {
  pedidos: '+ Novo Pedido',
  vendas: '+ Nova Venda',
  produtos: '+ Novo Produto',
}

export default function AtendimentoPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const activeTab: TabKey = VALID_TABS.includes(tabParam as TabKey) ? (tabParam as TabKey) : 'pedidos'
  const [createHandler, setCreateHandler] = useState<(() => void) | null>(null)

  const handleTabChange = (value: string) => {
    setSearchParams(value === 'pedidos' ? {} : { tab: value }, { replace: true })
    setCreateHandler(null)
  }

  const registerCreateHandler = useCallback((handlers: { openCreate: () => void }) => {
    setCreateHandler(() => handlers.openCreate)
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <ClipboardList className="h-8 w-8" />
          {`Atendimento${user?.estabelecimento?.nomeFantasia ? ` — ${user.estabelecimento.nomeFantasia}` : ''}`}
        </h1>
        <Button onClick={() => createHandler?.()} disabled={!createHandler}>
          <Plus className="mr-2 h-4 w-4" /> {TAB_ACTION_LABEL[activeTab]}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full space-y-6">
        <TabsList>
          <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
          <TabsTrigger value="vendas">Vendas</TabsTrigger>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
        </TabsList>

        <TabsContent value="pedidos">
          <PedidosTab onReady={registerCreateHandler} />
        </TabsContent>
        <TabsContent value="vendas">
          <VendasTab onReady={registerCreateHandler} />
        </TabsContent>
        <TabsContent value="produtos">
          <ProdutosQuickTab onReady={registerCreateHandler} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
