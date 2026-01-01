import { useState, useEffect, useCallback } from "react"
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
import { Plus, Pencil, Trash2, ShoppingBag, Search, Loader2, Power } from "lucide-react"
import api from "@/services/api"
import useSSE from "@/hooks/useSSE"
import { Pagination } from "@/components/Pagination"
import { useAuth } from "@/contexts/AuthContext"

type ProductType = {
  id: number
  descricao: string
  isEditable?: boolean
  cor?: string
  ativo?: boolean
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
  const { user } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [productTypes, setProductTypes] = useState<ProductType[]>([])
  const [pagedTypes, setPagedTypes] = useState<ProductType[]>([])
  const [typesPage, setTypesPage] = useState(1)
  const [typesLimit, setTypesLimit] = useState(10)
  const [typesTotalPages, setTypesTotalPages] = useState(0)
  const [typesTotalItems, setTypesTotalItems] = useState(0)
  const [typesHasMore, setTypesHasMore] = useState(false)
  const [typesSearch, setTypesSearch] = useState("")
  const [typeColor, setTypeColor] = useState<string>("#000000")
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
    // load all types for selects/lookup and load first page for types table
    fetchTypesAll()
    fetchTypesPage()
  }, [])

  useEffect(() => {
    const delay = setTimeout(() => {
      fetchTypesPage()
    }, 300)
    return () => clearTimeout(delay)
  }, [typesPage, typesLimit, typesSearch])

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchProducts()
    }, 300)
    return () => clearTimeout(delayDebounceFn)
  }, [page, limit, search])

  const handleProductsSSE = useCallback((payload: any) => {
    try {
      const action = payload.action
      const produto = payload.produto
      if (!produto) return
      if (action === 'created') {
        if (page === 1) setProducts(prev => [produto, ...prev].slice(0, limit))
      } else if (action === 'updated') {
        setProducts(prev => prev.map(p => (p.id === produto.id ? { ...p, ...produto } : p)))
      } else if (action === 'deleted') {
        setProducts(prev => prev.filter(p => p.id !== produto.id))
      }
    } catch (e) { console.error('[Products SSE handler] error', e) }
  }, [page, limit])

  useSSE(handleProductsSSE, { path: '/stream' })

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

  // fetch all types (used for selects and product mapping)
  const fetchTypesAll = async () => {
    try {
      const response = await api.get("/tipos?all=true")
      const types: ProductType[] = response.data.map((t: any) => ({
        id: t.id,
        descricao: t.descricao,
        isEditable: t.isEditable ?? t.editavel ?? true,
        cor: t.cor ?? t.color ?? "#111827",
        ativo: typeof t.ativo === "boolean" ? t.ativo : (t.ativo === 0 ? false : true),
      }))
      setProductTypes(types)
    } catch (error) {
      console.error("Error fetching types", error)
    }
  }

  // fetch paginated types for the types table
  const fetchTypesPage = async () => {
    try {
      const response = await api.get(`/tipos?page=${typesPage}&limit=${typesLimit}&all=true&search=${encodeURIComponent(typesSearch)}`)

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

      const types: ProductType[] = data.map((t: any) => ({
        id: t.id,
        descricao: t.descricao,
        isEditable: t.isEditable ?? t.editavel ?? true,
        cor: t.cor ?? t.color ?? "#111827",
        ativo: typeof t.ativo === "boolean" ? t.ativo : (t.ativo === 0 ? false : true),
      }))

      setPagedTypes(types)
      setTypesTotalItems(total)

      if (total > 0) {
        setTypesTotalPages(Math.ceil(total / typesLimit))
        setTypesHasMore(typesPage < Math.ceil(total / typesLimit))
      } else {
        setTypesTotalPages(0)
        setTypesHasMore(types.length === typesLimit)
      }
    } catch (error) {
      console.error("Error fetching paged types", error)
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
      await api.post("/tipos", { descricao: typeName, cor: typeColor })
      await fetchTypesAll()
      await fetchTypesPage()
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
    setTypeColor(type.cor ?? "#000000")
    setIsEditTypeDialogOpen(true)
  }

  const handleUpdateType = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentType) return
    setIsLoading(true)
    try {
      await api.put(`/tipos/${currentType.id}`, { descricao: typeName, cor: typeColor })
      await fetchTypesAll()
      await fetchTypesPage()
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
    const type = productTypes.find(t => t.id === id)
    const currentlyActive = type?.ativo ?? true
    const action = currentlyActive ? 'inativar' : 'ativar'
    if (confirm(`Tem certeza que deseja ${action} este tipo?`)) {
      setDeletingId(id)
      try {
        // toggle ativo via PATCH endpoint, API expects { ativo: boolean }
        await api.patch(`/tipos/${id}/ativo`, { ativo: !currentlyActive })
        // refresh types and products because inactive types hide their products
        await fetchTypesAll()
        await fetchTypesPage()
        await fetchProducts()
      } catch (error) {
        console.error("Error toggling type active", error)
        alert("Erro ao atualizar status do tipo. Verifique se não há produtos vinculados.")
      } finally {
        setDeletingId(null)
      }
    }
  }

  const resetTypeForm = () => {
    setTypeName("")
    setCurrentType(null)
    setTypeColor("#000000")
  }

  const getType = (id: number) => {
    return productTypes.find(t => t.id === id) || null
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="products" className="w-full space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ShoppingBag className="h-8 w-8" />
            {`Gerenciamento${user?.estabelecimento?.nomeFantasia ? ` do ${user.estabelecimento.nomeFantasia}` : ''}`}
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
                    <div className="space-y-2">
                      <Label htmlFor="typeColor">Cor</Label>
                      <Input
                        id="typeColor"
                        type="color"
                        value={typeColor}
                        onChange={(e) => setTypeColor(e.target.value)}
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
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Preço</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products
                    .filter((product) => {
                      const t = getType(product.tipoProdutoId)
                      // hide products whose type is explicitly inactive
                      return t ? (t.ativo !== false) : true
                    })
                    .map((product, index) => (
                    <TableRow key={product.id}>
                      <TableCell>{(page - 1) * limit + index + 1}</TableCell>
                      <TableCell>{product.nome}</TableCell>
                      <TableCell>
                        {(() => {
                          const t = getType(product.tipoProdutoId)
                          if (t) {
                            return (
                              <span
                                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                                style={{ backgroundColor: t.cor ?? '#111827', color: '#fff' }}
                              >
                                {t.descricao}
                              </span>
                            )
                          }
                          return (
                            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground">
                              {getTypeName(product.tipoProdutoId)}
                            </span>
                          )
                        })()}
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
                  <div className="flex items-center justify-between">
                    <CardTitle>Tipos de Produtos</CardTitle>
                    <div className="relative w-[250px]">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar tipos..."
                        value={typesSearch}
                        onChange={(e) => {
                          setTypesSearch(e.target.value)
                          setTypesPage(1)
                        }}
                        className="pl-8"
                      />
                    </div>
                  </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableCaption>Lista de tipos de produtos cadastrados.</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-[160px]">Origem</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedTypes.map((type, index) => (
                    <TableRow key={type.id} className={type.ativo === false ? 'opacity-60' : ''}>
                      <TableCell>{(typesPage - 1) * typesLimit + index + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-3 w-3 rounded-full"
                            style={{ backgroundColor: type.cor ?? '#111827' }}
                          />
                          <span>{type.descricao}{type.ativo === false ? ' (Inativo)' : ''}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {type.isEditable === false ? 'Padrão do Sistema' : 'Criado pelo usuário'}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {type.isEditable && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditTypeClick(type)}
                              disabled={deletingId === type.id}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteType(type.id)}
                            disabled={deletingId === type.id}
                            aria-label={type.ativo === false ? 'Ativar tipo' : 'Inativar tipo'}
                          >
                            {deletingId === type.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Power
                                className={`h-4 w-4 ${type.ativo === false ? 'text-muted-foreground' : 'text-emerald-600'}`}
                              />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mb-4 text-sm text-muted-foreground">
                Total de registros: {typesTotalItems}
              </div>
              <Pagination
                currentPage={typesPage}
                totalPages={typesTotalPages}
                hasMore={typesHasMore}
                onPageChange={setTypesPage}
                pageSize={typesLimit}
                onPageSizeChange={(newLimit) => {
                  setTypesLimit(newLimit)
                  setTypesPage(1)
                }}
              />
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
              <div className="space-y-2">
                <Label htmlFor="edit-typeColor">Cor</Label>
                <Input
                  id="edit-typeColor"
                  type="color"
                  value={typeColor}
                  onChange={(e) => setTypeColor(e.target.value)}
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
