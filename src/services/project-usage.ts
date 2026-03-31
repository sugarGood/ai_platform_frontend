import type { PageResponse } from '../lib/api-client'
import { requestJson, withQuery } from '../lib/api-client'
import type { AiUsageEventResponse } from '../types/platform-usage'

/** GET `/api/projects/{projectId}/usage/summary` — 结构以后端为准，前端用 `normalizeProjectUsageSummary` 解析 */
export function getProjectUsageSummary(projectId: number) {
  return requestJson<Record<string, unknown>>(`/projects/${projectId}/usage/summary`)
}

/** GET `/api/projects/{projectId}/usage/events` — 项目维度用量事件分页 */
export function listProjectUsageEvents(projectId: number, page = 1, size = 30) {
  return requestJson<PageResponse<AiUsageEventResponse>>(
    withQuery(`/projects/${projectId}/usage/events`, { page, size }),
  )
}
