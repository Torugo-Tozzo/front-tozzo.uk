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
import { Plus, Pencil, Trash2, Users } from "lucide-react"

type Employee = {
  id: string
  name: string
  phone: string
  email: string
  role: "Dono" | "Funcionário"
}

const initialEmployees: Employee[] = [
  {
    id: "1",
    name: "Victor Tozzo",
    phone: "(11) 99999-9999",
    email: "victor@tozzo.uk",
    role: "Dono",
  },
  {
    id: "2",
    name: "João Silva",
    phone: "(11) 98888-8888",
    email: "joao@email.com",
    role: "Funcionário",
  },
  {
    id: "3",
    name: "Maria Oliveira",
    phone: "(11) 97777-7777",
    email: "maria@email.com",
    role: "Funcionário",
  },
]

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null)

  // Form states
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("") // Just for UI, not storing in mock

  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault()
    const newEmployee: Employee = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      phone,
      email,
      role: "Funcionário",
    }
    setEmployees([...employees, newEmployee])
    setIsAddDialogOpen(false)
    resetForm()
  }

  const handleEditClick = (employee: Employee) => {
    setCurrentEmployee(employee)
    setName(employee.name)
    setPhone(employee.phone)
    setEmail(employee.email)
    setPassword("") // Reset password field
    setIsEditDialogOpen(true)
  }

  const handleUpdateEmployee = (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentEmployee) return

    const updatedEmployees = employees.map((emp) =>
      emp.id === currentEmployee.id
        ? { ...emp, name, phone, email }
        : emp
    )
    setEmployees(updatedEmployees)
    setIsEditDialogOpen(false)
    resetForm()
  }

  const handleDeleteEmployee = (id: string) => {
    if (confirm("Tem certeza que deseja excluir este funcionário?")) {
      setEmployees(employees.filter((emp) => emp.id !== id))
    }
  }

  const resetForm = () => {
    setName("")
    setPhone("")
    setEmail("")
    setPassword("")
    setCurrentEmployee(null)
  }

  // Sort employees: Owner first, then alphabetical
  const sortedEmployees = [...employees].sort((a, b) => {
    if (a.role === "Dono") return -1
    if (b.role === "Dono") return 1
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Users className="h-8 w-8" />
          Funcionários
        </h1>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" /> Novo Funcionário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Funcionário</DialogTitle>
              <DialogDescription>
                Preencha os dados para cadastrar um novo funcionário.
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
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Celular</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
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
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
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
          <CardTitle>Equipe</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableCaption>Lista de todos os funcionários cadastrados.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Celular</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Função</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedEmployees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="font-medium">{employee.name}</TableCell>
                  <TableCell>{employee.phone}</TableCell>
                  <TableCell>{employee.email}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        employee.role === "Dono"
                          ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300"
                          : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {employee.role}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditClick(employee)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {employee.role !== "Dono" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteEmployee(employee.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Celular</Label>
              <Input
                id="edit-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">Nova Senha (opcional)</Label>
              <Input
                id="edit-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Deixe em branco para manter"
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
