/**
 * `GET /api/projects/{projectId}/usage/summary` 在 OpenAPI 中为宽松 object，
 * 此处做常见字段名的归一化，便于配额页展示。
 */
export interface ProjectUsageSummaryView {
  usedTokens?: number
  quotaTokens?: number
  percentUsed?: number
  activeMembers?: number
  overQuotaMembers?: number
  resetHint?: string
}

function readNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

/** 拍平一层嵌套对象，键为 `a.b` */
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
    const n = readNumber(flat[key])
    if (n !== undefined) return n
  }
  return undefined
}

function firstStr(flat: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = flat[key]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return undefined
}

export function normalizeProjectUsageSummary(raw: Record<string, unknown> | null | undefined): ProjectUsageSummaryView {
  if (!raw || typeof raw !== 'object') return {}
  const flat = flattenObject(raw)

  const usedTokens = firstNum(flat, [
    'usedTokensThisMonth',
    'usedTokens',
    'monthUsedTokens',
    'totalTokensUsed',
    'projectUsedTokens',
    'tokensUsed',
    'summary.usedTokensThisMonth',
    'summary.usedTokens',
  ])

  const quotaTokens = firstNum(flat, [
    'monthlyTokenQuota',
    'tokenQuota',
    'quotaTokens',
    'monthlyQuota',
    'projectQuota',
    'summary.monthlyTokenQuota',
    'summary.quotaTokens',
  ])

  let percentUsed = firstNum(flat, ['percentUsed', 'usagePercent', 'usedPercent', 'summary.percentUsed'])
  if (percentUsed === undefined && usedTokens !== undefined && quotaTokens !== undefined && quotaTokens > 0) {
    percentUsed = Math.min(100, Math.round((usedTokens / quotaTokens) * 100))
  }

  const activeMembers = firstNum(flat, ['activeMembers', 'activeMemberCount', 'membersWithUsage', 'summary.activeMembers'])

  const overQuotaMembers = firstNum(flat, [
    'overQuotaMemberCount',
    'overQuotaMembers',
    'exceededMembers',
    'summary.overQuotaMemberCount',
  ])

  const resetHint = firstStr(flat, [
    'resetHint',
    'nextResetDescription',
    'billingCycleHint',
    'resetDayDescription',
    'summary.resetHint',
  ])

  return {
    usedTokens,
    quotaTokens,
    percentUsed,
    activeMembers,
    overQuotaMembers,
    resetHint,
  }
}
