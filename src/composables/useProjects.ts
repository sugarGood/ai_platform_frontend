import { ref, reactive } from 'vue'

import type { ListItem, PageMetric, ProjectInheritedGlobalKbItem, TableCell } from '../types/module-page'
import type {
  BackendProjectResponse,
  BackendProjectServiceResponse,
  BackendProjectType,
  CreateBackendProjectPayload,
  ProjectDetail,
  ProjectSummary,
  ProjectServiceHealth,
} from '../types/project'
import type { ProjectIncidentResponse } from '../types/incident'
import type {
  ProjectTokenDashboardBundle,
  TokenDashboardMemberQuotaRowView,
} from '../types/token-dashboard'

import { normalizeProjectsDashboard } from '../lib/normalize-projects-dashboard'
import { formatMemberDateDay, memberCredentialStatusCell } from '../lib/project-member-display'
import {
  normalizeTokenDashboardActivityPage,
  normalizeTokenDashboardConfig,
  normalizeTokenDashboardConsumptionByUser,
  normalizeTokenDashboardMemberQuotaRows,
  normalizeTokenDashboardSummary,
} from '../lib/token-dashboard-normalize'
import { listProjectKnowledgeSources } from '../services/knowledge'
import { listMemberQuotasByProject } from '../services/member-quotas'
import { listProjectIncidents } from '../services/project-incidents'
import { listProjectUsageEvents, getProjectUsageSummary } from '../services/project-usage'
import {
  getTokenDashboardConfig,
  getTokenDashboardConsumptionByUser,
  getTokenDashboardMemberQuotaRows,
  getTokenDashboardSummary,
  listTokenDashboardActivity,
} from '../services/project-token-dashboard'
import {
  createProject as createProjectApi,
  getProject,
  getProjectsDashboard,
  listProjectMembers,
  listProjectServices,
} from '../services/projects'
import { listProjectSkills, listSkills } from '../services/skills'
import { listProjectTools, listTools } from '../services/tools'
import { listUsers } from '../services/users'
import { projectSummaries as mockProjectSummaries, getProjectById as getMockProjectById } from '../mocks/projects'

// -------------------------
// Labels & options (for UI + overlay)
// -------------------------

export const projectTypeLabelMap: Record<BackendProjectType, string> = {
  PRODUCT: '产品项目',
  PLATFORM: '平台能力',
  DATA: '数据项目',
  OTHER: '其他',
}

export const projectTypeOptions: Array<{ value: BackendProjectType; label: string; hint: string }> = [
  { value: 'PRODUCT', label: '产品项目', hint: '对齐后端 PRODUCT。' },
  { value: 'PLATFORM', label: '平台能力', hint: '对齐后端 PLATFORM。' },
  { value: 'DATA', label: '数据项目', hint: '对齐后端 DATA。' },
  { value: 'OTHER', label: '其他', hint: '对齐后端 OTHER。' },
]

const projectSummaries = ref<ProjectSummary[]>([])

const projectState = reactive({
  loading: false,
  error: '',
  loadedFromApi: false,
})

const projectDetailCache = new Map<string, ProjectDetail>()

const projectMemberTableRowsCache = new Map<string, TableCell[][]>()

export function getProjectMemberTableRows(projectId: string): TableCell[][] | undefined {
  return projectMemberTableRowsCache.get(projectId)
}

const projectKnowledgeTableRowsCache = new Map<string, TableCell[][]>()

export function getProjectKnowledgeTableRows(projectId: string): TableCell[][] | undefined {
  return projectKnowledgeTableRowsCache.get(projectId)
}

const projectInheritedGlobalKbsCache = new Map<string, ProjectInheritedGlobalKbItem[]>()

export function getProjectInheritedGlobalKbs(projectId: string): ProjectInheritedGlobalKbItem[] | undefined {
  return projectInheritedGlobalKbsCache.get(projectId)
}

const projectSkillTableRowsCache = new Map<string, TableCell[][]>()

export function getProjectSkillTableRows(projectId: string): TableCell[][] | undefined {
  return projectSkillTableRowsCache.get(projectId)
}

const projectToolTableRowsCache = new Map<string, TableCell[][]>()

export function getProjectToolTableRows(projectId: string): TableCell[][] | undefined {
  return projectToolTableRowsCache.get(projectId)
}

const projectApiSnapshotCache = new Map<string, BackendProjectResponse>()

export function getProjectApiSnapshot(projectId: string): BackendProjectResponse | undefined {
  return projectApiSnapshotCache.get(projectId)
}

const projectQuotaTableRowsCache = new Map<string, TableCell[][]>()

export function getProjectQuotaTableRows(projectId: string): TableCell[][] | undefined {
  return projectQuotaTableRowsCache.get(projectId)
}

/** `GET /projects/{id}/usage/summary` 原始 JSON，供配额页归一化展示 */
const projectUsageSummaryCache = new Map<string, Record<string, unknown>>()

export function getProjectUsageSummaryRaw(projectId: string): Record<string, unknown> | undefined {
  return projectUsageSummaryCache.get(projectId)
}

/** `GET /projects/{id}/incidents` 列表 */
const projectIncidentsCache = new Map<string, ProjectIncidentResponse[]>()

export function getProjectIncidentsList(projectId: string): ProjectIncidentResponse[] | undefined {
  return projectIncidentsCache.get(projectId)
}

const projectKeyMetricsCache = new Map<string, PageMetric[]>()

export function getProjectKeyMetrics(projectId: string): PageMetric[] | undefined {
  return projectKeyMetricsCache.get(projectId)
}

const projectUsageActivityCache = new Map<string, ListItem[]>()

export function getProjectUsageActivity(projectId: string): ListItem[] | undefined {
  return projectUsageActivityCache.get(projectId)
}

const projectUsageTopCache = new Map<string, ListItem[]>()

export function getProjectUsageTop(projectId: string): ListItem[] | undefined {
  return projectUsageTopCache.get(projectId)
}

const projectTokenDashboardBundleCache = new Map<string, ProjectTokenDashboardBundle>()

export function getProjectTokenDashboardBundle(projectId: string): ProjectTokenDashboardBundle | undefined {
  return projectTokenDashboardBundleCache.get(projectId)
}

/** 配额页依赖此 tick 触发重算（Map 缓存非响应式） */
export const tokenDashboardRevision = ref(0)

export const projectSpaceState = reactive({
  loadingProjectId: '',
  error: '',
})

function isBackendNumericProjectId(projectId: string) {
  return /^\d+$/.test(projectId)
}

function truncateText(text: string, max: number) {
  if (text.length <= max) return text
  return `${text.slice(0, max)}…`
}

function formatMemberJoinedAt(iso: string | null): string {
  return formatMemberDateDay(iso)
}

function formatIsoDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return iso.length >= 19 ? iso.slice(0, 19).replace('T', ' ') : iso
}

function formatTokensShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatProjectListTokenLabel(api: BackendProjectResponse): string {
  const usedRaw = api.usedTokensThisMonth
  const quotaRaw = api.monthlyTokenQuota
  const used = usedRaw != null && Number.isFinite(Number(usedRaw)) ? Number(usedRaw) : null
  const quota = quotaRaw != null && Number.isFinite(Number(quotaRaw)) ? Number(quotaRaw) : null
  if (used != null && used >= 0) {
    if (quota != null && quota > 0) {
      return `${formatTokensShort(used)} / ${formatTokensShort(quota)}`
    }
    return formatTokensShort(used)
  }
  return '—'
}

function buildAiCapabilityItems(
  skillCount: number,
  toolCount: number,
  knowledgeCount: number,
): ProjectSummary['aiCapabilityItems'] {
  return [
    { label: '技能', count: skillCount },
    { label: '工具', count: toolCount },
    { label: '知识库', count: knowledgeCount },
  ]
}

function labelFromAiCapabilityItems(items: ProjectSummary['aiCapabilityItems']): string {
  return items.map((x) => `${x.label} ${x.count}`).join(' · ')
}

function buildDashboardQuotaTable(
  rows: TokenDashboardMemberQuotaRowView[],
  fmt: (n: number) => string,
): { columns: string[]; rows: TableCell[][] } {
  const columns = ['成员', '角色', '个人池', 'TOKEN_QUOTA', 'AI', '操作']
  const f = (n: number | null | undefined) => (n != null && Number.isFinite(n) ? fmt(n) : '—')
  return {
    columns,
    rows: rows.map((r) => {
      const poolEmpty =
        r.personalPoolUsed == null && r.personalPoolRemaining == null && r.personalPoolLimit == null
      const pool = poolEmpty
        ? '—'
        : `用 ${f(r.personalPoolUsed)} · 余 ${f(r.personalPoolRemaining)} · 额 ${f(r.personalPoolLimit)}`
      const tq = `${f(r.tokenQuotaUsed)} / ${f(r.tokenQuotaLimit)}`
      return [
        { text: r.displayName },
        { text: r.roleLabel, display: 'tag', tone: 'muted' },
        { text: pool },
        { text: tq, mono: true },
        {
          text: r.aiEnabled ? '● 可用' : '○ 关闭',
          display: 'tag',
          tone: r.aiEnabled ? 'success' : 'muted',
        },
        { text: 'AI 开关' },
      ]
    }),
  }
}

function resolveTypeLabel(projectType: string) {
  return projectTypeLabelMap[projectType as BackendProjectType] ?? projectType
}

function serviceStatusTone(status: string): ProjectServiceHealth['statusTone'] {
  const s = status.toUpperCase()
  if (s === 'ACTIVE' || s === 'RUNNING' || s === 'HEALTHY' || s === 'ONLINE') return 'success'
  if (s === 'WARNING' || s === 'DEGRADED' || s === 'BUILDING') return 'warning'
  return 'primary'
}

function mapBackendService(s: BackendProjectServiceResponse): ProjectServiceHealth {
  const stack = [s.framework, s.language].filter(Boolean).join(' · ') || '—'
  let deployMeta = '—'
  if (s.gitRepoUrl) deployMeta = `仓库：${s.gitRepoUrl}`
  else if (s.mainBranch) deployMeta = `分支：${s.mainBranch}`

  return {
    id: String(s.id),
    name: s.name,
    techStack: stack,
    statusLabel: s.status,
    statusTone: serviceStatusTone(s.status),
    deployMeta,
  }
}

function toProjectSummary(api: BackendProjectResponse, tokenLabel?: string): ProjectSummary {
  const tone: ProjectSummary['statusTone'] = api.status === 'ACTIVE' ? 'success' : 'warning'
  const pt = api.projectType?.toUpperCase() as BackendProjectType
  const projectType = (['PRODUCT', 'PLATFORM', 'DATA', 'OTHER'] as const).includes(pt) ? pt : undefined
  const idStr = String(api.id)
  const emptyAi = buildAiCapabilityItems(0, 0, 0)
  return {
    id: idStr,
    name: api.name,
    icon: api.icon?.trim() || '📁',
    typeLabel: resolveTypeLabel(api.projectType),
    code: api.code?.trim() || undefined,
    projectType,
    description: api.description?.trim() || '',
    statusLabel: api.status,
    statusTone: tone,
    aiCapabilityLabel: labelFromAiCapabilityItems(emptyAi),
    aiCapabilityItems: emptyAi,
    listMetricsLoaded: !isBackendNumericProjectId(idStr),
    tokenLabel: tokenLabel ?? formatProjectListTokenLabel(api),
    serviceCount: 0,
    memberCount: 0,
    members: [],
  }
}

function toProjectDetail(summary: ProjectSummary): ProjectDetail {
  return {
    ...summary,
    incidentsSummary: '无事故',
    monthlyTokenDelta: '0',
    aiReadyCount: '-- / --',
    aiReadyDelta: '暂无数据',
    aiSummary: '暂无 AI 摘要，数据加载后将自动生成。',
    services: [],
    activities: [],
    incidents: [],
  }
}

function cacheDetail(detail: ProjectDetail | undefined) {
  if (!detail) return
  projectDetailCache.set(detail.id, detail)
}

function clearProjectSpaceCachesForProject(projectId: string) {
  projectMemberTableRowsCache.delete(projectId)
  projectKnowledgeTableRowsCache.delete(projectId)
  projectSkillTableRowsCache.delete(projectId)
  projectToolTableRowsCache.delete(projectId)
  projectApiSnapshotCache.delete(projectId)
  projectQuotaTableRowsCache.delete(projectId)
  projectKeyMetricsCache.delete(projectId)
  projectUsageActivityCache.delete(projectId)
  projectUsageTopCache.delete(projectId)
  projectUsageSummaryCache.delete(projectId)
  projectIncidentsCache.delete(projectId)
  projectTokenDashboardBundleCache.delete(projectId)
  projectInheritedGlobalKbsCache.delete(projectId)
}

/** 项目档案 + 成员 + 服务（进入项目或切换项目时调用，与子菜单无关） */
export async function refreshProjectCoreFromApi(projectId: string) {
  projectSpaceState.error = ''
  if (!isBackendNumericProjectId(projectId)) return

  projectSpaceState.loadingProjectId = projectId
  try {
    const pid = Number(projectId)
    const [proj, members, services] = await Promise.all([
      getProject(pid),
      listProjectMembers(pid),
      listProjectServices(pid),
    ])

    let users: Awaited<ReturnType<typeof listUsers>> = []
    try {
      users = await listUsers()
    } catch {
      // 成员展示退化为 userId
    }

    const userLabel = (uid: number) => {
      const u = users.find((x) => x.id === uid)
      return (u?.fullName?.trim() || u?.username || `用户 #${uid}`) as string
    }

    const prevSummary = projectSummaries.value.find((p) => p.id === projectId)
    const summary = toProjectSummary(proj)
    summary.serviceCount = services.length
    summary.memberCount = members.length
    summary.members = members.map((m) => `${userLabel(m.userId)}（${m.role}）`).slice(0, 12)
    summary.tokenLabel = formatProjectListTokenLabel(proj)
    if (prevSummary?.listMetricsLoaded) {
      summary.aiCapabilityItems = prevSummary.aiCapabilityItems
      summary.aiCapabilityLabel = prevSummary.aiCapabilityLabel
      summary.listMetricsLoaded = prevSummary.listMetricsLoaded
    }

    const detail: ProjectDetail = {
      ...summary,
      incidentsSummary: '无事故',
      monthlyTokenDelta: '0',
      aiReadyCount: '-- / --',
      aiReadyDelta: '暂无数据',
      aiSummary: '暂无 AI 摘要，数据加载后将自动生成。',
      services: services.map(mapBackendService),
      activities: [],
      incidents: [],
    }

    cacheDetail(detail)

    const idx = projectSummaries.value.findIndex((p) => p.id === projectId)
    if (idx >= 0) projectSummaries.value[idx] = { ...summary }

    projectMemberTableRowsCache.set(
      projectId,
      members.map((m) => {
        const st = memberCredentialStatusCell(m)
        return [
          { text: userLabel(m.userId) },
          { text: String(m.userId), mono: true },
          { text: m.role },
          { text: st.text, tone: st.tone, display: st.display },
          { text: formatMemberJoinedAt(m.joinedAt) },
        ]
      }),
    )

    projectApiSnapshotCache.set(projectId, proj)
  } catch (err) {
    clearProjectSpaceCachesForProject(projectId)
    projectSpaceState.error = err instanceof Error ? err.message : '加载项目详情失败'
  } finally {
    projectSpaceState.loadingProjectId = ''
  }
}

/** 知识库列表 + 全局继承（侧边栏「AI 能力配置」或独立知识库页） */
export async function loadProjectKnowledgeFromApi(projectId: string) {
  if (!isBackendNumericProjectId(projectId)) return
  const pid = Number(projectId)
  const knowledgeRows: TableCell[][] = []
  let inheritedGlobalKbs: ProjectInheritedGlobalKbItem[] = []
  try {
    const [globalRes, projectRes] = await Promise.all([
      listProjectKnowledgeSources(pid, 'global'),
      listProjectKnowledgeSources(pid, 'PROJECT'),
    ])

    const kbDocPath = (kid: number) => `/projects/${projectId}/knowledge/${kid}`
    const enterKb = (kid: number): TableCell => ({ text: '进入知识库', to: kbDocPath(kid) })

    inheritedGlobalKbs = []
    for (const item of globalRes.items) {
      const kb = item.knowledgeBase
      if (!kb?.id) continue

      const kind = (item.kind ?? '').toUpperCase()
      const kbName = (kb.name ?? '').trim() || `知识库 #${kb.id}`

      if (kind !== 'GLOBAL_INHERITED') continue

      const cfgRaw = item.projectKnowledgeConfigId
      const cfgId = cfgRaw != null && Number.isFinite(Number(cfgRaw)) ? Number(cfgRaw) : undefined

      const wRaw = item.searchWeight
      const w = wRaw == null || wRaw === '' ? '—' : String(wRaw)
      const injectMode = item.injectMode ?? kb.injectMode ?? null
      inheritedGlobalKbs.push({
        kbId: kb.id,
        ...(cfgId != null ? { projectKnowledgeConfigId: cfgId } : {}),
        name: kbName,
        description: `全局继承 · 文档 ${kb.docCount != null ? String(kb.docCount) : '—'} · 检索权重 ${w === '—' ? '默认' : w}`,
        injectMode,
      })
    }

    for (const item of projectRes.items) {
      const kb = item.knowledgeBase
      if (!kb?.id) continue

      const kind = (item.kind ?? '').toUpperCase()
      const kbName = (kb.name ?? '').trim() || `知识库 #${kb.id}`

      if (kind !== 'DEDICATED') continue

      knowledgeRows.push([
        { text: kbName },
        { text: '本项目', tone: 'primary' },
        { text: String(kb.docCount ?? 0) },
        { text: kb.status ?? '—' },
        { text: kb.embeddingModel?.trim() || kb.category || '—' },
        enterKb(kb.id),
      ])
    }
  } catch {
    inheritedGlobalKbs = []
  }
  projectKnowledgeTableRowsCache.set(projectId, knowledgeRows)
  projectInheritedGlobalKbsCache.set(projectId, inheritedGlobalKbs)
}

export async function loadProjectSkillsFromApi(projectId: string) {
  if (!isBackendNumericProjectId(projectId)) return
  const pid = Number(projectId)
  const skillRows: TableCell[][] = []
  try {
    const [allSkills, projSkills] = await Promise.all([listSkills(), listProjectSkills(pid)])
    const skillById = new Map(allSkills.map((s) => [s.id, s]))
    for (const ps of projSkills) {
      const sk = skillById.get(ps.skillId)
      const rawDesc = sk?.description?.trim() || ''
      const desc = rawDesc ? truncateText(rawDesc, 48) : '—'
      skillRows.push([
        { text: sk?.name ?? `Skill #${ps.skillId}` },
        { text: desc },
        { text: ps.status ?? '—' },
        { text: sk?.category || sk?.skillKey || '—' },
        { text: formatMemberJoinedAt(ps.updatedAt ?? ps.createdAt) },
      ])
    }
  } catch {
    // 不阻断
  }
  projectSkillTableRowsCache.set(projectId, skillRows)
}

export async function loadProjectToolsFromApi(projectId: string) {
  if (!isBackendNumericProjectId(projectId)) return
  const pid = Number(projectId)
  const toolRows: TableCell[][] = []
  try {
    const [allTools, projTools] = await Promise.all([listTools(), listProjectTools(pid)])
    const toolById = new Map(allTools.map((t) => [t.id, t]))
    for (const pt of projTools) {
      const td = toolById.get(pt.toolId)
      const rawDesc = td?.description?.trim() || ''
      const desc = rawDesc ? truncateText(rawDesc, 40) : '—'
      toolRows.push([
        { text: td?.displayName?.trim() || td?.toolName || `Tool #${pt.toolId}` },
        { text: td?.toolName || '—', mono: true },
        { text: pt.status ?? '—' },
        { text: td?.category || '—' },
        { text: desc },
        { text: td?.implType || td?.auditLevel || '—' },
      ])
    }
  } catch {
    // 不阻断
  }
  projectToolTableRowsCache.set(projectId, toolRows)
}

export async function loadProjectKnowledgeSkillsToolsFromApi(projectId: string) {
  await Promise.all([
    loadProjectKnowledgeFromApi(projectId),
    loadProjectSkillsFromApi(projectId),
    loadProjectToolsFromApi(projectId),
  ])
}

/** 成员配额、用量摘要、Token 看板（「配额管理」） */
export async function loadProjectQuotaTokenDashboardFromApi(projectId: string) {
  if (!isBackendNumericProjectId(projectId)) return
  const pid = Number(projectId)

  let users: Awaited<ReturnType<typeof listUsers>> = []
  try {
    users = await listUsers()
  } catch {
    // 退化为 userId
  }
  const userLabel = (uid: number) => {
    const u = users.find((x) => x.id === uid)
    return (u?.fullName?.trim() || u?.username || `用户 #${uid}`) as string
  }

  let membersLen = 0
  try {
    const members = await listProjectMembers(pid)
    membersLen = members.length
  } catch {
    membersLen = 0
  }

  const defaultKeyMetrics: PageMetric[] = [
    { id: 'quotas', icon: '📋', label: '成员配额', value: '0', delta: 'member-quotas', tone: 'primary' },
    { id: 'members', icon: '👥', label: '项目成员', value: String(membersLen), delta: '成员列表', tone: 'success' },
    { id: 'tokens', icon: '📈', label: '近页 tokens', value: '0', delta: 'usage-events', tone: 'warning' },
    { id: 'fail', icon: '⚠️', label: '非成功调用', value: '0', delta: '本页事件', tone: 'danger' },
  ]
  let quotaRows: TableCell[][] = []
  let keyMetrics = defaultKeyMetrics
  let usageActivity: ListItem[] = []
  let usageTop: ListItem[] = []

  try {
    const [qRes, uRes, sRes] = await Promise.allSettled([
      listMemberQuotasByProject(pid),
      listProjectUsageEvents(pid, 1, 30),
      getProjectUsageSummary(pid),
    ])

    const quotas = qRes.status === 'fulfilled' ? qRes.value : []
    const usagePage =
      uRes.status === 'fulfilled' ? uRes.value : { data: [], total: 0, page: 1, size: 30 }
    const summaryRaw = sRes.status === 'fulfilled' ? sRes.value : {}

    projectUsageSummaryCache.set(projectId, summaryRaw)

    const events = usagePage.data ?? []
    const totalTok = events.reduce((a, e) => a + (Number(e.totalTokens) || 0), 0)
    const failN = events.filter((e) => (e.status || '').toUpperCase() !== 'SUCCESS').length

    quotaRows = quotas.map((q) => {
      const limit = q.quotaLimit == null ? '∞' : String(q.quotaLimit)
      const used = q.usedAmount == null ? '—' : String(q.usedAmount)
      return [
        { text: userLabel(q.userId) },
        { text: q.quotaType },
        { text: `${used} / ${limit}` },
        { text: q.resetCycle?.trim() || '—' },
        { text: q.status },
      ]
    })

    keyMetrics = [
      { id: 'quotas', icon: '📋', label: '成员配额', value: String(quotas.length), delta: 'member-quotas', tone: 'primary' },
      { id: 'members', icon: '👥', label: '项目成员', value: String(membersLen), delta: '成员列表', tone: 'success' },
      {
        id: 'tokens',
        icon: '📈',
        label: '近页 tokens',
        value: formatTokensShort(totalTok),
        delta: `${events.length} 条事件`,
        tone: 'warning',
      },
      {
        id: 'fail',
        icon: '⚠️',
        label: '非成功调用',
        value: String(failN),
        delta: '本页统计',
        tone: failN > 0 ? 'danger' : 'success',
      },
    ]

    usageActivity = events.slice(0, 10).map((e) => {
      const uid = e.userId
      const who = uid == null ? '—' : userLabel(uid)
      const st = (e.status || '—').toUpperCase()
      const tone = st === 'SUCCESS' ? 'success' : st === '—' ? 'muted' : 'warning'
      return {
        title: `${who} · 模型 #${e.modelId ?? '—'}`,
        meta: `in ${e.inputTokens ?? 0} / out ${e.outputTokens ?? 0} · ${e.status ?? '—'}`,
        description: e.errorMessage?.trim() || undefined,
        badge: formatIsoDateTime(e.occurredAt),
        tone,
      }
    })

    const byUser = new Map<number, number>()
    for (const e of events) {
      if (e.userId == null) continue
      byUser.set(e.userId, (byUser.get(e.userId) || 0) + (Number(e.totalTokens) || 0))
    }
    usageTop = [...byUser.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([uid, tok], i) => ({
        title: `${i + 1}. ${userLabel(uid)}`,
        meta: `${formatTokensShort(tok)} tokens（本页累计）`,
        badge: i === 0 ? '最高' : '成员',
        tone: i === 0 ? 'success' : 'primary',
      }))
  } catch {
    // 配额/用量失败不阻断
  }

  const tdBundle: ProjectTokenDashboardBundle = {
    loaded: true,
    memberRows: [],
    consumption: [],
    activityRows: [],
    activityTotal: 0,
    activityPage: 1,
    activitySize: 20,
  }
  const tdErrors: string[] = []
  try {
    const [r1, r2, r3, r4, r5] = await Promise.allSettled([
      getTokenDashboardSummary(pid),
      getTokenDashboardConfig(pid),
      getTokenDashboardMemberQuotaRows(pid),
      getTokenDashboardConsumptionByUser(pid),
      listTokenDashboardActivity(pid, { page: 1, size: 20 }),
    ])
    if (r1.status === 'fulfilled') {
      tdBundle.summary = normalizeTokenDashboardSummary(r1.value)
    } else {
      tdErrors.push(r1.reason instanceof Error ? r1.reason.message : 'summary 失败')
    }
    if (r2.status === 'fulfilled') {
      tdBundle.config = normalizeTokenDashboardConfig(r2.value)
    } else {
      tdErrors.push(r2.reason instanceof Error ? r2.reason.message : 'config 失败')
    }
    if (r3.status === 'fulfilled') {
      tdBundle.memberRows = normalizeTokenDashboardMemberQuotaRows(r3.value)
      if (tdBundle.memberRows.length > 0) {
        tdBundle.quotaTable = buildDashboardQuotaTable(tdBundle.memberRows, formatTokensShort)
        quotaRows = tdBundle.quotaTable.rows
      }
    } else {
      tdErrors.push(r3.reason instanceof Error ? r3.reason.message : 'quota-rows 失败')
    }
    if (r4.status === 'fulfilled') {
      tdBundle.consumption = normalizeTokenDashboardConsumptionByUser(r4.value)
    } else {
      tdErrors.push(r4.reason instanceof Error ? r4.reason.message : 'consumption-by-user 失败')
    }
    if (r5.status === 'fulfilled') {
      const ap = normalizeTokenDashboardActivityPage(r5.value)
      tdBundle.activityRows = ap.rows
      tdBundle.activityTotal = ap.total
      tdBundle.activityPage = ap.page
      tdBundle.activitySize = ap.size
    } else {
      tdErrors.push(r5.reason instanceof Error ? r5.reason.message : 'activity 失败')
    }
    if (tdErrors.length) {
      tdBundle.loadError = tdErrors.join('；')
    }
  } catch (e) {
    tdBundle.loadError = e instanceof Error ? e.message : 'token-dashboard 加载异常'
  }
  projectTokenDashboardBundleCache.set(projectId, tdBundle)
  tokenDashboardRevision.value += 1

  projectQuotaTableRowsCache.set(projectId, quotaRows)
  projectKeyMetricsCache.set(projectId, keyMetrics)
  projectUsageActivityCache.set(projectId, usageActivity)
  projectUsageTopCache.set(projectId, usageTop)
}

/** 事故列表（「事故与告警」） */
export async function loadProjectIncidentsFromApi(projectId: string) {
  if (!isBackendNumericProjectId(projectId)) return
  const pid = Number(projectId)
  try {
    const incidents = await listProjectIncidents(pid)
    projectIncidentsCache.set(projectId, incidents)
  } catch {
    projectIncidentsCache.set(projectId, [])
  }
}

/**
 * 按项目模块路由 `section` 拉取对应数据（进入子菜单时再请求，避免一次打满所有接口）。
 */
export async function loadProjectSpaceSectionFromApi(projectId: string, section: string) {
  if (!isBackendNumericProjectId(projectId)) return
  const sec = section.trim()
  switch (sec) {
    case 'ai-cap':
      await loadProjectKnowledgeSkillsToolsFromApi(projectId)
      break
    case 'knowledge':
      await loadProjectKnowledgeFromApi(projectId)
      break
    case 'skillconfig':
      await loadProjectSkillsFromApi(projectId)
      break
    case 'projtools':
      await loadProjectToolsFromApi(projectId)
      break
    case 'keymanagement':
      await loadProjectQuotaTokenDashboardFromApi(projectId)
      break
    case 'incidents':
      await loadProjectIncidentsFromApi(projectId)
      break
    default:
      break
  }
}

/** 全量刷新（编辑项目后、或需与子菜单无关地同步全部缓存时） */
export async function refreshProjectSpaceFromApi(projectId: string) {
  await refreshProjectCoreFromApi(projectId)
  if (projectSpaceState.error) return
  await Promise.all([
    loadProjectKnowledgeSkillsToolsFromApi(projectId),
    loadProjectQuotaTokenDashboardFromApi(projectId),
    loadProjectIncidentsFromApi(projectId),
  ])
}

export function getProjectById(projectId: string): ProjectDetail | undefined {
  const cached = projectDetailCache.get(projectId)
  if (cached) return cached

  if (!isBackendNumericProjectId(projectId)) {
    const fromMock = getMockProjectById(projectId)
    if (fromMock) {
      cacheDetail(fromMock)
      return fromMock
    }
  }

  const fromSummary = projectSummaries.value.find((p) => p.id === projectId)
  if (!fromSummary) return undefined

  const built = toProjectDetail(fromSummary)
  cacheDetail(built)
  return built
}

export async function loadProjects(preferApi = true) {
  projectState.loading = true
  projectState.error = ''
  projectState.loadedFromApi = false

  try {
    if (!preferApi) {
      projectSummaries.value = [...mockProjectSummaries]
      projectState.loadedFromApi = false
      return
    }

    const dashRaw = await getProjectsDashboard()
    const rows = normalizeProjectsDashboard(dashRaw)
    const summaries = rows.map((r) => {
      const base = toProjectSummary(r.project)
      const aiCapabilityItems = buildAiCapabilityItems(r.skillCount, r.toolCount, r.knowledgeCount)
      return {
        ...base,
        serviceCount: r.serviceCount,
        memberCount: r.memberCount,
        members: r.members,
        memberAvatarUrls: r.memberAvatarUrls.length > 0 ? r.memberAvatarUrls : undefined,
        aiCapabilityItems,
        aiCapabilityLabel: labelFromAiCapabilityItems(aiCapabilityItems),
        listMetricsLoaded: true,
      }
    })
    projectSummaries.value = summaries
    projectState.loadedFromApi = true

    for (const s of summaries) {
      cacheDetail(toProjectDetail(s))
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '请求失败，请稍后重试。'
    projectState.error = message
    projectSummaries.value = []
    projectState.loadedFromApi = false
  } finally {
    projectState.loading = false
  }
}

export async function createProject(payload: CreateBackendProjectPayload) {
  const created = await createProjectApi(payload)
  await loadProjects(true)
  return created
}

export function useProjects() {
  return {
    loadProjects,
    refreshProjectSpaceFromApi,
    projectState,
    projectSpaceState,
    projectSummaries,
  }
}
