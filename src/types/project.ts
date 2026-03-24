import type { ActivityEvent, Incident } from './dashboard'

export type ProjectStatusTone = 'success' | 'warning'

/** Aligns with backend `CreateProjectRequest.projectType` (PRODUCT | PLATFORM | DATA | OTHER). */
export type BackendProjectType = 'PRODUCT' | 'PLATFORM' | 'DATA' | 'OTHER'

export interface ProjectSummary {
  id: string
  name: string
  icon: string
  typeLabel: string
  /** 后端项目编码，用于列表检索 */
  code?: string
  /** 后端 projectType 枚举，用于类型筛选 */
  projectType?: BackendProjectType
  description: string
  statusLabel: string
  statusTone: ProjectStatusTone
  /** 列表/卡片展示的 AI 能力概要，如「5/6 · 58%」 */
  aiCapabilityLabel: string
  tokenLabel: string
  serviceCount: number
  memberCount: number
  members: string[]
}

export interface ProjectServiceHealth {
  id: string
  name: string
  techStack: string
  statusLabel: string
  statusTone: 'success' | 'primary' | 'warning'
  deployMeta: string
}

export interface ProjectDetail extends ProjectSummary {
  incidentsSummary: string
  monthlyTokenDelta: string
  aiReadyCount: string
  aiReadyDelta: string
  aiSummary: string
  services: ProjectServiceHealth[]
  activities: ActivityEvent[]
  incidents: Incident[]
}

/**
 * 与后端项目详情 / 列表项结构对齐。
 * Jackson serializes LocalDateTime as ISO-8601 strings.
 */
export interface BackendProjectResponse {
  id: number
  name: string
  code: string
  description: string | null
  icon: string | null
  projectType: string
  createdBy: number | null
  ownerUserId: number | null
  /** 0 = 不限制；详情接口可能返回 */
  monthlyTokenQuota?: number | null
  alertThresholdPct?: number | null
  overQuotaStrategy?: string | null
  usedTokensThisMonth?: number | null
  status: string
  createdAt: string | null
  updatedAt: string | null
}

export interface BackendProjectMemberResponse {
  id: number
  projectId: number
  userId: number
  role: string
  joinedAt: string | null
}

/** Aligns with backend `ServiceResponse`. */
export interface BackendProjectServiceResponse {
  id: number
  projectId: number
  name: string
  description: string | null
  gitRepoUrl: string | null
  mainBranch: string | null
  framework: string | null
  language: string | null
  status: string
  createdAt: string | null
}

export interface CreateBackendProjectPayload {
  name: string
  code: string
  description?: string | null
  icon?: string | null
  projectType: BackendProjectType
  ownerUserId?: number | null
  /** 项目月度 Token 池；0=不限制；不传则按类型默认 */
  monthlyTokenQuota?: number | null
  alertThresholdPct?: number | null
  overQuotaStrategy?: string | null
}

/** 对齐后端 `UpdateProjectRequest`：仅非 null 字段会更新 */
export interface UpdateBackendProjectPayload {
  name?: string | null
  description?: string | null
  icon?: string | null
  ownerUserId?: number | null
  monthlyTokenQuota?: number | null
  alertThresholdPct?: number | null
  overQuotaStrategy?: string | null
}
