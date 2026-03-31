import type { ActivityEvent, Incident } from './dashboard'

export type ProjectStatusTone = 'success' | 'warning'

/** Aligns with backend `CreateProjectRequest.projectType` (PRODUCT | PLATFORM | DATA | OTHER). */
export type BackendProjectType = 'PRODUCT' | 'PLATFORM' | 'DATA' | 'OTHER'

/** 项目列表卡片：技能 / 工具 / 知识库等数量（来自各项目明细接口） */
export interface ProjectAiCapabilityCount {
  label: string
  count: number
}

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
  /** 列表/表格用一行摘要，如「技能 3 · 工具 2 · 知识库 1」 */
  aiCapabilityLabel: string
  /** 卡片分项展示 */
  aiCapabilityItems: ProjectAiCapabilityCount[]
  /**
   * 数字 ID 项目在拉齐成员/服务/技能/工具/知识库前为 false，避免误展示占位 0。
   * 本地 mock 或非数字 ID 可为 true。
   */
  listMetricsLoaded?: boolean
  tokenLabel: string
  serviceCount: number
  memberCount: number
  members: string[]
  /** 成员头像 URL 列表（来自 /projects/dashboard 的 memberAvatars 字段） */
  memberAvatarUrls?: string[]
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
  /** Token Dashboard / 配额：任务周期，如 MONTHLY */
  quotaResetCycle?: string | null
  /** 单次请求 Token 上限；与 dashboard /config 对齐 */
  perRequestTokenLimit?: number | null
  usedTokensThisMonth?: number | null
  status: string
  createdAt: string | null
  updatedAt: string | null
}

/** 对齐 OpenAPI `ProjectMemberResponse`（GET/POST `/api/projects/{projectId}/members`） */
export interface BackendProjectMemberResponse {
  id: number
  projectId: number
  userId: number
  role: string
  joinedAt: string | null
  /** NONE / VALID / EXPIRING_SOON / EXPIRED / REVOKED / DISABLED */
  credentialStatus?: string | null
  credentialExpiresInDays?: number | null
  credentialExpiresAt?: string | null
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
  quotaResetCycle?: string | null
  perRequestTokenLimit?: number | null
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
  quotaResetCycle?: string | null
  perRequestTokenLimit?: number | null
}
