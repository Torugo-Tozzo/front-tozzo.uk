import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import {
  BUSINESS_MODULES, BUSINESS_PROFILES, PROFILE_MODULES, REQUIRED_MODULES, modulesForProfiles, suggestedBusinessModules,
  type BusinessModule, type BusinessProfile,
} from '@/domain/businessPreferences'
import api from '@/services/api'

type PreferencesResponse = { profiles: BusinessProfile[]; visibleModules: BusinessModule[]; revision: number }
const UPCOMING_MODULES: readonly BusinessModule[] = ['SERVICES', 'ESTIMATES', 'INGREDIENT_INVENTORY', 'STORE_INVENTORY']

export function BusinessPreferencesPanel() {
  const { user, refreshUserProfile } = useAuth()
  const { t } = useTranslation('settings')
  const isOwner = user?.role === 'OWNER'
  const [profiles, setProfiles] = useState<BusinessProfile[]>([])
  const [visibleModules, setVisibleModules] = useState<BusinessModule[]>([])
  const [revision, setRevision] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [conflict, setConflict] = useState(false)

  const loadPreferences = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const response = await api.get<PreferencesResponse>('/establishments/preferences')
      const data = response.data
      if (!Array.isArray(data?.profiles) || !Array.isArray(data?.visibleModules) || !Number.isInteger(data?.revision)) {
        throw new Error('Invalid business preferences response')
      }
      setProfiles(data.profiles)
      setVisibleModules(data.visibleModules)
      setRevision(data.revision)
      setConflict(false)
    } catch (error) {
      console.error('Error loading business preferences', error)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadPreferences() }, [loadPreferences])

  const toggleProfile = (profile: BusinessProfile) => {
    if (!isOwner || saving) return
    const wasSelected = profiles.includes(profile)
    const nextProfiles = wasSelected ? profiles.filter((item) => item !== profile) : BUSINESS_PROFILES.filter((item) => item === profile || profiles.includes(item))
    const newSuggestions = suggestedBusinessModules(nextProfiles)
    const selected = new Set(visibleModules)
    if (wasSelected) {
      for (const module of PROFILE_MODULES[profile]) selected.delete(module)
    } else {
      for (const module of newSuggestions) selected.add(module)
    }
    setProfiles(nextProfiles)
    setVisibleModules(modulesForProfiles(nextProfiles, BUSINESS_MODULES.filter((module) => selected.has(module))))
  }

  const toggleModule = (module: BusinessModule) => {
    if (!isOwner || saving || REQUIRED_MODULES.includes(module)) return
    const selected = new Set(visibleModules)
    if (selected.has(module)) selected.delete(module)
    else selected.add(module)
    setVisibleModules(BUSINESS_MODULES.filter((item) => selected.has(item)))
  }

  const savePreferences = async () => {
    if (!isOwner || saving || conflict || revision === null || profiles.length === 0) return
    setSaving(true)
    try {
      const response = await api.patch<PreferencesResponse>('/establishments/preferences', {
        profiles, visibleModules, expectedRevision: revision,
      })
      setProfiles(response.data.profiles)
      setVisibleModules(response.data.visibleModules)
      setRevision(response.data.revision)
      toast.success(t('businessPreferences.saved'))
      await refreshUserProfile().catch((error) => {
        console.error('Error refreshing user profile after saving business preferences', error)
      })
    } catch (error) {
      if ((error as { response?: { status?: number } })?.response?.status === 409) {
        setConflict(true)
      } else {
        console.error('Error saving business preferences', error)
        toast.error(t('businessPreferences.saveError'))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-lg border bg-card p-6 space-y-4" aria-labelledby="business-preferences-title">
      <div>
        <h2 id="business-preferences-title" className="text-xl font-semibold">{t('businessPreferences.profilesTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('businessPreferences.modulesDescription')}</p>
      </div>

      {loading && <p role="status">{t('businessPreferences.loading')}</p>}
      {loadError && <div role="alert" className="space-y-2"><p>{t('businessPreferences.loadError')}</p><Button type="button" variant="outline" onClick={() => void loadPreferences()}>{t('businessPreferences.reload')}</Button></div>}
      {conflict && <div role="alert" className="space-y-2"><p>{t('businessPreferences.conflict')}</p><Button type="button" variant="outline" onClick={() => void loadPreferences()}>{t('businessPreferences.reload')}</Button></div>}

      {!loading && !loadError && <>
        <fieldset className="space-y-2">
          <legend className="font-medium">{t('businessPreferences.profilesTitle')}</legend>
          <div className="grid gap-3 lg:grid-cols-3">
            {BUSINESS_PROFILES.map((profile) => (
              <div key={profile} role="group" aria-label={t(`businessPreferences.profiles.${profile}` as never)} className="rounded border p-4">
                <label className="flex items-center gap-2 font-medium">
                  <input type="checkbox" checked={profiles.includes(profile)} disabled={!isOwner || saving || conflict} onChange={() => toggleProfile(profile)} />
                  <span>{t(`businessPreferences.profiles.${profile}` as never)}</span>
                </label>
                <div className="ml-2 mt-3 space-y-3 border-l pl-5">
                    {PROFILE_MODULES[profile].map((module) => (
                      <label key={module} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={profiles.includes(profile) && visibleModules.includes(module)} disabled={!isOwner || saving || conflict || !profiles.includes(profile)} onChange={() => toggleModule(module)} />
                        <span>{t(`businessPreferences.modules.${module}` as never)}</span>
                        {UPCOMING_MODULES.includes(module) && <span className="text-xs text-muted-foreground">{t('businessPreferences.comingSoon')}</span>}
                      </label>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="font-medium">{t('businessPreferences.modulesTitle')}</legend>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {BUSINESS_MODULES.filter((module) => !REQUIRED_MODULES.includes(module) && !BUSINESS_PROFILES.some(profile => PROFILE_MODULES[profile].includes(module))).map((module) => (
              <label key={module} className="flex items-center gap-2 rounded border p-3">
                <input type="checkbox" checked={visibleModules.includes(module)} disabled={!isOwner || saving || conflict || REQUIRED_MODULES.includes(module)} onChange={() => toggleModule(module)} />
                <span>{t(`businessPreferences.modules.${module}` as never)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {isOwner && <Button type="button" onClick={() => void savePreferences()} disabled={saving || conflict || profiles.length === 0}>
          {saving ? t('businessPreferences.saving') : t('businessPreferences.save')}
        </Button>}
      </>}
    </section>
  )
}
