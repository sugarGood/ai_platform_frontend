import type { CreateProviderApiKeyPayload, ProviderApiKeyResponse } from '../types/provider-api-keys'

import { requestJson, withQuery } from '../lib/api-client'

export function listProviderApiKeys(providerId?: number | null) {
  return requestJson<ProviderApiKeyResponse[]>(withQuery('/admin/provider-keys', { providerId: providerId ?? undefined }))
}

export function createProviderApiKey(payload: CreateProviderApiKeyPayload) {
  return requestJson<ProviderApiKeyResponse>('/admin/provider-keys', {
    method: 'POST',
    body: JSON.stringify({
      providerId: payload.providerId,
      label: payload.label,
      apiKey: payload.apiKey,
      modelsAllowed: payload.modelsAllowed ?? '[]',
      monthlyQuotaTokens: payload.monthlyQuotaTokens ?? 0,
      rateLimitRpm: payload.rateLimitRpm ?? 60,
      rateLimitTpm: payload.rateLimitTpm ?? 60_000,
      proxyEndpoint: payload.proxyEndpoint ?? '',
    }),
  })
}

