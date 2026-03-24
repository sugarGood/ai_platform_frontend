/** 后端统一 JSON 信封：`{ success, code, errorCode, message, data, timestamp }` */
export interface ApiEnvelope<T = unknown> {
  success: boolean
  code: number
  errorCode?: string | null
  message?: string
  data: T
  timestamp?: number
}

export function isUnifiedApiEnvelope(body: unknown): body is ApiEnvelope<unknown> {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return false
  const o = body as Record<string, unknown>
  return typeof o.success === 'boolean' && typeof o.code === 'number' && 'data' in o
}

/**
 * 从统一信封中取出 `data`；若非信封则原样返回（便于单测或未改完的接口）。
 * `success === false` 或 `code >= 400` 时抛出带 `message` / `errorCode` 的 Error。
 */
export function unwrapApiJson<T>(body: unknown): T {
  if (!isUnifiedApiEnvelope(body)) {
    return body as T
  }
  if (body.success === false || (typeof body.code === 'number' && body.code >= 400)) {
    const msg =
      typeof body.message === 'string' && body.message.trim() ? body.message : '请求失败'
    const ec = body.errorCode
    const ecStr = ec != null && String(ec).trim() !== '' ? String(ec) : ''
    throw new Error(ecStr ? `${msg}（${ecStr}）` : msg)
  }
  return body.data as T
}
