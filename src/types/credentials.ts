export type PlatformCredentialType = 'PERSONAL' | 'SERVICE_ACCOUNT' | 'TEMPORARY' | string

export interface PlatformCredentialResponse {
  id: number
  userId: number
  credentialType: PlatformCredentialType
  keyPrefix: string
  name: string
  boundProjectId: number | null
  status: string
  expiresAt: string | null
  lastUsedAt: string | null
  createdAt: string
}

export interface CreatePlatformCredentialPayload {
  userId: number
  credentialType?: PlatformCredentialType
  name?: string
  boundProjectId?: number | null
}

