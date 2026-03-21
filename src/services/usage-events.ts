import type { AiUsageEventResponse, PageResponse } from '../types/platform-usage'

import { requestJson, withQuery } from '../lib/api-client'

export function listUsageEvents(params: {
  userId?: number
  projectId?: number
  page?: number
  size?: number
}) {
  return requestJson<PageResponse<AiUsageEventResponse>>(
    withQuery('/usage-events', {
      userId: params.userId,
      projectId: params.projectId,
      page: params.page ?? 1,
      size: params.size ?? 20,
    }),
  )
}
