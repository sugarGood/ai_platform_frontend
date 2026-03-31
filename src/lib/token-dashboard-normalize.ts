import type {
  ProjectTokenDashboardConfigView,
  ProjectTokenDashboardSummaryView,
  TokenDashboardActivityRowView,
  TokenDashboardMemberQuotaRowView,
  TokenDashboardUserConsumptionView,
} from '../types/token-dashboard'

function readNum(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

function readStr(v: unknown): string | undefined {
  if (typeof v === 'string' && v.trim()) return v.trim()
  return undefined
}

function flattenObject(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...input }
  for (const [k, v] of Object.entries(input)) {
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      for (const [k2, v2] of Object.entries(v as Record<string, unknown>)) {
        out[`${k}.${k2}`] = v2
      }
    }
  }
  return out
}

function firstNum(flat: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const n = readNum(flat[key])
    if (n !== undefined) return n
  }
  return undefined
}

function firstBool(flat: Record<string, unknown>, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const v = flat[key]
    if (typeof v === 'boolean') return v
    if (v === 'true' || v === 'false') return v === 'true'
  }
  return undefined
}

export function normalizeTokenDashboardSummary(raw: unknown): ProjectTokenDashboardSummaryView {
  if (!raw || typeof raw !== 'object') return {}
  const flat = flattenObject(raw as Record<string, unknown>)

  const dailyFlat =
    flat.dailyDigest && typeof flat.dailyDigest === 'object'
      ? flattenObject(flat.dailyDigest as Record<string, unknown>)
      : {}

  return {
    projectUsedTokensThisMonth: firstNum(flat, [
      'projectUsedTokensThisMonth',
      'usedTokensThisMonth',
      'poolUsedTokensThisMonth',
      'usedTokens',
    ]),
    projectQuotaTokens: firstNum(flat, ['projectQuotaTokens', 'poolQuotaTokens', 'monthlyTokenQuota', 'quotaTokens']),
    projectRemainingTokens: firstNum(flat, ['projectRemainingTokens', 'poolRemainingTokens', 'remainingTokens']),
    memberTotalCount: firstNum(flat, ['memberTotalCount', 'totalMemberCount', 'memberCount']),
    membersAiEnabledCount: firstNum(flat, [
      'membersAiEnabledCount',
      'aiEnabledMemberCount',
      'membersWithAiEnabled',
    ]),
    membersAiDisabledCount: firstNum(flat, [
      'membersAiDisabledCount',
      'aiDisabledMemberCount',
      'membersWithAiDisabled',
    ]),
    firingAlertsCount: firstNum(flat, ['firingAlertsCount', 'firingAlertCount', 'firingCount']),
    monthWarningAlertsCount: firstNum(flat, [
      'monthWarningAlertsCount',
      'monthlyWarningAlertsCount',
      'warningAlertsCount',
    ]),
    monthCriticalAlertsCount: firstNum(flat, [
      'monthCriticalAlertsCount',
      'monthlyCriticalAlertsCount',
      'criticalAlertsCount',
    ]),
    personalPoolAtThresholdCount: firstNum(flat, [
      'personalPoolAtThresholdCount',
      'personalPoolThresholdMemberCount',
      'membersAtPersonalPoolThreshold',
    ]),
    dailyDigestModuleAvailable: firstBool(
      { ...flat, ...dailyFlat },
      ['dailyDigest.moduleAvailable', 'dailyDigestModuleAvailable', 'moduleAvailable'],
    ),
    dailyDigestCount: firstNum({ ...flat, ...dailyFlat }, ['dailyDigest.itemCount', 'dailyDigestCount', 'itemCount']),
  }
}

export function normalizeTokenDashboardConfig(raw: unknown): ProjectTokenDashboardConfigView {
  if (!raw || typeof raw !== 'object') return {}
  const flat = flattenObject(raw as Record<string, unknown>)
  return {
    poolQuotaTokens: readNum(flat.poolQuotaTokens) ?? readNum(flat.poolQuota) ?? null,
    poolUsedTokens: readNum(flat.poolUsedTokens) ?? readNum(flat.poolUsed) ?? null,
    poolRemainingTokens: readNum(flat.poolRemainingTokens) ?? readNum(flat.poolRemaining) ?? null,
    alertThresholdPercent:
      readNum(flat.alertThresholdPercent) ?? readNum(flat.alertThresholdPct) ?? null,
    quotaResetCycle: readStr(flat.quotaResetCycle) ?? null,
    singleRequestCapTokens:
      readNum(flat.singleRequestCapTokens) ??
      readNum(flat.perRequestTokenLimit) ??
      readNum(flat.singleRequestCap) ??
      null,
    effectiveSingleRequestCapTokens:
      readNum(flat.effectiveSingleRequestCapTokens) ??
      readNum(flat.effectivePerRequestTokenLimit) ??
      null,
  }
}

function asObjectArray(raw: unknown): Record<string, unknown>[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((x) => x !== null && typeof x === 'object') as Record<string, unknown>[]
}

export function normalizeTokenDashboardMemberQuotaRows(raw: unknown): TokenDashboardMemberQuotaRowView[] {
  const arr = Array.isArray(raw) ? raw : (raw as { data?: unknown })?.data
  return asObjectArray(arr).map((o) => {
    const flat = flattenObject(o)
    const memberId = firstNum(flat, ['memberId', 'projectMemberId', 'id']) ?? 0
    const userId = firstNum(flat, ['userId']) ?? 0
    const displayName =
      readStr(flat.displayName) ??
      readStr(flat.userName) ??
      readStr(flat.name) ??
      (userId ? `用户 #${userId}` : '—')
    const roleLabel = readStr(flat.role) ?? readStr(flat.roleLabel) ?? readStr(flat.memberRole) ?? '—'
    const aiEnabled =
      firstBool(flat, ['aiEnabled', 'aiAccessEnabled', 'credentialActive']) ??
      (() => {
        const s = readStr(flat.credentialStatus)?.toUpperCase()
        if (s === 'ACTIVE') return true
        if (s === 'DISABLED' || s === 'REVOKED') return false
        return true
      })()

    return {
      memberId,
      userId,
      displayName,
      roleLabel,
      personalPoolLimit: firstNum(flat, ['personalPoolLimit', 'personalQuotaLimit']) ?? null,
      personalPoolUsed: firstNum(flat, ['personalPoolUsed', 'personalUsedAmount']) ?? null,
      personalPoolRemaining: firstNum(flat, ['personalPoolRemaining', 'personalRemaining']) ?? null,
      tokenQuotaLimit: firstNum(flat, ['tokenQuotaLimit', 'tokenQuota', 'quotaLimit']) ?? null,
      tokenQuotaUsed: firstNum(flat, ['tokenQuotaUsed', 'usedAmount', 'tokenUsed']) ?? null,
      aiEnabled: Boolean(aiEnabled),
    }
  })
}

export function normalizeTokenDashboardConsumptionByUser(raw: unknown): TokenDashboardUserConsumptionView[] {
  const arr = Array.isArray(raw) ? raw : (raw as { data?: unknown })?.data
  return asObjectArray(arr).map((o) => {
    const flat = flattenObject(o)
    const userId = firstNum(flat, ['userId']) ?? 0
    const displayName =
      readStr(flat.displayName) ?? readStr(flat.userName) ?? readStr(flat.name) ?? `用户 #${userId}`
    const monthlyTokens = firstNum(flat, ['monthlyTokens', 'tokensThisMonth', 'totalTokens']) ?? 0
    const estimatedDailyTokens =
      firstNum(flat, ['estimatedDailyTokens', 'avgDailyTokens', 'dailyTokensEstimate']) ?? 0
    return { userId, displayName, monthlyTokens, estimatedDailyTokens }
  })
}

function parsePoolTags(v: unknown): Array<'project' | 'personal' | 'service'> {
  if (!Array.isArray(v)) return []
  const out: Array<'project' | 'personal' | 'service'> = []
  for (const x of v) {
    const s = String(x).toUpperCase()
    if (s.includes('PROJECT') || s.includes('项目')) out.push('project')
    else if (s.includes('PERSONAL') || s.includes('个人')) out.push('personal')
    else if (s.includes('SERVICE') || s.includes('服务')) out.push('service')
  }
  return out.length ? out : []
}

export function normalizeTokenDashboardActivityRow(o: Record<string, unknown>): TokenDashboardActivityRowView {
  const flat = flattenObject(o)
  const occurredAt = readStr(flat.occurredAt) ?? readStr(flat.createdAt) ?? null
  const userId = firstNum(flat, ['userId']) ?? null
  const memberLabel =
    readStr(flat.memberLabel) ??
    readStr(flat.displayName) ??
    readStr(flat.userName) ??
    (userId != null ? `用户 #${userId}` : '—')
  const callTypeLabel =
    readStr(flat.callTypeLabel) ??
    readStr(flat.callType) ??
    readStr(flat.sourceType) ??
    (flat.skillId != null ? `Skill #${flat.skillId}` : '—')
  const totalTokens = readNum(flat.totalTokens) ?? null
  let poolTags = parsePoolTags(flat.deductionPools)
  if (!poolTags.length) poolTags = parsePoolTags(flat.poolTags)
  if (!poolTags.length) poolTags = parsePoolTags(flat.pools)
  const modelLabel =
    readStr(flat.modelName) ??
    (flat.modelId != null ? `模型 #${flat.modelId}` : undefined) ??
    '—'
  return {
    occurredAt,
    userId,
    memberLabel,
    callTypeLabel,
    totalTokens,
    poolTags: poolTags.length > 0 ? poolTags : ['project'],
    modelLabel,
    status: readStr(flat.status) ?? null,
    sourceType: readStr(flat.sourceType) ?? null,
  }
}

export function normalizeTokenDashboardActivityPage(raw: unknown): {
  rows: TokenDashboardActivityRowView[]
  total: number
  page: number
  size: number
} {
  if (!raw || typeof raw !== 'object') {
    return { rows: [], total: 0, page: 1, size: 20 }
  }
  const o = raw as Record<string, unknown>
  const data = (o.data ?? o.content ?? o.records ?? o.list) as unknown
  const list = asObjectArray(Array.isArray(data) ? data : [])
  const rows = list.map((x) => normalizeTokenDashboardActivityRow(x))
  const total = readNum(o.total) ?? readNum(o.totalElements) ?? rows.length
  const page = readNum(o.page) ?? readNum(o.current) ?? 1
  const size = readNum(o.size) ?? readNum(o.pageSize) ?? 20
  return {
    rows,
    total: total ?? 0,
    page: page ?? 1,
    size: size ?? 20,
  }
}

/** UI 下拉值 → PUT 项目 overQuotaStrategy（可按后端约定调整） */
export function mapUiOverQuotaToApi(ui: string): string {
  const m: Record<string, string> = {
    throttle: 'THROTTLE',
    hard: 'BLOCK',
    auto20: 'AUTO_EXPAND_PCT_20',
    notify: 'NOTIFY_ADMIN',
  }
  return m[ui] ?? ui
}

/** 后端策略 → UI 下拉 */
export function mapApiOverQuotaToUi(api: string | null | undefined): string {
  if (!api) return 'throttle'
  const u = api.toUpperCase().trim()
  const rev: Record<string, string> = {
    THROTTLE: 'throttle',
    RATE_LIMIT: 'throttle',
    BLOCK: 'hard',
    HARD_LIMIT: 'hard',
    AUTO_EXPAND_PCT_20: 'auto20',
    AUTO_EXPAND_20: 'auto20',
    NOTIFY_ADMIN: 'notify',
  }
  return rev[u] ?? 'throttle'
}
