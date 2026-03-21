/**
 * Shared fetch helpers for backend REST (base `/api` or VITE_API_BASE_URL).
 */

const rawApiBaseUrl = (import.meta.env.VITE_API_BASE_URL?.trim() || '/api').replace(/\/$/, '')

export function buildApiUrl(path: string) {
  const normalized = path.startsWith('/') ? path : `/${path}`
  if (/^https?:\/\//.test(rawApiBaseUrl)) {
    return `${rawApiBaseUrl}${normalized}`
  }
  return `${rawApiBaseUrl}${normalized}`
}

export interface PageResponse<T> {
  data: T[]
  total: number
  page: number
  size: number
}

export function withQuery(path: string, params: Record<string, string | number | undefined | null | boolean>) {
  const u = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    u.set(k, String(v))
  }
  const q = u.toString()
  return q ? `${path}?${q}` : path
}

async function readErrorMessage(response: Response) {
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    try {
      const body = (await response.json()) as Record<string, unknown>
      const message = typeof body.message === 'string' ? body.message : undefined
      const error = typeof body.error === 'string' ? body.error : undefined
      const details = Array.isArray(body.errors) ? body.errors.join('；') : undefined

      return message || error || details || `请求失败：${response.status}`
    } catch {
      return `请求失败：${response.status}`
    }
  }

  const text = await response.text()
  return text.trim() || `请求失败：${response.status}`
}

export async function requestJson<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  return (await response.json()) as T
}
