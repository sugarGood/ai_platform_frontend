import type { MemberAiQuotaResponse } from '../types/platform-usage'

import { requestJson, withQuery } from '../lib/api-client'

export function listMemberQuotasByProject(projectId: number) {
  return requestJson<MemberAiQuotaResponse[]>(withQuery('/member-quotas', { projectId }))
}

export function listMemberQuotasByUser(userId: number) {
  return requestJson<MemberAiQuotaResponse[]>(withQuery('/member-quotas', { userId }))
}

export function listMemberQuotas(params: { userId?: number | null; projectId?: number | null }) {
  return requestJson<MemberAiQuotaResponse[]>(
    withQuery('/member-quotas', { userId: params.userId ?? undefined, projectId: params.projectId ?? undefined }),
  )
}

export function createMemberQuota(payload: {
  userId: number
  projectId?: number | null
  quotaType: string
  quotaLimit: number
  resetCycle?: string
}) {
  return requestJson<MemberAiQuotaResponse>('/member-quotas', {
    method: 'POST',
    body: JSON.stringify({
      userId: payload.userId,
      projectId: payload.projectId ?? null,
      quotaType: payload.quotaType,
      quotaLimit: payload.quotaLimit,
      resetCycle: payload.resetCycle ?? 'MONTHLY',
    }),
  })
}
