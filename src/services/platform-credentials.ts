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

