/**
 * Tiny fetch wrapper with credentials + JSON + non-2xx error throwing.
 * The backend issues an httpOnly `session` cookie on /auth/login; sending
 * `credentials: 'include'` ensures the browser attaches it on subsequent calls.
 */

export const API_BASE_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) ||
  'http://localhost:8000'

export class ApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, message: string, body: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** JSON body — will be stringified and Content-Type set automatically. */
  json?: unknown
  /** Optional query params, appended to the URL. */
  query?: Record<string, string | number | boolean | string[] | undefined | null>
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(
    path.startsWith('http') ? path : `${API_BASE_URL.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`,
  )
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue
      if (Array.isArray(value)) {
        for (const v of value) {
          if (v === undefined || v === null || v === '') continue
          url.searchParams.append(key, String(v))
        }
      } else {
        url.searchParams.set(key, String(value))
      }
    }
  }
  return url.toString()
}

export async function apiFetch<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { json, query, headers, ...rest } = opts
  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(headers as Record<string, string> | undefined),
  }
  let body: BodyInit | undefined
  if (json !== undefined) {
    body = JSON.stringify(json)
    finalHeaders['Content-Type'] = 'application/json'
  }

  const res = await fetch(buildUrl(path, query), {
    credentials: 'include',
    ...rest,
    headers: finalHeaders,
    body: body ?? undefined,
  })

  // 204 no content
  if (res.status === 204) return undefined as T

  const contentType = res.headers.get('content-type') || ''
  const isJson = contentType.includes('application/json')
  const payload: unknown = isJson ? await res.json().catch(() => null) : await res.text().catch(() => '')

  if (!res.ok) {
    const message =
      (isJson && payload && typeof payload === 'object' && 'detail' in payload && typeof (payload as { detail: unknown }).detail === 'string'
        ? (payload as { detail: string }).detail
        : null) || `Request failed (${res.status})`
    throw new ApiError(res.status, message, payload)
  }
  return payload as T
}

/** SWR-friendly fetcher: `useSWR(['/calls', { agent_id: 'x' }], swrFetcher)`. */
export const swrFetcher = <T>(key: string | [string, RequestOptions['query']?]): Promise<T> => {
  if (typeof key === 'string') return apiFetch<T>(key)
  const [path, query] = key
  return apiFetch<T>(path, { query })
}
