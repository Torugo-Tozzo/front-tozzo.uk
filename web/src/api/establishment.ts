import { api } from './client'
import { unwrap } from './errors'
import type { components } from './schema'

export type EstablishmentView = components['schemas']['View']
export type UpdateEstablishmentRequest = components['schemas']['UpdateEstablishmentRequest']
export type Preferences = components['schemas']['Preferences']
export type UpdatePreferencesRequest = components['schemas']['UpdateEstablishmentPreferencesRequest']
export type EstablishmentCategory = NonNullable<EstablishmentView['category']>

export const establishmentKeys = {
  all: ['establishment'] as const,
  preferences: ['establishment', 'preferences'] as const,
}

export async function getEstablishment(signal?: AbortSignal): Promise<EstablishmentView> {
  return unwrap(await api.GET('/v1/establishment', { signal }))
}

export async function updateEstablishment(body: UpdateEstablishmentRequest): Promise<EstablishmentView> {
  return unwrap(await api.PATCH('/v1/establishment', { body }))
}

export async function setEstablishmentCategory(category: EstablishmentCategory): Promise<EstablishmentView> {
  return unwrap(await api.PUT('/v1/establishment/category', { body: { category } }))
}

export async function getPreferences(signal?: AbortSignal): Promise<Preferences> {
  return unwrap(await api.GET('/v1/establishment/preferences', { signal }))
}

export async function updatePreferences(body: UpdatePreferencesRequest): Promise<Preferences> {
  return unwrap(await api.PATCH('/v1/establishment/preferences', { body }))
}

/** GET /v1/account/export: every row of the establishment. */
export async function exportAccount(): Promise<Record<string, unknown>> {
  return unwrap(await api.GET('/v1/account/export'))
}

/** POST /v1/account/delete: deletes the establishment (password confirmation). */
export async function deleteAccount(password: string): Promise<void> {
  unwrap(await api.POST('/v1/account/delete', { body: { password } }))
}
