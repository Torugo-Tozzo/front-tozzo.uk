import { createSignal, For, Show } from "solid-js"
import { Navigate } from "@solidjs/router"
import { createMutation, createQuery, useQueryClient } from "@tanstack/solid-query"
import { loadedData, onQueryError } from "@/api/query"
import { Loader2, Trash2 } from "lucide-solid"
import { toast } from "solid-sonner"

import { deleteDevice, deviceKeys, listDevices, type ListedDevice } from "@/api/devices"
import { establishmentKeys } from "@/api/establishment"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAuth } from "@/contexts/AuthContext"
import { useConfirm } from "@/contexts/ConfirmContext"
import { formatDate } from "@/i18n/format"
import { useTranslation } from "@/i18n/solid"
import { createMinLoading } from "@/lib/min-loading"

function formatPlatform(info: unknown, fallback: string): string {
  const platform = info && typeof info === "object" && "platform" in info ? String((info as { platform?: unknown }).platform ?? "") : ""
  if (platform.toLowerCase() === "android") return "Android"
  if (platform.toLowerCase() === "ios") return "iOS"
  return platform || fallback
}

export default function DevicesPage() {
  const { user } = useAuth()
  const canView = () => user()?.role === "OWNER" || user()?.role === "MANAGER"
  return (
    <Show when={canView()} fallback={<Navigate href="/dashboard" />}>
      <DevicesContent />
    </Show>
  )
}

function DevicesContent() {
  const { t, language } = useTranslation("settings")
  const { user } = useAuth()
  const confirm = useConfirm()
  const queryClient = useQueryClient()
  const isOwner = () => user()?.role === "OWNER"
  const [removingId, setRemovingId] = createSignal<string | null>(null)

  const devices = createQuery(() => ({
    queryKey: deviceKeys.all,
    queryFn: ({ signal }) => listDevices(signal),
  }))
  const showSkeleton = createMinLoading(() => devices.isPending)

  onQueryError(devices, (error) => {
    console.error("Error fetching devices", error)
    toast.error(t("devices.loadError"))
  })

  const remove = createMutation(() => ({
    mutationFn: deleteDevice,
    onMutate: (id: string) => setRemovingId(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<ListedDevice[]>(deviceKeys.all, (current) => current?.filter((item) => item.id !== id))
      // The plan usage on the settings page counts the devices.
      void queryClient.invalidateQueries({ queryKey: establishmentKeys.all, exact: true })
    },
    onError: (error) => {
      console.error("Error removing device", error)
      toast.error(t("devices.removeError"))
    },
    onSettled: () => setRemovingId(null),
  }))

  const handleRemove = async (device: ListedDevice) => {
    const confirmed = await confirm({
      description: t("devices.removeConfirmDescription"),
      confirmLabel: t("devices.removeConfirmButton"),
      destructive: true,
    })
    if (confirmed) remove.mutate(device.id)
  }

  const rows = () => loadedData(devices) ?? []

  return (
    <div class="space-y-6">
      <h1 class="text-3xl font-bold tracking-tight">{t("devices.title")}</h1>
      <div class="border rounded-lg bg-card">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t("devices.columns.platform")}</TableHead>
            <TableHead>{t("devices.columns.user")}</TableHead>
            <TableHead>{t("devices.columns.lastSeen")}</TableHead>
            <Show when={isOwner()}><TableHead class="text-right">{t("devices.columns.actions")}</TableHead></Show>
          </TableRow></TableHeader>
          <TableBody>
            <Show
              when={!showSkeleton()}
              fallback={
                <For each={[0, 1, 2]}>
                  {() => (
                    <TableRow>
                      <TableCell><Skeleton class="h-4 w-24" /></TableCell><TableCell><Skeleton class="h-4 w-32" /></TableCell><TableCell><Skeleton class="h-4 w-24" /></TableCell><Show when={isOwner()}><TableCell /></Show>
                    </TableRow>
                  )}
                </For>
              }
            >
              <Show
                when={rows().length > 0}
                fallback={<TableRow><TableCell colSpan={isOwner() ? 4 : 3}>{t("devices.noResults")}</TableCell></TableRow>}
              >
                <For each={rows()}>
                  {(device) => (
                    <TableRow>
                      <TableCell>{formatPlatform(device.info, t("devices.notAvailable"))}</TableCell>
                      <TableCell>{device.lastUserName ?? t("devices.notAvailable")}</TableCell>
                      <TableCell>{device.lastSeen ? formatDate(device.lastSeen, language()) : t("devices.neverSeen")}</TableCell>
                      <Show when={isOwner()}>
                        <TableCell class="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            class="text-destructive hover:text-destructive"
                            disabled={removingId() === device.id}
                            onClick={() => void handleRemove(device)}
                            aria-label={t("devices.removeButton")}
                            title={t("devices.removeButton")}
                          >
                            <Show when={removingId() === device.id} fallback={<Trash2 class="h-4 w-4" />}>
                              <Loader2 class="h-4 w-4 animate-spin" />
                            </Show>
                          </Button>
                        </TableCell>
                      </Show>
                    </TableRow>
                  )}
                </For>
              </Show>
            </Show>
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
