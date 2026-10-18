import { api } from './client'
import { unwrap } from './errors'
import type { components } from './schema'

export type ListedDevice = components['schemas']['ListedDevice']

export const deviceKeys = { all: ['devices'] as const }

export async function listDevices(signal?: AbortSignal): Promise<ListedDevice[]> {
  return unwrap(await api.GET('/v1/devices', { signal })) ?? []
}

export async function deleteDevice(id: string): Promise<void> {
  unwrap(await api.DELETE('/v1/devices/{id}', { params: { path: { id } } }))
}
