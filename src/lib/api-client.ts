/**
 * Shared fetch helpers for backend REST (base `/api` or VITE_API_BASE_URL).
 */

import { fetchWithApiTimeout } from './fetch-with-api-timeout'
import { buildApiUrl } from './api-url'
import { getStoredAccessToken } from './auth-storage'
import { emitAuthSessionUpdated, refreshStoredSession } from './session-refresh'
import { isUnifiedApiEnvelope, unwrapApiJson } from './api-envelope'

export { buildApiUrl } from './api-url'
export type { ApiEnvelope } from './api-envelope'
export { unwrapApiJson } from './api-envelope'

export interface PageResponse<T> {
  data: T[]
  total: number
  page: number
  size: number
}

/**
 * 将接口返回值规范为数组：兼容裸数组及常见 Spring 风格分页封装
 *（如 `{ data: [] }`、分页 `{ content: [] }`）。
 */
export function asArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) {
    return raw as T[]
  }
  if (raw !== null && typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    const nested = o.data ?? o.content ?? o.records ?? o.items ?? o.list
    if (Array.isArray(nested)) {
      return nested as T[]
    }
  }
  return []
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

/** 从失败响应中解析可读错误文案（含统一信封） */
export async function readFetchErrorMessage(response: Response) {
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    try {
      const body = (await response.json()) as Record<string, unknown>
      if (isUnifiedApiEnvelope(body)) {
        const msg = typeof body.message === 'string' ? body.message.trim() : ''
        if (msg) {
          const ec = body.errorCode
          const ecStr = ec != null && String(ec).trim() !== '' ? String(ec) : ''
          return ecStr ? `${msg}（${ecStr}）` : msg
        }
      }
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
  async function send(access: string | null) {
    const body = init.body
    const jsonBody = Boolean(body) && !(body instanceof FormData)
    return fetchWithApiTimeout(buildApiUrl(path), {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(jsonBody ? { 'Content-Type': 'application/json' } : {}),
        ...(access ? { Authorization: `Bearer ${access}` } : {}),
        ...init.headers,
      },
    })
  }

  let access = getStoredAccessToken()
  let response = await send(access)

  if (response.status === 401 && access) {
    const refreshed = await refreshStoredSession()
    if (refreshed) {
      emitAuthSessionUpdated()
      access = getStoredAccessToken()
      response = await send(access)
    }
  }

  if (!response.ok) {
    throw new Error(await readFetchErrorMessage(response))
  }

  const raw: unknown = await response.json()
  return unwrapApiJson<T>(raw)
}

/** DELETE / 204 等无 JSON 响应体的请求 */
export async function requestOk(path: string, init: RequestInit = {}): Promise<void> {
  async function send(access: string | null) {
    const body = init.body
    const jsonBody = Boolean(body) && !(body instanceof FormData)
    return fetchWithApiTimeout(buildApiUrl(path), {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(jsonBody ? { 'Content-Type': 'application/json' } : {}),
        ...(access ? { Authorization: `Bearer ${access}` } : {}),
        ...init.headers,
      },
    })
  }

  let access = getStoredAccessToken()
  let response = await send(access)

  if (response.status === 401 && access) {
    const refreshed = await refreshStoredSession()
    if (refreshed) {
      emitAuthSessionUpdated()
      access = getStoredAccessToken()
      response = await send(access)
    }
  }

  if (!response.ok) {
    throw new Error(await readFetchErrorMessage(response))
  }

  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) return

  const text = await response.text()
  if (!text.trim()) return

  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  } catch {
    return
  }
  unwrapApiJson(parsed)
}
