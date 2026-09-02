import { Languages, Printer } from "lucide-react"
import { ModeToggle } from "@/components/mode-toggle"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useTranslation } from "react-i18next"
import { LOCALE_NATIVE_NAMES, normalizeLocale, SUPPORTED_LOCALES } from "@/i18n/locale"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  PAPER_WIDTH_PRESETS,
  getStoredPaperWidth,
  persistPaperWidth,
  type PaperWidthPreset,
} from "@/lib/printPreferences"
import api from "@/services/api"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "sonner"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import type { EstablishmentPlan } from "@/domain/models"

type EstablishmentResponse = {
  id: number | string | null
  plan: EstablishmentPlan | null
  printCountToday: number | null
  reportCount: number | null
  deviceCount: number | null
  tradeName: string
  phone: string
  zipCode: string
  addressStreet: string
  addressNumber: string
  addressComplement: string
  addressNeighborhood: string
  addressCity: string
  addressState: string
  cnpj: string
}

const ESTABLISHMENT_PLANS: readonly EstablishmentPlan[] = ['FREE', 'PAGO', 'PAGO_LEGADO', 'ENTERPRISE']

function isEstablishmentPlan(value: unknown): value is EstablishmentPlan {
  return typeof value === "string" && ESTABLISHMENT_PLANS.includes(value as EstablishmentPlan)
}

function readEstablishmentResponse(data: unknown, fallbackId: number | string | null): EstablishmentResponse {
  const rawData = Array.isArray(data) ? data[0] : data
  if (!rawData || typeof rawData !== "object") {
    return { id: fallbackId, plan: null, printCountToday: null, reportCount: null, deviceCount: null, tradeName: "", phone: "", zipCode: "", addressStreet: "", addressNumber: "", addressComplement: "", addressNeighborhood: "", addressCity: "", addressState: "", cnpj: "" }
  }

  const rawEstablishment = rawData as Record<string, unknown>
  const id = typeof rawEstablishment.id === "number" || typeof rawEstablishment.id === "string"
    ? rawEstablishment.id
    : fallbackId

  const readString = (key: string) => typeof rawEstablishment[key] === "string" ? rawEstablishment[key] : ""
  return {
    id,
    plan: isEstablishmentPlan(rawEstablishment.plan) ? rawEstablishment.plan : null,
    printCountToday: typeof rawEstablishment.printCountToday === "number" ? rawEstablishment.printCountToday : null,
    reportCount: typeof rawEstablishment.reportCount === "number" ? rawEstablishment.reportCount : null,
    deviceCount: typeof rawEstablishment.deviceCount === "number" ? rawEstablishment.deviceCount : null,
    tradeName: readString("tradeName"),
    phone: readString("phone"),
    zipCode: readString("zipCode"),
    addressStreet: readString("addressStreet"),
    addressNumber: readString("addressNumber"),
    addressComplement: readString("addressComplement"),
    addressNeighborhood: readString("addressNeighborhood"),
    addressCity: readString("addressCity"),
    addressState: readString("addressState"),
    cnpj: readString("cnpj"),
  }
}

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { i18n, t } = useTranslation('settings')
  const locale = normalizeLocale(i18n.language)
  const localeLabel = t(`locales.${locale}` as never)

  const handleLocaleChange = (value: string) => {
    void i18n.changeLanguage(normalizeLocale(value))
  }

  const [paperWidth, setPaperWidth] = useState<PaperWidthPreset>(() => getStoredPaperWidth())
  const isOwner = user?.role === 'OWNER'
  const fallbackEstablishmentId = user?.establishmentId ?? user?.establishment?.id ?? null
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deletePassword, setDeletePassword] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [planInfo, setPlanInfo] = useState<EstablishmentResponse | null>(null)
  const [establishmentInfo, setEstablishmentInfo] = useState<EstablishmentResponse | null>(null)
  const [isSavingEstablishmentInfo, setIsSavingEstablishmentInfo] = useState(false)

  useEffect(() => {
    let cancelled = false

    const loadEstablishment = async () => {
      try {
        const response = await api.get('/estabelecimentos')
        if (cancelled) return

        const establishment = readEstablishmentResponse(response.data, fallbackEstablishmentId)
        setPlanInfo(establishment)
        setEstablishmentInfo(establishment)
      } catch (error) {
        if (!cancelled) {
          console.error('Error fetching establishment info', error)
        }
      }
    }

    void loadEstablishment()
    return () => {
      cancelled = true
    }
  }, [fallbackEstablishmentId])

  const handlePaperWidthChange = (value: string) => {
    setPaperWidth(persistPaperWidth(value))
  }

  const handleEstablishmentInfoChange = (field: keyof Omit<EstablishmentResponse, 'id' | 'plan' | 'printCountToday' | 'reportCount' | 'deviceCount'>, value: string) => {
    setEstablishmentInfo((current) => current ? { ...current, [field]: value } : current)
  }

  const handleSaveEstablishmentInfo = async () => {
    if (!establishmentInfo) return

    const { tradeName, phone, zipCode, addressStreet, addressNumber, addressComplement, addressNeighborhood, addressCity, addressState, cnpj } = establishmentInfo
    setIsSavingEstablishmentInfo(true)
    try {
      await api.put('/estabelecimentos', { tradeName, phone, zipCode, addressStreet, addressNumber, addressComplement, addressNeighborhood, addressCity, addressState, cnpj })
      toast.success(t('establishmentInfo.saved'))
    } catch (error) {
      console.error('Error updating establishment information', error)
      toast.error(t('establishmentInfo.saveError'))
    } finally {
      setIsSavingEstablishmentInfo(false)
    }
  }

  const handleExportData = async () => {
    try {
      const response = await api.get("/auth/export-data")
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: "application/json" })
      const link = document.createElement("a")
      link.href = window.URL.createObjectURL(blob)
      link.download = "tozzo-export.json"
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast.success(t("dataPrivacy.exportSuccess"))
    } catch (error) {
      console.error("Export failed", error)
      toast.error(t("dataPrivacy.exportError"))
    }
  }

  const handleDeleteAccount = async () => {
    setIsDeleting(true)
    try {
      await api.post("/auth/delete-account", { password: deletePassword })
      toast.success(t("dataPrivacy.deleteSuccess"))
      setIsDeleteDialogOpen(false)
      logout()
    } catch (error) {
      console.error("Delete account failed", error)
      toast.error(t("dataPrivacy.deleteWrongPassword"))
    } finally {
      setIsDeleting(false)
    }
  }

  const establishmentFields = [
    { field: 'tradeName', label: t('establishmentInfo.tradeName') },
    { field: 'phone', label: t('establishmentInfo.phone') },
    { field: 'zipCode', label: t('establishmentInfo.zipCode') },
    { field: 'addressStreet', label: t('establishmentInfo.addressStreet') },
    { field: 'addressNumber', label: t('establishmentInfo.addressNumber') },
    { field: 'addressComplement', label: t('establishmentInfo.addressComplement') },
    { field: 'addressNeighborhood', label: t('establishmentInfo.addressNeighborhood') },
    { field: 'addressCity', label: t('establishmentInfo.addressCity') },
    { field: 'addressState', label: t('establishmentInfo.addressState') },
    { field: 'cnpj', label: t('establishmentInfo.cnpj') },
  ] as const

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
      
      <div className="p-6 border rounded-lg bg-card">
        <h2 className="text-xl font-semibold mb-4">{t('appearance')}</h2>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t('system')}</span>
          <ModeToggle />
        </div>
      </div>

      <div className="p-6 border rounded-lg bg-card space-y-3">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Languages className="h-5 w-5" />
          {t('language')}
        </h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label htmlFor="locale-select" className="text-muted-foreground">
            {t('currentLanguage')}
          </label>
          <Select value={locale} onValueChange={handleLocaleChange}>
            <SelectTrigger id="locale-select" aria-describedby="current-locale" className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {/* Each option shows the language's own name for itself (not
                  translated into the active UI language) so a speaker of
                  that language recognizes it at a glance in the picker. */}
              {SUPPORTED_LOCALES.map((supportedLocale) => (
                <SelectItem key={supportedLocale} value={supportedLocale}>
                  {LOCALE_NATIVE_NAMES[supportedLocale]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p
          id="current-locale"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          aria-label={t('localeIndicator', { locale: localeLabel })}
          className="text-sm text-muted-foreground"
        >
          {t('localeIndicator', { locale: localeLabel })}
        </p>
      </div>

      <div className="p-6 border rounded-lg bg-card space-y-3">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Printer className="h-5 w-5" />
          {t('printing')}
        </h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label htmlFor="paper-width-select" className="text-muted-foreground">
            {t('paperWidth')}
          </label>
          <Select value={paperWidth} onValueChange={handlePaperWidthChange}>
            <SelectTrigger id="paper-width-select" className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAPER_WIDTH_PRESETS.map((preset) => (
                <SelectItem key={preset} value={preset}>
                  {preset === 'a4' ? 'A4' : preset}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {planInfo && (
        <div className="p-6 border rounded-lg bg-card space-y-3">
          <h2 className="text-xl font-semibold">{t('plan.title')}</h2>
          <div className="flex items-center justify-between"><span className="text-muted-foreground">{t('plan.currentPlan')}</span><span className="font-medium">{t(`plan.tiers.${planInfo.plan ?? 'FREE'}` as never)}</span></div>
          <div className="flex items-center justify-between"><span className="text-muted-foreground">{t('plan.printsToday')}</span><span className="font-medium">{planInfo.plan === 'FREE' || planInfo.plan === null ? `${planInfo.printCountToday ?? 0}/30` : t('plan.unlimited')}</span></div>
          <div className="flex items-center justify-between"><span className="text-muted-foreground">{t('plan.reportsThisMonth')}</span><span className="font-medium">{planInfo.plan === 'FREE' || planInfo.plan === null ? `${planInfo.reportCount ?? 0}/5` : t('plan.unlimited')}</span></div>
          <div className="flex items-center justify-between"><span className="text-muted-foreground">{t('plan.devices')}</span><span className="font-medium">{planInfo.deviceCount ?? 0}</span></div>
          {isOwner && (planInfo.plan === 'FREE' || planInfo.plan === null) && <Button type="button" variant="outline" size="sm" onClick={() => navigate('/plan')}>{t('plan.upgradeButton')}</Button>}
        </div>
      )}

      {isOwner && establishmentInfo && (
        <section className="p-6 border rounded-lg bg-card space-y-4" aria-labelledby="establishment-info-title">
          <div>
            <h2 id="establishment-info-title" className="text-xl font-semibold">{t('establishmentInfo.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('establishmentInfo.description')}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {establishmentFields.map(({ field, label }) => (
              <div key={field} className="space-y-2">
                <label htmlFor={`establishment-${field}`} className="text-sm text-muted-foreground">{label}</label>
                <Input
                  id={`establishment-${field}`}
                  value={establishmentInfo[field]}
                  maxLength={field === 'addressState' ? 2 : undefined}
                  placeholder={field === 'addressComplement' ? 'Apto, sala, etc.' : undefined}
                  onChange={(event) => handleEstablishmentInfoChange(field, event.target.value)}
                  disabled={isSavingEstablishmentInfo}
                />
              </div>
            ))}
          </div>
          <Button type="button" onClick={handleSaveEstablishmentInfo} disabled={isSavingEstablishmentInfo}>
            {isSavingEstablishmentInfo ? t('establishmentInfo.saving') : t('establishmentInfo.save')}
          </Button>
        </section>
      )}

      {isOwner && (
        <div className="space-y-4 border-t pt-4">
          <div>
            <h3 className="font-semibold">{t('dataPrivacy.sectionTitle')}</h3>
            <p className="text-sm text-muted-foreground">{t('dataPrivacy.sectionDescription')}</p>
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={handleExportData}>
              {t('dataPrivacy.exportButton')}
            </Button>
            <Button type="button" variant="destructive" onClick={() => setIsDeleteDialogOpen(true)}>
              {t('dataPrivacy.deleteButton')}
            </Button>
          </div>
        </div>
      )}

      <Dialog open={isDeleteDialogOpen} onOpenChange={(open) => { if (!open) { setIsDeleteDialogOpen(false); setDeletePassword("") } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dataPrivacy.deleteDialogTitle')}</DialogTitle>
            <DialogDescription>{t('dataPrivacy.deleteDialogDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="delete-account-password" className="text-sm text-muted-foreground">
              {t('dataPrivacy.deletePasswordLabel')}
            </label>
            <Input
              id="delete-account-password"
              type="password"
              value={deletePassword}
              onChange={(event) => setDeletePassword(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              {t('dataPrivacy.deleteCancelButton')}
            </Button>
            <Button
              variant="destructive"
              disabled={deletePassword.length === 0 || isDeleting}
              onClick={handleDeleteAccount}
            >
              {t('dataPrivacy.deleteConfirmButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="p-10 border-2 border-dashed rounded-lg flex items-center justify-center text-muted-foreground">
        {t('moreComingSoon')}
      </div>
    </div>
  )
}
