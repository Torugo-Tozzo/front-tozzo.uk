import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
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
import api, { getErrorCode } from "@/services/api"
import { parseListResponse } from "@/services/parseResponse"
import { toast } from "sonner"
import { Pagination } from "@/components/Pagination"
import { useAuth } from "@/contexts/AuthContext"
import { useConfirm } from "@/contexts/ConfirmContext"
import { useMinLoadingDuration } from "@/hooks/useMinLoadingDuration"
import { formatCurrencyBRL, formatNumber } from "@/i18n/format"
import { getCatalogLabel } from "@/i18n/labels"
import { normalizeLocale } from "@/i18n/locale"
import { getErrorTranslationKey, type ErrorContext } from "@/i18n/error-keys"
import type { Product, ProductType } from "@/domain/models"

type EditableProductType = ProductType & { isEditable?: boolean }

export default function ProductsPage() {
  const { i18n } = useTranslation()
  const { t: tAuth } = useTranslation("auth")
  const { t: tProducts } = useTranslation("products")
  const { t: tCommon } = useTranslation("common")
  const { t: tErrors } = useTranslation("errors")
  const localizedError = (context: ErrorContext, error: unknown) => {
    const translation = getErrorTranslationKey(context, getErrorCode(error))
    return translation.namespace === "auth"
      ? tAuth(translation.key)
      : tErrors(translation.key)
  }
  const activeLocale = normalizeLocale(i18n.language)
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
      toast.error(localizedError("loadProducts", error))
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
      toast.error(localizedError("loadProductTypes", error))
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
      toast.error(localizedError("loadProductTypes", error))
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
      toast.warning(tErrors("products.selectType"))
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
      toast.error(localizedError("createProduct", error))
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
      toast.warning(tErrors("products.selectType"))
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
      toast.error(localizedError("updateProduct", error))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteProduct = async (id: number | string) => {
    if (await confirm({ description: tProducts("confirm.delete"), confirmLabel: tCommon("delete"), destructive: true })) {
      setDeletingId(id)
      try {
        await api.delete(`/produtos/${id}`)
        fetchProducts()
      } catch (error) {
        console.error("Error deleting product", error)
        toast.error(localizedError("deleteProduct", error))
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
    return type ? getCatalogLabel(type.id, type.description, activeLocale) : tCommon("notInformed")
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
      toast.error(localizedError("createType", error))
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
      toast.error(localizedError("updateType", error))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteType = async (id: number | string) => {
    const type = productTypes.find(t => String(t.id) === String(id))
    const currentlyActive = type?.isActive ?? true
    if (await confirm({
      description: tProducts("confirm.toggle"),
      confirmLabel: currentlyActive ? tProducts("deactivateType") : tProducts("activateType"),
      destructive: currentlyActive,
    })) {
      setDeletingId(id)
      try {
        await api.patch(`/tipos/${id}/ativo`, { isActive: !currentlyActive })
        // refresh types and products because inactive types hide their products
        await fetchTypesAll()
        await fetchTypesPage()
        await fetchProducts()
      } catch (error) {
        console.error("Error toggling type active", error)
        toast.error(localizedError("updateTypeStatus", error))
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
            {user?.establishment?.tradeName
              ? tProducts("pageTitle", { establishment: user.establishment.tradeName })
              : tProducts("title")}
          </h1>
          
          <div className="flex items-center gap-4">
            <TabsList>
              <TabsTrigger value="products">{tProducts("tabs.products")}</TabsTrigger>
              <TabsTrigger value="types">{tProducts("tabs.types")}</TabsTrigger>
            </TabsList>

            <TabsContent value="products" className="mt-0">
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={resetForm} disabled={isSaving}>
                    <Plus className="mr-2 h-4 w-4" /> {tProducts("new")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{tProducts("dialogs.addProductTitle")}</DialogTitle>
                    <DialogDescription>{tProducts("dialogs.addProductDescription")}</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddProduct} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">{tProducts("name")}</Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="price">{tProducts("price")}</Label>
                      <Input
                        id="price"
                        value={price}
                        onChange={handlePriceChange}
                        placeholder={tProducts("forms.pricePlaceholder")}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="type">{tProducts("type")}</Label>
                      <Select value={typeId} onValueChange={setTypeId}>
                        <SelectTrigger aria-label={tProducts("type")}>
                          <SelectValue placeholder={tProducts("forms.typePlaceholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          {productTypes.map((type) => (
                            <SelectItem key={type.id} value={type.id.toString()}>
                              {getCatalogLabel(type.id, type.description, activeLocale)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ingredients">{tProducts("ingredients")}</Label>
                      <Input
                        id="ingredients"
                        value={ingredients}
                        onChange={(e) => setIngredients(e.target.value)}
                        placeholder={tProducts("forms.ingredientsPlaceholder")}
                      />
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {tCommon("save")}
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
                    <Plus className="mr-2 h-4 w-4" /> {tProducts("newType")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{tProducts("dialogs.addTypeTitle")}</DialogTitle>
                    <DialogDescription>{tProducts("dialogs.addTypeDescription")}</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddType} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="typeName">{tProducts("description")}</Label>
                      <Input
                        id="typeName"
                        value={typeName}
                        onChange={(e) => setTypeName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="typeColor">{tProducts("color")}</Label>
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
                        {tCommon("save")}
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
              <CardTitle>{tProducts("menu")}</CardTitle>
              <div className="relative w-[250px]">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={tProducts("table.searchPlaceholder")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 text-sm text-muted-foreground">
                {tCommon("recordsTotal", { count: formatNumber(totalItems, activeLocale) })}
              </div>
              <span className="sr-only" role="status">{showSkeleton ? tCommon("loading") : ""}</span>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">{tCommon("index")}</TableHead>
                    <TableHead>{tProducts("name")}</TableHead>
                    <TableHead>{tProducts("type")}</TableHead>
                    <TableHead className="text-right">{tProducts("price")}</TableHead>
                    <TableHead className="text-right">{tCommon("actions.label")}</TableHead>
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
                  ) : products.filter((product) => {
                    const type = getType(product.productTypeId ?? 0)
                    return type ? type.isActive !== false : true
                  }).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                        {tProducts("noProducts")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    products
                      .filter((product) => {
                      const t = getType(product.productTypeId ?? 0)
                      // hide products whose type is explicitly inactive
                      return t ? (t.isActive !== false) : true
                    })
                    .map((product, index) => (
                    <TableRow key={product.id} className="animate-in fade-in-0 duration-300">
                    <TableCell>{formatNumber((page - 1) * limit + index + 1, activeLocale)}</TableCell>
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
                                {getCatalogLabel(t.id, t.description, activeLocale)}
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
                        {formatCurrencyBRL(product.price, activeLocale)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditClick(product)}
                            aria-label={tCommon("edit")}
                            title={tCommon("edit")}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteProduct(product.id)}
                            disabled={deletingId === product.id}
                            aria-label={tCommon("delete")}
                            title={tCommon("delete")}
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
                    <CardTitle>{tProducts("types")}</CardTitle>
                    <div className="relative w-[250px]">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder={tProducts("table.typesSearchPlaceholder")}
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
                <TableCaption>{tProducts("table.typesCaption")}</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">{tCommon("index")}</TableHead>
                    <TableHead>{tProducts("description")}</TableHead>
                    <TableHead className="w-[160px]">{tProducts("table.origin")}</TableHead>
                    <TableHead className="text-right">{tCommon("actions.label")}</TableHead>
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
                  ) : pagedTypes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                        {tProducts("noTypes")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagedTypes.map((type, index) => (
                    <TableRow key={type.id} className={`animate-in fade-in-0 duration-300 ${type.isActive === false ? 'opacity-60' : ''}`}>
                      <TableCell>{formatNumber((typesPage - 1) * typesLimit + index + 1, activeLocale)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-3 w-3 rounded-full"
                            style={{ backgroundColor: type.color ?? '#111827' }}
                          />
                          <span>
                            {getCatalogLabel(type.id, type.description, activeLocale)}
                            {type.isActive === false ? ` ${tProducts("table.inactiveSuffix")}` : ''}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {type.isEditable === false ? tProducts("table.systemOrigin") : tProducts("table.userOrigin")}
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
                              aria-label={tCommon("edit")}
                              title={tCommon("edit")}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteType(type.id)}
                            disabled={deletingId === type.id}
                            aria-label={type.isActive === false
                              ? tProducts("accessibility.activateType")
                              : tProducts("accessibility.deactivateType")}
                            title={type.isActive === false
                              ? tProducts("accessibility.activateType")
                              : tProducts("accessibility.deactivateType")}
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
                {tCommon("recordsTotal", { count: formatNumber(typesTotalItems, activeLocale) })}
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
            <DialogTitle>{tProducts("dialogs.editProductTitle")}</DialogTitle>
            <DialogDescription>{tProducts("dialogs.editProductDescription")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateProduct} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">{tProducts("name")}</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-price">{tProducts("price")}</Label>
              <Input
                id="edit-price"
                value={price}
                onChange={handlePriceChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-type">{tProducts("type")}</Label>
              <Select value={typeId} onValueChange={setTypeId}>
                <SelectTrigger aria-label={tProducts("type")}>
                  <SelectValue placeholder={tProducts("forms.typePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {productTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id.toString()}>
                      {getCatalogLabel(type.id, type.description, activeLocale)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-ingredients">{tProducts("ingredients")}</Label>
              <Input
                id="edit-ingredients"
                value={ingredients}
                onChange={(e) => setIngredients(e.target.value)}
                placeholder={tProducts("forms.ingredientsPlaceholder")}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {tCommon("saveChanges")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Type Dialog */}
      <Dialog open={isEditTypeDialogOpen} onOpenChange={setIsEditTypeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tProducts("dialogs.editTypeTitle")}</DialogTitle>
            <DialogDescription>{tProducts("dialogs.editTypeDescription")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateType} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="edit-typeName">{tProducts("description")}</Label>
              <Input
                id="edit-typeName"
                value={typeName}
                onChange={(e) => setTypeName(e.target.value)}
                required
              />
            </div>
              <div className="space-y-2">
                <Label htmlFor="edit-typeColor">{tProducts("color")}</Label>
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
                {tCommon("saveChanges")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
