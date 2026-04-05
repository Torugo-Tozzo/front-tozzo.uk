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
import { Plus, Pencil, Trash2, Users, Loader2, Search } from "lucide-react"
import api from "@/services/api"
import { parseListResponse } from "@/services/parseResponse"
import { toast } from "sonner"
import { Pagination } from "@/components/Pagination"
import { useAuth } from "@/contexts/AuthContext"

type Employee = {
  id: number
  nome: string
  email: string
  role: string
}

export default function EmployeesPage() {
  const { user } = useAuth()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null)

  const [isLoading, setIsLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [totalPages, setTotalPages] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [search, setSearch] = useState("")

  // Form states
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState("FUNCIONARIO")

  useEffect(() => {
    const delay = setTimeout(() => {
      setIsLoading(true)
      fetchEmployees().finally(() => setIsLoading(false))
    }, 300)
    return () => clearTimeout(delay)
  }, [page, limit, search])

  const fetchEmployees = async () => {
    try {
      const response = await api.get(`/usuarios?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`)

      const { data, total } = parseListResponse<Employee>(response)

      setEmployees(data)
      setTotalItems(total)

      if (total > 0) {
        setTotalPages(Math.ceil(total / limit))
        setHasMore(page < Math.ceil(total / limit))
      } else {
        setTotalPages(0)
        setHasMore(data.length === limit)
      }
    } catch (error) {
      console.error("Error fetching employees", error)
    }
  }

  const handleAddEmployee = async (e: React.FormEvent) => {
    setIsLoading(true)
    e.preventDefault()
    try {
      await api.post("/usuarios", {
        nome: name,
        email,
        senha: password,
        role: role
      })
      await fetchEmployees()
      setIsAddDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error("Error creating employee", error)
      toast.error("Erro ao criar funcionário")
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditClick = (employee: Employee) => {
    setCurrentEmployee(employee)
    setName(employee.nome)
    setEmail(employee.email)
    setRole(employee.role || "FUNCIONARIO")
    setPassword("") // Reset password field
    setIsEditDialogOpen(true)
  }

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    setIsLoading(true)
    e.preventDefault()
    if (!currentEmployee) return

    try {
      const payload: any = {
        nome: name,
        email,
        role: role
      }
      if (password) {
        payload.senha = password
      }

      await api.put(`/usuarios/${currentEmployee.id}`, payload)
      await fetchEmployees()
      setIsEditDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error("Error updating employee", error)
      toast.error("Erro ao atualizar funcionário")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteEmployee = async (id: number) => {
    if (confirm("Tem certeza que deseja excluir este funcionário?")) {
        setIsLoading(true)
        try {
          await api.delete(`/usuarios/${id}`)
          await fetchEmployees()
        } catch (error) {
          console.error("Error deleting employee", error)
          toast.error("Erro ao excluir funcionário")
        } finally {
          setIsLoading(false)
        }
    }
  }

  const resetForm = () => {
    setName("")
    setEmail("")
    setPassword("")
    setRole("FUNCIONARIO")
    setCurrentEmployee(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Users className="h-8 w-8" />
          {`Funcionários${user?.estabelecimento?.nomeFantasia ? ` do ${user.estabelecimento.nomeFantasia}` : ''}`}
        </h1>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} disabled={isLoading}>
              <Plus className="mr-2 h-4 w-4" /> Novo Funcionário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Funcionário</DialogTitle>
              <DialogDescription>
                Cadastre um novo funcionário para acessar o sistema.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddEmployee} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Cargo</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger disabled={isLoading}>
                    <SelectValue placeholder="Selecione o cargo" />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="DONO">Dono</SelectItem>
                      <SelectItem value="GERENTE">Gerente</SelectItem>
                      <SelectItem value="FUNCIONARIO">Funcionário</SelectItem>
                      <SelectItem value="CLIENTE">Cliente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvar
                    </>
                  ) : (
                    "Salvar"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <CardTitle>Equipe</CardTitle>
            <div className="relative w-[250px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar funcionários..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableCaption>Lista de usuários do sistema.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[250px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                      <TableCell className="text-right justify-end flex gap-2">
                        <Skeleton className="h-8 w-8" />
                        <Skeleton className="h-8 w-8" />
                      </TableCell>
                    </TableRow>
                  ))
              ) : (
                employees.map((employee, index) => (
                <TableRow key={employee.id}>
                    <TableCell className="font-medium">{(page - 1) * limit + index + 1}</TableCell>
                    <TableCell>{employee.nome}</TableCell>
                    <TableCell>{employee.email}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-primary/10 text-primary">
                        {(() => {
                          const r = employee.role
                          if (!r) return "N/A"
                          switch (r) {
                            case 'DONO': return 'Dono'
                            case 'GERENTE': return 'Gerente'
                            case 'FUNCIONARIO': return 'Funcionário'
                            case 'CLIENTE': return 'Cliente'
                            default: return r
                          }
                        })()}
                      </span>
                    </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditClick(employee)}
                          disabled={isLoading}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {employee.role !== 'DONO' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteEmployee(employee.id)}
                            disabled={isLoading}
                          >
                            {isLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                    </div>
                  </TableCell>
                </TableRow>
              )))}
            </TableBody>
          </Table>
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Total de registros: {totalItems}</div>
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
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Funcionário</DialogTitle>
            <DialogDescription>
              Atualize os dados do funcionário.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateEmployee} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Cargo</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger disabled={isLoading}>
                  <SelectValue placeholder="Selecione o cargo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DONO">Dono</SelectItem>
                  <SelectItem value="GERENTE">Gerente</SelectItem>
                  <SelectItem value="FUNCIONARIO">Funcionário</SelectItem>
                  <SelectItem value="CLIENTE">Cliente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">Nova Senha (opcional)</Label>
              <Input
                id="edit-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Deixe em branco para manter"
                disabled={isLoading}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvar Alterações
                  </>
                ) : (
                  "Salvar Alterações"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
