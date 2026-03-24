import type { AuthLoginResponse } from '../types/auth'
import { unwrapApiJson } from './api-envelope'
import { fetchWithApiTimeout } from './fetch-with-api-timeout'
import { buildApiUrl } from './api-url'
import { readStoredSession, writeStoredSession } from './auth-storage'

const SESSION_UPDATED = 'ai-platform-auth-session-updated'

/** 提前多少毫秒触发刷新（默认 5 分钟）*/
const REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000

/** 最短轮询间隔（60 秒），避免频繁唤醒 */
const MIN_CHECK_INTERVAL_MS = 60 * 1000

export function emitAuthSessionUpdated() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(SESSION_UPDATED))
}

export function subscribeAuthSessionUpdated(fn: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(SESSION_UPDATED, fn)
  return () => window.removeEventListener(SESSION_UPDATED, fn)
}

/** 使用本地 refreshToken 换新 accessToken 并写回存储；成功返回 true */
export async function refreshStoredSession(): Promise<boolean> {
  const session = readStoredSession()
  const refreshToken = session?.refreshToken
  if (!refreshToken) return false

  try {
    const response = await fetchWithApiTimeout(buildApiUrl('/auth/refresh'), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    })

    if (!response.ok) return false

    const data = unwrapApiJson<AuthLoginResponse>(await response.json())
    if (!data?.accessToken || !data?.user) return false

    writeStoredSession({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken ?? refreshToken,
      expiresAt: data.expiresIn ? Date.now() + data.expiresIn * 1000 : undefined,
      user: data.user,
    })
    emitAuthSessionUpdated()
    return true
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// 自动刷新调度器
// ---------------------------------------------------------------------------

let _autoRefreshTimer: ReturnType<typeof setTimeout> | null = null

function clearAutoRefresh() {
  if (_autoRefreshTimer !== null) {
    clearTimeout(_autoRefreshTimer)
    _autoRefreshTimer = null
  }
}

/**
 * 根据当前 session 的 expiresAt 调度下一次自动刷新。
 * - 若 expiresAt 未知，则按 MIN_CHECK_INTERVAL_MS 定期检查。
 * - 若 expiresAt 已过期，立即尝试刷新。
 * - 调用 stopAutoRefresh() 可停止调度器。
 */
export function scheduleAutoRefresh() {
  if (typeof window === 'undefined') return
  clearAutoRefresh()

  const session = readStoredSession()
  if (!session?.refreshToken) return // 无 session，无需调度

  let delayMs: number

  if (session.expiresAt) {
    const msUntilExpiry = session.expiresAt - Date.now()
    if (msUntilExpiry <= 0) {
      // 已过期，立即刷新
      delayMs = 0
    } else {
      delayMs = Math.max(msUntilExpiry - REFRESH_BEFORE_EXPIRY_MS, MIN_CHECK_INTERVAL_MS)
    }
  } else {
    // expiresAt 未知，按固定间隔检查
    delayMs = MIN_CHECK_INTERVAL_MS
  }

  _autoRefreshTimer = setTimeout(async () => {
    const refreshed = await refreshStoredSession()
    if (refreshed) {
      // 刷新成功后重新调度
      scheduleAutoRefresh()
    }
    // 刷新失败（refreshToken 也过期）则停止，由路由守卫处理重新登录
  }, delayMs)
}

export function stopAutoRefresh() {
  clearAutoRefresh()
}
