import { useState, useEffect, useRef, useCallback } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusSelect } from "@/components/ui/status-select"
import { IconButton } from "@/components/ui/icon-button"
import { Printer, Pencil, Trash2, Loader2 } from "lucide-react"
import api, { getErrorMessage } from "@/services/api"
import { parseListResponse } from "@/services/parseResponse"
import { toast } from "sonner"
import { ProductSelectionModal } from "@/components/ProductSelectionModal"
import { Pagination } from "@/components/Pagination"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents"
import { getStatusColor, type PedidoStatus } from "@/lib/status"

type OrderItem = {
  produtoId: number
  quantidade: number
  produto?: { nome: string } | null
}

type Order = {
  id: number
  cliente: string
  total: number
  status: PedidoStatus
  dataCriacao: string
  updatedAt: string
  vendedor?: { id: number; nome: string } | null
  itens?: OrderItem[]
}

function isOrdersEqual(a: Order[], b: Order[]) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]
    const bi = b[i]
    if (ai.id !== bi.id) return false
    if (ai.status !== bi.status) return false
    if ((ai.updatedAt || ai.dataCriacao) !== (bi.updatedAt || bi.dataCriacao)) return false
    if (ai.total !== bi.total) return false
  }
  return true
}

function formatItemsSummary(itens?: OrderItem[]): string {
  if (!itens || itens.length === 0) return ""
  return itens.map((i) => `${i.quantidade}x ${i.produto?.nome ?? "Produto"}`).join(", ")
}

interface PedidosTabProps {
  onReady?: (handlers: { openCreate: () => void }) => void
}

export function PedidosTab({ onReady }: PedidosTabProps) {
  const [page, setPage] = useState<number>(1)
  const [limit, setLimit] = useState<number>(10)
  const [statusFilter, setStatusFilter] = useState<string>('NAO_FECHADOS')
  const [orders, setOrders] = useState<Order[]>([])
  const [totalPages, setTotalPages] = useState<number>(0)
  const [hasMore, setHasMore] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null)
  const [currentOrderItems, setCurrentOrderItems] = useState<any[]>([])
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null)
  const ordersRef = useRef<Order[]>([])

  const loadOrdersRaw = useCallback(async () => {
    const params: any = { page, limit }
    if (statusFilter) {
      params.status = statusFilter
    }

    const response = await api.get(`/pedidos`, { params })

    let { data, total } = parseListResponse<Order>(response)

    if (statusFilter === 'NAO_FECHADOS') {
      data = data.filter((o) => o.status !== 'FECHADO')
      total = data.length
    }

    return { data, total }
  }, [page, limit, statusFilter])

  const fetchOrders = useCallback(async () => {
    setIsLoading(true)
    try {
      const { data, total } = await loadOrdersRaw()
      setOrders(data)
      ordersRef.current = data

      if (total > 0) {
        setTotalPages(Math.ceil(total / limit))
        setHasMore(page < Math.ceil(total / limit))
      } else {
        setTotalPages(0)
        setHasMore(data.length === limit)
      }
    } catch (error) {
      console.error("Error fetching orders", error)
    } finally {
      setIsLoading(false)
    }
  }, [loadOrdersRaw, limit, page])

  const poll = useCallback(async () => {
    try {
      const { data } = await loadOrdersRaw()
      const previous = ordersRef.current || []
      if (!isOrdersEqual(previous, data)) {
        setOrders(data)
        ordersRef.current = data
      }
    } catch (err) {
      console.error('[PedidosTab] Error polling orders', err)
    }
  }, [loadOrdersRaw])

  useRealtimeEvents(['pedidos'], poll)

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // Fallback: SSE eh o caminho principal (useRealtimeEvents acima), esse
  // interval mais espaçado so cobre o caso de conexao SSE falhar silenciosamente.
  useEffect(() => {
    let interval: number | null = null

    const startPolling = () => {
      if (interval != null) return
      poll()
      interval = window.setInterval(poll, 60000)
    }

    const stopPolling = () => {
      if (interval != null) {
        clearInterval(interval)
        interval = null
      }
    }

    const handleVisibilityChange = () => {
      const visibility = (typeof document !== 'undefined' && document.visibilityState) || 'unknown'
      if (visibility === 'visible') {
        startPolling()
      } else {
        stopPolling()
      }
    }

    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      startPolling()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleVisibilityChange)
    window.addEventListener('blur', handleVisibilityChange)

    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleVisibilityChange)
      window.removeEventListener('blur', handleVisibilityChange)
    }
  }, [poll])

  const handleOpenCreateModal = useCallback(() => {
    setCurrentOrder(null)
    setCurrentOrderItems([])
    setIsModalOpen(true)
  }, [])

  useEffect(() => {
    onReady?.({ openCreate: handleOpenCreateModal })
  }, [onReady, handleOpenCreateModal])

  const handleEditClick = async (order: Order) => {
    setCurrentOrder(order)
    try {
      const response = await api.get(`/pedidos`, { params: { id: order.id } })

      let orderData = null
      if (response.data.data && Array.isArray(response.data.data)) {
        orderData = response.data.data[0]
      } else if (Array.isArray(response.data)) {
        orderData = response.data[0]
      }

      if (orderData && orderData.itens) {
        const items = orderData.itens.map((item: any) => ({
          produtoId: item.produtoId ?? (item.produto ? item.produto.id : undefined),
          quantidade: Number(item.quantidade) || 0,
          precoHistorico: item.precoHistorico != null ? Number(item.precoHistorico) : (item.preco != null ? Number(item.preco) : (item.produto ? Number(item.produto.preco || 0) : undefined)),
        })).filter((i: any) => i.produtoId != null && i.produtoId !== '')
        setCurrentOrderItems(items)
      } else {
        setCurrentOrderItems([])
      }
    } catch (error) {
      console.error("Error fetching order details", error)
      setCurrentOrderItems([])
    }
    setIsModalOpen(true)
  }

  const handleModalConfirm = async (cliente: string, itens: { produtoId: number; quantidade: number; precoHistorico?: number }[]) => {
    try {
      if (currentOrder) {
        await api.put(`/pedidos/${currentOrder.id}`, { cliente, itens })
      } else {
        await api.post("/pedidos", { cliente, itens })
      }

      fetchOrders()
      setIsModalOpen(false)
    } catch (error) {
      console.error("Error saving order", error)
      toast.error(getErrorMessage(error, "Erro ao salvar pedido"))
    }
  }

  const handleDeleteOrder = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir este pedido?")) return
    setDeletingId(id)
    try {
      await api.delete(`/pedidos/${id}`)
      fetchOrders()
    } catch (error) {
      console.error("Error deleting order", error)
      toast.error(getErrorMessage(error, "Erro ao excluir pedido"))
    } finally {
      setDeletingId(null)
    }
  }

  const handleCloseOrder = async (id: number) => {
    if (!confirm("Tem certeza que deseja fechar este pedido? Ele será transformado em venda.")) return
    try {
      await api.post(`/pedidos/${id}/status`, { status: 'FECHADO' })
      fetchOrders()
    } catch (error) {
      console.error("Error closing order", error)
      toast.error(getErrorMessage(error, "Erro ao fechar pedido"))
    }
  }

  const handleChangeStatus = async (id: number, newStatus: string) => {
    setUpdatingStatusId(id)
    try {
      await api.post(`/pedidos/${id}/status`, { status: newStatus })
      fetchOrders()
    } catch (error) {
      console.error('Error updating order status', error)
      toast.error(getErrorMessage(error, 'Erro ao atualizar status do pedido'))
    } finally {
      setUpdatingStatusId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="w-[200px]">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="NAO_FECHADOS">Não Fechados</SelectItem>
            <SelectItem value="ABERTO">Aberto</SelectItem>
            <SelectItem value="EM_PREPARO">Em Preparo</SelectItem>
            <SelectItem value="ENTREGANDO">Entregando</SelectItem>
            <SelectItem value="FECHADO">Fechado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ProductSelectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleModalConfirm}
        title={currentOrder ? "Editar Pedido (Adicionar Itens)" : "Novo Pedido"}
        initialClientName={currentOrder?.cliente || ""}
        initialOrderItems={currentOrderItems as any}
        isEditing={!!currentOrder}
        onCloseOrder={currentOrder ? () => handleCloseOrder(currentOrder.id) : undefined}
        initialStatus={currentOrder?.status}
        onChangeStatus={currentOrder ? (val: string) => handleChangeStatus(currentOrder.id, val) : undefined}
      />

      <Card>
        <CardHeader>
          <CardTitle>Pedidos Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px] text-center">#</TableHead>
                <TableHead>Cliente / Mesa</TableHead>
                <TableHead>Criado por</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-[150px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                    <TableCell className="text-right justify-end flex"><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell className="text-right justify-end flex gap-2">
                      <Skeleton className="h-8 w-8" />
                      <Skeleton className="h-8 w-8" />
                      <Skeleton className="h-8 w-8" />
                    </TableCell>
                  </TableRow>
                ))
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum pedido encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order, index) => (
                  <TableRow key={order.id} accentColor={getStatusColor(order.status)}>
                    <TableCell className="text-center">{(page - 1) * limit + index + 1}</TableCell>
                    <TableCell>
                      <div className="font-medium">{order.cliente || "Não Informado"}</div>
                      {formatItemsSummary(order.itens) && (
                        <div
                          className="text-sm text-muted-foreground truncate max-w-[280px]"
                          title={formatItemsSummary(order.itens)}
                        >
                          {formatItemsSummary(order.itens)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{order.vendedor?.nome || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StatusSelect
                          value={order.status}
                          disabled={order.status === 'FECHADO' || updatingStatusId === order.id}
                          onValueChange={(val) => {
                            if (!confirm('Tem certeza que deseja alterar o status do pedido?')) return
                            handleChangeStatus(order.id, val)
                          }}
                        />
                        {updatingStatusId === order.id && <Loader2 className="h-4 w-4 animate-spin" />}
                      </div>
                    </TableCell>
                    <TableCell>{new Date(order.updatedAt || order.dataCriacao).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <IconButton icon={<Printer className="h-4 w-4" />} label="Impressão (em breve)" disabled />
                        <IconButton icon={<Pencil className="h-4 w-4" />} label="Editar pedido" onClick={() => handleEditClick(order)} />
                        <IconButton
                          icon={deletingId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          label="Excluir pedido"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteOrder(order.id)}
                          disabled={deletingId === order.id}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            hasMore={hasMore}
            onPageChange={setPage}
            pageSize={limit}
            onPageSizeChange={(newLimit) => {
              setLimit(newLimit)
              setPage(1)
            }}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>
    </div>
  )
}
