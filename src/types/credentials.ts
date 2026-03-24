export type PlatformCredentialType = 'PERSONAL' | 'SERVICE_ACCOUNT' | 'TEMPORARY' | string

/** 对齐 OpenAPI `PlatformCredentialResponse`（一人一证、跨项目共用）。 */
export interface PlatformCredentialResponse {
  id: number
  userId: number
  credentialType: PlatformCredentialType
  keyPrefix: string
  name: string
  monthlyTokenQuota?: number | null
  usedTokensThisMonth?: number | null
  alertThresholdPct?: number | null
  overQuotaStrategy?: string | null
  status: string
  expiresAt: string | null
  lastUsedAt: string | null
  createdAt: string
  boundProjectId?: number | null
}

export interface CreatePlatformCredentialPayload {
  userId: number
  credentialType?: PlatformCredentialType
  name?: string
  boundProjectId?: number | null
}

