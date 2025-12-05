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
import { Plus, DollarSign } from "lucide-react"
import api from "@/services/api"

type Sale = {
  id: number
  cliente: string
  total: number
  dataCriacao: string
}

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [customer, setCustomer] = useState("")
  const [total, setTotal] = useState("")

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

  const handleAddSale = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post("/vendas", {
        cliente: customer,
        total: parseFloat(total.replace("R$", "").replace(",", ".").trim())
      })
      fetchSales()
      setIsAddDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error("Error creating sale", error)
      alert("Erro ao criar venda")
    }
  }

  const resetForm = () => {
    setCustomer("")
    setTotal("")
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <DollarSign className="h-8 w-8" />
          Vendas
        </h1>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" /> Nova Venda
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Venda</DialogTitle>
              <DialogDescription>
                Registre uma nova venda manualmente.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddSale} className="space-y-4">
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
              <div className="space-y-2">
                <Label htmlFor="total">Total</Label>
                <Input
                  id="total"
                  value={total}
                  onChange={(e) => setTotal(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
              <DialogFooter>
                <Button type="submit">Registrar Venda</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
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
              {sales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell className="font-medium">{sale.id}</TableCell>
                  <TableCell>{sale.cliente}</TableCell>
                  <TableCell>{new Date(sale.dataCriacao).toLocaleString()}</TableCell>
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
