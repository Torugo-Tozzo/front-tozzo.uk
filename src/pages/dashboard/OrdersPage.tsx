import { useState, useEffect } from "react"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Pencil, Trash2, ShoppingCart } from "lucide-react"
import api from "@/services/api"
import { ProductSelectionModal } from "@/components/ProductSelectionModal"

type Order = {
  id: number
  cliente: string
  total: number
  status: string
  dataCriacao: string
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null)

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    try {
      const response = await api.get("/pedidos")
      setOrders(response.data)
    } catch (error) {
      console.error("Error fetching orders", error)
    }
  }

  const handleOpenCreateModal = () => {
    setCurrentOrder(null)
    setIsModalOpen(true)
  }

  const handleEditClick = (order: Order) => {
    setCurrentOrder(order)
    setIsModalOpen(true)
  }

  const handleModalConfirm = async (cliente: string, itens: { produtoId: number; quantidade: number }[]) => {
    try {
      if (currentOrder) {
        // Edit Mode
        // 1. Update Client Name if changed
        if (cliente !== currentOrder.cliente) {
          await api.put(`/pedidos/${currentOrder.id}`, { cliente })
        }
        
        // 2. Add new items if any
        if (itens.length > 0) {
          await api.post(`/pedidos/${currentOrder.id}/itens`, { itens })
        }
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
    try {
      await api.delete(`/pedidos/${id}`)
      fetchOrders()
    } catch (error) {
      console.error("Error deleting order", error)
      alert("Erro ao excluir pedido")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <ShoppingCart className="h-8 w-8" />
          Pedidos
        </h1>
        <Button onClick={handleOpenCreateModal}>
          <Plus className="mr-2 h-4 w-4" /> Novo Pedido
        </Button>
      </div>

      <ProductSelectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleModalConfirm}
        title={currentOrder ? "Editar Pedido (Adicionar Itens)" : "Novo Pedido"}
        initialClientName={currentOrder?.cliente || ""}
        isEditing={!!currentOrder}
      />

      <Card>
        <CardHeader>
          <CardTitle>Pedidos Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableCaption>Lista dos últimos pedidos realizados.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">ID</TableHead>
                <TableHead>Cliente / Mesa</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.id}</TableCell>
                  <TableCell>{order.cliente || "Não Informado"}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
                      ${order.status === 'Concluído' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 
                        order.status === 'Em preparo' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' :
                        order.status === 'Aberto' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' :
                        'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                      }`}>
                      {order.status}
                    </span>
                  </TableCell>
                  <TableCell>{new Date(order.dataCriacao).toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
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
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
