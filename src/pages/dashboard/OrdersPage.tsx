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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/contexts/AuthContext"
import { usePolling } from "@/hooks/usePolling"
import { useToast } from "@/contexts/ToastContext"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { ProductSelectionModal } from "@/components/ProductSelectionModal"
import { Pagination } from "@/components/Pagination"
import { ordersService, type Order } from "@/services/orders"
import { formatDateTime, formatCurrency } from "@/utils/format"

type ConfirmAction =
  | { type: 'delete'; orderId: number }
  | { type: 'status'; orderId: number; newStatus: string }

export default function OrdersPage() {
  const { user } = useAuth()
  const toast = useToast()

  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [statusFilter, setStatusFilter] = useState('NAO_FECHADOS')
  const [orders, setOrders] = useState<Order[]>([])
  const [totalPages, setTotalPages] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null)
  const [currentOrderItems, setCurrentOrderItems] = useState<any[]>([])
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null)
  const [newOrdersCount, setNewOrdersCount] = useState(0)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const ordersRef = useRef<Order[]>([])

  const fetchOrders = async () => {
    setIsLoading(true)
    try {
      const { items, totalPages, hasMore } = await ordersService.list({ page, limit, status: statusFilter })
      setOrders(items)
      ordersRef.current = items
      setTotalPages(totalPages)
      setHasMore(hasMore)
    } catch {
      toast("Erro ao carregar pedidos", "error")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [page, limit, statusFilter])

  const poll = async () => {
    try {
      const { items } = await ordersService.list({ page, limit, status: statusFilter })
      const previous = ordersRef.current
      const changed =
        items.length !== previous.length ||
        items.some((o, i) => {
          const p = previous[i]
          return (
            o.id !== p?.id ||
            o.status !== p?.status ||
            o.total !== p?.total ||
            (o.updatedAt || o.dataCriacao) !== (p.updatedAt || p.dataCriacao)
          )
        })
      if (changed) {
        setOrders(items)
        ordersRef.current = items
        if (page === 1 && items.length > previous.length) {
          setNewOrdersCount(items.length - previous.length)
        }
      }
    } catch { /* silent */ }
  }

  usePolling(poll, 8000)

  const handleOpenCreateModal = () => {
    setCurrentOrder(null)
    setCurrentOrderItems([])
    setIsModalOpen(true)
  }

  const handleEditClick = async (order: Order) => {
    setCurrentOrder(order)
    try {
      const { items } = await ordersService.getWithItems(order.id)
      setCurrentOrderItems(items)
    } catch {
      setCurrentOrderItems([])
    }
    setIsModalOpen(true)
  }

  const handleModalConfirm = async (
    cliente: string,
    itens: { produtoId: number; quantidade: number; precoHistorico?: number }[]
  ) => {
    try {
      if (currentOrder) {
        await ordersService.update(currentOrder.id, cliente, itens)
      } else {
        await ordersService.create(cliente, itens)
      }
      fetchOrders()
      setIsModalOpen(false)
    } catch {
      toast("Erro ao salvar pedido", "error")
    }
  }

  const handleConfirmAction = async () => {
    if (!confirmAction) return
    const action = confirmAction
    setConfirmAction(null)

    if (action.type === 'delete') {
      setDeletingId(action.orderId)
      try {
        await ordersService.delete(action.orderId)
        toast("Pedido excluído", "success")
        fetchOrders()
      } catch {
        toast("Erro ao excluir pedido", "error")
      } finally {
        setDeletingId(null)
      }
    } else if (action.type === 'status') {
      setUpdatingStatusId(action.orderId)
      try {
        await ordersService.updateStatus(action.orderId, action.newStatus)
        fetchOrders()
      } catch {
        toast("Erro ao atualizar status", "error")
      } finally {
        setUpdatingStatusId(null)
      }
    }
  }

  const confirmDescription =
    confirmAction?.type === 'delete'
      ? 'Tem certeza que deseja excluir este pedido?'
      : confirmAction?.newStatus === 'FECHADO'
      ? 'Tem certeza que deseja fechar este pedido? Ele será transformado em venda.'
      : 'Tem certeza que deseja alterar o status do pedido?'

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
        )}
      </div>

      <ProductSelectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleModalConfirm}
        title={currentOrder ? "Editar Pedido" : "Novo Pedido"}
        initialClientName={currentOrder?.cliente || ""}
        initialOrderItems={currentOrderItems as any}
        isEditing={!!currentOrder}
        initialStatus={currentOrder?.status}
        onChangeStatus={
          currentOrder
            ? (val) => setConfirmAction({ type: 'status', orderId: currentOrder.id, newStatus: val })
            : undefined
        }
        onCloseOrder={
          currentOrder
            ? () => {
                setConfirmAction({ type: 'status', orderId: currentOrder.id, newStatus: 'FECHADO' })
                return Promise.resolve()
              }
            : undefined
        }
      />

      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.type === 'delete' ? 'Excluir Pedido' : 'Alterar Status'}
        description={confirmDescription}
        confirmLabel={confirmAction?.type === 'delete' ? 'Excluir' : 'Confirmar'}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmAction(null)}
      />

      <Card>
        <CardHeader>
          <CardTitle>Pedidos Recentes</CardTitle>
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
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          order.status === 'FECHADO'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                            : order.status === 'ABERTO'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
                        }`}
                      >
                        {order.status}
                      </span>
                    </TableCell>
                    <TableCell>{formatDateTime(order.updatedAt || order.dataCriacao)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(order.total)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {order.status !== 'FECHADO' && (
                          <div className="flex items-center gap-2">
                            <Select
                              value={order.status}
                              onValueChange={(val) =>
                                setConfirmAction({ type: 'status', orderId: order.id, newStatus: val })
                              }
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
                          onClick={() => setConfirmAction({ type: 'delete', orderId: order.id })}
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
