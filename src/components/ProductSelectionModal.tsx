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
import { Plus, Minus, Trash2 } from "lucide-react";
import api from "@/services/api";

type Product = {
  id: number;
  nome: string;
  preco: number;
};

type SelectedItem = {
  produtoId: number;
  quantidade: number;
  nome: string;
  preco: number;
};

interface ProductSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (cliente: string, itens: { produtoId: number; quantidade: number }[]) => Promise<void>;
  title: string;
  initialClientName?: string;
  isEditing?: boolean; // If editing, we might handle things differently
}

export function ProductSelectionModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  initialClientName = "",
  isEditing = false,
}: ProductSelectionModalProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [clientName, setClientName] = useState(initialClientName);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchProducts();
      setClientName(initialClientName);
      setSelectedItems([]);
      setSearchTerm("");
    }
  }, [isOpen, initialClientName]);

  const fetchProducts = async () => {
    try {
      const response = await api.get("/produtos");
      // Ensure preco is a number
      const data = response.data.map((p: any) => ({
        ...p,
        preco: p.preco ? Number(p.preco) : 0
      }));
      setProducts(data);
    } catch (error) {
      console.error("Error fetching products", error);
    }
  };

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
        { produtoId: product.id, quantidade: 1, nome: product.nome, preco: product.preco },
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
      alert("Selecione pelo menos um produto.");
      return;
    }

    setIsLoading(true);
    try {
      const finalClientName = clientName.trim() || "Não Informado";
      const itensPayload = selectedItems.map(({ produtoId, quantidade }) => ({
        produtoId,
        quantidade,
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

  const total = selectedItems.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);

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
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Product List */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="font-semibold">Produtos Disponíveis</h3>
              <Input 
                placeholder="Buscar produto..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <div className="h-[300px] overflow-y-auto space-y-2">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-2 border rounded hover:bg-gray-50 cursor-pointer"
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
                ))}
              </div>
            </div>

            {/* Selected Items */}
            <div className="space-y-4 border rounded-lg p-4 bg-gray-50">
              <h3 className="font-semibold">Itens Selecionados</h3>
              <div className="h-[300px] overflow-y-auto space-y-2">
                {selectedItems.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Nenhum item selecionado</p>
                ) : (
                  selectedItems.map((item) => (
                    <div key={item.produtoId} className="flex items-center justify-between p-2 bg-white rounded shadow-sm">
                      <div className="flex-1">
                        <p className="font-medium">{item.nome}</p>
                        <p className="text-sm text-gray-500">
                          {item.quantidade} x R$ {Number(item.preco || 0).toFixed(2)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
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
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="pt-4 border-t flex justify-between items-center font-bold text-lg">
                <span>Total:</span>
                <span>R$ {total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? "Salvando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
