import { createSignal, For, Index, Show } from "solid-js"
import { useQueryClient } from "@tanstack/solid-query"
import { Loader2 } from "lucide-solid"
import { toast } from "solid-sonner"

import { catalogKeys, createProductType } from "@/api/catalog"
import { apiErrorOf } from "@/api/errors"
import { establishmentKeys, setEstablishmentCategory, updatePreferences, type EstablishmentCategory } from "@/api/establishment"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BUSINESS_PROFILES, suggestedBusinessModules, type BusinessProfile } from "@/domain/businessPreferences"
import { categoryLabelKey, categorySeeds, ESTABLISHMENT_CATEGORIES, isEstablishmentCategory } from "@/domain/categories"
import { useTranslation } from "@/i18n/solid"

type EstablishmentOnboardingModalProps = {
  open: boolean
  initialRevision?: number
  /** Reloads the session user (the menu and this modal follow its profiles). */
  onSaved: () => Promise<void> | void
}

// The color the React app gave the suggested types.
const SUGGESTED_TYPE_COLOR = "#9E9E9E"

/**
 * Asks an owner whose establishment has no business profile yet which kind of
 * business it is (and, for food, its category and suggested product types).
 * It cannot be dismissed: the menu depends on the answer.
 */
export function EstablishmentOnboardingModal(props: EstablishmentOnboardingModalProps) {
  const { t } = useTranslation("settings")
  const queryClient = useQueryClient()
  const [profiles, setProfiles] = createSignal<BusinessProfile[]>([])
  const [category, setCategory] = createSignal<EstablishmentCategory | "">("")
  const [suggestedTypes, setSuggestedTypes] = createSignal<string[]>([])
  const [isSavingProfiles, setIsSavingProfiles] = createSignal(false)
  // Saved on the API: from here on, only the profile refresh is retried (a
  // second PATCH with the old revision would be a 409).
  const [saved, setSaved] = createSignal(false)
  const [isAddingTypes, setIsAddingTypes] = createSignal(false)
  const [addedTypes, setAddedTypes] = createSignal<Set<string>>(new Set())
  // Synchronous guard: a double click starts one run only.
  let addingTypes = false
  const typeKey = (description: string) => description.trim().toLowerCase()
  const allTypesAdded = () => suggestedTypes().length > 0 && suggestedTypes().every((type) => addedTypes().has(typeKey(type)))
  const includesFood = () => profiles().includes("FOOD")
  const hasBlankType = () => suggestedTypes().some((type) => type.trim().length === 0)

  const handleProfileToggle = (profile: BusinessProfile) => {
    if (saved() || isSavingProfiles() || isAddingTypes()) return
    const hadFood = includesFood()
    setProfiles((current) => current.includes(profile)
      ? current.filter((item) => item !== profile)
      : BUSINESS_PROFILES.filter((item) => item === profile || current.includes(item)))
    if (profile === "FOOD" && hadFood) {
      setCategory("")
      setSuggestedTypes([])
    }
  }

  const handleCategoryChange = (value: string | null) => {
    if (addingTypes || !isEstablishmentCategory(value)) return
    setCategory(value)
    setSuggestedTypes(categorySeeds(value))
  }

  const refreshProfile = async () => {
    setIsSavingProfiles(true)
    try {
      await props.onSaved()
    } catch (error) {
      console.error("Error refreshing the profile after saving business profiles", error)
    } finally {
      setIsSavingProfiles(false)
    }
  }

  const handleSaveProfiles = async () => {
    if (addingTypes || isSavingProfiles() || profiles().length === 0) return
    if (saved()) return refreshProfile()

    setIsSavingProfiles(true)
    try {
      const chosen = category()
      if (includesFood() && chosen) await setEstablishmentCategory(chosen)
      try {
        await updatePreferences({
          profiles: profiles(),
          visibleModules: suggestedBusinessModules(profiles()),
          expectedRevision: props.initialRevision ?? 0,
        })
      } catch (error) {
        // The revision moved: an earlier save went through (its answer was
        // lost, or the profile refresh had not arrived yet).
        if (apiErrorOf(error).code !== "PREFERENCES_CONFLICT") throw error
      }
      setSaved(true)
      void queryClient.invalidateQueries({ queryKey: establishmentKeys.all })
      toast.success(t("businessPreferences.saved"))
    } catch (error) {
      console.error("Error updating business profiles", error)
      toast.error(t("businessPreferences.saveError"))
      setIsSavingProfiles(false)
      return
    }
    // Stays disabled until the session user brings the profiles (and the
    // modal closes); if that fails, the button only retries the refresh.
    await refreshProfile()
  }

  const handleSuggestedTypeChange = (index: number, value: string) => {
    setSuggestedTypes((types) => types.map((type, currentIndex) => currentIndex === index ? value : type))
  }

  const handleAddSuggestedTypes = async () => {
    if (addingTypes || allTypesAdded() || suggestedTypes().length === 0 || hasBlankType()) return

    addingTypes = true
    setIsAddingTypes(true)
    try {
      const completed = new Set(addedTypes())
      for (const description of suggestedTypes()) {
        const key = typeKey(description)
        if (completed.has(key)) continue
        // Idempotent in the /v1 (same description gives back the same type).
        await createProductType({ description: description.trim(), color: SUGGESTED_TYPE_COLOR })
        completed.add(key)
        setAddedTypes(new Set(completed))
      }
      toast.success(t("category.typesAdded"))
    } catch (error) {
      console.error("Error creating suggested product types", error)
      toast.error(t("category.addTypesError"))
    } finally {
      addingTypes = false
      setIsAddingTypes(false)
      void queryClient.invalidateQueries({ queryKey: catalogKeys.productTypes })
    }
  }

  return (
    <Dialog open={props.open}>
      <DialogContent showCloseButton={false} class="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("businessPreferences.onboardingTitle")}</DialogTitle>
          <DialogDescription>{t("businessPreferences.onboardingDescription")}</DialogDescription>
        </DialogHeader>

        <fieldset class="space-y-2">
          <legend class="text-sm font-medium">{t("businessPreferences.profilesTitle")}</legend>
          <For each={BUSINESS_PROFILES}>
            {(profile) => (
              <label class="flex items-center gap-2 rounded border p-3">
                <input
                  type="checkbox"
                  checked={profiles().includes(profile)}
                  onChange={() => handleProfileToggle(profile)}
                  disabled={saved() || isSavingProfiles() || isAddingTypes()}
                />
                <span>{t(`businessPreferences.profiles.${profile}` as never)}</span>
              </label>
            )}
          </For>
        </fieldset>

        <Show when={includesFood()}>
          <div class="flex flex-col gap-2">
            <label for="establishment-category-select" class="text-muted-foreground">{t("category.label")}</label>
            <Select<string>
              options={[...ESTABLISHMENT_CATEGORIES]}
              // "" matches no option: the placeholder shows.
              value={category()}
              onChange={handleCategoryChange}
              placeholder={t("category.placeholder")}
              disabled={saved() || isSavingProfiles() || isAddingTypes()}
              itemComponent={(item) => (
                <SelectItem item={item.item}>{t(categoryLabelKey(item.item.rawValue as EstablishmentCategory) as never)}</SelectItem>
              )}
            >
              <SelectTrigger id="establishment-category-select" aria-label={t("category.label")}>
                <SelectValue<string>>{(state) => t(categoryLabelKey(state.selectedOption() as EstablishmentCategory) as never)}</SelectValue>
              </SelectTrigger>
              <SelectContent />
            </Select>
          </div>
        </Show>

        <Show when={suggestedTypes().length > 0}>
          <div class="space-y-4 border-t pt-4">
            <div>
              <h3 class="font-semibold">{t("category.suggestedTypesTitle")}</h3>
              <p class="text-sm text-muted-foreground">{t("category.suggestedTypesDescription")}</p>
            </div>
            <div class="grid gap-3 sm:grid-cols-2">
              {/* Index, not For: editing a text must keep its input (and focus). */}
              <Index each={suggestedTypes()}>
                {(suggestedType, index) => (
                  <div class="space-y-2">
                    <label for={`suggested-type-${index}`} class="text-sm text-muted-foreground">{t("category.typeLabel", { number: index + 1 })}</label>
                    <Input id={`suggested-type-${index}`} value={suggestedType()} onInput={(event) => handleSuggestedTypeChange(index, event.currentTarget.value)} disabled={isAddingTypes()} />
                  </div>
                )}
              </Index>
            </div>
            <Button type="button" onClick={() => void handleAddSuggestedTypes()} disabled={isAddingTypes() || allTypesAdded() || hasBlankType()}>
              <Show when={isAddingTypes()} fallback={t("category.addTypes")}>
                <Loader2 class="mr-2 h-4 w-4 animate-spin" />{t("category.addingTypes")}
              </Show>
            </Button>
          </div>
        </Show>

        <Button type="button" onClick={() => void handleSaveProfiles()} disabled={profiles().length === 0 || isSavingProfiles() || isAddingTypes()}>
          <Show when={isSavingProfiles()} fallback={t("businessPreferences.save")}>
            <Loader2 class="mr-2 h-4 w-4 animate-spin" />{t("businessPreferences.saving")}
          </Show>
        </Button>
      </DialogContent>
    </Dialog>
  )
}
