import { ref, reactive } from 'vue'

import type { ListItem, PageMetric, TableCell } from '../types/module-page'
import type {
  BackendProjectResponse,
  BackendProjectServiceResponse,
  BackendProjectType,
  CreateBackendProjectPayload,
  ProjectDetail,
  ProjectSummary,
  ProjectServiceHealth,
} from '../types/project'

import { listKnowledgeBases, listProjectKnowledgeConfigs } from '../services/knowledge'
import { listMemberQuotasByProject } from '../services/member-quotas'
import {
  createProject as createProjectApi,
  getProject,
  listProjectMembers,
  listProjectServices,
  listProjects,
} from '../services/projects'
import { listProjectSkills, listSkills } from '../services/skills'
import { listProjectTools, listTools } from '../services/tools'
import { listUsageEvents } from '../services/usage-events'
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
  if (!iso) return '—'
  return iso.length >= 10 ? iso.slice(0, 10) : iso
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

function toProjectSummary(api: BackendProjectResponse, tokenLabel = '--K'): ProjectSummary {
  const tone: ProjectSummary['statusTone'] = api.status === 'ACTIVE' ? 'success' : 'warning'
  return {
    id: String(api.id),
    name: api.name,
    icon: api.icon?.trim() || '📁',
    typeLabel: resolveTypeLabel(api.projectType),
    description: api.description?.trim() || '',
    statusLabel: api.status,
    statusTone: tone,
    sprintLabel: 'Sprint · --',
    tokenLabel,
    serviceCount: 0,
    memberCount: 0,
    members: [],
  }
}

function toProjectDetail(summary: ProjectSummary): ProjectDetail {
  return {
    ...summary,
    currentSprint: 'Sprint · --',
    sprintProgress: '0% 已完成',
    incidentsSummary: '无事故',
    monthlyTokenDelta: '0',
    services: [],
    activities: [],
    incidents: [],
  }
}

function cacheDetail(detail: ProjectDetail | undefined) {
  if (!detail) return
  projectDetailCache.set(detail.id, detail)
}

export async function refreshProjectSpaceFromApi(projectId: string) {
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

    const summary = toProjectSummary(proj)
    summary.serviceCount = services.length
    summary.memberCount = members.length
    summary.members = members.map((m) => `${userLabel(m.userId)}（${m.role}）`).slice(0, 12)

    const detail: ProjectDetail = {
      ...summary,
      currentSprint: 'Sprint · --',
      sprintProgress: '0% 已完成',
      incidentsSummary: '无事故',
      monthlyTokenDelta: '0',
      services: services.map(mapBackendService),
      activities: [],
      incidents: [],
    }

    cacheDetail(detail)

    const idx = projectSummaries.value.findIndex((p) => p.id === projectId)
    if (idx >= 0) projectSummaries.value[idx] = { ...summary }

    projectMemberTableRowsCache.set(
      projectId,
      members.map((m) => [
        { text: userLabel(m.userId) },
        { text: String(m.userId), mono: true },
        { text: m.role },
        { text: formatMemberJoinedAt(m.joinedAt) },
      ]),
    )

    const knowledgeRows: TableCell[][] = []
    try {
      const [allKbs, kbConfigs] = await Promise.all([listKnowledgeBases(), listProjectKnowledgeConfigs(pid)])
      const kbById = new Map(allKbs.map((k) => [k.id, k]))

      for (const kb of allKbs) {
        if (kb.scope?.toUpperCase() === 'PROJECT' && kb.projectId === pid) {
          knowledgeRows.push([
            { text: kb.name },
            { text: '本项目', tone: 'primary' },
            { text: String(kb.docCount ?? 0) },
            { text: kb.status ?? '—' },
            { text: kb.embeddingModel?.trim() || kb.category || '—' },
          ])
        }
      }

      for (const c of kbConfigs) {
        const kb = kbById.get(c.kbId)
        const w = c.searchWeight == null || c.searchWeight === '' ? '—' : String(c.searchWeight)
        knowledgeRows.push([
          { text: kb?.name ?? `知识库 #${c.kbId}` },
          { text: '全局继承', tone: 'success' },
          { text: kb?.docCount != null ? String(kb.docCount) : '—' },
          { text: c.status ?? '—' },
          { text: w === '—' ? '默认权重' : `权重 ${w}` },
        ])
      }
    } catch {
      // 不阻断主流程
    }
    projectKnowledgeTableRowsCache.set(projectId, knowledgeRows)

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

    projectApiSnapshotCache.set(projectId, proj)

    const defaultKeyMetrics: PageMetric[] = [
      { id: 'quotas', icon: '📋', label: '成员配额', value: '0', delta: 'member-quotas', tone: 'primary' },
      { id: 'members', icon: '👥', label: '项目成员', value: String(members.length), delta: '成员列表', tone: 'success' },
      { id: 'tokens', icon: '📈', label: '近页 tokens', value: '0', delta: 'usage-events', tone: 'warning' },
      { id: 'fail', icon: '⚠️', label: '非成功调用', value: '0', delta: '本页事件', tone: 'danger' },
    ]
    let quotaRows: TableCell[][] = []
    let keyMetrics = defaultKeyMetrics
    let usageActivity: ListItem[] = []
    let usageTop: ListItem[] = []

    try {
      const [quotas, usagePage] = await Promise.all([
        listMemberQuotasByProject(pid),
        listUsageEvents({ projectId: pid, page: 1, size: 30 }),
      ])
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
        { id: 'members', icon: '👥', label: '项目成员', value: String(members.length), delta: '成员列表', tone: 'success' },
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

    projectQuotaTableRowsCache.set(projectId, quotaRows)
    projectKeyMetricsCache.set(projectId, keyMetrics)
    projectUsageActivityCache.set(projectId, usageActivity)
    projectUsageTopCache.set(projectId, usageTop)
  } catch (err) {
    projectMemberTableRowsCache.delete(projectId)
    projectKnowledgeTableRowsCache.delete(projectId)
    projectSkillTableRowsCache.delete(projectId)
    projectToolTableRowsCache.delete(projectId)
    projectApiSnapshotCache.delete(projectId)
    projectQuotaTableRowsCache.delete(projectId)
    projectKeyMetricsCache.delete(projectId)
    projectUsageActivityCache.delete(projectId)
    projectUsageTopCache.delete(projectId)
    projectSpaceState.error = err instanceof Error ? err.message : '加载项目详情失败'
  } finally {
    projectSpaceState.loadingProjectId = ''
  }
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

    const page = await listProjects(1, 100)
    projectSummaries.value = page.data.map((p) => toProjectSummary(p))
    projectState.loadedFromApi = true

    for (const apiProject of page.data) {
      cacheDetail(toProjectDetail(toProjectSummary(apiProject)))
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
