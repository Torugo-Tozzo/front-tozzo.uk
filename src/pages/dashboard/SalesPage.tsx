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
import { Plus, DollarSign } from "lucide-react"
import api from "@/services/api"
import { ProductSelectionModal } from "@/components/ProductSelectionModal"

type Sale = {
  id: number
  cliente: string
  total: number
  horario: string
}

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    fetchSales()
  }, [])

  const fetchSales = async () => {
    try {
      const response = await api.get("/vendas")
      setSales(response.data)
    } catch (error) {
      console.error("Error fetching sales", error)
    }
  }

  const handleModalConfirm = async (cliente: string, itens: { produtoId: number; quantidade: number }[]) => {
    try {
      await api.post("/vendas", {
        cliente,
        itens
      })
      fetchSales()
      setIsModalOpen(false)
    } catch (error) {
      console.error("Error creating sale", error)
      alert("Erro ao criar venda")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <DollarSign className="h-8 w-8" />
          Vendas
        </h1>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nova Venda
        </Button>
      </div>

      <ProductSelectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleModalConfirm}
        title="Nova Venda"
        initialClientName=""
      />

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
              {sales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell className="font-medium">{sale.id}</TableCell>
                  <TableCell>{sale.cliente || "Não Informado"}</TableCell>
                  <TableCell>
                    {sale.horario ? new Date(sale.horario).toLocaleString() : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sale.total)}
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
