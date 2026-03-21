import type { PageResponse } from '../lib/api-client'

export type { PageResponse }

/** Backend `AiUsageEventResponse` */
export interface AiUsageEventResponse {
  id: number
  credentialId: number | null
  userId: number | null
  projectId: number | null
  providerId: number | null
  modelId: number | null
  sourceType: string | null
  requestMode: string | null
  requestId: string | null
  skillId: number | null
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
  costAmount: string | number | null
  status: string | null
  errorMessage: string | null
  latencyMs: number | null
  occurredAt: string | null
}

/** Backend `MemberAiQuotaResponse` */
export interface MemberAiQuotaResponse {
  id: number
  userId: number
  projectId: number
  quotaType: string
  quotaLimit: number | null
  usedAmount: number | null
  resetCycle: string | null
  lastResetAt: string | null
  status: string
  createdAt: string | null
}
