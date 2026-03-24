import type { PageResponseActivityLog } from '../types/activity-log'
import { requestJson, withQuery } from '../lib/api-client'

/** `GET /api/admin/audit-logs` — 平台审计日志（管理员） */
export function listAdminAuditLogs(params: {
  userId?: number
  actionType?: string
  page?: number
  size?: number
}) {
  return requestJson<PageResponseActivityLog>(
    withQuery('/admin/audit-logs', {
      userId: params.userId,
      actionType: params.actionType || undefined,
      page: params.page ?? 1,
      size: params.size ?? 20,
    }),
  )
}
