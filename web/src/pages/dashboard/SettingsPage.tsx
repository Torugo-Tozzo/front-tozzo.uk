import { createEffect, createSignal, For, Show } from "solid-js"
import { useNavigate } from "@solidjs/router"
import { createMutation, createQuery, useQueryClient } from "@tanstack/solid-query"
import { loadedData, onQueryError } from "@/api/query"
import { Languages, Printer } from "lucide-solid"
import { toast } from "solid-sonner"

import { apiErrorOf } from "@/api/errors"
import {
  deleteAccount,
  establishmentKeys,
  exportAccount,
  getEstablishment,
  updateEstablishment,
  type EstablishmentView,
  type UpdateEstablishmentRequest,
} from "@/api/establishment"
import { BusinessPreferencesPanel } from "@/components/dashboard/BusinessPreferencesPanel"
import { ModeToggle } from "@/components/mode-toggle"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/contexts/AuthContext"
import { PLAN_TIER_KEY } from "@/domain/categories"
import { useErrorMessage } from "@/i18n/error-message"
import { LOCALE_NATIVE_NAMES, normalizeLocale, SUPPORTED_LOCALES, type SupportedLocale } from "@/i18n/locale"
import { useTranslation } from "@/i18n/solid"
import { getStoredPaperWidth, PAPER_WIDTH_PRESETS, persistPaperWidth, type PaperWidthPreset } from "@/lib/printPreferences"

type EstablishmentField = Exclude<keyof UpdateEstablishmentRequest, "logoKey">
type EstablishmentForm = Record<EstablishmentField, string>

function formFrom(view: EstablishmentView): EstablishmentForm {
  return {
    tradeName: view.tradeName,
    phone: view.phone ?? "",
    zipCode: view.address.zipCode ?? "",
    addressStreet: view.address.street ?? "",
    addressNumber: view.address.number ?? "",
    addressComplement: view.address.complement ?? "",
    addressNeighborhood: view.address.neighborhood ?? "",
    addressCity: view.address.city ?? "",
    addressState: view.address.state ?? "",
    cnpj: view.cnpj ?? "",
  }
}

const ESTABLISHMENT_FIELDS: EstablishmentField[] = [
  "tradeName", "phone", "zipCode", "addressStreet", "addressNumber",
  "addressComplement", "addressNeighborhood", "addressCity", "addressState", "cnpj",
]

// The /v1 answers 401 INVALID_PASSWORD (or 403 REAUTH_REQUIRED) when the password does not confirm the deletion.
const WRONG_PASSWORD_CODES = new Set(["INVALID_PASSWORD", "REAUTH_REQUIRED"])

export default function SettingsPage() {
  const { user, clearSession, refreshUserProfile } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t, i18n, language } = useTranslation("settings")
  const localizedError = useErrorMessage()
  const locale = () => normalizeLocale(language())
  const localeLabel = () => t(`locales.${locale()}` as never)

  const [paperWidth, setPaperWidth] = createSignal<PaperWidthPreset>(getStoredPaperWidth())
  const isOwner = () => user()?.role === "OWNER"
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = createSignal(false)
  const [deletePassword, setDeletePassword] = createSignal("")
  const [form, setForm] = createSignal<EstablishmentForm | null>(null)

  const establishment = createQuery(() => ({
    queryKey: establishmentKeys.all,
    queryFn: ({ signal }) => getEstablishment(signal),
    enabled: !!user(),
    refetchOnWindowFocus: false,
  }))
  createEffect(() => {
    const view = loadedData(establishment)
    if (view) setForm(formFrom(view))
  })
  onQueryError(establishment, (error) => console.error("Error fetching establishment info", error))

  const saveInfo = createMutation(() => ({
    mutationFn: updateEstablishment,
    onSuccess: async (view: EstablishmentView) => {
      queryClient.setQueryData(establishmentKeys.all, view)
      toast.success(t("establishmentInfo.saved"))
      // The trade name is also in the navbar, which reads the session user.
      await refreshUserProfile()
    },
    onError: (error) => {
      console.error("Error updating establishment information", error)
      toast.error(t("establishmentInfo.saveError"))
    },
  }))

  const removeAccount = createMutation(() => ({
    mutationFn: deleteAccount,
    onSuccess: () => {
      toast.success(t("dataPrivacy.deleteSuccess"))
      setIsDeleteDialogOpen(false)
      // The API already revoked every session of the establishment.
      clearSession()
      queryClient.clear()
      navigate("/login", { replace: true })
    },
    onError: (error) => {
      console.error("Delete account failed", error)
      toast.error(WRONG_PASSWORD_CODES.has(apiErrorOf(error).code) ? t("dataPrivacy.deleteWrongPassword") : localizedError("deleteAccount", error))
    },
  }))

  const handleLocaleChange = (value: string | null) => {
    if (value) void i18n.changeLanguage(normalizeLocale(value))
  }

  const handlePaperWidthChange = (value: string | null) => {
    if (value) setPaperWidth(persistPaperWidth(value))
  }

  const handleFieldChange = (field: EstablishmentField, value: string) => {
    setForm((current) => current ? { ...current, [field]: value } : current)
  }

  const handleSaveEstablishmentInfo = () => {
    const current = form()
    if (!current || saveInfo.isPending) return
    saveInfo.mutate({ ...current })
  }

  const handleExportData = async () => {
    try {
      const data = await exportAccount()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = "tozzo-export.json"
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success(t("dataPrivacy.exportSuccess"))
    } catch (error) {
      console.error("Export failed", error)
      toast.error(t("dataPrivacy.exportError"))
    }
  }

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false)
    setDeletePassword("")
  }

  const isFree = (view: EstablishmentView) => view.plan === "FREE"
  const fieldLabel = (field: EstablishmentField) => t(`establishmentInfo.${field}` as never)

  return (
    <div class="space-y-6">
      <h1 class="text-3xl font-bold tracking-tight">{t("title")}</h1>

      <Show when={user()}>
        <BusinessPreferencesPanel />
      </Show>

      <div class="p-6 border rounded-lg bg-card">
        <h2 class="text-xl font-semibold mb-4">{t("appearance")}</h2>
        <div class="flex items-center justify-between">
          <span class="text-muted-foreground">{t("system")}</span>
          <ModeToggle />
        </div>
      </div>

      <div class="p-6 border rounded-lg bg-card space-y-3">
        <h2 class="text-xl font-semibold flex items-center gap-2">
          <Languages class="h-5 w-5" />
          {t("language")}
        </h2>
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label for="locale-select" class="text-muted-foreground">
            {t("currentLanguage")}
          </label>
          <Select<string>
            options={[...SUPPORTED_LOCALES]}
            value={locale()}
            onChange={handleLocaleChange}
            // Each option shows the language's own name for itself, so a
            // speaker recognizes it whatever the active UI language is.
            itemComponent={(item) => <SelectItem item={item.item}>{LOCALE_NATIVE_NAMES[item.item.rawValue as SupportedLocale]}</SelectItem>}
          >
            <SelectTrigger id="locale-select" aria-label={t("currentLanguage")} aria-describedby="current-locale" class="w-[180px]">
              <SelectValue<string>>{() => LOCALE_NATIVE_NAMES[locale()]}</SelectValue>
            </SelectTrigger>
            <SelectContent />
          </Select>
        </div>
        <p
          id="current-locale"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          aria-label={t("localeIndicator", { locale: localeLabel() })}
          class="text-sm text-muted-foreground"
        >
          {t("localeIndicator", { locale: localeLabel() })}
        </p>
      </div>

      <div class="p-6 border rounded-lg bg-card space-y-3">
        <h2 class="text-xl font-semibold flex items-center gap-2">
          <Printer class="h-5 w-5" />
          {t("printing")}
        </h2>
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label for="paper-width-select" class="text-muted-foreground">
            {t("paperWidth")}
          </label>
          <Select<string>
            options={[...PAPER_WIDTH_PRESETS]}
            value={paperWidth()}
            onChange={handlePaperWidthChange}
            itemComponent={(item) => <SelectItem item={item.item}>{item.item.rawValue === "a4" ? "A4" : item.item.rawValue}</SelectItem>}
          >
            <SelectTrigger id="paper-width-select" aria-label={t("paperWidth")} class="w-[180px]">
              <SelectValue<string>>{() => paperWidth() === "a4" ? "A4" : paperWidth()}</SelectValue>
            </SelectTrigger>
            <SelectContent />
          </Select>
        </div>
      </div>

      <Show when={loadedData(establishment)}>
        {(view) => (
          <div class="p-6 border rounded-lg bg-card space-y-3">
            <h2 class="text-xl font-semibold">{t("plan.title")}</h2>
            <div class="flex items-center justify-between"><span class="text-muted-foreground">{t("plan.currentPlan")}</span><span class="font-medium">{t(`plan.tiers.${PLAN_TIER_KEY[view().plan]}` as never)}</span></div>
            <div class="flex items-center justify-between"><span class="text-muted-foreground">{t("plan.printsToday")}</span><span class="font-medium">{isFree(view()) ? `${view().usage.printsToday}/${view().limits.printsPerDay ?? ""}` : t("plan.unlimited")}</span></div>
            <div class="flex items-center justify-between"><span class="text-muted-foreground">{t("plan.reportsThisMonth")}</span><span class="font-medium">{isFree(view()) ? `${view().usage.reportsThisMonth}/${view().limits.reportsPerMonth ?? ""}` : t("plan.unlimited")}</span></div>
            <div class="flex items-center justify-between"><span class="text-muted-foreground">{t("plan.devices")}</span><span class="font-medium">{view().usage.devices}</span></div>
            <Show when={isOwner() && isFree(view())}>
              <Button type="button" variant="outline" size="sm" onClick={() => navigate("/plan")}>{t("plan.upgradeButton")}</Button>
            </Show>
          </div>
        )}
      </Show>

      <Show when={isOwner() && form()}>
        {(values) => (
          <section class="p-6 border rounded-lg bg-card space-y-4" aria-labelledby="establishment-info-title">
            <div>
              <h2 id="establishment-info-title" class="text-xl font-semibold">{t("establishmentInfo.title")}</h2>
              <p class="text-sm text-muted-foreground">{t("establishmentInfo.description")}</p>
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <For each={ESTABLISHMENT_FIELDS}>
                {(field) => (
                  <div class="space-y-2">
                    <label for={`establishment-${field}`} class="text-sm text-muted-foreground">{fieldLabel(field)}</label>
                    <Input
                      id={`establishment-${field}`}
                      value={values()[field]}
                      maxLength={field === "addressState" ? 2 : undefined}
                      placeholder={field === "addressComplement" ? t("establishmentInfo.addressComplementPlaceholder") : undefined}
                      onInput={(event) => handleFieldChange(field, event.currentTarget.value)}
                      disabled={saveInfo.isPending}
                    />
                  </div>
                )}
              </For>
            </div>
            <Button type="button" onClick={handleSaveEstablishmentInfo} disabled={saveInfo.isPending}>
              {saveInfo.isPending ? t("establishmentInfo.saving") : t("establishmentInfo.save")}
            </Button>
          </section>
        )}
      </Show>

      {/* 2FA is not part of the new app (user's decision, 2026-10-14): no Security card. */}

      <Show when={isOwner()}>
        <div class="space-y-4 border-t pt-4">
          <div>
            <h3 class="font-semibold">{t("dataPrivacy.sectionTitle")}</h3>
            <p class="text-sm text-muted-foreground">{t("dataPrivacy.sectionDescription")}</p>
          </div>
          <div class="flex gap-3">
            <Button type="button" variant="outline" onClick={() => void handleExportData()}>
              {t("dataPrivacy.exportButton")}
            </Button>
            <Button type="button" variant="destructive" onClick={() => setIsDeleteDialogOpen(true)}>
              {t("dataPrivacy.deleteButton")}
            </Button>
          </div>
        </div>
      </Show>

      <Dialog open={isDeleteDialogOpen()} onOpenChange={(open) => { if (!open) closeDeleteDialog() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dataPrivacy.deleteDialogTitle")}</DialogTitle>
            <DialogDescription>{t("dataPrivacy.deleteDialogDescription")}</DialogDescription>
          </DialogHeader>
          <div class="space-y-2">
            <label for="delete-account-password" class="text-sm text-muted-foreground">
              {t("dataPrivacy.deletePasswordLabel")}
            </label>
            <Input
              id="delete-account-password"
              type="password"
              value={deletePassword()}
              onInput={(event) => setDeletePassword(event.currentTarget.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              {t("dataPrivacy.deleteCancelButton")}
            </Button>
            <Button
              variant="destructive"
              disabled={deletePassword().length === 0 || removeAccount.isPending}
              onClick={() => removeAccount.mutate(deletePassword())}
            >
              {t("dataPrivacy.deleteConfirmButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div class="p-10 border-2 border-dashed rounded-lg flex items-center justify-center text-muted-foreground">
        {t("moreComingSoon")}
      </div>
    </div>
  )
}
