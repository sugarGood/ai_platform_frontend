/** 对齐 `_api_docs.json` — `ActivityLog` */
export interface ActivityLog {
  id: number
  projectId?: number | null
  userId?: number | null
  actorName?: string | null
  actionType?: string | null
  summary?: string | null
  targetType?: string | null
  targetId?: number | null
  targetName?: string | null
  occurredAt?: string | null
  createdAt?: string | null
}

export interface PageResponseActivityLog {
  data: ActivityLog[]
  total: number
  page: number
  size: number
}
