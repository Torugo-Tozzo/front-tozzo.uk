import { Loader2 } from "lucide-react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CATEGORY_SEEDS, ESTABLISHMENT_CATEGORIES, type EstablishmentCategory } from "@/lib/categorySeeds"
import api from "@/services/api"
import { toast } from "sonner"
import { BUSINESS_PROFILES, suggestedBusinessModules, type BusinessProfile } from "@/domain/businessPreferences"

type EstablishmentOnboardingModalProps = {
  open: boolean
  establishmentId: number | string | null
  initialRevision?: number
  onSaved: () => void
}

function isEstablishmentCategory(value: unknown): value is EstablishmentCategory {
  return typeof value === "string" && ESTABLISHMENT_CATEGORIES.includes(value as EstablishmentCategory)
}

export function EstablishmentOnboardingModal({ open, establishmentId, initialRevision = 0, onSaved }: EstablishmentOnboardingModalProps) {
  const { t } = useTranslation("settings")
  const [profiles, setProfiles] = useState<BusinessProfile[]>([])
  const [category, setCategory] = useState<EstablishmentCategory | "">("")
  const [suggestedTypes, setSuggestedTypes] = useState<string[]>([])
  const [isSavingProfiles, setIsSavingProfiles] = useState(false)
  const [isAddingTypes, setIsAddingTypes] = useState(false)
  const addingTypes = useRef(false)
  const [addedTypes, setAddedTypes] = useState<Set<string>>(new Set())
  const typeKey = (description: string) => description.trim().toLowerCase()
  const allTypesAdded = suggestedTypes.length > 0 && suggestedTypes.every(type => addedTypes.has(typeKey(type)))
  const includesFood = profiles.includes('FOOD')

  const handleProfileToggle = (profile: BusinessProfile) => {
    if (isSavingProfiles || isAddingTypes) return
    setProfiles((current) => current.includes(profile)
      ? current.filter((item) => item !== profile)
      : BUSINESS_PROFILES.filter((item) => item === profile || current.includes(item)))
    if (profile === 'FOOD' && includesFood) {
      setCategory('')
      setSuggestedTypes([])
    }
  }

  const handleCategoryChange = (value: string) => {
    if (addingTypes.current || !isEstablishmentCategory(value)) return
    setCategory(value)
    setSuggestedTypes([...CATEGORY_SEEDS[value]])
  }

  const handleSaveProfiles = async () => {
    if (addingTypes.current || isSavingProfiles || profiles.length === 0 || establishmentId == null) return

    setIsSavingProfiles(true)
    try {
      if (includesFood && category) await api.patch(`/establishments/${establishmentId}`, { category })
      await api.patch('/establishments/preferences', {
        profiles,
        visibleModules: suggestedBusinessModules(profiles),
        expectedRevision: initialRevision,
      })
      toast.success(t("businessPreferences.saved"))
      onSaved()
    } catch (error) {
      console.error("Error updating business profiles", error)
      toast.error(t("businessPreferences.saveError"))
    } finally {
      setIsSavingProfiles(false)
    }
  }

  const handleSuggestedTypeChange = (index: number, value: string) => {
    setSuggestedTypes((types) => types.map((type, currentIndex) => currentIndex === index ? value : type))
  }

  const handleAddSuggestedTypes = async () => {
    if (addingTypes.current || allTypesAdded || suggestedTypes.length === 0 || suggestedTypes.some((type) => type.trim().length === 0)) return

    addingTypes.current = true
    setIsAddingTypes(true)
    try {
      const completed = new Set(addedTypes)
      for (const description of suggestedTypes) {
        const key = typeKey(description)
        if (completed.has(key)) continue
        await api.post("/tipos", { description: description.trim(), color: "#9E9E9E" })
        completed.add(key)
        setAddedTypes(new Set(completed))
      }
      toast.success(t("category.typesAdded"))
    } catch (error) {
      console.error("Error creating suggested product types", error)
      toast.error(t("category.addTypesError"))
    } finally {
      addingTypes.current = false
      setIsAddingTypes(false)
    }
  }

  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false} className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("businessPreferences.onboardingTitle")}</DialogTitle>
          <DialogDescription>{t("businessPreferences.onboardingDescription")}</DialogDescription>
        </DialogHeader>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t("businessPreferences.profilesTitle")}</legend>
          {BUSINESS_PROFILES.map((profile) => (
            <label key={profile} className="flex items-center gap-2 rounded border p-3">
              <input
                type="checkbox"
                checked={profiles.includes(profile)}
                onChange={() => handleProfileToggle(profile)}
                disabled={isSavingProfiles || isAddingTypes}
              />
              <span>{t(`businessPreferences.profiles.${profile}` as never)}</span>
            </label>
          ))}
        </fieldset>

        {includesFood && <div className="flex flex-col gap-2">
          <label htmlFor="establishment-category-select" className="text-muted-foreground">{t("category.label")}</label>
          <Select value={category} onValueChange={handleCategoryChange}>
            <SelectTrigger id="establishment-category-select" aria-label={t("category.label")} disabled={isSavingProfiles || isAddingTypes}>
              <SelectValue placeholder={t("category.placeholder")} />
            </SelectTrigger>
            <SelectContent>
              {ESTABLISHMENT_CATEGORIES.map((option) => (
                <SelectItem key={option} value={option}>{t(`category.options.${option}` as never)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>}

        {suggestedTypes.length > 0 && (
          <div className="space-y-4 border-t pt-4">
            <div>
              <h3 className="font-semibold">{t("category.suggestedTypesTitle")}</h3>
              <p className="text-sm text-muted-foreground">{t("category.suggestedTypesDescription")}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {suggestedTypes.map((suggestedType, index) => {
                const inputId = `suggested-type-${index}`
                return (
                  <div key={inputId} className="space-y-2">
                    <label htmlFor={inputId} className="text-sm text-muted-foreground">{t("category.typeLabel", { number: index + 1 })}</label>
                    <Input id={inputId} value={suggestedType} onChange={(event) => handleSuggestedTypeChange(index, event.target.value)} disabled={isAddingTypes} />
                  </div>
                )
              })}
            </div>
            <Button type="button" onClick={handleAddSuggestedTypes} disabled={isAddingTypes || allTypesAdded || suggestedTypes.some((type) => type.trim().length === 0)}>
              {isAddingTypes ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("category.addingTypes")}</> : t("category.addTypes")}
            </Button>
          </div>
        )}

        <Button type="button" onClick={handleSaveProfiles} disabled={profiles.length === 0 || establishmentId == null || isSavingProfiles || isAddingTypes}>
          {isSavingProfiles ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("businessPreferences.saving")}</> : t("businessPreferences.save")}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
