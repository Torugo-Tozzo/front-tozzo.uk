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
import { Pagination } from "@/components/Pagination"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { useAuth } from "@/contexts/AuthContext"
import { useDebounce } from "@/hooks/useDebounce"
import { useToast } from "@/contexts/ToastContext"
import { employeesService, type Employee } from "@/services/employees"
import { formatRole } from "@/utils/format"

export default function EmployeesPage() {
  const { user } = useAuth()
  const toast = useToast()

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
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  const [form, setForm] = useState({ name: "", email: "", password: "", role: "FUNCIONARIO" })

  const debouncedSearch = useDebounce(search, 300)

  useEffect(() => {
    fetchEmployees()
  }, [page, limit, debouncedSearch])

  const fetchEmployees = async () => {
    setIsLoading(true)
    try {
      const { items, total, totalPages, hasMore } = await employeesService.list(page, limit, debouncedSearch)
      setEmployees(items)
      setTotalItems(total)
      setTotalPages(totalPages)
      setHasMore(hasMore)
    } catch {
      toast("Erro ao carregar funcionários", "error")
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await employeesService.create({ nome: form.name, email: form.email, senha: form.password, role: form.role })
      toast("Funcionário criado com sucesso", "success")
      await fetchEmployees()
      setIsAddDialogOpen(false)
      resetForm()
    } catch {
      toast("Erro ao criar funcionário", "error")
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditClick = (employee: Employee) => {
    setCurrentEmployee(employee)
    setForm({ name: employee.nome, email: employee.email, password: "", role: employee.role || "FUNCIONARIO" })
    setIsEditDialogOpen(true)
  }

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentEmployee) return
    setIsLoading(true)
    try {
      const payload: Parameters<typeof employeesService.update>[1] = { nome: form.name, email: form.email, role: form.role }
      if (form.password) payload.senha = form.password
      await employeesService.update(currentEmployee.id, payload)
      toast("Funcionário atualizado", "success")
      await fetchEmployees()
      setIsEditDialogOpen(false)
      resetForm()
    } catch {
      toast("Erro ao atualizar funcionário", "error")
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (confirmDeleteId === null) return
    const id = confirmDeleteId
    setConfirmDeleteId(null)
    setIsLoading(true)
    try {
      await employeesService.delete(id)
      toast("Funcionário excluído", "success")
      await fetchEmployees()
    } catch {
      toast("Erro ao excluir funcionário", "error")
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setForm({ name: "", email: "", password: "", role: "FUNCIONARIO" })
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
              <DialogDescription>Cadastre um novo funcionário para acessar o sistema.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddEmployee} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required disabled={isLoading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required disabled={isLoading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Cargo</Label>
                <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger disabled={isLoading}><SelectValue placeholder="Selecione o cargo" /></SelectTrigger>
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
                <Input id="password" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required disabled={isLoading} />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
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
                onChange={e => { setSearch(e.target.value); setPage(1) }}
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
                      <Skeleton className="h-8 w-8" /><Skeleton className="h-8 w-8" />
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
                        {formatRole(employee.role)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEditClick(employee)} disabled={isLoading}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {employee.role !== 'DONO' && (
                          <Button
                            variant="ghost" size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setConfirmDeleteId(employee.id)}
                            disabled={isLoading}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
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
              onPageSizeChange={newLimit => { setLimit(newLimit); setPage(1) }}
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
            <DialogDescription>Atualize os dados do funcionário.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateEmployee} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome</Label>
              <Input id="edit-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required disabled={isLoading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required disabled={isLoading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Cargo</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger disabled={isLoading}><SelectValue placeholder="Selecione o cargo" /></SelectTrigger>
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
              <Input id="edit-password" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Deixe em branco para manter" disabled={isLoading} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar Alterações
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Excluir Funcionário"
        description="Tem certeza que deseja excluir este funcionário?"
        confirmLabel="Excluir"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  )
}
