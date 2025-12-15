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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Pencil, Trash2, ShoppingBag, Search, Loader2 } from "lucide-react"
import api from "@/services/api"
import { Pagination } from "@/components/Pagination"

type ProductType = {
  id: number
  descricao: string
  isEditable?: boolean
}

type Product = {
  id: number
  nome: string
  preco: number
  ingredientes: string
  tipoProdutoId: number
  tipoProduto?: ProductType
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [productTypes, setProductTypes] = useState<ProductType[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [totalPages, setTotalPages] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // Form states
  const [name, setName] = useState("")
  const [price, setPrice] = useState("")
  const [ingredients, setIngredients] = useState("")
  const [typeId, setTypeId] = useState<string>("")

  // Type dialogs/forms
  const [isAddTypeDialogOpen, setIsAddTypeDialogOpen] = useState(false)
  const [isEditTypeDialogOpen, setIsEditTypeDialogOpen] = useState(false)
  const [typeName, setTypeName] = useState("")
  const [currentType, setCurrentType] = useState<ProductType | null>(null)

  useEffect(() => {
    fetchTypes()
  }, [])

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchProducts()
    }, 300)
    return () => clearTimeout(delayDebounceFn)
  }, [page, limit, search])

  const fetchProducts = async () => {
    try {
      const response = await api.get(`/produtos?page=${page}&limit=${limit}&search=${search}`)
      
      let data = []
      let total = 0

      if (response.data.data) {
        data = response.data.data
        total = response.data.total || response.data.count || 0
      } else if (Array.isArray(response.data)) {
        data = response.data
        const totalHeader = response.headers['x-total-count']
        total = totalHeader ? parseInt(totalHeader) : 0
      }

      setProducts(data)
      setTotalItems(total)

      if (total > 0) {
        setTotalPages(Math.ceil(total / limit))
        setHasMore(page < Math.ceil(total / limit))
      } else {
        setTotalPages(0)
        setHasMore(data.length === limit)
      }
    } catch (error) {
      console.error("Error fetching products", error)
    }
  }

  const fetchTypes = async () => {
    try {
      const response = await api.get("/tipos")
      setProductTypes(response.data)
    } catch (error) {
      console.error("Error fetching types", error)
    }
  }

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, "")
    const numberValue = parseInt(rawValue || "0") / 100
    setPrice(numberValue.toFixed(2))
  }

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!typeId) {
      alert("Por favor, selecione um tipo de produto.")
      return
    }
    setIsLoading(true)
    try {
      await api.post("/produtos", {
        nome: name,
        preco: parseFloat(price),
        ingredientes: ingredients,
        tipoProdutoId: parseInt(typeId),
      })
      fetchProducts()
      setIsAddDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error("Error creating product", error)
      alert("Erro ao criar produto")
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditClick = (product: Product) => {
    setCurrentProduct(product)
    setName(product.nome)
    setPrice(Number(product.preco).toFixed(2))
    setIngredients(product.ingredientes)
    setTypeId(product.tipoProdutoId?.toString() || "")
    setIsEditDialogOpen(true)
  }

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentProduct) return
    if (!typeId) {
      alert("Por favor, selecione um tipo de produto.")
      return
    }
    setIsLoading(true)
    try {
      await api.put(`/produtos/${currentProduct.id}`, {
        nome: name,
        preco: parseFloat(price),
        ingredientes: ingredients,
        tipoProdutoId: parseInt(typeId),
      })
      fetchProducts()
      setIsEditDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error("Error updating product", error)
      alert("Erro ao atualizar produto")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteProduct = async (id: number) => {
    if (confirm("Tem certeza que deseja excluir este produto?")) {
      setDeletingId(id)
      try {
        await api.delete(`/produtos/${id}`)
        fetchProducts()
      } catch (error) {
        console.error("Error deleting product", error)
        alert("Erro ao excluir produto")
      } finally {
        setDeletingId(null)
      }
    }
  }


  const resetForm = () => {
    setName("")
    setPrice("")
    setIngredients("")
    setTypeId("")
    setCurrentProduct(null)
  }

  const getTypeName = (id: number) => {
    const type = productTypes.find(t => t.id === id)
    return type ? type.descricao : "-"
  }

  const handleAddType = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await api.post("/tipos", { descricao: typeName })
      fetchTypes()
      setIsAddTypeDialogOpen(false)
      resetTypeForm()
    } catch (error) {
      console.error("Error creating type", error)
      alert("Erro ao criar tipo")
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditTypeClick = (type: ProductType) => {
    setCurrentType(type)
    setTypeName(type.descricao)
    setIsEditTypeDialogOpen(true)
  }

  const handleUpdateType = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentType) return
    setIsLoading(true)
    try {
      await api.put(`/tipos/${currentType.id}`, { descricao: typeName })
      fetchTypes()
      setIsEditTypeDialogOpen(false)
      resetTypeForm()
    } catch (error) {
      console.error("Error updating type", error)
      alert("Erro ao atualizar tipo")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteType = async (id: number) => {
    if (confirm("Tem certeza que deseja excluir este tipo?")) {
      setDeletingId(id)
      try {
        await api.delete(`/tipos/${id}`)
        fetchTypes()
      } catch (error) {
        console.error("Error deleting type", error)
        alert("Erro ao excluir tipo. Verifique se não há produtos vinculados.")
      } finally {
        setDeletingId(null)
      }
    }
  }

  const resetTypeForm = () => {
    setTypeName("")
    setCurrentType(null)
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="products" className="w-full space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ShoppingBag className="h-8 w-8" />
            Gerenciamento
          </h1>
          
          <div className="flex items-center gap-4">
            <TabsList>
              <TabsTrigger value="products">Produtos</TabsTrigger>
              <TabsTrigger value="types">Tipos</TabsTrigger>
            </TabsList>

            <TabsContent value="products" className="mt-0">
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={resetForm}>
                    <Plus className="mr-2 h-4 w-4" /> Novo Produto
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adicionar Produto</DialogTitle>
                    <DialogDescription>
                      Preencha os dados para cadastrar um novo produto no cardápio.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddProduct} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome</Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="price">Preço</Label>
                      <Input
                        id="price"
                        value={price}
                        onChange={handlePriceChange}
                        placeholder="0.00"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="type">Tipo</Label>
                      <Select value={typeId} onValueChange={setTypeId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          {productTypes.map((type) => (
                            <SelectItem key={type.id} value={type.id.toString()}>
                              {type.descricao}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ingredients">Ingredientes</Label>
                      <Input
                        id="ingredients"
                        value={ingredients}
                        onChange={(e) => setIngredients(e.target.value)}
                        placeholder="Separe por vírgula"
                      />
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Salvar
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </TabsContent>

            <TabsContent value="types" className="mt-0">
              <Dialog open={isAddTypeDialogOpen} onOpenChange={setIsAddTypeDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={resetTypeForm}>
                    <Plus className="mr-2 h-4 w-4" /> Novo Tipo
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adicionar Tipo de Produto</DialogTitle>
                    <DialogDescription>
                      Cadastre um novo tipo de produto para categorizar o cardápio.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddType} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="typeName">Descrição</Label>
                      <Input
                        id="typeName"
                        value={typeName}
                        onChange={(e) => setTypeName(e.target.value)}
                        required
                      />
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Salvar
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </TabsContent>
          </div>
        </div>

        <TabsContent value="products">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
              <CardTitle>Cardápio</CardTitle>
              <div className="relative w-[250px]">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produtos..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 text-sm text-muted-foreground">
                Total de registros: {totalItems}
              </div>
              <Table>
                <TableCaption>Lista de todos os produtos cadastrados.</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead className="w-[100px]">ID</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Preço</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product, index) => (
                    <TableRow key={product.id}>
                      <TableCell>{(page - 1) * limit + index + 1}</TableCell>
                      <TableCell className="font-medium">{product.id}</TableCell>
                      <TableCell>{product.nome}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground">
                          {getTypeName(product.tipoProdutoId)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.preco)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditClick(product)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteProduct(product.id)}
                            disabled={deletingId === product.id}
                          >
                            {deletingId === product.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
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
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="types">
          <Card>
            <CardHeader>
              <CardTitle>Tipos de Produtos</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableCaption>Lista de tipos de produtos cadastrados.</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">ID</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productTypes.map((type) => (
                    <TableRow key={type.id}>
                      <TableCell className="font-medium">{type.id}</TableCell>
                      <TableCell>{type.descricao}</TableCell>
                      <TableCell className="text-right">
                        {type.isEditable && (
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditTypeClick(type)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDeleteType(type.id)}
                              disabled={deletingId === type.id}
                            >
                              {deletingId === type.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Product Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Produto</DialogTitle>
            <DialogDescription>
              Atualize os dados do produto.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateProduct} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-price">Preço</Label>
              <Input
                id="edit-price"
                value={price}
                onChange={handlePriceChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-type">Tipo</Label>
              <Select value={typeId} onValueChange={setTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {productTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id.toString()}>
                      {type.descricao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-ingredients">Ingredientes</Label>
              <Input
                id="edit-ingredients"
                value={ingredients}
                onChange={(e) => setIngredients(e.target.value)}
                placeholder="Separe por vírgula"
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Alterações
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Type Dialog */}
      <Dialog open={isEditTypeDialogOpen} onOpenChange={setIsEditTypeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Tipo</DialogTitle>
            <DialogDescription>
              Atualize a descrição do tipo de produto.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateType} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-typeName">Descrição</Label>
              <Input
                id="edit-typeName"
                value={typeName}
                onChange={(e) => setTypeName(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Alterações
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
