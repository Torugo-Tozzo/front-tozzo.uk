import { createSignal, For, Show } from "solid-js"
import { useNavigate } from "@solidjs/router"
import { createMutation, createQuery, keepPreviousData, useQueryClient } from "@tanstack/solid-query"
import { loadedData, onQueryError } from "@/api/query"
import { Loader2, Pencil, Plus, Search, Trash2, Users } from "lucide-solid"
import { toast } from "solid-sonner"

import { isPlanUpgradeRequired } from "@/api/errors"
import { createUser, deleteUser, listUsers, updateUser, userKeys, type Member, type UpdateUserRequest } from "@/api/users"
import { PaywallBanner } from "@/components/dashboard/PaywallBanner"
import { Pagination } from "@/components/Pagination"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAuth } from "@/contexts/AuthContext"
import { useConfirm } from "@/contexts/ConfirmContext"
import type { Role } from "@/domain/user"
import { useErrorMessage } from "@/i18n/error-message"
import { formatNumber, formatPageIndex } from "@/i18n/format"
import { useTranslation } from "@/i18n/solid"
import { createCursorPages, totalPagesOf } from "@/lib/cursor-pages"
import { createDebounced, createMinLoading } from "@/lib/min-loading"

const MANAGED_BY_MANAGER: readonly Role[] = ["EMPLOYEE", "COOK", "DRIVER", "CUSTOMER"]

export default function EmployeesPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const confirm = useConfirm()
  const queryClient = useQueryClient()
  const { t, language } = useTranslation("employees")
  const { t: tCommon } = useTranslation("common")
  const localizedError = useErrorMessage()

  const [isAddDialogOpen, setIsAddDialogOpen] = createSignal(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = createSignal(false)
  const [currentEmployee, setCurrentEmployee] = createSignal<Member | null>(null)
  const [deletingId, setDeletingId] = createSignal<string | null>(null)
  const [search, setSearch] = createSignal("")
  const debouncedSearch = createDebounced(search)
  const pages = createCursorPages(10)

  const [name, setName] = createSignal("")
  const [email, setEmail] = createSignal("")
  const [password, setPassword] = createSignal("")
  const [role, setRole] = createSignal<Role>("EMPLOYEE")

  const isOwner = () => user()?.role === "OWNER"
  const isManager = () => user()?.role === "MANAGER"
  const canManageUsers = () => isOwner() || isManager()

  // Roles the signed-in user can give (the API refuses others: ROLE_NOT_ASSIGNABLE).
  const availableRoles = (): Role[] => {
    if (isOwner()) return ["MANAGER", "EMPLOYEE", "COOK", "DRIVER", "CUSTOMER"]
    if (isManager()) return [...MANAGED_BY_MANAGER]
    return []
  }
  const editAvailableRoles = (): Role[] => {
    if (currentEmployee()?.role === "MANAGER" && isOwner()) return ["MANAGER", "EMPLOYEE", "CUSTOMER"]
    return availableRoles()
  }
  const canManage = (employee: Member) => {
    if (employee.role === "OWNER") return false
    if (isOwner()) return true
    return isManager() && MANAGED_BY_MANAGER.includes(employee.role)
  }

  const employees = createQuery(() => ({
    queryKey: [...userKeys.all, { search: debouncedSearch(), cursor: pages.cursor(), limit: pages.limit() }],
    queryFn: ({ signal }) => listUsers({ search: debouncedSearch(), cursor: pages.cursor(), limit: pages.limit() }, signal),
    placeholderData: keepPreviousData,
  }))
  const paywall = () => isPlanUpgradeRequired(employees.error)
  const showSkeleton = createMinLoading(() => employees.isPending || employees.isPlaceholderData)
  const page = () => (employees.isError ? undefined : loadedData(employees))
  const rows = () => page()?.items ?? []
  const total = () => page()?.total ?? 0
  const totalPages = () => totalPagesOf(total(), pages.limit())

  onQueryError(employees, (error) => {
    // A plan without the module shows the PaywallBanner instead.
    if (isPlanUpgradeRequired(error)) return
    console.error("Error fetching employees", error)
    toast.error(localizedError("loadEmployees", error))
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: userKeys.all })

  const resetForm = () => {
    setName("")
    setEmail("")
    setPassword("")
    setRole("EMPLOYEE")
    setCurrentEmployee(null)
  }

  const create = createMutation(() => ({
    mutationFn: createUser,
    onSuccess: async () => {
      await invalidate()
      setIsAddDialogOpen(false)
      resetForm()
    },
    onError: (error) => {
      console.error("Error creating employee", error)
      toast.error(localizedError("createEmployee", error))
    },
  }))

  const update = createMutation(() => ({
    mutationFn: (input: { id: string; body: UpdateUserRequest }) => updateUser(input.id, input.body),
    onSuccess: async () => {
      await invalidate()
      setIsEditDialogOpen(false)
      resetForm()
    },
    onError: (error) => {
      console.error("Error updating employee", error)
      toast.error(localizedError("updateEmployee", error))
    },
  }))

  const remove = createMutation(() => ({
    mutationFn: deleteUser,
    onMutate: (id: string) => setDeletingId(id),
    onSuccess: () => invalidate(),
    onError: (error) => {
      console.error("Error deleting employee", error)
      toast.error(localizedError("deleteEmployee", error))
    },
    onSettled: () => setDeletingId(null),
  }))

  const isSaving = () => create.isPending || update.isPending

  const handleAddEmployee = (event: SubmitEvent) => {
    event.preventDefault()
    if (isSaving()) return
    create.mutate({ name: name(), email: email(), password: password(), role: role() })
  }

  const handleEditClick = (employee: Member) => {
    setCurrentEmployee(employee)
    setName(employee.name)
    setEmail(employee.email)
    setRole(employee.role || "EMPLOYEE")
    setPassword("")
    setIsEditDialogOpen(true)
  }

  const handleUpdateEmployee = (event: SubmitEvent) => {
    event.preventDefault()
    const target = currentEmployee()
    if (!target || isSaving()) return
    const body: UpdateUserRequest = { name: name(), email: email(), role: role() }
    if (password()) body.password = password()
    update.mutate({ id: target.id, body })
  }

  const handleDeleteEmployee = async (id: string) => {
    if (await confirm({ description: t("confirm.delete"), confirmLabel: tCommon("delete"), destructive: true })) {
      remove.mutate(id)
    }
  }

  const roleLabel = (value: string) => {
    switch (value) {
      case "OWNER": return t("role.owner")
      case "MANAGER": return t("role.manager")
      case "EMPLOYEE": return t("role.employee")
      case "COOK": return t("role.cook")
      case "DRIVER": return t("role.driver")
      case "CUSTOMER": return t("role.customer")
      default: return tCommon("notInformed")
    }
  }

  const RoleSelect = (selectProps: { roles: Role[] }) => (
    <Select<string>
      options={selectProps.roles}
      value={role()}
      onChange={(value) => { if (value) setRole(value as Role) }}
      placeholder={t("selectRole")}
      disabled={isSaving()}
      itemComponent={(item) => <SelectItem item={item.item}>{roleLabel(item.item.rawValue)}</SelectItem>}
    >
      <SelectTrigger aria-label={t("roleLabel")}>
        <SelectValue<string>>{() => roleLabel(role())}</SelectValue>
      </SelectTrigger>
      <SelectContent />
    </Select>
  )

  const SaveLabel = (labelProps: { label: string }) => (
    <Show when={isSaving()} fallback={labelProps.label}>
      <Loader2 class="mr-2 h-4 w-4 animate-spin" />
      {labelProps.label}
    </Show>
  )

  return (
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <h1 class="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Users class="h-8 w-8" />
          {user()?.establishment?.tradeName
            ? t("pageTitle", { establishment: user()!.establishment!.tradeName })
            : t("title")}
        </h1>
        <Show when={canManageUsers()}>
          <Dialog open={isAddDialogOpen()} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger as={Button} onClick={resetForm} disabled={isSaving()}>
              <Plus class="mr-2 h-4 w-4" /> {t("addButton")}
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("dialog.addTitle")}</DialogTitle>
                <DialogDescription>{t("dialog.addDescription")}</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddEmployee} class="space-y-4">
                <div class="space-y-2">
                  <Label for="name">{t("name")}</Label>
                  <Input id="name" value={name()} onInput={(e) => setName(e.currentTarget.value)} required disabled={isSaving()} />
                </div>
                <div class="space-y-2">
                  <Label for="email">{t("email")}</Label>
                  <Input id="email" type="email" value={email()} onInput={(e) => setEmail(e.currentTarget.value)} required disabled={isSaving()} />
                </div>
                <div class="space-y-2">
                  <Label for="role">{t("roleLabel")}</Label>
                  <RoleSelect roles={availableRoles()} />
                </div>
                <div class="space-y-2">
                  <Label for="password">{t("password")}</Label>
                  <Input id="password" type="password" value={password()} onInput={(e) => setPassword(e.currentTarget.value)} required disabled={isSaving()} />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isSaving()}>
                    <SaveLabel label={tCommon("save")} />
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </Show>
      </div>

      <Show when={paywall()}>
        <PaywallBanner code="PLAN_UPGRADE_REQUIRED" role={user()?.role} />
      </Show>

      <Show when={!paywall()}>
        <Card>
          <CardHeader>
            <div class="flex items-center justify-between w-full">
              <CardTitle>{t("team")}</CardTitle>
              <div class="relative w-[250px]">
                <Search class="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("table.searchPlaceholder")}
                  value={search()}
                  onInput={(e) => {
                    setSearch(e.currentTarget.value)
                    pages.reset()
                  }}
                  class="pl-8"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <span class="sr-only" role="status">{showSkeleton() ? tCommon("loading") : ""}</span>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead class="w-[50px]">{tCommon("index")}</TableHead>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("email")}</TableHead>
                  <TableHead>{t("roleLabel")}</TableHead>
                  <Show when={canManageUsers()}>
                    <TableHead class="text-right">{tCommon("actions.label")}</TableHead>
                  </Show>
                </TableRow>
              </TableHeader>
              <TableBody>
                <Show
                  when={!showSkeleton()}
                  fallback={
                    <For each={[0, 1, 2, 3, 4]}>
                      {() => (
                        <TableRow class="animate-in fade-in-0 duration-300">
                          <TableCell><Skeleton class="h-4 w-8" /></TableCell>
                          <TableCell><Skeleton class="h-4 w-[200px]" /></TableCell>
                          <TableCell><Skeleton class="h-4 w-[250px]" /></TableCell>
                          <TableCell><Skeleton class="h-4 w-[100px]" /></TableCell>
                          <Show when={canManageUsers()}>
                            <TableCell class="text-right justify-end flex gap-2">
                              <Skeleton class="h-8 w-8" />
                              <Skeleton class="h-8 w-8" />
                            </TableCell>
                          </Show>
                        </TableRow>
                      )}
                    </For>
                  }
                >
                  <Show
                    when={rows().length > 0}
                    fallback={
                      <TableRow>
                        <TableCell colSpan={canManageUsers() ? 5 : 4} class="py-8 text-center text-muted-foreground">
                          {t("noResults")}
                        </TableCell>
                      </TableRow>
                    }
                  >
                    <For each={rows()}>
                      {(employee, index) => (
                        <TableRow class="animate-in fade-in-0 duration-300">
                          <TableCell class="font-medium">
                            {formatPageIndex(pages.page(), pages.limit(), index(), language())}
                          </TableCell>
                          <TableCell>{employee.name}</TableCell>
                          <TableCell>{employee.email}</TableCell>
                          <TableCell>
                            <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-primary/10 text-primary">
                              {roleLabel(employee.role)}
                            </span>
                          </TableCell>
                          <Show when={canManageUsers()}>
                            <TableCell class="text-right">
                              <div class="flex justify-end gap-2">
                                <Show when={canManage(employee)}>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEditClick(employee)}
                                    disabled={deletingId() === employee.id}
                                    aria-label={tCommon("edit")}
                                    title={tCommon("edit")}
                                  >
                                    <Pencil class="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    class="text-destructive hover:text-destructive"
                                    onClick={() => void handleDeleteEmployee(employee.id)}
                                    disabled={deletingId() === employee.id}
                                    aria-label={tCommon("delete")}
                                    title={tCommon("delete")}
                                  >
                                    <Show when={deletingId() === employee.id} fallback={<Trash2 class="h-4 w-4" />}>
                                      <Loader2 class="h-4 w-4 animate-spin" />
                                    </Show>
                                  </Button>
                                </Show>
                              </div>
                            </TableCell>
                          </Show>
                        </TableRow>
                      )}
                    </For>
                  </Show>
                </Show>
              </TableBody>
            </Table>
            <div class="mt-4 flex items-center justify-between">
              <div class="text-sm text-muted-foreground">
                {t("table.totalRecords", { count: formatNumber(total(), language()) })}
              </div>
              <Pagination
                currentPage={pages.page()}
                totalPages={totalPages()}
                hasMore={!!page()?.nextCursor}
                onPageChange={(target) => pages.goTo(target, page()?.nextCursor)}
                pageSize={pages.limit()}
                onPageSizeChange={pages.setLimit}
                isLoading={employees.isFetching || deletingId() !== null}
              />
            </div>
          </CardContent>
        </Card>

        <Dialog open={isEditDialogOpen()} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("dialog.editTitle")}</DialogTitle>
              <DialogDescription>{t("dialog.editDescription")}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdateEmployee} class="space-y-4">
              <div class="space-y-2">
                <Label for="edit-name">{t("name")}</Label>
                <Input id="edit-name" value={name()} onInput={(e) => setName(e.currentTarget.value)} required disabled={isSaving()} />
              </div>
              <div class="space-y-2">
                <Label for="edit-email">{t("email")}</Label>
                <Input id="edit-email" type="email" value={email()} onInput={(e) => setEmail(e.currentTarget.value)} required disabled={isSaving()} />
              </div>
              <div class="space-y-2">
                <Label for="edit-role">{t("roleLabel")}</Label>
                <RoleSelect roles={editAvailableRoles()} />
              </div>
              <div class="space-y-2">
                <Label for="edit-password">{t("newPassword")}</Label>
                <Input id="edit-password" type="password" value={password()} onInput={(e) => setPassword(e.currentTarget.value)} placeholder={t("leaveBlank")} disabled={isSaving()} />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSaving() || !currentEmployee()}
                  onClick={() => {
                    const target = currentEmployee()
                    if (target) navigate(`/dashboard/schedule?employeeId=${encodeURIComponent(target.id)}`)
                  }}
                >
                  {t("viewSchedule")}
                </Button>
                <Button type="submit" disabled={isSaving()}>
                  <SaveLabel label={tCommon("saveChanges")} />
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </Show>
    </div>
  )
}
