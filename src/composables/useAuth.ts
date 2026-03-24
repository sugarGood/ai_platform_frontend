import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import {
  scheduleAutoRefresh,
  stopAutoRefresh,
  subscribeAuthSessionUpdated,
} from '../lib/session-refresh'
import {
  clearStoredSession,
  readStoredSession,
  writeStoredSession,
  type StoredAuthSession,
} from '../lib/auth-storage'
import { loginWithCredentials, fetchCurrentUser, requestRemoteLogout } from '../services/auth'
import type { UserResponse } from '../types/user'

const initial = readStoredSession()
const user = ref<UserResponse | null>(initial?.user ?? null)
const accessToken = ref<string | null>(initial?.accessToken ?? null)

function applySession(session: StoredAuthSession) {
  writeStoredSession(session)
  accessToken.value = session.accessToken
  user.value = session.user
}

function clearSession() {
  clearStoredSession()
  stopAutoRefresh()
  accessToken.value = null
  user.value = null
}

function syncFromStorage() {
  const s = readStoredSession()
  accessToken.value = s?.accessToken ?? null
  user.value = s?.user ?? null
}

let unsubSessionSync: (() => void) | null = null

function ensureAuthSessionSync() {
  if (typeof window === 'undefined' || unsubSessionSync) return
  unsubSessionSync = subscribeAuthSessionUpdated(syncFromStorage)
}

// 启动自动刷新（仅在有 session 时）
if (initial?.refreshToken) {
  scheduleAutoRefresh()
}

export function useAuth() {
  ensureAuthSessionSync()
  const router = useRouter()
  const isAuthenticated = computed(() => Boolean(accessToken.value))

  async function login(email: string, password: string) {
    const res = await loginWithCredentials({ email, password })
    applySession({
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
      expiresAt: res.expiresIn ? Date.now() + res.expiresIn * 1000 : undefined,
      user: res.user,
    })
    scheduleAutoRefresh()
  }

  async function logout() {
    const token = accessToken.value
    clearSession()
    // 后台发登出请求，不阻塞跳转
    void requestRemoteLogout(token)
    void router.replace('/login')
  }

  /**
   * 从服务端拉取最新用户信息（校验 token 有效性）。
   * 失败时自动清除 session 并跳转登录页。
   */
  async function refreshUserInfo() {
    const token = accessToken.value
    if (!token) return
    try {
      const freshUser = await fetchCurrentUser(token)
      const session = readStoredSession()
      if (session) {
        applySession({ ...session, user: freshUser })
      }
    } catch {
      clearSession()
      void router.replace('/login')
    }
  }

  const displayName = computed(() => {
    const u = user.value
    if (!u) return '访客'
    return u.fullName?.trim() || u.username?.trim() || u.email?.trim() || '用户'
  })

  const avatarChar = computed(() => {
    const name = displayName.value
    return name ? name.slice(0, 1) : '?'
  })

  return {
    user,
    accessToken,
    isAuthenticated,
    displayName,
    avatarChar,
    login,
    logout,
    refreshUserInfo,
  }
}
