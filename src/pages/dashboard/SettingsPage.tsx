import { Languages, Loader2, Printer, Tags } from "lucide-react"
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
  PAPER_WIDTH_PRESETS,
  getStoredPaperWidth,
  persistPaperWidth,
  type PaperWidthPreset,
} from "@/lib/printPreferences"
import {
  CATEGORY_SEEDS,
  ESTABLISHMENT_CATEGORIES,
  type EstablishmentCategory,
} from "@/lib/categorySeeds"
import api from "@/services/api"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "sonner"
import { useEffect, useState } from "react"

type EstablishmentResponse = {
  id: number | string | null
  category: EstablishmentCategory | null
}

function isEstablishmentCategory(value: unknown): value is EstablishmentCategory {
  return typeof value === "string" && ESTABLISHMENT_CATEGORIES.includes(value as EstablishmentCategory)
}

function readEstablishmentResponse(data: unknown, fallbackId: number | string | null): EstablishmentResponse {
  const rawData = Array.isArray(data) ? data[0] : data
  if (!rawData || typeof rawData !== "object") {
    return { id: fallbackId, category: null }
  }

  const rawEstablishment = rawData as Record<string, unknown>
  const id = typeof rawEstablishment.id === "number" || typeof rawEstablishment.id === "string"
    ? rawEstablishment.id
    : fallbackId

  return {
    id,
    category: isEstablishmentCategory(rawEstablishment.category) ? rawEstablishment.category : null,
  }
}

export default function SettingsPage() {
  const { user } = useAuth()
  const { i18n, t } = useTranslation('settings')
  const locale = normalizeLocale(i18n.language)
  const localeLabel = t(`locales.${locale}` as never)

  const handleLocaleChange = (value: string) => {
    void i18n.changeLanguage(normalizeLocale(value))
  }

  const [paperWidth, setPaperWidth] = useState<PaperWidthPreset>(() => getStoredPaperWidth())
  const canEditCategory = user?.role === 'OWNER' || user?.role === 'MANAGER'
  const isOwner = user?.role === 'OWNER'
  const fallbackEstablishmentId = user?.establishmentId ?? user?.establishment?.id ?? null
  const [establishmentId, setEstablishmentId] = useState<number | string | null>(fallbackEstablishmentId)
  const [category, setCategory] = useState<EstablishmentCategory | ''>('')
  const [suggestedTypes, setSuggestedTypes] = useState<string[]>([])
  const [isLoadingCategory, setIsLoadingCategory] = useState(false)
  const [isSavingCategory, setIsSavingCategory] = useState(false)
  const [isAddingTypes, setIsAddingTypes] = useState(false)

  useEffect(() => {
    if (!canEditCategory) return

    let cancelled = false
    setIsLoadingCategory(true)

    const loadEstablishment = async () => {
      try {
        const response = await api.get('/estabelecimentos')
        if (cancelled) return

        const establishment = readEstablishmentResponse(response.data, fallbackEstablishmentId)
        setEstablishmentId(establishment.id)
        setCategory(establishment.category ?? '')
        setSuggestedTypes(establishment.category ? [...CATEGORY_SEEDS[establishment.category]] : [])
      } catch (error) {
        if (!cancelled) {
          console.error('Error fetching establishment category', error)
          toast.error(i18n.t('category.loadError', { ns: 'settings' }))
        }
      } finally {
        if (!cancelled) setIsLoadingCategory(false)
      }
    }

    void loadEstablishment()
    return () => {
      cancelled = true
    }
  }, [canEditCategory, fallbackEstablishmentId, i18n])

  const handlePaperWidthChange = (value: string) => {
    setPaperWidth(persistPaperWidth(value))
  }

  const handleCategoryChange = (value: string) => {
    if (!isEstablishmentCategory(value)) return
    setCategory(value)
    setSuggestedTypes([...CATEGORY_SEEDS[value]])
  }

  const handleSaveCategory = async () => {
    if (!category || establishmentId == null) return

    setIsSavingCategory(true)
    try {
      await api.patch(`/establishments/${establishmentId}`, { category })
      toast.success(t('category.saved'))
    } catch (error) {
      console.error('Error updating establishment category', error)
      toast.error(t('category.saveError'))
    } finally {
      setIsSavingCategory(false)
    }
  }

  const handleSuggestedTypeChange = (index: number, value: string) => {
    setSuggestedTypes((currentTypes) => currentTypes.map((currentType, currentIndex) => (
      currentIndex === index ? value : currentType
    )))
  }

  const handleAddSuggestedTypes = async () => {
    if (!isOwner || suggestedTypes.length === 0 || suggestedTypes.some((type) => type.trim().length === 0)) return

    setIsAddingTypes(true)
    try {
      for (const description of suggestedTypes) {
        await api.post('/tipos', {
          description: description.trim(),
          color: '#9E9E9E',
        })
      }
      toast.success(t('category.typesAdded'))
    } catch (error) {
      console.error('Error creating suggested product types', error)
      toast.error(t('category.addTypesError'))
    } finally {
      setIsAddingTypes(false)
    }
  }

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

      {canEditCategory && (
        <div className="p-6 border rounded-lg bg-card space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Tags className="h-5 w-5" />
            {t('category.title')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('category.description')}</p>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-1 flex-col gap-2">
              <label htmlFor="establishment-category-select" className="text-muted-foreground">
                {t('category.label')}
              </label>
              <Select
                value={category}
                onValueChange={handleCategoryChange}
              >
                <SelectTrigger
                  id="establishment-category-select"
                  aria-label={t('category.label')}
                  disabled={isLoadingCategory || isSavingCategory}
                  className="sm:max-w-[280px]"
                >
                  <SelectValue placeholder={t('category.placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  {ESTABLISHMENT_CATEGORIES.map((categoryOption) => (
                    <SelectItem key={categoryOption} value={categoryOption}>
                      {t(`category.options.${categoryOption}` as never)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              onClick={handleSaveCategory}
              disabled={!category || establishmentId == null || isLoadingCategory || isSavingCategory}
            >
              {isSavingCategory ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('category.saving')}
                </>
              ) : (
                t('category.save')
              )}
            </Button>
          </div>

          {isOwner && suggestedTypes.length > 0 && (
            <div className="space-y-4 border-t pt-4">
              <div>
                <h3 className="font-semibold">{t('category.suggestedTypesTitle')}</h3>
                <p className="text-sm text-muted-foreground">{t('category.suggestedTypesDescription')}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {suggestedTypes.map((suggestedType, index) => {
                  const inputId = `suggested-type-${index}`
                  return (
                    <div key={inputId} className="space-y-2">
                      <label htmlFor={inputId} className="text-sm text-muted-foreground">
                        {t('category.typeLabel', { number: index + 1 })}
                      </label>
                      <Input
                        id={inputId}
                        value={suggestedType}
                        onChange={(event) => handleSuggestedTypeChange(index, event.target.value)}
                        disabled={isAddingTypes}
                      />
                    </div>
                  )
                })}
              </div>
              <Button
                type="button"
                onClick={handleAddSuggestedTypes}
                disabled={isAddingTypes || suggestedTypes.some((type) => type.trim().length === 0)}
              >
                {isAddingTypes ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('category.addingTypes')}
                  </>
                ) : (
                  t('category.addTypes')
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="p-10 border-2 border-dashed rounded-lg flex items-center justify-center text-muted-foreground">
        {t('moreComingSoon')}
      </div>
    </div>
  )
}
