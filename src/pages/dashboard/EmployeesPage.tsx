import { useState, useEffect } from "react"
import {
  Table,
  TableBody,
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
import api, { getErrorCode } from "@/services/api"
import { parseListResponse } from "@/services/parseResponse"
import { toast } from "sonner"
import { Pagination } from "@/components/Pagination"
import { useAuth } from "@/contexts/AuthContext"
import { useConfirm } from "@/contexts/ConfirmContext"
import { useMinLoadingDuration } from "@/hooks/useMinLoadingDuration"
import { useTranslation } from "react-i18next"
import { getErrorTranslationKey, type ErrorContext } from "@/i18n/error-keys"
import { formatNumber, formatPageIndex } from "@/i18n/format"
import type { UserRole } from "@/domain/models"

type Employee = {
  id: number | string
  name: string
  email: string
  role: UserRole
}

export default function EmployeesPage() {
  const { user } = useAuth()
  const confirm = useConfirm()
  const { i18n } = useTranslation()
  const { t: tAuth } = useTranslation("auth")
  const { t } = useTranslation("employees")
  const { t: tCommon } = useTranslation("common")
  const { t: tErrors } = useTranslation("errors")
  const localizedError = (context: ErrorContext, error: unknown) => {
    const translation = getErrorTranslationKey(context, getErrorCode(error))
    return translation.namespace === "auth"
      ? tAuth(translation.key)
      : tErrors(translation.key)
  }
  const [employees, setEmployees] = useState<Employee[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null)

  // isFetching = so a listagem (efeito de page/limit/search). isSaving = so
  // os dialogs de criar/editar. deletingId = so a linha sendo excluida.
  // Mesmo padrao usado em ProductsPage - antes um unico isLoading cobria
  // tudo e excluir 1 funcionario reskeletonava a tabela inteira.
  const [isFetching, setIsFetching] = useState(false)
  const showSkeleton = useMinLoadingDuration(isFetching)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | string | null>(null)
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
  const [role, setRole] = useState<UserRole>("EMPLOYEE")

  const isOwner = user?.role === "OWNER"
  const isManager = user?.role === "MANAGER"
  const canManageUsers = isOwner || isManager

  // Roles disponíveis para criação/edição baseado no cargo do usuário logado
  const getAvailableRoles = () => {
    if (isOwner) return ["MANAGER", "EMPLOYEE", "CUSTOMER"]
    if (isManager) return ["EMPLOYEE", "CUSTOMER"]
    return []
  }

  // Verifica se o usuário logado pode editar o funcionário alvo
  const canEditEmployee = (employee: Employee) => {
    if (employee.role === "OWNER") return false
    if (isOwner) return true
    if (isManager && (employee.role === "EMPLOYEE" || employee.role === "CUSTOMER")) return true
    return false
  }

  // Verifica se o usuário logado pode excluir o funcionário alvo
  const canDeleteEmployee = (employee: Employee) => {
    if (employee.role === "OWNER") return false
    if (isOwner) return true
    if (isManager && (employee.role === "EMPLOYEE" || employee.role === "CUSTOMER")) return true
    return false
  }

  useEffect(() => {
    const delay = setTimeout(() => {
      setIsFetching(true)
      fetchEmployees().finally(() => setIsFetching(false))
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
      toast.error(localizedError("loadEmployees", error))
    }
  }

  const handleAddEmployee = async (e: React.FormEvent) => {
    setIsSaving(true)
    e.preventDefault()
    try {
      await api.post("/usuarios", {
        name,
        email,
        password,
        role,
      })
      await fetchEmployees()
      setIsAddDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error("Error creating employee", error)
      toast.error(localizedError("createEmployee", error))
    } finally {
      setIsSaving(false)
    }
  }

  const handleEditClick = (employee: Employee) => {
    setCurrentEmployee(employee)
    setName(employee.name)
    setEmail(employee.email)
    setRole(employee.role || "EMPLOYEE")
    setPassword("") // Reset password field
    setIsEditDialogOpen(true)
  }

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    setIsSaving(true)
    e.preventDefault()
    if (!currentEmployee) return

    try {
      const payload: any = {
        name,
        email,
        role,
      }
      if (password) {
        payload.password = password
      }

      await api.put(`/usuarios/${currentEmployee.id}`, payload)
      await fetchEmployees()
      setIsEditDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error("Error updating employee", error)
      toast.error(localizedError("updateEmployee", error))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteEmployee = async (id: number | string) => {
    if (await confirm({ description: t("confirm.delete"), confirmLabel: tCommon("delete"), destructive: true })) {
        setDeletingId(id)
        try {
          await api.delete(`/usuarios/${id}`)
          await fetchEmployees()
        } catch (error) {
          console.error("Error deleting employee", error)
          toast.error(localizedError("deleteEmployee", error))
        } finally {
          setDeletingId(null)
        }
    }
  }

  const resetForm = () => {
    setName("")
    setEmail("")
    setPassword("")
    setRole("EMPLOYEE")
    setCurrentEmployee(null)
  }

  const roleLabel = (r: string) => {
    switch (r) {
      case 'OWNER': return t("role.owner")
      case 'MANAGER': return t("role.manager")
      case 'EMPLOYEE': return t("role.employee")
      case 'CUSTOMER': return t("role.customer")
      default: return tCommon("notInformed")
    }
  }

  const availableRoles = getAvailableRoles()

  // Roles disponíveis para edição (pode ser diferente dependendo do alvo)
  const getEditAvailableRoles = () => {
    if (!currentEmployee) return availableRoles
    if (currentEmployee.role === "MANAGER" && isOwner) return ["MANAGER", "EMPLOYEE", "CUSTOMER"]
    return availableRoles
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Users className="h-8 w-8" />
          {user?.establishment?.tradeName
            ? t("pageTitle", { establishment: user.establishment.tradeName })
            : t("title")}
        </h1>
        {canManageUsers && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} disabled={isSaving}>
                <Plus className="mr-2 h-4 w-4" /> {t("addButton")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("dialog.addTitle")}</DialogTitle>
                <DialogDescription>{t("dialog.addDescription")}</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddEmployee} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t("name")}</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">{t("email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">{t("roleLabel")}</Label>
                  <Select value={role} onValueChange={(value) => setRole(value as UserRole)}>
                    <SelectTrigger aria-label={t("roleLabel")} disabled={isSaving}>
                      <SelectValue placeholder={t("selectRole")} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles.map((r) => (
                        <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{t("password")}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isSaving}
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {tCommon("save")}
                      </>
                    ) : (
                      tCommon("save")
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <CardTitle>{t("team")}</CardTitle>
            <div className="relative w-[250px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("table.searchPlaceholder")}
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
          <span className="sr-only" role="status">{showSkeleton ? tCommon("loading") : ""}</span>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">{tCommon("index")}</TableHead>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("email")}</TableHead>
                <TableHead>{t("roleLabel")}</TableHead>
                {canManageUsers && (
                  <TableHead className="text-right">{tCommon("actions.label")}</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {showSkeleton ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="animate-in fade-in-0 duration-300">
                      <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[250px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                      {canManageUsers && (
                        <TableCell className="text-right justify-end flex gap-2">
                          <Skeleton className="h-8 w-8" />
                          <Skeleton className="h-8 w-8" />
                        </TableCell>
                      )}
                    </TableRow>
                  ))
              ) : employees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canManageUsers ? 5 : 4} className="py-8 text-center text-muted-foreground">
                    {t("noResults")}
                  </TableCell>
                </TableRow>
              ) : (
                employees.map((employee, index) => (
                <TableRow key={employee.id} className="animate-in fade-in-0 duration-300">
                    <TableCell className="font-medium">
                      {formatPageIndex(page, limit, index, i18n.language)}
                    </TableCell>
                    <TableCell>{employee.name}</TableCell>
                    <TableCell>{employee.email}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-primary/10 text-primary">
                        {roleLabel(employee.role)}
                      </span>
                    </TableCell>
                  {canManageUsers && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {canEditEmployee(employee) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditClick(employee)}
                            disabled={deletingId === employee.id}
                            aria-label={tCommon("edit")}
                            title={tCommon("edit")}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {canDeleteEmployee(employee) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteEmployee(employee.id)}
                            disabled={deletingId === employee.id}
                            aria-label={tCommon("delete")}
                            title={tCommon("delete")}
                          >
                            {deletingId === employee.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              )))}
            </TableBody>
          </Table>
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {t("table.totalRecords", { count: formatNumber(totalItems, i18n.language) })}
            </div>
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
              isLoading={isFetching || deletingId !== null}
            />
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dialog.editTitle")}</DialogTitle>
            <DialogDescription>{t("dialog.editDescription")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateEmployee} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">{t("name")}</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">{t("email")}</Label>
              <Input
                id="edit-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">{t("roleLabel")}</Label>
              <Select value={role} onValueChange={(value) => setRole(value as UserRole)}>
                <SelectTrigger aria-label={t("roleLabel")} disabled={isSaving}>
                <SelectValue placeholder={t("selectRole")} />
                </SelectTrigger>
                <SelectContent>
                  {getEditAvailableRoles().map((r) => (
                    <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">{t("newPassword")}</Label>
              <Input
                id="edit-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("leaveBlank")}
                disabled={isSaving}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {tCommon("saveChanges")}
                  </>
                ) : (
                  tCommon("saveChanges")
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
