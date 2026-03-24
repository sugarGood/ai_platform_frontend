const rawApiBaseUrl = (import.meta.env.VITE_API_BASE_URL?.trim() || '/api').replace(/\/$/, '')

export function buildApiUrl(path: string) {
  const normalized = path.startsWith('/') ? path : `/${path}`
  if (/^https?:\/\//.test(rawApiBaseUrl)) {
    return `${rawApiBaseUrl}${normalized}`
  }
  return `${rawApiBaseUrl}${normalized}`
}
