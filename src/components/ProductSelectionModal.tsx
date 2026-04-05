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
import { Plus, Minus, Trash2, Loader2 } from "lucide-react";
import api from "@/services/api";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Product = {
  id: number;
  nome: string;
  preco: number;
};

export type SelectedItem = {
  produtoId: number;
  quantidade: number;
  nome: string;
  preco: number; // current product price (for reference)
  precoHistorico: number; // snapshot price to send with the order/sale
};

interface ProductSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (cliente: string, itens: { produtoId: number; quantidade: number; precoHistorico?: number }[]) => Promise<void>;
  title: string;
  initialClientName?: string;
  initialOrderItems?: { produtoId: number; quantidade: number; precoHistorico?: number }[];
  isEditing?: boolean; // If editing, we might handle things differently
  onCloseOrder?: () => Promise<void>;
  initialStatus?: string;
  onChangeStatus?: (newStatus: string) => Promise<void> | void;
  onCancelSale?: () => Promise<void>;
  readOnly?: boolean;
}

const DEFAULT_ITEMS: { produtoId: number; quantidade: number }[] = [];

export function ProductSelectionModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  initialClientName = "",
  initialOrderItems = DEFAULT_ITEMS,
  isEditing = false,
  onCloseOrder,
  initialStatus,
  onChangeStatus,
  onCancelSale,
  readOnly = false,
}: ProductSelectionModalProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [clientName, setClientName] = useState(initialClientName);
  const [isLoading, setIsLoading] = useState(false);
  const [isClosingOrder, setIsClosingOrder] = useState(false);
  const [isCancellingSale, setIsCancellingSale] = useState(false);
  const [status, setStatus] = useState<string>(initialStatus ?? "");
  const [searchTerm, setSearchTerm] = useState("");
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

  // Combined fetch and hydrate to avoid flash of empty state
  useEffect(() => {
    if (isOpen) {
      // Immediate reset to show loading and clear stale data
      setIsProductsLoading(true);
      setSelectedItems([]); 
      
      setClientName(initialClientName);
      setSearchTerm("");
      
      const loadData = async () => {
        try {
          const response = await api.get("/produtos");
          const data = response.data.map((p: any) => ({
            ...p,
            preco: p.preco ? Number(p.preco) : 0
          }));
          setProducts(data);

          // Hydrate immediately with the fetched data
          if (initialOrderItems && initialOrderItems.length > 0) {
            const hydratedItems = initialOrderItems.map((item) => {
              const product = data.find((p: any) => p.id === item.produtoId);
              if (product) {
                return {
                  produtoId: item.produtoId,
                  quantidade: item.quantidade,
                  nome: product.nome,
                  preco: product.preco, // preco atual
                  precoHistorico: item.precoHistorico != null ? Number(item.precoHistorico) : Number(product.preco || 0),
                };
              }
              return null;
            }).filter((item: any): item is SelectedItem => item !== null);
            setSelectedItems(hydratedItems);
          } else {
            setSelectedItems([]);
          }
        } catch (error) {
          console.error("Error fetching products", error);
        } finally {
          setIsProductsLoading(false);
        }
      };

      loadData();
    }
  }, [isOpen, initialClientName, initialOrderItems]);

  const handleAddItem = (product: Product) => {
    setSelectedItems((prev) => {
      const existing = prev.find((item) => item.produtoId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.produtoId === product.id
            ? { ...item, quantidade: item.quantidade + 1 }
            : item
        );
      }
      return [
        ...prev,
        { produtoId: product.id, quantidade: 1, nome: product.nome, preco: product.preco, precoHistorico: Number(product.preco || 0) },
      ];
    });
  };

  const handleRemoveItem = (produtoId: number) => {
    setSelectedItems((prev) => prev.filter((item) => item.produtoId !== produtoId));
  };

  const handleUpdateQuantity = (produtoId: number, delta: number) => {
    setSelectedItems((prev) =>
      prev.map((item) => {
        if (item.produtoId === produtoId) {
          const newQuantity = Math.max(1, item.quantidade + delta);
          return { ...item, quantidade: newQuantity };
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
      const finalClientName = clientName.trim() || "Não Informado";
      const itensPayload = selectedItems.map(({ produtoId, quantidade, precoHistorico, preco }) => ({
        produtoId,
        quantidade,
        precoHistorico: precoHistorico != null ? Number(precoHistorico) : Number(preco || 0),
      }));
      
      await onConfirm(finalClientName, itensPayload);
      onClose();
    } catch (error) {
      console.error("Error confirming", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const total = selectedItems.reduce((acc, item) => acc + ((item.precoHistorico != null ? item.precoHistorico : item.preco) * item.quantidade), 0);

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
                <Input 
                  placeholder="Buscar produto..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  disabled={isProductsLoading}
                />
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
                  ) : (
                    filteredProducts.map((product) => (
                      <div
                        key={product.id}
                        className="flex items-center justify-between p-2 border rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                        onClick={() => handleAddItem(product)}
                      >
                        <div>
                          <p className="font-medium">{product.nome}</p>
                          <p className="text-sm text-gray-500">R$ {Number(product.preco || 0).toFixed(2)}</p>
                        </div>
                        <Button size="sm" variant="ghost">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Selected Items */}
            <div className="space-y-4 border rounded-lg p-4 bg-gray-50 dark:bg-gray-900/50">
              <h3 className="font-semibold">Itens Selecionados</h3>
              <div className="h-[300px] overflow-y-auto space-y-2">
                {isProductsLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded shadow-sm border dark:border-gray-700">
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-[120px] bg-gray-200 dark:bg-gray-700" />
                        <Skeleton className="h-3 w-[180px] bg-gray-200 dark:bg-gray-700" />
                      </div>
                      <div className="flex items-center gap-2">
                        {readOnly ? (
                            <Skeleton className="h-6 w-16 bg-gray-200 dark:bg-gray-700" />
                        ) : (
                          <>
                            <Skeleton className="h-6 w-6 rounded-md bg-gray-200 dark:bg-gray-700" />
                            <Skeleton className="h-4 w-4 bg-gray-200 dark:bg-gray-700" />
                            <Skeleton className="h-6 w-6 rounded-md bg-gray-200 dark:bg-gray-700" />
                          </>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  selectedItems.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-8">Nenhum item selecionado</p>
                  ) : (
                    selectedItems.map((item) => (
                      <div key={item.produtoId} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded shadow-sm border dark:border-gray-700">
                        <div className="flex-1">
                          <p className="font-medium">{item.nome}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {item.quantidade} x R$ {Number((item.precoHistorico != null ? item.precoHistorico : item.preco) || 0).toFixed(2)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {!readOnly ? (
                            <>
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-6 w-6"
                                onClick={() => handleUpdateQuantity(item.produtoId, -1)}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-4 text-center">{item.quantidade}</span>
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-6 w-6"
                                onClick={() => handleUpdateQuantity(item.produtoId, 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-red-500"
                                onClick={() => handleRemoveItem(item.produtoId)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <span className="font-bold px-4">{item.quantidade} un</span>
                          )}
                        </div>
                      </div>
                    ))
                  )
                )}
              </div>
              <div className="pt-4 border-t flex justify-between items-center font-bold text-lg text-gray-900 dark:text-gray-100">
                <span>Total:</span>
                {isProductsLoading ? (
                   <Skeleton className="h-6 w-24 bg-gray-200 dark:bg-gray-700" />
                ) : (
                   <span>R$ {total.toFixed(2)}</span>
                )}
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
                  onValueChange={async (val: string) => {
                    if (val === status) return
                    const confirmMsg = 'Tem certeza que deseja alterar o status do pedido?'
                    if (!confirm(confirmMsg)) return
                    setIsClosingOrder(true)
                    try {
                      if (onChangeStatus) {
                        await onChangeStatus(val)
                      } else if (val === 'FECHADO' && onCloseOrder) {
                        await onCloseOrder()
                      }
                      setStatus(val)
                    } catch (err) {
                      console.error('Error changing status', err)
                      toast.error('Erro ao alterar status do pedido')
                    } finally {
                      setIsClosingOrder(false)
                    }
                  }}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ABERTO">Aberto</SelectItem>
                    <SelectItem value="EM_PREPARO">Em Preparo</SelectItem>
                    <SelectItem value="ENTREGANDO">Entregando</SelectItem>
                    <SelectItem value="FECHADO">Fechado</SelectItem>
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
                    if (!confirm('Tem certeza que deseja cancelar esta venda?')) return
                    setIsCancellingSale(true)
                    try {
                      await onCancelSale()
                      onClose()
                    } catch (err) {
                      console.error('Error cancelling sale', err)
                      toast.error('Erro ao cancelar venda')
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
