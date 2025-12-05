import { useState } from "react"
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
import { Plus, Pencil, Trash2, ShoppingBag } from "lucide-react"

type Product = {
  id: string
  name: string
  price: string
  ingredients: string
  type: "Comida" | "Bebida" | "Sobremesa"
}

const initialProducts: Product[] = [
  {
    id: "PROD-001",
    name: "Hambúrguer Clássico",
    price: "R$ 35,00",
    ingredients: "Pão, carne, queijo, alface, tomate",
    type: "Comida",
  },
  {
    id: "PROD-002",
    name: "Refrigerante Lata",
    price: "R$ 6,00",
    ingredients: "",
    type: "Bebida",
  },
  {
    id: "PROD-003",
    name: "Pudim de Leite",
    price: "R$ 12,00",
    ingredients: "Leite condensado, ovos, leite",
    type: "Sobremesa",
  },
]

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null)

  // Form states
  const [name, setName] = useState("")
  const [price, setPrice] = useState("")
  const [ingredients, setIngredients] = useState("")
  const [type, setType] = useState<"Comida" | "Bebida" | "Sobremesa">("Comida")

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault()
    const newProduct: Product = {
      id: `PROD-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      name,
      price,
      ingredients,
      type,
    }
    setProducts([...products, newProduct])
    setIsAddDialogOpen(false)
    resetForm()
  }

  const handleEditClick = (product: Product) => {
    setCurrentProduct(product)
    setName(product.name)
    setPrice(product.price)
    setIngredients(product.ingredients)
    setType(product.type)
    setIsEditDialogOpen(true)
  }

  const handleUpdateProduct = (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentProduct) return

    const updatedProducts = products.map((prod) =>
      prod.id === currentProduct.id
        ? { ...prod, name, price, ingredients, type }
        : prod
    )
    setProducts(updatedProducts)
    setIsEditDialogOpen(false)
    resetForm()
  }

  const handleDeleteProduct = (id: string) => {
    if (confirm("Tem certeza que deseja excluir este produto?")) {
      setProducts(products.filter((prod) => prod.id !== id))
    }
  }

  const resetForm = () => {
    setName("")
    setPrice("")
    setIngredients("")
    setType("Comida")
    setCurrentProduct(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <ShoppingBag className="h-8 w-8" />
          Produtos
        </h1>
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
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="R$ 0,00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Tipo</Label>
                <Select value={type} onValueChange={(value: any) => setType(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Comida">Comida</SelectItem>
                    <SelectItem value="Bebida">Bebida</SelectItem>
                    <SelectItem value="Sobremesa">Sobremesa</SelectItem>
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
                <Button type="submit">Salvar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cardápio</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableCaption>Lista de todos os produtos cadastrados.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">ID</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.id}</TableCell>
                  <TableCell>{product.name}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
                      ${product.type === 'Comida' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300' : 
                        product.type === 'Bebida' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' :
                        'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300'
                      }`}>
                      {product.type}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{product.price}</TableCell>
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
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
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
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-type">Tipo</Label>
              <Select value={type} onValueChange={(value: any) => setType(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Comida">Comida</SelectItem>
                  <SelectItem value="Bebida">Bebida</SelectItem>
                  <SelectItem value="Sobremesa">Sobremesa</SelectItem>
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
              <Button type="submit">Salvar Alterações</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
