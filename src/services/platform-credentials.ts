import type { CreatePlatformCredentialPayload, PlatformCredentialResponse } from '../types/credentials'

import { requestJson, withQuery } from '../lib/api-client'

export function listPlatformCredentialsByUser(userId: number) {
  return requestJson<PlatformCredentialResponse[]>(withQuery('/credentials', { userId }))
}

export function createPlatformCredential(payload: CreatePlatformCredentialPayload) {
  return requestJson<{ plainKey: string; credential: PlatformCredentialResponse }>('/credentials', {
    method: 'POST',
    body: JSON.stringify({
      userId: payload.userId,
      credentialType: payload.credentialType,
      name: payload.name,
      boundProjectId: payload.boundProjectId ?? null,
    }),
  })
}

export function revokePlatformCredential(id: number, reason: string) {
  return requestJson<PlatformCredentialResponse>(`/credentials/${id}/revoke`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

/** OpenAPI：`POST /api/credentials/{id}/renew`，body 含 renewDays：30 / 90 / 180 */
export function renewPlatformCredential(id: number, renewDays: 30 | 90 | 180) {
  return requestJson<PlatformCredentialResponse>(`/credentials/${id}/renew`, {
    method: 'POST',
    body: JSON.stringify({ renewDays }),
  })
}

/** OpenAPI：`POST /api/credentials/{id}/rotate` — 响应含新明文密钥（仅一次） */
export function rotatePlatformCredential(id: number) {
  return requestJson<{ plainKey: string; credential: PlatformCredentialResponse }>(`/credentials/${id}/rotate`, {
    method: 'POST',
  })
}

/** PUT `/api/credentials/{id}/bound-project` — body: `{ projectId: number | null }`，null 表示解绑 */
export function updateCredentialBoundProject(credentialId: number, projectId: number | null) {
  return requestJson<PlatformCredentialResponse>(`/credentials/${credentialId}/bound-project`, {
    method: 'PUT',
    body: JSON.stringify({ projectId }),
  })
}

