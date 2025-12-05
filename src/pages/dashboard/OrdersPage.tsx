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
import { Plus } from "lucide-react"

const ordersData = [
  {
    id: "PED-001",
    customer: "João Silva",
    total: "R$ 150,00",
    status: "Concluído",
    date: "05/12/2025 14:30",
  },
  {
    id: "PED-002",
    customer: "Maria Oliveira",
    total: "R$ 85,50",
    status: "Em preparo",
    date: "05/12/2025 14:45",
  },
  {
    id: "PED-003",
    customer: "Mesa 05",
    total: "R$ 210,00",
    status: "Aberto",
    date: "05/12/2025 15:00",
  },
  {
    id: "PED-004",
    customer: "Carlos Santos",
    total: "R$ 45,00",
    status: "Concluído",
    date: "05/12/2025 13:15",
  },
  {
    id: "PED-005",
    customer: "Ana Costa",
    total: "R$ 120,00",
    status: "Cancelado",
    date: "05/12/2025 12:00",
  },
]

export default function OrdersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Pedidos</h1>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Novo Pedido
        </Button>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordersData.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.id}</TableCell>
                  <TableCell>{order.customer}</TableCell>
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
                  <TableCell>{order.date}</TableCell>
                  <TableCell className="text-right">{order.total}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
