import { api } from './client'
import { ApiError, unwrap } from './errors'
import type { components } from './schema'
import { updateProduct, type Product } from './catalog'

export type UploadKind = components['schemas']['CreateUploadRequest']['kind']

/** The types and size the API accepts (POST /v1/uploads answers UPLOAD_INVALID otherwise). */
export const UPLOAD_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024

/** Code of a PUT to the bucket that failed (not an API answer). */
export const UPLOAD_PUT_FAILED = 'UPLOAD_PUT_FAILED'

// Headers a browser sets by itself and refuses from a script: fetch sends the
// Content-Length of the Blob, which is the sizeBytes the URL was signed for.
const FORBIDDEN_HEADERS = new Set(['content-length', 'host'])

/**
 * Sends a file straight to the bucket (Cloudflare R2) and returns its
 * objectKey, which the PATCH of the resource then associates:
 * 1. POST /v1/uploads gives a pre-signed PUT URL (5 min) and the headers to send;
 * 2. PUT of the file to that URL (the API never sees the bytes).
 * A dev API without a bucket answers 503 NOT_READY at step 1.
 */
export async function uploadFile(kind: UploadKind, file: File, targetId?: string): Promise<string> {
  const upload = unwrap(await api.POST('/v1/uploads', {
    body: { kind, targetId, contentType: file.type, sizeBytes: file.size },
  }))

  const headers = new Headers()
  for (const [name, value] of Object.entries(upload.headers ?? {})) {
    if (!FORBIDDEN_HEADERS.has(name.toLowerCase())) headers.set(name, value)
  }
  if (!headers.has('Content-Type')) headers.set('Content-Type', file.type)

  let response: Response
  try {
    response = await fetch(upload.uploadUrl, { method: 'PUT', body: file, headers })
  } catch {
    throw new ApiError(0, { code: UPLOAD_PUT_FAILED, status: 0, title: UPLOAD_PUT_FAILED })
  }
  if (!response.ok) throw new ApiError(response.status, { code: UPLOAD_PUT_FAILED, status: response.status, title: UPLOAD_PUT_FAILED })
  return upload.objectKey
}

/** The three steps for a product image: upload, PUT, then PATCH /v1/products/{id} with imageKey. */
export async function uploadProductImage(productId: string, file: File): Promise<Product> {
  const imageKey = await uploadFile('product', file, productId)
  return updateProduct(productId, { imageKey })
}
