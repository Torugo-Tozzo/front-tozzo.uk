import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Minus, Trash2, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import api, { getErrorMessage } from "@/services/api";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfirm } from "@/contexts/ConfirmContext";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Product, ProductType } from "@/domain/models";
import type { OrderStatus } from "@/domain/models";
import { formatCount, formatCurrencyBRL, formatNumber } from "@/i18n/format";
import { getCatalogLabel } from "@/i18n/labels";
import { normalizeLocale } from "@/i18n/locale";

export type SelectedItem = {
  productId: number | string;
  quantity: number;
  name: string;
  price: number;
  unitPrice: number;
};

interface ProductSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (customerName: string, items: { productId: number | string; quantity: number; unitPrice?: number }[]) => Promise<void>;
  title: string;
  initialClientName?: string;
  initialItems?: { productId: number | string; quantity: number; unitPrice?: number; name?: string; price?: number }[];
  isEditing?: boolean; // If editing, we might handle things differently
  onCloseOrder?: () => Promise<void>;
  initialStatus?: OrderStatus;
  onChangeStatus?: (newStatus: OrderStatus) => Promise<void> | void;
  onCancelSale?: () => Promise<void>;
  readOnly?: boolean;
}

const DEFAULT_ITEMS: { productId: number; quantity: number }[] = [];
const PRODUCTS_PAGE_SIZE = 20;

export function ProductSelectionModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  initialClientName = "",
  initialItems = DEFAULT_ITEMS,
  isEditing = false,
  onCloseOrder,
  initialStatus,
  onChangeStatus,
  onCancelSale,
  readOnly = false,
}: ProductSelectionModalProps) {
  const confirm = useConfirm();
  const { i18n, t } = useTranslation();
  const activeLocale = normalizeLocale(i18n.language);
  const unitCountMessages = {
    zero: t("unitCount.zero"),
    one: t("unitCount.one"),
    two: t("unitCount.two"),
    few: t("unitCount.few"),
    many: t("unitCount.many"),
    other: t("unitCount.other"),
  };
  const [products, setProducts] = useState<Product[]>([]);
  const [productsTotal, setProductsTotal] = useState(0);
  const [productsPage, setProductsPage] = useState(1);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [clientName, setClientName] = useState(initialClientName);
  const [isLoading, setIsLoading] = useState(false);
  const [isClosingOrder, setIsClosingOrder] = useState(false);
  const [isCancellingSale, setIsCancellingSale] = useState(false);
  const [status, setStatus] = useState<OrderStatus | "">(initialStatus ?? "");
  const [searchTerm, setSearchTerm] = useState("");
  const [productTypeFilter, setProductTypeFilter] = useState("");
  const [isProductsLoading, setIsProductsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialStatus) {
        setStatus(initialStatus);
      } else {
        setStatus("");
      }
    }
  }, [isOpen, initialStatus]);

  // Reset local state and hydrate selected items on open.
  // Nomes/precos dos itens ja selecionados vem do caller (pedido/venda), nao
  // depende mais do catalogo carregado - assim funciona mesmo se o produto
  // do item nao estiver na pagina atual de busca.
  useEffect(() => {
    if (!isOpen) return;

    setClientName(initialClientName);
    setSearchTerm("");
    setProductTypeFilter("");

    if (initialItems && initialItems.length > 0) {
      const hydratedItems = initialItems
        .filter((item) => item.productId != null)
        .map((item) => {
          const price = item.price != null ? Number(item.price) : Number(item.unitPrice ?? 0);
          return {
            productId: item.productId,
            quantity: item.quantity,
            name: item.name ?? "Produto",
            price,
            unitPrice: item.unitPrice != null ? Number(item.unitPrice) : price,
          };
        });
      setSelectedItems(hydratedItems);
    } else {
      setSelectedItems([]);
    }
  }, [isOpen, initialClientName, initialItems]);

  // Tipos de produto para o filtro de categoria (poucos registros, carrega tudo de uma vez).
  useEffect(() => {
    if (!isOpen) return;
    api.get("/tipos")
      .then((response) => {
        const payload = response.data;
        const types = Array.isArray(payload) ? payload : payload?.types ?? payload?.data ?? [];
        setProductTypes(types);
      })
      .catch((error) => console.error("Error fetching product types", error));
  }, [isOpen]);

  // Busca produtos no servidor - nunca carrega o catalogo inteiro, so a
  // pagina atual (20 itens) filtrada por nome/categoria.
  const fetchProductsPage = async (page: number) => {
    setIsProductsLoading(true);
    try {
      const params: any = { limit: PRODUCTS_PAGE_SIZE, page };
      if (searchTerm) params.search = searchTerm;
      if (productTypeFilter) params.productTypeId = productTypeFilter;

      const response = await api.get("/produtos", { params });
      const payload = response.data;
      const products = Array.isArray(payload) ? payload : payload?.products ?? payload?.data ?? [];
      const data = products.map((p: Product) => ({
        ...p,
        price: p.price ? Number(p.price) : 0,
      }));
      setProducts(data);
      setProductsPage(page);
      const totalHeader = response.headers["x-total-count"];
      setProductsTotal(payload?.total ?? payload?.count ?? (totalHeader ? parseInt(totalHeader, 10) : data.length));
    } catch (error) {
      console.error("Error fetching products", error);
    } finally {
      setIsProductsLoading(false);
    }
  };

  // Busca (nome/categoria) tem debounce e sempre volta pra pagina 1.
  // Skeleton liga na hora (nao so quando o fetch comeca) - sem isso ficava
  // um instante mostrando "Nenhum produto encontrado" antes do debounce disparar.
  useEffect(() => {
    if (!isOpen) return;
    setIsProductsLoading(true);
    const timer = setTimeout(() => {
      fetchProductsPage(1);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, searchTerm, productTypeFilter]);

  const productsTotalPages = Math.ceil(productsTotal / PRODUCTS_PAGE_SIZE);

  const handleAddItem = (product: Product) => {
    setSelectedItems((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        { productId: product.id, quantity: 1, name: product.name, price: product.price, unitPrice: Number(product.price || 0) },
      ];
    });
  };

  const handleRemoveItem = (productId: number | string) => {
    setSelectedItems((prev) => prev.filter((item) => item.productId !== productId));
  };

  const handleUpdateQuantity = (productId: number | string, delta: number) => {
    setSelectedItems((prev) =>
      prev.map((item) => {
        if (item.productId === productId) {
          const newQuantity = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQuantity };
        }
        return item;
      })
    );
  };

  const handleConfirm = async () => {
    if (selectedItems.length === 0 && !isEditing) {
      toast.warning("Selecione pelo menos um produto.");
      return;
    }

    setIsLoading(true);
    try {
      const finalCustomerName = clientName.trim() || "Não Informado";
      const itemsPayload = selectedItems.map(({ productId, quantity, unitPrice, price }) => ({
        productId,
        quantity,
        unitPrice: unitPrice != null ? Number(unitPrice) : Number(price || 0),
      }));
      
      await onConfirm(finalCustomerName, itemsPayload);
      onClose();
    } catch (error) {
      console.error("Error confirming", error);
    } finally {
      setIsLoading(false);
    }
  };

  const total = selectedItems.reduce((acc, item) => acc + ((item.unitPrice != null ? item.unitPrice : item.price) * item.quantity), 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Selecione os produtos e informe o cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="client">Cliente / Mesa</Label>
            <Input
              id="client"
              placeholder="Ex: Mesa 10 ou João"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              disabled={readOnly}
            />
          </div>

          <div className={`grid ${readOnly ? 'grid-cols-1' : 'md:grid-cols-2'} gap-6`}>
            {/* Product List */}
            {!readOnly && (
              <div className="space-y-4 border rounded-lg p-4">
                <h3 className="font-semibold">Produtos Disponíveis</h3>
                <div className="flex gap-2">
                  <Input
                    placeholder="Buscar produto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1"
                  />
                  <Select value={productTypeFilter || "all"} onValueChange={(val) => setProductTypeFilter(val === "all" ? "" : val)}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas categorias</SelectItem>
                      {productTypes.map((productType) => (
                        <SelectItem key={productType.id} value={String(productType.id)}>
                          {getCatalogLabel(productType.id, productType.description, activeLocale)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="h-[300px] overflow-y-auto space-y-2">
                  {isProductsLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="flex items-center justify-between p-2 border rounded">
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-[150px] bg-gray-200 dark:bg-gray-700" />
                          <Skeleton className="h-3 w-[80px] bg-gray-200 dark:bg-gray-700" />
                        </div>
                        <Skeleton className="h-8 w-8 rounded-md bg-gray-200 dark:bg-gray-700" />
                      </div>
                    ))
                  ) : products.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-8">Nenhum produto encontrado.</p>
                  ) : (
                    <div
                      key={`${productsPage}-${searchTerm}-${productTypeFilter}`}
                      className="space-y-2 animate-in fade-in-0 duration-200"
                    >
                      {products.map((product) => (
                        <div
                          key={product.id}
                          className="flex items-center justify-between p-2 border rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                          onClick={() => handleAddItem(product)}
                        >
                          <div>
                            <p className="font-medium">{product.name}</p>
                            <p className="text-sm text-gray-500">{formatCurrencyBRL(Number(product.price || 0), activeLocale)}</p>
                          </div>
                          <Button size="sm" variant="ghost">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Sempre renderiza (mesmo com 1 pagina, so desabilita) - senao
                    o painel muda de altura ao trocar categoria e o modal "pula". */}
                <div className="flex items-center justify-between pt-1 h-7">
                  <span className="text-xs text-muted-foreground">
                    {productsTotalPages > 0 && t("pageOf", {
                      page: formatNumber(productsPage, activeLocale),
                      total: formatNumber(productsTotalPages, activeLocale),
                    })}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      onClick={() => fetchProductsPage(productsPage - 1)}
                      disabled={productsPage <= 1 || isProductsLoading}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      onClick={() => fetchProductsPage(productsPage + 1)}
                      disabled={productsPage >= productsTotalPages || isProductsLoading}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Selected Items */}
            <div className="space-y-4 border rounded-lg p-4 bg-gray-50 dark:bg-gray-900/50">
              <h3 className="font-semibold">Itens Selecionados</h3>
              <div className="h-[300px] overflow-y-auto space-y-2">
                {selectedItems.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-8">Nenhum item selecionado</p>
                  ) : (
                    selectedItems.map((item) => (
                      <div key={item.productId} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded shadow-sm border dark:border-gray-700">
                        <div className="flex-1">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {formatNumber(item.quantity, activeLocale)} x {formatCurrencyBRL(
                              Number((item.unitPrice != null ? item.unitPrice : item.price) || 0),
                              activeLocale,
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {!readOnly ? (
                            <>
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-6 w-6"
                                onClick={() => handleUpdateQuantity(item.productId, -1)}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-4 text-center">{formatNumber(item.quantity, activeLocale)}</span>
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-6 w-6"
                                onClick={() => handleUpdateQuantity(item.productId, 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-red-500"
                                onClick={() => handleRemoveItem(item.productId)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <span className="font-bold px-4">
                              {formatCount(item.quantity, unitCountMessages, activeLocale)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
              </div>
              <div className="pt-4 border-t flex justify-between items-center font-bold text-lg text-gray-900 dark:text-gray-100">
                <span>Total:</span>
                <span>{formatCurrencyBRL(total, activeLocale)}</span>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className="flex justify-between sm:justify-between">
          {isEditing && !readOnly && (
            <div className="mr-auto">
              <div className="flex items-center gap-2">
                <Select
                  value={status}
                  onValueChange={async (val) => {
                    if (val === status) return
                    if (!(await confirm('Tem certeza que deseja alterar o status do pedido?'))) return
                    setIsClosingOrder(true)
                    try {
                      if (onChangeStatus) {
                        await onChangeStatus(val as OrderStatus)
                      } else if (val === 'CLOSED' && onCloseOrder) {
                        await onCloseOrder()
                      }
                      setStatus(val as OrderStatus)
                    } catch (err) {
                      console.error('Error changing status', err)
                      toast.error(getErrorMessage(err, 'Erro ao alterar status do pedido'))
                    } finally {
                      setIsClosingOrder(false)
                    }
                  }}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPEN">Aberto</SelectItem>
                    <SelectItem value="IN_PREPARATION">Em Preparo</SelectItem>
                    <SelectItem value="DELIVERING">Entregando</SelectItem>
                    <SelectItem value="CLOSED">Fechado</SelectItem>
                  </SelectContent>
                </Select>
                {isClosingOrder && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
            </div>
          )}
          <div className="flex gap-2 ml-auto">
            {readOnly && onCancelSale && (
              <div className="mr-auto">
                <Button
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={async () => {
                    if (!(await confirm({ description: 'Tem certeza que deseja cancelar esta venda?', confirmLabel: 'Cancelar venda', destructive: true }))) return
                    setIsCancellingSale(true)
                    try {
                      await onCancelSale()
                      onClose()
                    } catch (err) {
                      console.error('Error cancelling sale', err)
                      toast.error(getErrorMessage(err, 'Erro ao cancelar venda'))
                    } finally {
                      setIsCancellingSale(false)
                    }
                  }}
                  disabled={isCancellingSale || isLoading || isClosingOrder}
                >
                  {isCancellingSale ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Cancelando...
                    </>
                  ) : (
                    'Cancelar Venda'
                  )}
                </Button>
              </div>
            )}
            <Button variant="outline" onClick={onClose} disabled={isLoading || isClosingOrder}>
              {readOnly ? "Fechar" : "Cancelar"}
            </Button>
            {!readOnly && (
              <Button onClick={handleConfirm} disabled={isLoading || isClosingOrder}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Confirmar"
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
