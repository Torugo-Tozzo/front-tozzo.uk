import { useState, useEffect, useCallback } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, Loader2 } from "lucide-react"
import api, { getErrorMessage } from "@/services/api"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"

type ProductType = { id: number; descricao: string }
type Product = { id: number; nome: string; preco: number; tipoProdutoId: number }

interface ProdutosQuickTabProps {
  onReady?: (handlers: { openCreate: () => void }) => void
}

export function ProdutosQuickTab({ onReady }: ProdutosQuickTabProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [types, setTypes] = useState<ProductType[]>([])
  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [name, setName] = useState("")
  const [price, setPrice] = useState("")
  const [typeId, setTypeId] = useState("")

  const fetchProducts = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await api.get("/produtos", { params: { search } })
      const data = Array.isArray(response.data) ? response.data : (response.data?.data ?? [])
      setProducts(data.map((p: any) => ({ ...p, preco: Number(p.preco) || 0 })))
    } catch (error) {
      console.error("Error fetching products", error)
    } finally {
      setIsLoading(false)
    }
  }, [search])

  const fetchTypes = useCallback(async () => {
    try {
      const response = await api.get("/tipos", { params: { all: true } })
      setTypes(response.data.map((t: any) => ({ id: t.id, descricao: t.descricao })))
    } catch (error) {
      console.error("Error fetching types", error)
    }
  }, [])

  useEffect(() => {
    fetchTypes()
  }, [fetchTypes])

  useEffect(() => {
    const delay = setTimeout(fetchProducts, 300)
    return () => clearTimeout(delay)
  }, [fetchProducts])

  const getTypeName = (id: number) => types.find((t) => t.id === id)?.descricao ?? "-"

  const openCreate = useCallback(() => {
    setName("")
    setPrice("")
    setTypeId("")
    setIsDialogOpen(true)
  }, [])

  useEffect(() => {
    onReady?.({ openCreate })
  }, [onReady, openCreate])

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, "")
    setPrice((parseInt(rawValue || "0") / 100).toFixed(2))
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!typeId) {
      toast.warning("Selecione um tipo de produto.")
      return
    }
    setIsSaving(true)
    try {
      await api.post("/produtos", {
        nome: name,
        preco: parseFloat(price),
        ingredientes: "",
        tipoProdutoId: parseInt(typeId),
      })
      toast.success("Produto criado.")
      setIsDialogOpen(false)
      fetchProducts()
    } catch (error) {
      console.error("Error creating product", error)
      toast.error(getErrorMessage(error, "Erro ao criar produto"))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Produtos</CardTitle>
        <div className="relative w-[250px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Preço</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-[180px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                  <TableCell className="text-right justify-end flex"><Skeleton className="h-4 w-16" /></TableCell>
                </TableRow>
              ))
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  Nenhum produto encontrado.
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>{product.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{getTypeName(product.tipoProdutoId)}</TableCell>
                  <TableCell className="text-right">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.preco)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Produto novo</DialogTitle>
            <DialogDescription>Cadastro rápido — para edição completa, use a página Produtos.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quick-name">Nome</Label>
              <Input id="quick-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-price">Preço</Label>
              <Input id="quick-price" value={price} onChange={handlePriceChange} placeholder="0.00" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-type">Tipo</Label>
              <Select value={typeId} onValueChange={setTypeId}>
                <SelectTrigger id="quick-type">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {types.map((type) => (
                    <SelectItem key={type.id} value={type.id.toString()}>{type.descricao}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
