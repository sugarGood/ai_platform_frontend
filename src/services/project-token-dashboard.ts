import { requestJson, requestOk, withQuery } from '../lib/api-client'

const base = (projectId: number) => `/projects/${projectId}/token-dashboard`

/** GET …/token-dashboard/summary */
export function getTokenDashboardSummary(projectId: number) {
  return requestJson<unknown>(`${base(projectId)}/summary`)
}

/** GET …/token-dashboard/config */
export function getTokenDashboardConfig(projectId: number) {
  return requestJson<unknown>(`${base(projectId)}/config`)
}

/** GET …/token-dashboard/members/quota-rows */
export function getTokenDashboardMemberQuotaRows(projectId: number) {
  return requestJson<unknown>(`${base(projectId)}/members/quota-rows`)
}

/** GET …/token-dashboard/consumption-by-user */
export function getTokenDashboardConsumptionByUser(projectId: number) {
  return requestJson<unknown>(`${base(projectId)}/consumption-by-user`)
}

export interface TokenDashboardActivityQuery {
  page?: number
  size?: number
  sourceType?: string
  status?: string
  occurredAfter?: string
  occurredBefore?: string
  /** 若后端支持按成员过滤 */
  userId?: number
}

/** GET …/token-dashboard/activity */
export function listTokenDashboardActivity(projectId: number, q: TokenDashboardActivityQuery = {}) {
  return requestJson<unknown>(
    withQuery(`${base(projectId)}/activity`, {
      page: q.page,
      size: q.size,
      sourceType: q.sourceType,
      status: q.status,
      occurredAfter: q.occurredAfter,
      occurredBefore: q.occurredBefore,
    }),
  )
}

/** POST …/token-dashboard/members/sync-quotas */
export function postTokenDashboardSyncQuotas(projectId: number) {
  return requestOk(`${base(projectId)}/members/sync-quotas`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export interface TokenDashboardBatchSettlePayload {
  clearProjectTokenQuotaUsage?: boolean
  clearPersonalPoolMonthlyUsage?: boolean
}

/** POST …/token-dashboard/members/batch-settle */
export function postTokenDashboardBatchSettle(projectId: number, payload: TokenDashboardBatchSettlePayload) {
  return requestOk(`${base(projectId)}/members/batch-settle`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/** PATCH …/token-dashboard/members/{memberId}/ai-access */
export function patchTokenDashboardMemberAiAccess(projectId: number, memberId: number, enabled: boolean) {
  return requestOk(`${base(projectId)}/members/${memberId}/ai-access`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled, aiEnabled: enabled }),
  })
}
