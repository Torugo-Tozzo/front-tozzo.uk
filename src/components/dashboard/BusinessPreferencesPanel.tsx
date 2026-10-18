import { createEffect, createSignal, For, Show } from "solid-js"
import { createMutation, createQuery, useQueryClient } from "@tanstack/solid-query"
import { loadedData, onQueryError } from "@/api/query"
import { toast } from "solid-sonner"

import { apiErrorOf } from "@/api/errors"
import { establishmentKeys, getPreferences, updatePreferences, type Preferences } from "@/api/establishment"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import {
  BUSINESS_MODULES, BUSINESS_PROFILES, PROFILE_MODULES, REQUIRED_MODULES, modulesForProfiles, suggestedBusinessModules,
  type BusinessModule, type BusinessProfile,
} from "@/domain/businessPreferences"
import { useTranslation } from "@/i18n/solid"

const UPCOMING_MODULES: readonly BusinessModule[] = ["INGREDIENT_INVENTORY", "STORE_INVENTORY"]
const GENERAL_MODULES = BUSINESS_MODULES.filter((module) =>
  !REQUIRED_MODULES.includes(module) && !BUSINESS_PROFILES.some((profile) => PROFILE_MODULES[profile].includes(module)))

export function BusinessPreferencesPanel() {
  const { user, refreshUserProfile } = useAuth()
  const { t } = useTranslation("settings")
  const queryClient = useQueryClient()
  const isOwner = () => user()?.role === "OWNER"
  const [profiles, setProfiles] = createSignal<BusinessProfile[]>([])
  const [visibleModules, setVisibleModules] = createSignal<BusinessModule[]>([])
  const [revision, setRevision] = createSignal<number | null>(null)
  const [conflict, setConflict] = createSignal(false)

  const query = createQuery(() => ({
    queryKey: establishmentKeys.preferences,
    queryFn: ({ signal }) => getPreferences(signal),
    // An edit in progress must not be replaced by a background refetch.
    refetchOnWindowFocus: false,
  }))

  const apply = (data: Preferences) => {
    setProfiles((data.profiles ?? []) as BusinessProfile[])
    setVisibleModules((data.visibleModules ?? []) as BusinessModule[])
    setRevision(data.revision)
    setConflict(false)
  }

  createEffect(() => {
    const data = loadedData(query)
    if (data) apply(data)
  })

  onQueryError(query, (error) => console.error("Error loading business preferences", error))

  const loading = () => query.isFetching
  const loadError = () => query.isError && !query.isFetching

  const save = createMutation(() => ({
    mutationFn: updatePreferences,
    onSuccess: async (data: Preferences) => {
      queryClient.setQueryData(establishmentKeys.preferences, data)
      toast.success(t("businessPreferences.saved"))
      // The menu reads the profiles from the session user.
      await refreshUserProfile().catch((error) => {
        console.error("Error refreshing user profile after saving business preferences", error)
      })
    },
    onError: (error) => {
      if (apiErrorOf(error).status === 409) {
        setConflict(true)
      } else {
        console.error("Error saving business preferences", error)
        toast.error(t("businessPreferences.saveError"))
      }
    },
  }))
  const saving = () => save.isPending

  // An unchanged answer keeps the same data object (structural sharing), so
  // the form is reset here as well as by the effect.
  const reload = async () => {
    const result = await query.refetch()
    if (result.data) apply(result.data)
  }

  const toggleProfile = (profile: BusinessProfile) => {
    if (!isOwner() || saving()) return
    const current = profiles()
    const wasSelected = current.includes(profile)
    const nextProfiles = wasSelected ? current.filter((item) => item !== profile) : BUSINESS_PROFILES.filter((item) => item === profile || current.includes(item))
    const selected = new Set(visibleModules())
    if (wasSelected) {
      for (const module of PROFILE_MODULES[profile]) selected.delete(module)
    } else {
      for (const module of suggestedBusinessModules(nextProfiles)) selected.add(module)
    }
    setProfiles(nextProfiles)
    setVisibleModules(modulesForProfiles(nextProfiles, BUSINESS_MODULES.filter((module) => selected.has(module))))
  }

  const toggleModule = (module: BusinessModule) => {
    if (!isOwner() || saving() || REQUIRED_MODULES.includes(module)) return
    const selected = new Set(visibleModules())
    if (selected.has(module)) selected.delete(module)
    else selected.add(module)
    setVisibleModules(BUSINESS_MODULES.filter((item) => selected.has(item)))
  }

  const savePreferences = () => {
    const expectedRevision = revision()
    if (!isOwner() || saving() || conflict() || expectedRevision === null || profiles().length === 0) return
    save.mutate({ profiles: profiles(), visibleModules: visibleModules(), expectedRevision })
  }

  return (
    <section class="rounded-lg border bg-card p-6 space-y-4" aria-labelledby="business-preferences-title">
      <div>
        <h2 id="business-preferences-title" class="text-xl font-semibold">{t("businessPreferences.profilesTitle")}</h2>
        <p class="text-sm text-muted-foreground">{t("businessPreferences.modulesDescription")}</p>
      </div>

      <Show when={loading()}><p role="status">{t("businessPreferences.loading")}</p></Show>
      <Show when={loadError()}>
        <div role="alert" class="space-y-2"><p>{t("businessPreferences.loadError")}</p><Button type="button" variant="outline" onClick={() => void reload()}>{t("businessPreferences.reload")}</Button></div>
      </Show>
      <Show when={conflict()}>
        <div role="alert" class="space-y-2"><p>{t("businessPreferences.conflict")}</p><Button type="button" variant="outline" onClick={() => void reload()}>{t("businessPreferences.reload")}</Button></div>
      </Show>

      <Show when={!loading() && !loadError()}>
        <fieldset class="space-y-2">
          <legend class="font-medium">{t("businessPreferences.profilesTitle")}</legend>
          <div class="grid gap-3 lg:grid-cols-3">
            <For each={BUSINESS_PROFILES}>
              {(profile) => (
                <div role="group" aria-label={t(`businessPreferences.profiles.${profile}` as never)} class="rounded border p-4">
                  <label class="flex items-center gap-2 font-medium">
                    <input type="checkbox" checked={profiles().includes(profile)} disabled={!isOwner() || saving() || conflict()} onChange={() => toggleProfile(profile)} />
                    <span>{t(`businessPreferences.profiles.${profile}` as never)}</span>
                  </label>
                  <div class="ml-2 mt-3 space-y-3 border-l pl-5">
                    <For each={PROFILE_MODULES[profile]}>
                      {(module) => (
                        <label class="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={profiles().includes(profile) && visibleModules().includes(module)} disabled={!isOwner() || saving() || conflict() || !profiles().includes(profile)} onChange={() => toggleModule(module)} />
                          <span>{t(`businessPreferences.modules.${module}` as never)}</span>
                          <Show when={UPCOMING_MODULES.includes(module)}><span class="text-xs text-muted-foreground">{t("businessPreferences.comingSoon")}</span></Show>
                        </label>
                      )}
                    </For>
                  </div>
                </div>
              )}
            </For>
          </div>
        </fieldset>

        <fieldset class="space-y-2">
          <legend class="font-medium">{t("businessPreferences.modulesTitle")}</legend>
          <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <For each={GENERAL_MODULES}>
              {(module) => (
                <label class="flex items-center gap-2 rounded border p-3">
                  <input type="checkbox" checked={visibleModules().includes(module)} disabled={!isOwner() || saving() || conflict() || REQUIRED_MODULES.includes(module)} onChange={() => toggleModule(module)} />
                  <span>{t(`businessPreferences.modules.${module}` as never)}</span>
                </label>
              )}
            </For>
          </div>
        </fieldset>

        <Show when={isOwner()}>
          <Button type="button" onClick={savePreferences} disabled={saving() || conflict() || profiles().length === 0}>
            {saving() ? t("businessPreferences.saving") : t("businessPreferences.save")}
          </Button>
        </Show>
      </Show>
    </section>
  )
}
