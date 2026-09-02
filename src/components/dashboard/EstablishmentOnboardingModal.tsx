import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CATEGORY_SEEDS, ESTABLISHMENT_CATEGORIES, type EstablishmentCategory } from "@/lib/categorySeeds"
import api from "@/services/api"
import { toast } from "sonner"

type EstablishmentOnboardingModalProps = {
  open: boolean
  establishmentId: number | string | null
  onSaved: () => void
}

function isEstablishmentCategory(value: unknown): value is EstablishmentCategory {
  return typeof value === "string" && ESTABLISHMENT_CATEGORIES.includes(value as EstablishmentCategory)
}

export function EstablishmentOnboardingModal({ open, establishmentId, onSaved }: EstablishmentOnboardingModalProps) {
  const { t } = useTranslation("settings")
  const [category, setCategory] = useState<EstablishmentCategory | "">("")
  const [suggestedTypes, setSuggestedTypes] = useState<string[]>([])
  const [isSavingCategory, setIsSavingCategory] = useState(false)
  const [isAddingTypes, setIsAddingTypes] = useState(false)

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
      toast.success(t("category.saved"))
      onSaved()
    } catch (error) {
      console.error("Error updating establishment category", error)
      toast.error(t("category.saveError"))
    } finally {
      setIsSavingCategory(false)
    }
  }

  const handleSuggestedTypeChange = (index: number, value: string) => {
    setSuggestedTypes((types) => types.map((type, currentIndex) => currentIndex === index ? value : type))
  }

  const handleAddSuggestedTypes = async () => {
    if (suggestedTypes.length === 0 || suggestedTypes.some((type) => type.trim().length === 0)) return

    setIsAddingTypes(true)
    try {
      for (const description of suggestedTypes) {
        await api.post("/tipos", { description: description.trim(), color: "#9E9E9E" })
      }
      toast.success(t("category.typesAdded"))
    } catch (error) {
      console.error("Error creating suggested product types", error)
      toast.error(t("category.addTypesError"))
    } finally {
      setIsAddingTypes(false)
    }
  }

  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false} className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("category.title")}</DialogTitle>
          <DialogDescription>{t("category.description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <label htmlFor="establishment-category-select" className="text-muted-foreground">{t("category.label")}</label>
          <Select value={category} onValueChange={handleCategoryChange}>
            <SelectTrigger id="establishment-category-select" aria-label={t("category.label")} disabled={isSavingCategory}>
              <SelectValue placeholder={t("category.placeholder")} />
            </SelectTrigger>
            <SelectContent>
              {ESTABLISHMENT_CATEGORIES.map((option) => (
                <SelectItem key={option} value={option}>{t(`category.options.${option}` as never)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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
            <Button type="button" onClick={handleAddSuggestedTypes} disabled={isAddingTypes || suggestedTypes.some((type) => type.trim().length === 0)}>
              {isAddingTypes ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("category.addingTypes")}</> : t("category.addTypes")}
            </Button>
          </div>
        )}

        <Button type="button" onClick={handleSaveCategory} disabled={!category || establishmentId == null || isSavingCategory}>
          {isSavingCategory ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("category.saving")}</> : t("category.save")}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
