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
import api, { getErrorMessage } from "@/services/api"
import { parseListResponse } from "@/services/parseResponse"
import { toast } from "sonner"
import { Pagination } from "@/components/Pagination"
import { useAuth } from "@/contexts/AuthContext"
import { useConfirm } from "@/contexts/ConfirmContext"
import { useMinLoadingDuration } from "@/hooks/useMinLoadingDuration"
import type { Product, ProductType } from "@/domain/models"

type EditableProductType = ProductType & { isEditable?: boolean }

export default function ProductsPage() {
  const { user } = useAuth()
  const confirm = useConfirm()
  const [products, setProducts] = useState<Product[]>([])
  const [productTypes, setProductTypes] = useState<EditableProductType[]>([])
  const [pagedTypes, setPagedTypes] = useState<EditableProductType[]>([])
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
  const showSkeleton = useMinLoadingDuration(isLoading)
  const [isTypesLoading, setIsTypesLoading] = useState(false)
  const showTypesSkeleton = useMinLoadingDuration(isTypesLoading)
  const [deletingId, setDeletingId] = useState<number | string | null>(null)
  // Dedicado aos formularios (criar/editar produto ou tipo) - separado do
  // isLoading/isTypesLoading, que sao so da listagem. Sem isso, salvar um
  // tipo reskeletonava a tabela de Produtos tambem (flag errada sendo usada).
  const [isSaving, setIsSaving] = useState(false)

  // Form states
  const [name, setName] = useState("")
  const [price, setPrice] = useState("")
  const [ingredients, setIngredients] = useState("")
  const [typeId, setTypeId] = useState<string>("")

  // Type dialogs/forms
  const [isAddTypeDialogOpen, setIsAddTypeDialogOpen] = useState(false)
  const [isEditTypeDialogOpen, setIsEditTypeDialogOpen] = useState(false)
  const [typeName, setTypeName] = useState("")
  const [currentType, setCurrentType] = useState<EditableProductType | null>(null)

  useEffect(() => {
    // load all types for selects/lookup and load first page for types table
    fetchTypesAll()
    fetchTypesPage()
  }, [])

  useEffect(() => {
    // load all types for selects/lookup and load first page for types table
    fetchTypesAll()
  }, [])

  useEffect(() => {
    setIsTypesLoading(true)
    const delay = setTimeout(() => {
      fetchTypesPage()
    }, 300)
    return () => clearTimeout(delay)
  }, [typesPage, typesLimit, typesSearch])

  useEffect(() => {
    setIsLoading(true)
    const delayDebounceFn = setTimeout(() => {
      fetchProducts()
    }, 300)
    return () => clearTimeout(delayDebounceFn)
  }, [page, limit, search])

  const fetchProducts = async () => {
    setIsLoading(true)
    try {
      const response = await api.get(`/produtos?page=${page}&limit=${limit}&search=${search}`)
      
      const { data, total } = parseListResponse<Product>(response)

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
    } finally {
      setIsLoading(false)
    }
  }

  // fetch all types (used for selects and product mapping)
  const fetchTypesAll = async () => {
    try {
      const response = await api.get("/tipos?all=true")
      const payload = response.data
      const rawTypes = Array.isArray(payload) ? payload : payload?.types ?? payload?.data ?? []
      const types: EditableProductType[] = rawTypes.map((t: ProductType) => ({ ...t, isEditable: (t as EditableProductType).isEditable ?? true }))
      setProductTypes(types)
    } catch (error) {
      console.error("Error fetching types", error)
    }
  }

  // fetch paginated types for the types table
  const fetchTypesPage = async () => {
    setIsTypesLoading(true)
    try {
      const response = await api.get(`/tipos?page=${typesPage}&limit=${typesLimit}&all=true&search=${encodeURIComponent(typesSearch)}`)

      const { data, total } = parseListResponse<any>(response)

      const types: EditableProductType[] = data.map((t: ProductType) => ({ ...t, isEditable: (t as EditableProductType).isEditable ?? true }))

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
    } finally {
      setIsTypesLoading(false)
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
      toast.warning("Por favor, selecione um tipo de produto.")
      return
    }
    setIsSaving(true)
    try {
      await api.post("/produtos", {
        name,
        price: parseFloat(price),
        ingredients,
        productTypeId: parseInt(typeId),
      })
      fetchProducts()
      setIsAddDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error("Error creating product", error)
      toast.error(getErrorMessage(error, "Erro ao criar produto"))
    } finally {
      setIsSaving(false)
    }
  }

  const handleEditClick = (product: Product) => {
    setCurrentProduct(product)
    setName(product.name)
    setPrice(Number(product.price).toFixed(2))
    setIngredients(product.ingredients ?? '')
    setTypeId(product.productTypeId?.toString() || "")
    setIsEditDialogOpen(true)
  }

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentProduct) return
    if (!typeId) {
      toast.warning("Por favor, selecione um tipo de produto.")
      return
    }
    setIsSaving(true)
    try {
      await api.put(`/produtos/${currentProduct.id}`, {
        name,
        price: parseFloat(price),
        ingredients,
        productTypeId: parseInt(typeId),
      })
      fetchProducts()
      setIsEditDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error("Error updating product", error)
      toast.error(getErrorMessage(error, "Erro ao atualizar produto"))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteProduct = async (id: number | string) => {
    if (await confirm({ description: "Tem certeza que deseja excluir este produto?", confirmLabel: "Excluir", destructive: true })) {
      setDeletingId(id)
      try {
        await api.delete(`/produtos/${id}`)
        fetchProducts()
      } catch (error) {
        console.error("Error deleting product", error)
        toast.error(getErrorMessage(error, "Erro ao excluir produto"))
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

  const getTypeName = (id: number | string) => {
    const type = productTypes.find(t => String(t.id) === String(id))
    return type ? type.description : "-"
  }

  const handleAddType = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      await api.post("/tipos", { description: typeName, color: typeColor })
      await fetchTypesAll()
      await fetchTypesPage()
      setIsAddTypeDialogOpen(false)
      resetTypeForm()
    } catch (error) {
      console.error("Error creating type", error)
      toast.error(getErrorMessage(error, "Erro ao criar tipo"))
    } finally {
      setIsSaving(false)
    }
  }

  const handleEditTypeClick = (type: ProductType) => {
    setCurrentType(type)
    setTypeName(type.description)
    setTypeColor(type.color ?? "#000000")
    setIsEditTypeDialogOpen(true)
  }

  const handleUpdateType = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentType) return
    setIsSaving(true)
    try {
      await api.put(`/tipos/${currentType.id}`, { description: typeName, color: typeColor })
      await fetchTypesAll()
      await fetchTypesPage()
      setIsEditTypeDialogOpen(false)
      resetTypeForm()
    } catch (error) {
      console.error("Error updating type", error)
      toast.error(getErrorMessage(error, "Erro ao atualizar tipo"))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteType = async (id: number | string) => {
    const type = productTypes.find(t => String(t.id) === String(id))
    const currentlyActive = type?.isActive ?? true
    const action = currentlyActive ? 'inativar' : 'ativar'
    if (await confirm({ description: `Tem certeza que deseja ${action} este tipo?`, confirmLabel: currentlyActive ? "Inativar" : "Ativar", destructive: currentlyActive })) {
      setDeletingId(id)
      try {
        await api.patch(`/tipos/${id}/ativo`, { isActive: !currentlyActive })
        // refresh types and products because inactive types hide their products
        await fetchTypesAll()
        await fetchTypesPage()
        await fetchProducts()
      } catch (error) {
        console.error("Error toggling type active", error)
        toast.error(getErrorMessage(error, "Erro ao atualizar status do tipo"))
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

  const getType = (id: number | string) => {
    return productTypes.find(t => String(t.id) === String(id)) || null
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="products" className="w-full space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ShoppingBag className="h-8 w-8" />
            {`Gerenciamento${user?.establishment?.tradeName ? ` do ${user.establishment.tradeName}` : ''}`}
          </h1>
          
          <div className="flex items-center gap-4">
            <TabsList>
              <TabsTrigger value="products">Produtos</TabsTrigger>
              <TabsTrigger value="types">Tipos</TabsTrigger>
            </TabsList>

            <TabsContent value="products" className="mt-0">
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={resetForm} disabled={isSaving}>
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
                              {type.description}
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
                      <Button type="submit" disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
                  <Button onClick={resetTypeForm} disabled={isSaving}>
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
                      <Button type="submit" disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
                  {showSkeleton ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i} className="animate-in fade-in-0 duration-300">
                          <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                          <TableCell className="text-right justify-end flex"><Skeleton className="h-4 w-16" /></TableCell>
                          <TableCell className="text-right justify-end gap-2 flex">
                             <Skeleton className="h-8 w-8" />
                             <Skeleton className="h-8 w-8" />
                          </TableCell>
                        </TableRow>
                      ))
                  ) : (
                    products
                      .filter((product) => {
                      const t = getType(product.productTypeId ?? 0)
                      // hide products whose type is explicitly inactive
                      return t ? (t.isActive !== false) : true
                    })
                    .map((product, index) => (
                    <TableRow key={product.id} className="animate-in fade-in-0 duration-300">
                      <TableCell>{(page - 1) * limit + index + 1}</TableCell>
                      <TableCell>{product.name}</TableCell>
                      <TableCell>
                        {(() => {
                          const t = getType(product.productTypeId ?? 0)
                          if (t) {
                            return (
                              <span
                                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                                style={{ backgroundColor: t.color ?? '#111827', color: '#fff' }}
                              >
                                {t.description}
                              </span>
                            )
                          }
                          return (
                            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground">
                              {getTypeName(product.productTypeId ?? 0)}
                            </span>
                          )
                        })()}
                      </TableCell>
                      <TableCell className="text-right">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}
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
                  )))}
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
                isLoading={isLoading}
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
                  {showTypesSkeleton ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i} className="animate-in fade-in-0 duration-300">
                        <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-3 w-3 rounded-full" />
                            <Skeleton className="h-4 w-[150px]" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-[100px]" />
                        </TableCell>
                        <TableCell className="text-right justify-end gap-2 flex">
                          <Skeleton className="h-8 w-8" />
                          <Skeleton className="h-8 w-8" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    pagedTypes.map((type, index) => (
                    <TableRow key={type.id} className={`animate-in fade-in-0 duration-300 ${type.isActive === false ? 'opacity-60' : ''}`}>
                      <TableCell>{(typesPage - 1) * typesLimit + index + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-3 w-3 rounded-full"
                            style={{ backgroundColor: type.color ?? '#111827' }}
                          />
                          <span>{type.description}{type.isActive === false ? ' (Inativo)' : ''}</span>
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
                            aria-label={type.isActive === false ? 'Ativar tipo' : 'Inativar tipo'}
                          >
                            {deletingId === type.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Power
                                className={`h-4 w-4 ${type.isActive === false ? 'text-muted-foreground' : 'text-emerald-600'}`}
                              />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                  )}
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
                      {type.description}
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
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Alterações
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
