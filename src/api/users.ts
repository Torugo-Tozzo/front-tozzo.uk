import { api } from './client'
import { unwrap } from './errors'
import type { components } from './schema'

export type Member = components['schemas']['User']
export type MemberPage = components['schemas']['Page']
export type CreateUserRequest = components['schemas']['CreateUserRequest']
export type UpdateUserRequest = components['schemas']['UpdateUserRequest']

export const userKeys = { all: ['users'] as const }

export async function listUsers(query: { search?: string; cursor?: string; limit?: number }, signal?: AbortSignal): Promise<MemberPage> {
  const page = unwrap(await api.GET('/v1/users', { params: { query: { ...query, search: query.search || undefined } }, signal }))
  return { ...page, items: page.items ?? [] }
}

export async function createUser(body: CreateUserRequest): Promise<Member> {
  return unwrap(await api.POST('/v1/users', { body }))
}

export async function updateUser(id: string, body: UpdateUserRequest): Promise<Member> {
  return unwrap(await api.PATCH('/v1/users/{id}', { params: { path: { id } }, body }))
}

export async function deleteUser(id: string): Promise<void> {
  unwrap(await api.DELETE('/v1/users/{id}', { params: { path: { id } } }))
}
