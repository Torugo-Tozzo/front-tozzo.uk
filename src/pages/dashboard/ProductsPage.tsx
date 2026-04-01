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
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Pencil, Trash2, ShoppingBag, Search, Loader2, Power } from "lucide-react"
import { Pagination } from "@/components/Pagination"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { useAuth } from "@/contexts/AuthContext"
import { useDebounce } from "@/hooks/useDebounce"
import { useToast } from "@/contexts/ToastContext"
import { productsService, productTypesService, type Product, type ProductType } from "@/services/products"
import { formatCurrency } from "@/utils/format"

type ConfirmAction =
  | { type: 'deleteProduct'; id: number }
  | { type: 'toggleType'; id: number; currentlyActive: boolean }

export default function ProductsPage() {
  const { user } = useAuth()
  const toast = useToast()

  // Products state
  const [products, setProducts] = useState<Product[]>([])
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [totalPages, setTotalPages] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // Product form
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null)
  const [productForm, setProductForm] = useState({ name: "", price: "", ingredients: "", typeId: "" })

  // Types state
  const [productTypes, setProductTypes] = useState<ProductType[]>([])
  const [pagedTypes, setPagedTypes] = useState<ProductType[]>([])
  const [typesPage, setTypesPage] = useState(1)
  const [typesLimit, setTypesLimit] = useState(10)
  const [typesTotalPages, setTypesTotalPages] = useState(0)
  const [typesTotalItems, setTypesTotalItems] = useState(0)
  const [typesHasMore, setTypesHasMore] = useState(false)
  const [typesSearch, setTypesSearch] = useState("")
  const [isTypesLoading, setIsTypesLoading] = useState(false)

  // Type form
  const [isAddTypeDialogOpen, setIsAddTypeDialogOpen] = useState(false)
  const [isEditTypeDialogOpen, setIsEditTypeDialogOpen] = useState(false)
  const [currentType, setCurrentType] = useState<ProductType | null>(null)
  const [typeForm, setTypeForm] = useState({ name: "", color: "#000000" })

  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)

  const debouncedSearch = useDebounce(search, 300)
  const debouncedTypesSearch = useDebounce(typesSearch, 300)

  useEffect(() => {
    fetchTypesAll()
  }, [])

  useEffect(() => {
    fetchProducts()
  }, [page, limit, debouncedSearch])

  useEffect(() => {
    fetchTypesPage()
  }, [typesPage, typesLimit, debouncedTypesSearch])

  const fetchProducts = async () => {
    setIsLoading(true)
    try {
      const { items, total, totalPages, hasMore } = await productsService.list(page, limit, debouncedSearch)
      setProducts(items)
      setTotalItems(total)
      setTotalPages(totalPages)
      setHasMore(hasMore)
    } catch {
      toast("Erro ao carregar produtos", "error")
    } finally {
      setIsLoading(false)
    }
  }

  const fetchTypesAll = async () => {
    try {
      const types = await productTypesService.listAll()
      setProductTypes(types)
    } catch { /* non-critical */ }
  }

  const fetchTypesPage = async () => {
    setIsTypesLoading(true)
    try {
      const { items, total, totalPages, hasMore } = await productTypesService.listPaged(
        typesPage,
        typesLimit,
        debouncedTypesSearch
      )
      setPagedTypes(items)
      setTypesTotalItems(total)
      setTypesTotalPages(totalPages)
      setTypesHasMore(hasMore)
    } catch {
      toast("Erro ao carregar tipos", "error")
    } finally {
      setIsTypesLoading(false)
    }
  }

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "")
    const number = parseInt(raw || "0") / 100
    setProductForm(f => ({ ...f, price: number.toFixed(2) }))
  }

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!productForm.typeId) { toast("Selecione um tipo de produto", "error"); return }
    setIsLoading(true)
    try {
      await productsService.create({
        nome: productForm.name,
        preco: parseFloat(productForm.price),
        ingredientes: productForm.ingredients,
        tipoProdutoId: parseInt(productForm.typeId),
      })
      toast("Produto criado com sucesso", "success")
      fetchProducts()
      setIsAddDialogOpen(false)
      resetProductForm()
    } catch {
      toast("Erro ao criar produto", "error")
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditProductClick = (product: Product) => {
    setCurrentProduct(product)
    setProductForm({
      name: product.nome,
      price: Number(product.preco).toFixed(2),
      ingredients: product.ingredientes,
      typeId: product.tipoProdutoId?.toString() || "",
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentProduct) return
    if (!productForm.typeId) { toast("Selecione um tipo de produto", "error"); return }
    setIsLoading(true)
    try {
      await productsService.update(currentProduct.id, {
        nome: productForm.name,
        preco: parseFloat(productForm.price),
        ingredientes: productForm.ingredients,
        tipoProdutoId: parseInt(productForm.typeId),
      })
      toast("Produto atualizado", "success")
      fetchProducts()
      setIsEditDialogOpen(false)
      resetProductForm()
    } catch {
      toast("Erro ao atualizar produto", "error")
    } finally {
      setIsLoading(false)
    }
  }

  const resetProductForm = () => {
    setProductForm({ name: "", price: "", ingredients: "", typeId: "" })
    setCurrentProduct(null)
  }

  const handleAddType = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsTypesLoading(true)
    try {
      await productTypesService.create(typeForm.name, typeForm.color)
      toast("Tipo criado com sucesso", "success")
      await fetchTypesAll()
      await fetchTypesPage()
      setIsAddTypeDialogOpen(false)
      resetTypeForm()
    } catch {
      toast("Erro ao criar tipo", "error")
    } finally {
      setIsTypesLoading(false)
    }
  }

  const handleEditTypeClick = (type: ProductType) => {
    setCurrentType(type)
    setTypeForm({ name: type.descricao, color: type.cor ?? "#000000" })
    setIsEditTypeDialogOpen(true)
  }

  const handleUpdateType = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentType) return
    setIsTypesLoading(true)
    try {
      await productTypesService.update(currentType.id, typeForm.name, typeForm.color)
      toast("Tipo atualizado", "success")
      await fetchTypesAll()
      await fetchTypesPage()
      setIsEditTypeDialogOpen(false)
      resetTypeForm()
    } catch {
      toast("Erro ao atualizar tipo", "error")
    } finally {
      setIsTypesLoading(false)
    }
  }

  const resetTypeForm = () => {
    setTypeForm({ name: "", color: "#000000" })
    setCurrentType(null)
  }

  const handleConfirmAction = async () => {
    if (!confirmAction) return
    const action = confirmAction
    setConfirmAction(null)
    setDeletingId(action.id)
    try {
      if (action.type === 'deleteProduct') {
        await productsService.delete(action.id)
        toast("Produto excluído", "success")
        fetchProducts()
      } else {
        await productTypesService.toggleActive(action.id, !action.currentlyActive)
        toast(action.currentlyActive ? "Tipo inativado" : "Tipo ativado", "success")
        await fetchTypesAll()
        await fetchTypesPage()
        await fetchProducts()
      }
    } catch {
      toast(action.type === 'deleteProduct' ? "Erro ao excluir produto" : "Erro ao atualizar tipo", "error")
    } finally {
      setDeletingId(null)
    }
  }

  const getType = (id: number) => productTypes.find(t => t.id === id) ?? null

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
                  <Button onClick={resetProductForm} disabled={isLoading}>
                    <Plus className="mr-2 h-4 w-4" /> Novo Produto
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adicionar Produto</DialogTitle>
                    <DialogDescription>Preencha os dados para cadastrar um novo produto no cardápio.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddProduct} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome</Label>
                      <Input id="name" value={productForm.name} onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="price">Preço</Label>
                      <Input id="price" value={productForm.price} onChange={handlePriceChange} placeholder="0.00" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="type">Tipo</Label>
                      <Select value={productForm.typeId} onValueChange={v => setProductForm(f => ({ ...f, typeId: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                        <SelectContent>
                          {productTypes.map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.descricao}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ingredients">Ingredientes</Label>
                      <Input id="ingredients" value={productForm.ingredients} onChange={e => setProductForm(f => ({ ...f, ingredients: e.target.value }))} placeholder="Separe por vírgula" />
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </TabsContent>

            <TabsContent value="types" className="mt-0">
              <Dialog open={isAddTypeDialogOpen} onOpenChange={setIsAddTypeDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={resetTypeForm} disabled={isTypesLoading}>
                    <Plus className="mr-2 h-4 w-4" /> Novo Tipo
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adicionar Tipo de Produto</DialogTitle>
                    <DialogDescription>Cadastre um novo tipo de produto para categorizar o cardápio.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddType} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="typeName">Descrição</Label>
                      <Input id="typeName" value={typeForm.name} onChange={e => setTypeForm(f => ({ ...f, name: e.target.value }))} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="typeColor">Cor</Label>
                      <Input id="typeColor" type="color" value={typeForm.color} onChange={e => setTypeForm(f => ({ ...f, color: e.target.value }))} />
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={isTypesLoading}>
                        {isTypesLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
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
                <Input placeholder="Buscar produtos..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} className="pl-8" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 text-sm text-muted-foreground">Total de registros: {totalItems}</div>
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
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                        <TableCell className="text-right justify-end flex"><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell className="text-right justify-end gap-2 flex">
                          <Skeleton className="h-8 w-8" /><Skeleton className="h-8 w-8" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    products
                      .filter(p => getType(p.tipoProdutoId)?.ativo !== false)
                      .map((product, index) => {
                        const type = getType(product.tipoProdutoId)
                        return (
                          <TableRow key={product.id}>
                            <TableCell>{(page - 1) * limit + index + 1}</TableCell>
                            <TableCell>{product.nome}</TableCell>
                            <TableCell>
                              {type ? (
                                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: type.cor ?? '#111827', color: '#fff' }}>
                                  {type.descricao}
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(product.preco)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="icon" onClick={() => handleEditProductClick(product)}><Pencil className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setConfirmAction({ type: 'deleteProduct', id: product.id })} disabled={deletingId === product.id}>
                                  {deletingId === product.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                  )}
                </TableBody>
              </Table>
              <Pagination currentPage={page} totalPages={totalPages} hasMore={hasMore} onPageChange={setPage} pageSize={limit} onPageSizeChange={newLimit => { setLimit(newLimit); setPage(1) }} isLoading={isLoading} />
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
                  <Input placeholder="Buscar tipos..." value={typesSearch} onChange={e => { setTypesSearch(e.target.value); setTypesPage(1) }} className="pl-8" />
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
                  {isTypesLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                        <TableCell><div className="flex items-center gap-2"><Skeleton className="h-3 w-3 rounded-full" /><Skeleton className="h-4 w-[150px]" /></div></TableCell>
                        <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                        <TableCell className="text-right justify-end gap-2 flex"><Skeleton className="h-8 w-8" /><Skeleton className="h-8 w-8" /></TableCell>
                      </TableRow>
                    ))
                  ) : (
                    pagedTypes.map((type, index) => (
                      <TableRow key={type.id} className={type.ativo === false ? 'opacity-60' : ''}>
                        <TableCell>{(typesPage - 1) * typesLimit + index + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: type.cor ?? '#111827' }} />
                            <span>{type.descricao}{type.ativo === false ? ' (Inativo)' : ''}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{type.isEditable === false ? 'Padrão do Sistema' : 'Criado pelo usuário'}</div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {type.isEditable && (
                              <Button variant="ghost" size="icon" onClick={() => handleEditTypeClick(type)} disabled={deletingId === type.id}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => setConfirmAction({ type: 'toggleType', id: type.id, currentlyActive: type.ativo ?? true })} disabled={deletingId === type.id} aria-label={type.ativo === false ? 'Ativar tipo' : 'Inativar tipo'}>
                              {deletingId === type.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className={`h-4 w-4 ${type.ativo === false ? 'text-muted-foreground' : 'text-emerald-600'}`} />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <div className="mt-2 mb-4 text-sm text-muted-foreground">Total de registros: {typesTotalItems}</div>
              <Pagination currentPage={typesPage} totalPages={typesTotalPages} hasMore={typesHasMore} onPageChange={setTypesPage} pageSize={typesLimit} onPageSizeChange={newLimit => { setTypesLimit(newLimit); setTypesPage(1) }} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Product Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Produto</DialogTitle>
            <DialogDescription>Atualize os dados do produto.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateProduct} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome</Label>
              <Input id="edit-name" value={productForm.name} onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-price">Preço</Label>
              <Input id="edit-price" value={productForm.price} onChange={handlePriceChange} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-type">Tipo</Label>
              <Select value={productForm.typeId} onValueChange={v => setProductForm(f => ({ ...f, typeId: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                <SelectContent>
                  {productTypes.map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.descricao}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-ingredients">Ingredientes</Label>
              <Input id="edit-ingredients" value={productForm.ingredients} onChange={e => setProductForm(f => ({ ...f, ingredients: e.target.value }))} placeholder="Separe por vírgula" />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar Alterações
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
            <DialogDescription>Atualize a descrição do tipo de produto.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateType} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-typeName">Descrição</Label>
              <Input id="edit-typeName" value={typeForm.name} onChange={e => setTypeForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-typeColor">Cor</Label>
              <Input id="edit-typeColor" type="color" value={typeForm.color} onChange={e => setTypeForm(f => ({ ...f, color: e.target.value }))} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isTypesLoading}>
                {isTypesLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar Alterações
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.type === 'deleteProduct' ? 'Excluir Produto' : confirmAction?.currentlyActive ? 'Inativar Tipo' : 'Ativar Tipo'}
        description={
          confirmAction?.type === 'deleteProduct'
            ? 'Tem certeza que deseja excluir este produto?'
            : confirmAction?.currentlyActive
            ? 'Tem certeza que deseja inativar este tipo?'
            : 'Tem certeza que deseja ativar este tipo?'
        }
        confirmLabel={confirmAction?.type === 'deleteProduct' ? 'Excluir' : 'Confirmar'}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  )
}
