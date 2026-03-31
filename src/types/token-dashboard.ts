import type { TableCell } from './module-page'

/** 归一化后的 Token Dashboard 视图（兼容后端字段别名） */

export interface ProjectTokenDashboardSummaryView {
  projectUsedTokensThisMonth?: number
  projectQuotaTokens?: number
  projectRemainingTokens?: number
  memberTotalCount?: number
  membersAiEnabledCount?: number
  membersAiDisabledCount?: number
  firingAlertsCount?: number
  monthWarningAlertsCount?: number
  monthCriticalAlertsCount?: number
  personalPoolAtThresholdCount?: number
  dailyDigestModuleAvailable?: boolean
  dailyDigestCount?: number
}

export interface ProjectTokenDashboardConfigView {
  poolQuotaTokens?: number | null
  poolUsedTokens?: number | null
  poolRemainingTokens?: number | null
  alertThresholdPercent?: number | null
  quotaResetCycle?: string | null
  /** 库中为 null 时前端展示按 100K 有效 */
  singleRequestCapTokens?: number | null
  effectiveSingleRequestCapTokens?: number | null
}

export interface TokenDashboardMemberQuotaRowView {
  memberId: number
  userId: number
  displayName: string
  roleLabel: string
  personalPoolLimit: number | null
  personalPoolUsed: number | null
  personalPoolRemaining: number | null
  tokenQuotaLimit: number | null
  tokenQuotaUsed: number | null
  aiEnabled: boolean
}

export interface TokenDashboardUserConsumptionView {
  userId: number
  displayName: string
  monthlyTokens: number
  estimatedDailyTokens: number
}

export interface TokenDashboardActivityRowView {
  occurredAt: string | null
  userId: number | null
  memberLabel: string
  callTypeLabel: string
  totalTokens: number | null
  /** 扣减池标签，无则空数组 */
  poolTags: Array<'project' | 'personal' | 'service'>
  modelLabel: string
  status: string | null
  sourceType: string | null
}

/** `refreshProjectSpaceFromApi` 写入；供配额管理页联调 */
export interface ProjectTokenDashboardBundle {
  loaded: boolean
  loadError?: string
  summary?: ProjectTokenDashboardSummaryView
  config?: ProjectTokenDashboardConfigView
  memberRows: TokenDashboardMemberQuotaRowView[]
  /** 成员配额表（与 memberRows 对应行序一致） */
  quotaTable?: { columns: string[]; rows: TableCell[][] }
  consumption: TokenDashboardUserConsumptionView[]
  activityRows: TokenDashboardActivityRowView[]
  activityTotal: number
  activityPage: number
  activitySize: number
}
