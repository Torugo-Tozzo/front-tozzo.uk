import { api } from './client'
import { unwrap } from './errors'
import type { components } from './schema'

export type Product = components['schemas']['Product']
export type ProductPage = components['schemas']['ProductPage']
export type ProductType = components['schemas']['ProductType']
export type CreateProductRequest = components['schemas']['CreateProductRequest']
export type UpdateProductRequest = components['schemas']['UpdateProductRequest']
export type CreateProductTypeRequest = components['schemas']['CreateProductTypeRequest']
export type UpdateProductTypeRequest = components['schemas']['UpdateProductTypeRequest']

/** Query keys of the catalog. Every key starts with one of these, so a prefix invalidates them all. */
export const catalogKeys = {
  products: ['products'] as const,
  productTypes: ['product-types'] as const,
}

export interface ProductQuery {
  search?: string
  productTypeId?: string
  cursor?: string
  limit?: number
}

export async function listProducts(query: ProductQuery, signal?: AbortSignal): Promise<ProductPage> {
  const page = unwrap(await api.GET('/v1/products', {
    params: { query: { ...query, search: query.search || undefined, productTypeId: query.productTypeId || undefined } },
    signal,
  }))
  return { ...page, items: page.items ?? [] }
}

export async function createProduct(body: CreateProductRequest): Promise<Product> {
  return unwrap(await api.POST('/v1/products', { body }))
}

export async function updateProduct(id: string, body: UpdateProductRequest): Promise<Product> {
  return unwrap(await api.PATCH('/v1/products/{id}', { params: { path: { id } }, body }))
}

export async function deleteProduct(id: string): Promise<void> {
  unwrap(await api.DELETE('/v1/products/{id}', { params: { path: { id } } }))
}

/** The whole list (the /v1 does not page product types: there are few). */
export async function listProductTypes(query: { includeInactive?: boolean; search?: string }, signal?: AbortSignal): Promise<ProductType[]> {
  return unwrap(await api.GET('/v1/product-types', {
    params: { query: { includeInactive: query.includeInactive || undefined, search: query.search || undefined } },
    signal,
  })) ?? []
}

export async function createProductType(body: CreateProductTypeRequest): Promise<ProductType> {
  return unwrap(await api.POST('/v1/product-types', { body }))
}

export async function updateProductType(id: string, body: UpdateProductTypeRequest): Promise<ProductType> {
  return unwrap(await api.PATCH('/v1/product-types/{id}', { params: { path: { id } }, body }))
}

export async function deleteProductType(id: string): Promise<void> {
  unwrap(await api.DELETE('/v1/product-types/{id}', { params: { path: { id } } }))
}
