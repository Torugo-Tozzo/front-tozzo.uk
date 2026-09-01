import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/contexts/AuthContext"
import { useConfirm } from "@/contexts/ConfirmContext"
import api from "@/services/api"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { useMinLoadingDuration } from "@/hooks/useMinLoadingDuration"
import { formatDate } from "@/i18n/format"
import type { Device } from "@/domain/models"

export default function DevicesPage() {
  const { t } = useTranslation("settings")
  const { user } = useAuth()
  const confirm = useConfirm()
  const isOwner = user?.role === "OWNER"
  const [devices, setDevices] = useState<Device[]>([])
  const [isFetching, setIsFetching] = useState(true)
  const showSkeleton = useMinLoadingDuration(isFetching)
  const [removingId, setRemovingId] = useState<string | number | null>(null)

  const fetchDevices = async () => {
    setIsFetching(true)
    try {
      const response = await api.get("/dispositivos")
      setDevices(Array.isArray(response.data) ? response.data : [])
    } catch (error) {
      console.error("Error fetching devices", error)
      toast.error(t("devices.loadError"))
    } finally {
      setIsFetching(false)
    }
  }

  useEffect(() => { fetchDevices() }, [])

  const handleRemove = async (device: Device) => {
    const confirmed = await confirm({
      description: t("devices.removeConfirmDescription"),
      confirmLabel: t("devices.removeConfirmButton"),
      destructive: true,
    })
    if (!confirmed) return
    setRemovingId(device.id)
    try {
      await api.delete(`/dispositivos/${device.id}`)
      setDevices((current) => current.filter((item) => item.id !== device.id))
    } catch (error) {
      console.error("Error removing device", error)
      toast.error(t("devices.removeError"))
    } finally {
      setRemovingId(null)
    }
  }

  return <div className="space-y-6">
    <h1 className="text-3xl font-bold tracking-tight">{t("devices.title")}</h1>
    <div className="border rounded-lg bg-card">
      <Table>
        <TableHeader><TableRow>
          <TableHead>{t("devices.columns.id")}</TableHead>
          <TableHead>{t("devices.columns.lastSeen")}</TableHead>
          {isOwner && <TableHead className="text-right">{t("devices.columns.actions")}</TableHead>}
        </TableRow></TableHeader>
        <TableBody>
          {showSkeleton ? Array.from({ length: 3 }).map((_, index) => <TableRow key={index}>
            <TableCell><Skeleton className="h-4 w-32" /></TableCell><TableCell><Skeleton className="h-4 w-24" /></TableCell>{isOwner && <TableCell />}
          </TableRow>) : devices.length === 0 ? <TableRow>
            <TableCell colSpan={isOwner ? 3 : 2}>{t("devices.noResults")}</TableCell>
          </TableRow> : devices.map((device) => <TableRow key={device.id}>
            <TableCell>{device.id}</TableCell>
            <TableCell>{device.lastSeen ? formatDate(device.lastSeen) : t("devices.neverSeen")}</TableCell>
            {isOwner && <TableCell className="text-right"><Button type="button" variant="destructive" size="sm" disabled={removingId === device.id} onClick={() => handleRemove(device)}>{t("devices.removeButton")}</Button></TableCell>}
          </TableRow>)}
        </TableBody>
      </Table>
    </div>
  </div>
}
