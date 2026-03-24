import type { UserResponse } from '../types/user'

export const AUTH_SESSION_STORAGE_KEY = 'ai_platform_session'

export interface StoredAuthSession {
  accessToken: string
  refreshToken?: string
  /** Unix timestamp (ms) when the access token expires; undefined = unknown */
  expiresAt?: number
  user: UserResponse
}

export function readStoredSession(): StoredAuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredAuthSession
    if (!parsed?.accessToken || !parsed?.user) return null
    return parsed
  } catch {
    return null
  }
}

export function writeStoredSession(session: StoredAuthSession): void {
  localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session))
}

export function clearStoredSession(): void {
  localStorage.removeItem(AUTH_SESSION_STORAGE_KEY)
}

export function getStoredAccessToken(): string | null {
  return readStoredSession()?.accessToken ?? null
}

export function getStoredRefreshToken(): string | null {
  return readStoredSession()?.refreshToken ?? null
}
