import type { AiUsageEventResponse } from '../types/platform-usage'

import type { PageResponse } from '../lib/api-client'
import { requestJson, withQuery } from '../lib/api-client'

/**
 * OpenAPI：`GET /api/me/usage` — 返回结构在文档中为 loosely typed，按运行时字段读取。
 */
export function fetchMyUsageSummary() {
  return requestJson<Record<string, unknown>>('/me/usage')
}

/** OpenAPI：`GET /api/me/usage/events` */
export function listMyUsageEvents(page = 1, size = 100) {
  return requestJson<PageResponse<AiUsageEventResponse>>(
    withQuery('/me/usage/events', { page, size }),
  )
}
