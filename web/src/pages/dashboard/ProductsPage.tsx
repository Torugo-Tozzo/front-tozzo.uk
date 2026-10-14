import { createSignal, For, Show, type JSX } from "solid-js"
import { createMutation, createQuery, keepPreviousData, useQueryClient } from "@tanstack/solid-query"
import { loadedData, onQueryError } from "@/api/query"
import { Loader2, Pencil, Plus, Search, ShoppingBag, Trash2 } from "lucide-solid"
import { toast } from "solid-sonner"

import {
  catalogKeys,
  createProduct,
  createProductType,
  deleteProduct,
  deleteProductType,
  listProducts,
  listProductTypes,
  updateProduct,
  updateProductType,
  type Product,
  type ProductType,
  type UpdateProductRequest,
} from "@/api/catalog"
import { ApiError } from "@/api/errors"
import { establishmentKeys } from "@/api/establishment"
import { UPLOAD_CONTENT_TYPES, UPLOAD_MAX_BYTES, uploadProductImage } from "@/api/uploads"
import { Pagination } from "@/components/Pagination"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectHiddenSelect, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/contexts/AuthContext"
import { useConfirm } from "@/contexts/ConfirmContext"
import { useErrorMessage } from "@/i18n/error-message"
import { formatNumber } from "@/i18n/format"
import { getCatalogLabel } from "@/i18n/labels"
import { normalizeLocale } from "@/i18n/locale"
import { useTranslation } from "@/i18n/solid"
import { createCursorPages, totalPagesOf } from "@/lib/cursor-pages"
import { createDebounced, createMinLoading } from "@/lib/min-loading"
import { centsFromInput, formatCents, inputFromCents } from "@/lib/money"

const NO_TYPE = "none"

export default function ProductsPage() {
  const { t: tProducts, language } = useTranslation("products")
  const { t: tCommon } = useTranslation("common")
  const localizedError = useErrorMessage()
  const activeLocale = () => normalizeLocale(language())
  const { user } = useAuth()
  const confirm = useConfirm()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = createSignal("products")
  const [search, setSearch] = createSignal("")
  const debouncedSearch = createDebounced(search)
  const pages = createCursorPages(10)
  const [typesSearch, setTypesSearch] = createSignal("")
  const debouncedTypesSearch = createDebounced(typesSearch)
  const [typesPage, setTypesPage] = createSignal(1)
  const [typesLimit, setTypesLimit] = createSignal(10)
  const [deletingId, setDeletingId] = createSignal<string | null>(null)

  const [isAddDialogOpen, setIsAddDialogOpen] = createSignal(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = createSignal(false)
  const [currentProduct, setCurrentProduct] = createSignal<Product | null>(null)
  const [name, setName] = createSignal("")
  const [price, setPrice] = createSignal("")
  const [ingredients, setIngredients] = createSignal("")
  const [typeId, setTypeId] = createSignal("")

  const [isAddTypeDialogOpen, setIsAddTypeDialogOpen] = createSignal(false)
  const [isEditTypeDialogOpen, setIsEditTypeDialogOpen] = createSignal(false)
  const [currentType, setCurrentType] = createSignal<ProductType | null>(null)
  const [typeName, setTypeName] = createSignal("")
  const [typeColor, setTypeColor] = createSignal("#000000")

  // Products: one /v1 cursor page at a time (types with isActive=false are hidden by the API).
  const products = createQuery(() => ({
    queryKey: [...catalogKeys.products, { search: debouncedSearch(), cursor: pages.cursor(), limit: pages.limit() }],
    queryFn: ({ signal }) => listProducts({ search: debouncedSearch(), cursor: pages.cursor(), limit: pages.limit() }, signal),
    placeholderData: keepPreviousData,
  }))
  // Every type, inactive ones included: the form's type picker, like the React app.
  const allTypes = createQuery(() => ({
    queryKey: [...catalogKeys.productTypes, { includeInactive: true, search: "" }],
    queryFn: ({ signal }) => listProductTypes({ includeInactive: true }, signal),
  }))
  // The types tab: the /v1 sends the whole (short) list, paged here.
  const pagedTypesQuery = createQuery(() => ({
    queryKey: [...catalogKeys.productTypes, { includeInactive: true, search: debouncedTypesSearch() }],
    queryFn: ({ signal }) => listProductTypes({ includeInactive: true, search: debouncedTypesSearch() }, signal),
    placeholderData: keepPreviousData,
  }))

  const showSkeleton = createMinLoading(() => products.isPending || products.isPlaceholderData)
  const showTypesSkeleton = createMinLoading(() => pagedTypesQuery.isPending || pagedTypesQuery.isPlaceholderData)
  const productPage = () => (products.isError ? undefined : loadedData(products))
  const productRows = () => productPage()?.items ?? []
  const totalItems = () => productPage()?.total ?? 0
  const productTypes = () => loadedData(allTypes) ?? []
  const typeRows = () => (pagedTypesQuery.isError ? [] : loadedData(pagedTypesQuery) ?? [])
  const typesTotalItems = () => typeRows().length
  const typesTotalPages = () => totalPagesOf(typesTotalItems(), typesLimit())
  const pagedTypes = () => typeRows().slice((typesPage() - 1) * typesLimit(), typesPage() * typesLimit())

  onQueryError(products, (error) => {
    console.error("Error fetching products", error)
    toast.error(localizedError("loadProducts", error))
  })
  const reportTypesError = (error: unknown) => {
    console.error("Error fetching types", error)
    toast.error(localizedError("loadProductTypes", error))
  }
  onQueryError(allTypes, reportTypesError)
  onQueryError(pagedTypesQuery, (error) => {
    // Same request as allTypes when there is no search: one toast is enough.
    if (debouncedTypesSearch()) reportTypesError(error)
  })

  const invalidateProducts = () => queryClient.invalidateQueries({ queryKey: catalogKeys.products })
  const invalidateTypes = () => queryClient.invalidateQueries({ queryKey: catalogKeys.productTypes })
  // Settings shows the active products of the plan.
  const invalidateUsage = () => queryClient.invalidateQueries({ queryKey: establishmentKeys.all, exact: true })

  const resetForm = () => {
    setName("")
    setPrice("")
    setIngredients("")
    setTypeId("")
    setCurrentProduct(null)
  }
  const resetTypeForm = () => {
    setTypeName("")
    setCurrentType(null)
    setTypeColor("#000000")
  }

  const create = createMutation(() => ({
    mutationFn: createProduct,
    onSuccess: () => {
      void invalidateProducts()
      void invalidateUsage()
      setIsAddDialogOpen(false)
      resetForm()
    },
    onError: (error) => {
      console.error("Error creating product", error)
      toast.error(localizedError("createProduct", error))
    },
  }))
  const update = createMutation(() => ({
    mutationFn: (input: { id: string; body: UpdateProductRequest }) => updateProduct(input.id, input.body),
    onSuccess: () => {
      void invalidateProducts()
      setIsEditDialogOpen(false)
      resetForm()
    },
    onError: (error) => {
      console.error("Error updating product", error)
      toast.error(localizedError("updateProduct", error))
    },
  }))
  const remove = createMutation(() => ({
    mutationFn: deleteProduct,
    onMutate: (id: string) => setDeletingId(id),
    onSuccess: () => {
      void invalidateProducts()
      void invalidateUsage()
    },
    onError: (error) => {
      console.error("Error deleting product", error)
      toast.error(localizedError("deleteProduct", error))
    },
    onSettled: () => setDeletingId(null),
  }))
  const uploadImage = createMutation(() => ({
    mutationFn: (input: { id: string; file: File }) => uploadProductImage(input.id, input.file),
    onSuccess: (product: Product, input) => {
      // The dialog may be showing another product by now: its form stays as is.
      if (currentProduct()?.id === input.id) setCurrentProduct(product)
      void invalidateProducts()
      toast.success(tProducts("image.uploaded"))
    },
    onError: (error) => {
      console.error("Error uploading product image", error)
      toast.error(localizedError("uploadImage", error))
    },
  }))

  const createType = createMutation(() => ({
    mutationFn: createProductType,
    onSuccess: async () => {
      await invalidateTypes()
      setIsAddTypeDialogOpen(false)
      resetTypeForm()
    },
    onError: (error) => {
      console.error("Error creating type", error)
      toast.error(localizedError("createType", error))
    },
  }))
  const updateType = createMutation(() => ({
    mutationFn: (input: { id: string; description: string; color: string }) =>
      updateProductType(input.id, { description: input.description, color: input.color }),
    onSuccess: async () => {
      await invalidateTypes()
      // A product row shows its type's name and color.
      void invalidateProducts()
      setIsEditTypeDialogOpen(false)
      resetTypeForm()
    },
    onError: (error) => {
      console.error("Error updating type", error)
      toast.error(localizedError("updateType", error))
    },
  }))
  const removeType = createMutation(() => ({
    mutationFn: deleteProductType,
    onMutate: (id: string) => setDeletingId(id),
    onSuccess: async () => {
      // Deleting a type deletes its products too.
      await Promise.all([invalidateTypes(), invalidateProducts(), invalidateUsage()])
    },
    onError: (error) => {
      console.error("Error deleting type", error)
      toast.error(localizedError("updateTypeStatus", error))
    },
    onSettled: () => setDeletingId(null),
  }))

  const isSaving = () => create.isPending || update.isPending || createType.isPending || updateType.isPending

  const handlePriceInput = (value: string) => setPrice(inputFromCents(centsFromInput(value)))

  const handleAddProduct = (event: SubmitEvent) => {
    event.preventDefault()
    if (isSaving()) return
    create.mutate({
      name: name(),
      priceCents: centsFromInput(price()),
      ingredients: ingredients(),
      ...(typeId() ? { productTypeId: typeId() } : {}),
    })
  }

  const handleEditClick = (product: Product) => {
    setCurrentProduct(product)
    setName(product.name)
    setPrice(inputFromCents(product.priceCents))
    setIngredients(product.ingredients ?? "")
    setTypeId(product.productType?.id ?? "")
    setIsEditDialogOpen(true)
  }

  const handleUpdateProduct = (event: SubmitEvent) => {
    event.preventDefault()
    const product = currentProduct()
    if (!product || isSaving()) return
    update.mutate({
      id: product.id,
      body: { name: name(), priceCents: centsFromInput(price()), ingredients: ingredients(), productTypeId: typeId() || null },
    })
  }

  const handleImageChange = (event: Event & { currentTarget: HTMLInputElement }) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    const product = currentProduct()
    input.value = ""
    if (!file || !product || uploadImage.isPending) return
    if (!(UPLOAD_CONTENT_TYPES as readonly string[]).includes(file.type) || file.size > UPLOAD_MAX_BYTES) {
      // Checked here too: the API would answer UPLOAD_INVALID.
      toast.error(localizedError("uploadImage", new ApiError(422, { code: "UPLOAD_INVALID", status: 422, title: "UPLOAD_INVALID" })))
      return
    }
    uploadImage.mutate({ id: product.id, file })
  }

  const handleDeleteProduct = async (id: string) => {
    if (await confirm({ description: tProducts("confirm.delete"), confirmLabel: tCommon("delete"), destructive: true })) {
      remove.mutate(id)
    }
  }

  const handleAddType = (event: SubmitEvent) => {
    event.preventDefault()
    if (isSaving()) return
    createType.mutate({ description: typeName(), color: typeColor() })
  }

  const handleEditTypeClick = (type: ProductType) => {
    setCurrentType(type)
    setTypeName(type.description)
    setTypeColor(type.color ?? "#000000")
    setIsEditTypeDialogOpen(true)
  }

  const handleUpdateType = (event: SubmitEvent) => {
    event.preventDefault()
    const type = currentType()
    if (!type || isSaving()) return
    updateType.mutate({ id: type.id, description: typeName(), color: typeColor() })
  }

  const handleDeleteType = async (id: string) => {
    if (await confirm({ description: tProducts("confirm.deleteTypeWithProducts"), confirmLabel: tCommon("delete"), destructive: true })) {
      removeType.mutate(id)
    }
  }

  const typeLabel = (type: { id: string; description: string }) => getCatalogLabel(type.id, type.description, activeLocale())
  const typeOptions = () => [NO_TYPE, ...productTypes().map((type) => type.id)]
  const optionLabel = (value: string) => {
    if (value === NO_TYPE) return tProducts("forms.noType")
    const type = productTypes().find((item) => item.id === value)
    return type ? typeLabel(type) : ""
  }

  const TypeSelect = (selectProps: { name?: string }) => (
    <Select<string>
      name={selectProps.name}
      options={typeOptions()}
      value={typeId() || NO_TYPE}
      onChange={(value) => setTypeId(!value || value === NO_TYPE ? "" : value)}
      placeholder={tProducts("forms.typePlaceholder")}
      itemComponent={(item) => <SelectItem item={item.item}>{optionLabel(item.item.rawValue)}</SelectItem>}
    >
      <Show when={selectProps.name}><SelectHiddenSelect /></Show>
      <SelectTrigger aria-label={tProducts("type")}>
        <SelectValue<string>>{(state) => optionLabel(state.selectedOption())}</SelectValue>
      </SelectTrigger>
      <SelectContent />
    </Select>
  )

  const SavingIcon = () => <Show when={isSaving()}><Loader2 class="mr-2 h-4 w-4 animate-spin" /></Show>

  const SkeletonRows = (rowProps: { cells: () => JSX.Element }) => (
    <For each={[0, 1, 2, 3, 4]}>{() => <TableRow class="animate-in fade-in-0 duration-300">{rowProps.cells()}</TableRow>}</For>
  )

  return (
    <div class="space-y-6">
      <Tabs value={activeTab()} onChange={setActiveTab} class="w-full space-y-6">
        <div class="flex items-center justify-between">
          <h1 class="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ShoppingBag class="h-8 w-8" />
            {user()?.establishment?.tradeName
              ? tProducts("pageTitle", { establishment: user()!.establishment!.tradeName })
              : tProducts("title")}
          </h1>

          <div class="flex items-center gap-4">
            <TabsList>
              <TabsTrigger value="products">{tProducts("tabs.products")}</TabsTrigger>
              <TabsTrigger value="types">{tProducts("tabs.types")}</TabsTrigger>
            </TabsList>

            {/* The React app put each tab's "new" button in a second TabsContent;
                Kobalte keeps one panel per tab, so the button follows the tab here. */}
            <Show when={activeTab() === "products"}>
              <div class="mt-0">
                <Dialog open={isAddDialogOpen()} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger as={Button} onClick={resetForm} disabled={isSaving()}>
                    <Plus class="mr-2 h-4 w-4" /> {tProducts("new")}
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{tProducts("dialogs.addProductTitle")}</DialogTitle>
                      <DialogDescription>{tProducts("dialogs.addProductDescription")}</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddProduct} class="space-y-4">
                      <div class="space-y-2">
                        <Label for="name">{tProducts("name")}</Label>
                        <Input id="name" value={name()} onInput={(e) => setName(e.currentTarget.value)} required />
                      </div>
                      <div class="space-y-2">
                        <Label for="price">{tProducts("price")}</Label>
                        <Input id="price" value={price()} onInput={(e) => handlePriceInput(e.currentTarget.value)} placeholder={tProducts("forms.pricePlaceholder")} required />
                      </div>
                      <div class="space-y-2">
                        <Label for="type">{tProducts("type")}</Label>
                        <TypeSelect name="productTypeId" />
                      </div>
                      <div class="space-y-2">
                        <Label for="ingredients">{tProducts("ingredients")}</Label>
                        <Input id="ingredients" value={ingredients()} onInput={(e) => setIngredients(e.currentTarget.value)} placeholder={tProducts("forms.ingredientsPlaceholder")} />
                      </div>
                      <DialogFooter>
                        <Button type="submit" disabled={isSaving()}>
                          <SavingIcon />
                          {tCommon("save")}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </Show>

            <Show when={activeTab() === "types"}>
              <div class="mt-0">
                <Dialog open={isAddTypeDialogOpen()} onOpenChange={setIsAddTypeDialogOpen}>
                  <DialogTrigger as={Button} onClick={resetTypeForm} disabled={isSaving()}>
                    <Plus class="mr-2 h-4 w-4" /> {tProducts("newType")}
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{tProducts("dialogs.addTypeTitle")}</DialogTitle>
                      <DialogDescription>{tProducts("dialogs.addTypeDescription")}</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddType} class="space-y-4">
                      <div class="space-y-2">
                        <Label for="typeName">{tProducts("description")}</Label>
                        <Input id="typeName" value={typeName()} onInput={(e) => setTypeName(e.currentTarget.value)} required />
                      </div>
                      <div class="space-y-2">
                        <Label for="typeColor">{tProducts("color")}</Label>
                        <Input id="typeColor" type="color" value={typeColor()} onInput={(e) => setTypeColor(e.currentTarget.value)} />
                      </div>
                      <DialogFooter>
                        <Button type="submit" disabled={isSaving()}>
                          <SavingIcon />
                          {tCommon("save")}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </Show>
          </div>
        </div>

        <TabsContent value="products">
          <Card>
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-7">
              <CardTitle>{tProducts("menu")}</CardTitle>
              <div class="relative w-[250px]">
                <Search class="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={tProducts("table.searchPlaceholder")}
                  value={search()}
                  onInput={(e) => {
                    setSearch(e.currentTarget.value)
                    pages.reset()
                  }}
                  class="pl-8"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div class="mb-4 text-sm text-muted-foreground">
                {tCommon("recordsTotal", { count: formatNumber(totalItems(), activeLocale()) })}
              </div>
              <span class="sr-only" role="status">{showSkeleton() ? tCommon("loading") : ""}</span>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead class="w-[50px]">{tCommon("index")}</TableHead>
                    <TableHead>{tProducts("name")}</TableHead>
                    <TableHead>{tProducts("type")}</TableHead>
                    <TableHead class="text-right">{tProducts("price")}</TableHead>
                    <TableHead class="text-right">{tCommon("actions.label")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <Show
                    when={!showSkeleton()}
                    fallback={
                      <SkeletonRows cells={() => <>
                        <TableCell><Skeleton class="h-4 w-8" /></TableCell>
                        <TableCell><Skeleton class="h-4 w-[200px]" /></TableCell>
                        <TableCell><Skeleton class="h-5 w-20 rounded-full" /></TableCell>
                        <TableCell class="text-right justify-end flex"><Skeleton class="h-4 w-16" /></TableCell>
                        <TableCell class="text-right justify-end gap-2 flex">
                          <Skeleton class="h-8 w-8" />
                          <Skeleton class="h-8 w-8" />
                        </TableCell>
                      </>} />
                    }
                  >
                    <Show
                      when={productRows().length > 0}
                      fallback={
                        <TableRow>
                          <TableCell colSpan={5} class="py-8 text-center text-muted-foreground">{tProducts("noProducts")}</TableCell>
                        </TableRow>
                      }
                    >
                      <For each={productRows()}>
                        {(product, index) => (
                          <TableRow class="animate-in fade-in-0 duration-300">
                            <TableCell>{formatNumber((pages.page() - 1) * pages.limit() + index() + 1, activeLocale())}</TableCell>
                            <TableCell>{product.name}</TableCell>
                            <TableCell>
                              <Show when={product.productType}>
                                {(type) => (
                                  <span
                                    class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                                    style={{ "background-color": type().color ?? "#111827", color: "#fff" }}
                                  >
                                    {typeLabel(type())}
                                  </span>
                                )}
                              </Show>
                            </TableCell>
                            <TableCell class="text-right">{formatCents(product.priceCents, activeLocale())}</TableCell>
                            <TableCell class="text-right">
                              <div class="flex justify-end gap-2">
                                <Button variant="ghost" size="icon" onClick={() => handleEditClick(product)} aria-label={tCommon("edit")} title={tCommon("edit")}>
                                  <Pencil class="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  class="text-destructive hover:text-destructive"
                                  onClick={() => void handleDeleteProduct(product.id)}
                                  disabled={deletingId() === product.id}
                                  aria-label={tCommon("delete")}
                                  title={tCommon("delete")}
                                >
                                  <Show when={deletingId() === product.id} fallback={<Trash2 class="h-4 w-4" />}>
                                    <Loader2 class="h-4 w-4 animate-spin" />
                                  </Show>
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </For>
                    </Show>
                  </Show>
                </TableBody>
              </Table>
              <Pagination
                currentPage={pages.page()}
                totalPages={totalPagesOf(totalItems(), pages.limit())}
                hasMore={!!productPage()?.nextCursor}
                onPageChange={(target) => pages.goTo(target, productPage()?.nextCursor)}
                pageSize={pages.limit()}
                onPageSizeChange={pages.setLimit}
                isLoading={products.isFetching}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="types">
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <CardTitle>{tProducts("types")}</CardTitle>
                <div class="relative w-[250px]">
                  <Search class="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={tProducts("table.typesSearchPlaceholder")}
                    value={typesSearch()}
                    onInput={(e) => {
                      setTypesSearch(e.currentTarget.value)
                      setTypesPage(1)
                    }}
                    class="pl-8"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableCaption>{tProducts("table.typesCaption")}</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead class="w-[50px]">{tCommon("index")}</TableHead>
                    <TableHead>{tProducts("description")}</TableHead>
                    <TableHead class="text-right">{tCommon("actions.label")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <Show
                    when={!showTypesSkeleton()}
                    fallback={
                      <SkeletonRows cells={() => <>
                        <TableCell><Skeleton class="h-4 w-8" /></TableCell>
                        <TableCell>
                          <div class="flex items-center gap-2">
                            <Skeleton class="h-3 w-3 rounded-full" />
                            <Skeleton class="h-4 w-[150px]" />
                          </div>
                        </TableCell>
                        <TableCell class="text-right justify-end gap-2 flex">
                          <Skeleton class="h-8 w-8" />
                          <Skeleton class="h-8 w-8" />
                        </TableCell>
                      </>} />
                    }
                  >
                    <Show
                      when={pagedTypes().length > 0}
                      fallback={
                        <TableRow>
                          <TableCell colSpan={3} class="py-8 text-center text-muted-foreground">{tProducts("noTypes")}</TableCell>
                        </TableRow>
                      }
                    >
                      <For each={pagedTypes()}>
                        {(type, index) => (
                          <TableRow class={`animate-in fade-in-0 duration-300 ${type.isActive === false ? "opacity-60" : ""}`}>
                            <TableCell>{formatNumber((typesPage() - 1) * typesLimit() + index() + 1, activeLocale())}</TableCell>
                            <TableCell>
                              <div class="flex items-center gap-2">
                                <span class="inline-block h-3 w-3 rounded-full" style={{ "background-color": type.color ?? "#111827" }} />
                                <span>
                                  {typeLabel(type)}
                                  {type.isActive === false ? ` ${tProducts("table.inactiveSuffix")}` : ""}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell class="text-right">
                              <div class="flex justify-end gap-2">
                                <Button variant="ghost" size="icon" onClick={() => handleEditTypeClick(type)} disabled={deletingId() === type.id} aria-label={tCommon("edit")} title={tCommon("edit")}>
                                  <Pencil class="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => void handleDeleteType(type.id)} disabled={deletingId() === type.id} aria-label={tCommon("delete")} title={tCommon("delete")}>
                                  <Show when={deletingId() === type.id} fallback={<Trash2 class="h-4 w-4 text-destructive" />}>
                                    <Loader2 class="h-4 w-4 animate-spin" />
                                  </Show>
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </For>
                    </Show>
                  </Show>
                </TableBody>
              </Table>
              <div class="mb-4 text-sm text-muted-foreground">
                {tCommon("recordsTotal", { count: formatNumber(typesTotalItems(), activeLocale()) })}
              </div>
              <Pagination
                currentPage={typesPage()}
                totalPages={typesTotalPages()}
                hasMore={typesPage() < typesTotalPages()}
                onPageChange={setTypesPage}
                pageSize={typesLimit()}
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
      <Dialog open={isEditDialogOpen()} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tProducts("dialogs.editProductTitle")}</DialogTitle>
            <DialogDescription>{tProducts("dialogs.editProductDescription")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateProduct} class="space-y-4">
            <div class="space-y-2">
              <Label for="edit-name">{tProducts("name")}</Label>
              <Input id="edit-name" value={name()} onInput={(e) => setName(e.currentTarget.value)} required />
            </div>
            <div class="space-y-2">
              <Label for="edit-price">{tProducts("price")}</Label>
              <Input id="edit-price" value={price()} onInput={(e) => handlePriceInput(e.currentTarget.value)} required />
            </div>
            <div class="space-y-2">
              <Label for="edit-type">{tProducts("type")}</Label>
              <TypeSelect />
            </div>
            <div class="space-y-2">
              <Label for="edit-ingredients">{tProducts("ingredients")}</Label>
              <Input id="edit-ingredients" value={ingredients()} onInput={(e) => setIngredients(e.currentTarget.value)} placeholder={tProducts("forms.ingredientsPlaceholder")} />
            </div>
            {/* New in the /v1 (not in the React app): the image goes straight to
                the bucket (POST /v1/uploads → PUT → PATCH imageKey). data-solid-only
                keeps it out of the comparison with the React baseline. */}
            <div class="space-y-2" data-solid-only="product-image">
              <Label for="edit-image">{tProducts("image.label")}</Label>
              <div class="flex items-center gap-3">
                <Show when={currentProduct()?.imageUrl}>
                  {(url) => <img src={url()} alt={tProducts("image.preview")} class="h-10 w-10 rounded-md border object-cover" />}
                </Show>
                <Input
                  id="edit-image"
                  type="file"
                  accept={UPLOAD_CONTENT_TYPES.join(",")}
                  onChange={handleImageChange}
                  disabled={uploadImage.isPending}
                />
              </div>
              <Show when={uploadImage.isPending}>
                <p role="status" class="text-sm text-muted-foreground">{tProducts("image.uploading")}</p>
              </Show>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isSaving() || uploadImage.isPending}>
                <SavingIcon />
                {tCommon("saveChanges")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Type Dialog */}
      <Dialog open={isEditTypeDialogOpen()} onOpenChange={setIsEditTypeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tProducts("dialogs.editTypeTitle")}</DialogTitle>
            <DialogDescription>{tProducts("dialogs.editTypeDescription")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateType} class="space-y-4">
            <div class="space-y-2">
              <Label for="edit-typeName">{tProducts("description")}</Label>
              <Input id="edit-typeName" value={typeName()} onInput={(e) => setTypeName(e.currentTarget.value)} required />
            </div>
            <div class="space-y-2">
              <Label for="edit-typeColor">{tProducts("color")}</Label>
              <Input id="edit-typeColor" type="color" value={typeColor()} onInput={(e) => setTypeColor(e.currentTarget.value)} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isSaving()}>
                <SavingIcon />
                {tCommon("saveChanges")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
