import { useState, useEffect, useRef } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Pencil, Trash2, ShoppingCart, Loader2 } from "lucide-react"
import api from "@/services/api"
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
import { useAuth } from "@/contexts/AuthContext"

type Order = {
  id: number
  cliente: string
  total: number
  status: string
  dataCriacao: string
  updatedAt: string
}

export default function OrdersPage() {
  const { user } = useAuth()
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
  const [newOrdersCount, setNewOrdersCount] = useState<number>(0)
  const ordersRef = useRef<Order[]>([])

  const loadOrdersRaw = async () => {
    const params: any = { page, limit }
    if (statusFilter) {
      params.status = statusFilter
    }

    const response = await api.get(`/pedidos`, { params })

    let data: any[] = []
    let total = 0

    if (response.data.data) {
      data = response.data.data
      total = response.data.total || response.data.count || 0
    } else if (Array.isArray(response.data)) {
      data = response.data
      const totalHeader = response.headers['x-total-count']
      total = totalHeader ? parseInt(totalHeader) : 0
    }

    if (statusFilter === 'NAO_FECHADOS') {
      data = data.filter((o: any) => o.status !== 'FECHADO')
      total = data.length
    }

    return { data, total }
  }

  const fetchOrders = async () => {
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
  }

  useEffect(() => {
    fetchOrders()
  }, [page, limit, statusFilter])

  // Polling: every 8 seconds check for updates and update state only if changed
  // But only run polling when the page/tab is visible. When the tab becomes visible
  // do an immediate poll and resume the interval. Pause polling when hidden.
  useEffect(() => {
    let mounted = true
    let interval: number | null = null

    const isOrdersEqual = (a: Order[], b: Order[]) => {
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

    const poll = async () => {
      try {
        const { data } = await loadOrdersRaw()
        if (!mounted) return

        const previous = ordersRef.current || []
        if (!isOrdersEqual(previous, data)) {
          setOrders(data)
          ordersRef.current = data

          // if new items were added at the top (only when page === 1), show count
          if (page === 1 && data.length > previous.length) {
            setNewOrdersCount(data.length - previous.length)
          }
        } else {
        }
      } catch (err) {
        console.error('[OrdersPage] Error polling orders', err)
      }
    }

    const startPolling = () => {
      if (interval != null) return
      poll()
      interval = window.setInterval(poll, 8000)
    }

    const stopPolling = () => {
      if (interval != null) {
        clearInterval(interval)
        interval = null
      }
    }

    const handleVisibilityChange = () => {
      if (!mounted) return
      const visibility = (typeof document !== 'undefined' && document.visibilityState) || 'unknown'
      if (visibility === 'visible') {
        startPolling()
      } else {
        stopPolling()
      }
    }

    // start polling only if the page is visible
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      startPolling()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleVisibilityChange)
    window.addEventListener('blur', handleVisibilityChange)

    return () => {
      mounted = false
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleVisibilityChange)
      window.removeEventListener('blur', handleVisibilityChange)
    }
  }, [page, limit, statusFilter])

  const handleOpenCreateModal = () => {
    setCurrentOrder(null)
    setCurrentOrderItems([])
    setIsModalOpen(true)
  }

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
        // Edit Mode - Full Update via PUT
        await api.put(`/pedidos/${currentOrder.id}`, {
          cliente,
          itens
        })
      } else {
        // Create Mode
        await api.post("/pedidos", {
          cliente,
          itens
        })
      }
      
      fetchOrders()
      setIsModalOpen(false)
    } catch (error) {
      console.error("Error saving order", error)
      alert("Erro ao salvar pedido")
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
      alert("Erro ao excluir pedido")
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
      alert("Erro ao fechar pedido")
    } finally {
    }
  }

  const handleChangeStatus = async (id: number, newStatus: string) => {
    setUpdatingStatusId(id)
    try {
      await api.post(`/pedidos/${id}/status`, { status: newStatus })
      fetchOrders()
    } catch (error) {
      console.error('Error updating order status', error)
      alert('Erro ao atualizar status do pedido')
    } finally {
      setUpdatingStatusId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <ShoppingCart className="h-8 w-8" />
          {`Pedidos${user?.estabelecimento?.nomeFantasia ? ` do ${user.estabelecimento.nomeFantasia}` : ''}`}
        </h1>
        <Button onClick={handleOpenCreateModal} disabled={isLoading}>
          <Plus className="mr-2 h-4 w-4" /> Novo Pedido
        </Button>
      </div>

      <div className="flex gap-4 items-center">
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
        {newOrdersCount > 0 && (
          <div>
            <Button
              variant="ghost"
              onClick={() => {
                setPage(1)
                fetchOrders()
                setNewOrdersCount(0)
              }}
            >
              Mostrar {newOrdersCount} novos
            </Button>
          </div>
        )}
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
          <CardTitle>Pedidos Recentes!</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>Cliente / Mesa</TableHead>
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
                      <TableCell><Skeleton className="h-5 w-24 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                      <TableCell className="text-right justify-end flex"><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell className="text-right justify-end flex gap-2">
                        <Skeleton className="h-8 w-8" />
                        <Skeleton className="h-8 w-8" />
                        <Skeleton className="h-8 w-8" />
                      </TableCell>
                    </TableRow>
                  ))
              ) : (
                orders.map((order, index) => (
                <TableRow key={order.id}>
                  <TableCell>{(page - 1) * limit + index + 1}</TableCell>
                  <TableCell>{order.cliente || "Não Informado"}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
                      ${order.status === 'FECHADO' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 
                        order.status === 'ABERTO' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
                      }`}>
                      {order.status}
                    </span>
                  </TableCell>
                  <TableCell>{new Date(order.updatedAt || order.dataCriacao).toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {order.status !== 'FECHADO' && (
                        <div className="flex items-center gap-2">
                          <Select
                            value={order.status}
                            onValueChange={(val) => {
                              const confirmMsg = 'Tem certeza que deseja alterar o status do pedido?'
                              if (!confirm(confirmMsg)) return
                              handleChangeStatus(order.id, val)
                            }}
                            disabled={updatingStatusId === order.id}
                          >
                            <SelectTrigger className="w-[150px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ABERTO">Aberto</SelectItem>
                              <SelectItem value="EM_PREPARO">Em Preparo</SelectItem>
                              <SelectItem value="ENTREGANDO">Entregando</SelectItem>
                              <SelectItem value="FECHADO">Fechado</SelectItem>
                            </SelectContent>
                          </Select>
                          {updatingStatusId === order.id && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          )}
                        </div>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditClick(order)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteOrder(order.id)}
                        disabled={deletingId === order.id}
                      >
                        {deletingId === order.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )))}
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
