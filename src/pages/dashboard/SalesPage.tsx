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

const salesData = [
  {
    id: "VEN-001",
    customer: "João Silva",
    total: "R$ 150,00",
    date: "05/12/2025 14:30",
  },
  {
    id: "VEN-002",
    customer: "Maria Oliveira",
    total: "R$ 85,50",
    date: "05/12/2025 14:45",
  },
  {
    id: "VEN-003",
    customer: "Mesa 05",
    total: "R$ 210,00",
    date: "05/12/2025 15:00",
  },
  {
    id: "VEN-004",
    customer: "Carlos Santos",
    total: "R$ 45,00",
    date: "05/12/2025 13:15",
  },
  {
    id: "VEN-005",
    customer: "Ana Costa",
    total: "R$ 120,00",
    date: "05/12/2025 12:00",
  },
]

export default function SalesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Vendas</h1>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Nova Venda
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vendas Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableCaption>Lista das últimas vendas realizadas.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">ID</TableHead>
                <TableHead>Cliente / Mesa</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salesData.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell className="font-medium">{sale.id}</TableCell>
                  <TableCell>{sale.customer}</TableCell>
                  <TableCell>{sale.date}</TableCell>
                  <TableCell className="text-right">{sale.total}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
