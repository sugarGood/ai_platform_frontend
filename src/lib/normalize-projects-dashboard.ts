import type { BackendProjectResponse } from '../types/project'

export interface NormalizedDashboardProjectRow {
  project: BackendProjectResponse
  serviceCount: number
  memberCount: number
  members: string[]
  memberAvatarUrls: string[]
  skillCount: number
  toolCount: number
  knowledgeCount: number
}

function readFiniteInt(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.trunc(raw)
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw)
    if (Number.isFinite(n)) return Math.trunc(n)
  }
  return null
}

/** 从多个对象中按候选 key 顺序取第一个非负整数 */
function readNumFromSources(sources: Record<string, unknown>[], keys: string[]): number {
  for (const src of sources) {
    for (const k of keys) {
      const n = readFiniteInt(src[k])
      if (n != null && n >= 0) return n
    }
  }
  return 0
}

/** 从多个对象中取第一个数组字段的长度 */
function readArrayLenFromSources(sources: Record<string, unknown>[], keys: string[]): number {
  for (const src of sources) {
    for (const k of keys) {
      const v = src[k]
      if (Array.isArray(v)) return v.length
    }
  }
  return 0
}

function extractRows(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  if (raw !== null && typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    const nested = o.projects ?? o.data ?? o.content ?? o.records ?? o.items ?? o.list ?? o.rows
    if (Array.isArray(nested)) return nested
    // `{ data: { content: [] } }` / Spring Page 嵌在 data 里
    if (nested !== null && typeof nested === 'object' && !Array.isArray(nested)) {
      const inner = nested as Record<string, unknown>
      const innerArr =
        inner.content ?? inner.data ?? inner.records ?? inner.items ?? inner.list ?? inner.rows
      if (Array.isArray(innerArr)) return innerArr
    }
  }
  return []
}

function isLikelyProjectId(raw: unknown): boolean {
  return typeof raw === 'number' || (typeof raw === 'string' && /^\d+$/.test(raw))
}

function coerceBackendProject(obj: object): BackendProjectResponse | null {
  const rec = obj as Record<string, unknown>
  if (!isLikelyProjectId(rec.id)) return null
  const id = typeof rec.id === 'number' ? rec.id : Number(rec.id)
  return { ...rec, id } as BackendProjectResponse
}

function pickProject(rec: Record<string, unknown>): BackendProjectResponse | null {
  const inner = rec.project
  if (inner && typeof inner === 'object' && inner !== null) {
    const p = coerceBackendProject(inner)
    if (p) return p
  }
  return coerceBackendProject(rec)
}

const NESTED_METRIC_KEYS = [
  'statistics',
  'stats',
  'metrics',
  'summary',
  'counts',
  'overview',
  'aggregate',
  'aggregates',
  'capabilities',
  'capability',
  'aiStats',
  'ai',
  'aiCapability',
  'aiCapabilities',
  'token',
  'tokenStats',
  'usage',
  'dashboard',
  'detail',
  'info',
  'extra',
  'result',
  'workspace',
  'snapshot',
] as const

function collectMetricSources(rec: Record<string, unknown>): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [rec]
  for (const key of NESTED_METRIC_KEYS) {
    const v = rec[key]
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      out.push(v as Record<string, unknown>)
    }
  }
  const proj = rec.project
  if (proj !== null && typeof proj === 'object' && !Array.isArray(proj)) {
    out.push(proj as Record<string, unknown>)
  }
  return out
}

function parseMemberAvatarUrls(sources: Record<string, unknown>[]): string[] {
  const keys = ['memberAvatars', 'avatarUrls', 'memberAvatarUrls', 'avatars']
  for (const src of sources) {
    for (const k of keys) {
      const v = src[k]
      if (Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === 'string')) {
        return (v as string[]).slice(0, 6)
      }
    }
  }
  return []
}

function parseMembers(sources: Record<string, unknown>[]): string[] {
  const keys = ['members', 'memberSummaries', 'memberLabels', 'memberPreview', 'memberList', 'memberDetails']
  let m: unknown
  outer: for (const src of sources) {
    for (const k of keys) {
      const v = src[k]
      if (Array.isArray(v)) {
        m = v
        break outer
      }
    }
  }
  if (!Array.isArray(m)) return []

  const out: string[] = []
  for (const item of m) {
    if (typeof item === 'string') {
      out.push(item)
      continue
    }
    if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>
      const nameRaw = o.displayName ?? o.fullName ?? o.username ?? o.name ?? o.userId ?? o.nickName
      const name = nameRaw != null && String(nameRaw).trim() !== '' ? String(nameRaw) : '成员'
      const role = o.role != null && String(o.role).trim() !== '' ? String(o.role) : '—'
      out.push(`${name}（${role}）`)
    }
  }
  return out.slice(0, 12)
}

/** 把散落在 stats / project 上的 Token 字段合并进 project，供 `formatProjectListTokenLabel` 使用（优先保留 project 上已有值） */
function mergeTokenFieldsOntoProject(
  project: BackendProjectResponse,
  sources: Record<string, unknown>[],
): BackendProjectResponse {
  let merged: BackendProjectResponse = { ...project }
  const usedKeys = [
    'usedTokensThisMonth',
    'used_tokens_this_month',
    'tokenUsedThisMonth',
    'usedTokenCount',
    'usedTokens',
    'used',
  ]
  const quotaKeys = [
    'monthlyTokenQuota',
    'monthly_token_quota',
    'monthlyTokensQuota',
    'tokenQuota',
    'monthlyQuota',
    'limit',
  ]

  for (const src of sources) {
    if (merged.usedTokensThisMonth == null) {
      for (const k of usedKeys) {
        const n = readFiniteInt(src[k])
        if (n != null && n >= 0) {
          merged = { ...merged, usedTokensThisMonth: n }
          break
        }
      }
    }
    if (merged.monthlyTokenQuota == null) {
      for (const k of quotaKeys) {
        const n = readFiniteInt(src[k])
        if (n != null && n >= 0) {
          merged = { ...merged, monthlyTokenQuota: n }
          break
        }
      }
    }
  }
  return merged
}

/**
 * 将 `GET /projects/dashboard` 的 JSON（已 unwrap 信封）解析为列表行。
 * 兼容：分页、嵌套 stats/metrics、数组长度计数字段、字符串 id。
 */
export function normalizeProjectsDashboard(raw: unknown): NormalizedDashboardProjectRow[] {
  const rows = extractRows(raw)
  const out: NormalizedDashboardProjectRow[] = []
  for (const row of rows) {
    if (row === null || typeof row !== 'object') continue
    const rec = row as Record<string, unknown>
    const baseProject = pickProject(rec)
    if (!baseProject) continue

    const sources = collectMetricSources(rec)

    const fromNum = (keys: string[]) => readNumFromSources(sources, keys)
    const fromLen = (keys: string[]) => readArrayLenFromSources(sources, keys)

    let serviceCount = fromNum([
      'serviceCount',
      'servicesCount',
      'service_count',
      'codeServiceCount',
      'projectServiceCount',
      'servicesTotal',
      'serviceTotal',
    ])
    if (serviceCount === 0) {
      serviceCount = fromLen(['services', 'serviceList', 'projectServices', 'codeServices'])
    }

    let memberCountVal = fromNum(['memberCount', 'membersCount', 'member_count', 'memberTotal', 'userCount'])
    if (memberCountVal === 0) {
      memberCountVal = fromLen(['members', 'memberList', 'memberDetails', 'users', 'projectMembers'])
    }

    let skillCount = fromNum(['skillCount', 'skillsCount', 'skill_count', 'skillsTotal', 'skills'])
    if (skillCount === 0) {
      skillCount = fromLen(['skills', 'projectSkills', 'skillList', 'project_skills'])
    }

    let toolCount = fromNum(['toolCount', 'toolsCount', 'tool_count', 'toolsTotal', 'tools'])
    if (toolCount === 0) {
      toolCount = fromLen(['tools', 'projectTools', 'toolList', 'project_tools'])
    }

    let knowledgeCount = fromNum([
      'knowledgeCount',
      'knowledgeSourceCount',
      'knowledgeBaseCount',
      'kbCount',
      'knowledge_count',
      'kb_count',
      'knowledge_total',
      'knowledge',
      'knowledgeBase',
      'docCount',
    ])
    if (knowledgeCount === 0) {
      knowledgeCount = fromLen([
        'knowledgeBases',
        'knowledgeSources',
        'knowledgeList',
        'kbs',
        'projectKnowledgeSources',
        'knowledge_bases',
      ])
    }

    const members = parseMembers(sources)
    const memberAvatarUrls = parseMemberAvatarUrls(sources)
    const project = mergeTokenFieldsOntoProject(baseProject, sources)

    out.push({
      project,
      serviceCount,
      memberCount: memberCountVal,
      members,
      memberAvatarUrls,
      skillCount,
      toolCount,
      knowledgeCount,
    })
  }
  return out
}
