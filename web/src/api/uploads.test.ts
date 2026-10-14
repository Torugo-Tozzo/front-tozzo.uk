import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from './errors'
import { UPLOAD_PUT_FAILED, uploadFile } from './uploads'

const upload = {
  uploadUrl: 'https://bucket.account.r2.cloudflarestorage.com/key.png?X-Amz-Signature=x',
  objectKey: 'establishments/e/logo/key.png',
  expiresAt: '2026-10-01T18:05:00Z',
  headers: { 'Content-Type': 'image/png', 'Content-Length': '3', Host: 'bucket.account.r2.cloudflarestorage.com' },
}

function stub(putStatus: number | 'network') {
  const requests: Request[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init)
    requests.push(request)
    if (request.url.endsWith('/v1/uploads')) return new Response(JSON.stringify(upload), { status: 200, headers: { 'Content-Type': 'application/json' } })
    if (putStatus === 'network') throw new TypeError('Failed to fetch')
    return new Response(null, { status: putStatus })
  }))
  return requests
}

const file = () => new File([new Uint8Array([1, 2, 3])], 'logo.png', { type: 'image/png' })

describe('uploadFile', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('asks for a URL, PUTs the file to the bucket and returns the object key', async () => {
    const requests = stub(200)
    await expect(uploadFile('logo', file())).resolves.toBe('establishments/e/logo/key.png')

    expect(await requests[0].clone().json()).toEqual({ kind: 'logo', contentType: 'image/png', sizeBytes: 3 })
    const put = requests[1]
    expect(put.method).toBe('PUT')
    expect(put.url).toBe(upload.uploadUrl)
    expect(put.headers.get('Content-Type')).toBe('image/png')
    // The browser sets these from the body; a script cannot.
    expect(put.headers.get('Host')).toBeNull()
    // The bucket gets no bearer token.
    expect(put.headers.get('Authorization')).toBeNull()
  })

  it('reports a refused PUT with its own code', async () => {
    stub(403)
    await expect(uploadFile('logo', file())).rejects.toMatchObject({ status: 403, code: UPLOAD_PUT_FAILED })
  })

  it('reports a PUT blocked by the network (CORS, CSP) with its own code', async () => {
    stub('network')
    const error = await uploadFile('logo', file()).catch((reason: unknown) => reason)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).code).toBe(UPLOAD_PUT_FAILED)
  })
})
