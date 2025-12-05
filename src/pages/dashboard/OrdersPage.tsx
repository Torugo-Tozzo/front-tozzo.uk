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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Pencil, Trash2, ShoppingCart } from "lucide-react"
import api from "@/services/api"

type Order = {
  id: number
  cliente: string
  total: number
  status: string
  dataCriacao: string
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null)

  // Form states
  const [customer, setCustomer] = useState("")
  const [status, setStatus] = useState("Aberto")

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

  const handleAddOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post("/pedidos", {
        cliente: customer,
        status: "Aberto",
        total: 0 // Initial total
      })
      fetchOrders()
      setIsAddDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error("Error creating order", error)
      alert("Erro ao criar pedido")
    }
  }

  const handleEditClick = (order: Order) => {
    setCurrentOrder(order)
    setCustomer(order.cliente)
    setStatus(order.status)
    setIsEditDialogOpen(true)
  }

  const handleUpdateOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentOrder) return

    try {
      await api.put(`/pedidos/${currentOrder.id}`, {
        cliente: customer,
        status
      })
      fetchOrders()
      setIsEditDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error("Error updating order", error)
      alert("Erro ao atualizar pedido")
    }
  }

  const handleDeleteOrder = async (id: number) => {
    if (confirm("Tem certeza que deseja excluir este pedido?")) {
      try {
        await api.delete(`/pedidos/${id}`)
        fetchOrders()
      } catch (error) {
        console.error("Error deleting order", error)
        alert("Erro ao excluir pedido")
      }
    }
  }

  const resetForm = () => {
    setCustomer("")
    setStatus("Aberto")
    setCurrentOrder(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <ShoppingCart className="h-8 w-8" />
          Pedidos
        </h1>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" /> Novo Pedido
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Pedido</DialogTitle>
              <DialogDescription>
                Inicie um novo pedido para um cliente ou mesa.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddOrder} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customer">Cliente / Mesa</Label>
                <Input
                  id="customer"
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                  placeholder="Ex: João Silva ou Mesa 05"
                  required
                />
              </div>
              <DialogFooter>
                <Button type="submit">Criar Pedido</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

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
                  <TableCell>{order.cliente}</TableCell>
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

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Pedido</DialogTitle>
            <DialogDescription>
              Atualize o status ou dados do pedido.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateOrder} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-customer">Cliente / Mesa</Label>
              <Input
                id="edit-customer"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Aberto">Aberto</SelectItem>
                  <SelectItem value="Em preparo">Em preparo</SelectItem>
                  <SelectItem value="Concluído">Concluído</SelectItem>
                  <SelectItem value="Cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit">Salvar Alterações</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
