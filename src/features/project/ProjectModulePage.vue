<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'

import ModuleContent from '../../components/ui/ModuleContent.vue'
import {
  getProjectApiSnapshot,
  getProjectById,
  getProjectInheritedGlobalKbs,
  getProjectIncidentsList,
  getProjectKnowledgeTableRows,
  getProjectMemberTableRows,
  getProjectQuotaTableRows,
  getProjectSkillTableRows,
  getProjectTokenDashboardBundle,
  getProjectToolTableRows,
  getProjectUsageSummaryRaw,
  loadProjectSpaceSectionFromApi,
  projectSpaceState,
  refreshProjectCoreFromApi,
  tokenDashboardRevision,
} from '../../composables/useProjects'
import { incidentToCardModel, pickPrimaryIncident } from '../../lib/project-incident-display'
import { normalizeProjectUsageSummary } from '../../lib/project-usage-summary'
import type {
  CatalogItem,
  ModulePageConfig,
  ModuleSection,
  PageMetric,
  TableCell,
  TableData,
} from '../../types/module-page'
import NotFoundProjectState from './NotFoundProjectState.vue'
import { useAuth } from '../../composables/useAuth'
import { useProjectWorkspaceApi } from '../../composables/useProjectWorkspace'
import { buildWorkspaceModuleSections } from '../../lib/workspace-module-sections'

const route = useRoute()

function isNumericBackendProject(projectId: string) {
  return /^\d+$/.test(projectId)
}

function cell(
  text: string,
  tone?: TableCell['tone'],
  mono = false,
  display?: TableCell['display'],
): TableCell {
  return { text, tone, mono, display }
}

const memberColsPrototype = ['成员', '角色', '凭证状态', '知识库权限', '可用技能', '配额（月）', '操作']

function membersTableForProject(projectId: string): TableData {
  const apiRows = getProjectMemberTableRows(projectId)
  if (apiRows !== undefined) {
    const empty = [cell('—'), cell('—'), cell('—'), cell('—'), cell('—'), cell('—'), cell('—')]
    if (apiRows.length === 0) {
      return {
        columns: memberColsPrototype,
        rows: [[cell('暂无成员', 'muted'), ...empty.slice(1)]],
      }
    }
    return {
      columns: memberColsPrototype,
      rows: apiRows.map((r) => {
        const name = r[0] ?? cell('—')
        const role = r[2] ?? cell('—')
        const cred = r[3] ?? cell('—')
        return [
          name,
          { ...role, display: 'tag' },
          { ...cred, display: cred.display ?? 'tag' },
          cell('与角色同步', 'muted'),
          cell('与项目同步', 'muted'),
          cell('—', 'muted'),
          cell('权限设置'),
        ]
      }),
    }
  }
  if (isNumericBackendProject(projectId)) {
    if (projectSpaceState.error) {
      return {
        columns: memberColsPrototype,
        rows: [
          [cell(`加载失败：${projectSpaceState.error}`, 'danger'), cell('—'), cell('—'), cell('—'), cell('—'), cell('—'), cell('—')],
        ],
      }
    }
    return {
      columns: memberColsPrototype,
      rows: [[cell('正在从后端加载成员…', 'primary'), cell('—'), cell('—'), cell('—'), cell('—'), cell('—'), cell('—')]],
    }
  }
  return {
    columns: memberColsPrototype,
    rows: [
      [
        cell('张三'),
        { text: '项目负责人', tone: 'primary', display: 'tag' },
        { text: '● 正常', tone: 'success', display: 'tag' },
        cell('读写'),
        cell('全部'),
        cell('无限制'),
        cell('权限设置'),
      ],
      [
        cell('李四'),
        { text: '开发', tone: 'muted', display: 'tag' },
        { text: '● 接近上限', tone: 'warning', display: 'tag' },
        cell('只读'),
        cell('代码相关'),
        { text: '180K / 100K', tone: 'warning' },
        cell('扩容 · 权限设置'),
      ],
      [
        cell('王五'),
        { text: '开发', tone: 'muted', display: 'tag' },
        { text: '● 正常', tone: 'success', display: 'tag' },
        cell('只读'),
        cell('代码相关'),
        cell('68K / 100K'),
        cell('权限设置'),
      ],
      [
        cell('陈六'),
        { text: '测试', tone: 'muted', display: 'tag' },
        { text: '● 正常', tone: 'success', display: 'tag' },
        cell('只读'),
        cell('测试相关'),
        cell('42K / 100K'),
        cell('权限设置'),
      ],
    ],
  }
}

const knowledgeTableCols = ['知识库名称', '来源', '文档数', '状态', '备注', '操作'] as const

function knowledgeTableForProject(projectId: string): TableData {
  const apiRows = getProjectKnowledgeTableRows(projectId)
  if (apiRows !== undefined) {
    return {
      columns: [...knowledgeTableCols],
      rows:
        apiRows.length > 0
          ? apiRows
          : [[cell('暂无知识库或继承配置', 'muted'), cell('—'), cell('—'), cell('—'), cell('—'), cell('—')]],
    }
  }
  if (isNumericBackendProject(projectId)) {
    if (projectSpaceState.error) {
      return {
        columns: [...knowledgeTableCols],
        rows: [[cell(`加载失败：${projectSpaceState.error}`, 'danger'), cell('—'), cell('—'), cell('—'), cell('—'), cell('—')]],
      }
    }
    return {
      columns: [...knowledgeTableCols],
      rows: [[cell('正在从后端加载知识库…', 'primary'), cell('—'), cell('—'), cell('—'), cell('—'), cell('—')]],
    }
  }
  return {
    columns: ['文件名', '类型', '大小', '上传者', '更新时间', '状态'],
    rows: [
      [cell('商城需求文档 v2.3'), cell('需求', 'primary'), cell('245KB'), cell('张三'), cell('2026-03-06'), cell('已索引', 'success')],
      [cell('商城原型图 v1.5'), cell('原型', 'warning'), cell('3.2MB'), cell('产品部'), cell('2026-03-05'), cell('已索引', 'success')],
      [cell('接口文档 - 商品模块'), cell('技术', 'success'), cell('88KB'), cell('AI 生成'), cell('2026-03-04'), cell('已索引', 'success')],
      [cell('安全规范手册'), cell('全局', 'primary'), cell('56KB'), cell('全局启用'), cell('2026-02-20'), cell('共享中', 'primary')],
    ],
  }
}

function skillTableForProject(projectId: string): TableData {
  const apiRows = getProjectSkillTableRows(projectId)
  if (apiRows !== undefined) {
    return {
      columns: ['Skill', '说明', '项目内状态', '分类 / Key', '更新日期'],
      rows:
        apiRows.length > 0 ? apiRows : [[cell('本项目尚未启用任何 Skill', 'muted'), cell('—'), cell('—'), cell('—'), cell('—')]],
    }
  }
  if (isNumericBackendProject(projectId)) {
    if (projectSpaceState.error) {
      return {
        columns: ['Skill', '说明', '项目内状态', '分类 / Key', '更新日期'],
        rows: [[cell(`加载失败：${projectSpaceState.error}`, 'danger'), cell('—'), cell('—'), cell('—'), cell('—')]],
      }
    }
    return {
      columns: ['Skill', '说明', '项目内状态', '分类 / Key', '更新日期'],
      rows: [[cell('正在从后端加载 Skill…', 'primary'), cell('—'), cell('—'), cell('—'), cell('—')]],
    }
  }
  return {
    columns: ['Skill', '用途', '当前状态', '审批要求', '最近变更'],
    rows: [
      [cell('代码审查 Skill'), cell('PR 审查与行内评论'), cell('启用', 'success'), cell('无需审批'), cell('03-10')],
      [cell('事故排障 Skill'), cell('告警诊断与修复建议'), cell('启用', 'success'), cell('高风险修复需审批'), cell('03-09')],
      [cell('需求拆分 Skill'), cell('PRD 拆分 Story / Task'), cell('启用', 'success'), cell('无需审批'), cell('03-08')],
      [cell('自动部署 Skill'), cell('从 IDE 触发部署'), cell('禁用', 'warning'), cell('生产必须审批'), cell('03-06')],
    ],
  }
}

function toolTableForProject(projectId: string): TableData {
  const apiRows = getProjectToolTableRows(projectId)
  if (apiRows !== undefined) {
    return {
      columns: ['展示名称', '工具标识', '项目内状态', '分类', '说明', '实现 / 审计'],
      rows:
        apiRows.length > 0 ? apiRows : [[cell('本项目尚未启用任何工具', 'muted'), cell('—'), cell('—'), cell('—'), cell('—'), cell('—')]],
    }
  }
  if (isNumericBackendProject(projectId)) {
    if (projectSpaceState.error) {
      return {
        columns: ['展示名称', '工具标识', '项目内状态', '分类', '说明', '实现 / 审计'],
        rows: [[cell(`加载失败：${projectSpaceState.error}`, 'danger'), cell('—'), cell('—'), cell('—'), cell('—'), cell('—')]],
      }
    }
    return {
      columns: ['展示名称', '工具标识', '项目内状态', '分类', '说明', '实现 / 审计'],
      rows: [[cell('正在从后端加载工具…', 'primary'), cell('—'), cell('—'), cell('—'), cell('—'), cell('—')]],
    }
  }
  return {
    columns: ['工具', '用途', '权限域', '状态', '最近调用', '备注'],
    rows: [
      [cell('search_codebase'), cell('搜索仓库代码'), cell('项目级'), cell('已启用', 'success'), cell('2 分钟前'), cell('MCP')],
      [cell('report_bug'), cell('创建事故任务'), cell('平台级'), cell('已启用', 'success'), cell('8 分钟前'), cell('—')],
      [cell('trigger_deploy'), cell('触发部署'), cell('服务级'), cell('需审批', 'warning'), cell('—'), cell('高风险')],
    ],
  }
}

// ?????????????????????????????
const project = computed(() => {
  if (typeof route.params.projectId !== 'string') {
    return undefined
  }

  return getProjectById(route.params.projectId)
})

// ??????? section ????????????? overview ???
const section = computed(() =>
  typeof route.params.section === 'string' ? route.params.section : 'overview',
)

const { user } = useAuth()

const workspaceRoleLabel = computed(() => {
  const u = user.value
  if (!u) return '开发者'
  return u.platformRole?.trim() || u.jobTitle?.trim() || '开发者'
})

const { workspaceSections, workspaceLoading, workspaceError } = useProjectWorkspaceApi({
  projectIdStr: computed(() => project.value?.id),
  projectName: computed(() => project.value?.name ?? ''),
  projectCode: computed(() => {
    const id = project.value?.id
    if (!id) return undefined
    return getProjectApiSnapshot(id)?.code
  }),
  section,
  userId: computed(() => user.value?.id),
  roleLabel: workspaceRoleLabel,
  getKnowledgeSkillToolCounts: () => {
    const id = project.value?.id
    if (!id) return { kb: 0, sk: 0, tl: 0 }
    return {
      kb: getProjectKnowledgeTableRows(id)?.length ?? 0,
      sk: getProjectSkillTableRows(id)?.length ?? 0,
      tl: getProjectToolTableRows(id)?.length ?? 0,
    }
  },
})

watch(
  () => (typeof route.params.projectId === 'string' ? route.params.projectId : ''),
  (pid) => {
    if (pid) void refreshProjectCoreFromApi(pid)
  },
  { immediate: true },
)

watch(
  () =>
    [
      typeof route.params.projectId === 'string' ? route.params.projectId : '',
      typeof route.params.section === 'string' ? route.params.section : '',
    ] as const,
  ([pid, sec]) => {
    if (!pid || !sec) return
    void loadProjectSpaceSectionFromApi(pid, sec)
  },
  { immediate: true },
)

// ???????????? ModuleContent ???????????
function buildServiceCards(projectId: string) {
  const serviceMeta: Record<string, { icon: string; repo: string; branch: string; deploy: string; ci: string }> = {
    'mall-backend': { icon: '🍃', repo: 'git.co/mall/backend', branch: 'main', deploy: '30 分钟前 · prod', ci: '通过' },
    'mall-frontend': { icon: '⚛️', repo: 'git.co/mall/frontend', branch: 'main', deploy: '2 小时前 · staging', ci: '构建中' },
    'mall-mobile': { icon: '📱', repo: 'git.co/mall/mobile', branch: 'main', deploy: '昨天 · prod v2.1.0', ci: '通过' },
  }

  return (project.value?.services ?? []).map((service): CatalogItem => {
    const meta = serviceMeta[service.id] ?? {
      icon: '⚙️',
      repo: `git.co/${projectId}/${service.id}`,
      branch: 'main',
      deploy: service.deployMeta,
      ci: service.statusLabel,
    }

    return {
      icon: meta.icon,
      title: service.name,
      subtitle: service.techStack,
      badge: service.statusLabel,
      tone: service.statusTone,
      lines: [
        { label: 'Git 仓库', value: meta.repo, mono: true },
        { label: '主干分支', value: meta.branch },
        { label: '最后部署', value: meta.deploy },
        { label: 'CI 状态', value: meta.ci, tone: service.statusTone },
      ],
      cta: '进入服务详情 →',
      to: `/projects/${projectId}/services/${service.id}`,
    }
  })
}

const quotaMemberCols = ['成员', '角色', '本月已用', '个人限额', '状态', '操作']

function formatTokensShortLocal(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(Math.round(n))
}

function memberQuotaTableForProject(projectId: string): TableData {
  void tokenDashboardRevision.value
  const tdBundle = getProjectTokenDashboardBundle(projectId)
  if (tdBundle?.quotaTable && tdBundle.quotaTable.rows.length > 0) {
    return {
      columns: tdBundle.quotaTable.columns,
      rows: tdBundle.quotaTable.rows,
    }
  }

  const emptyRow = [cell('—'), cell('—'), cell('—'), cell('—'), cell('—'), cell('—')] as TableCell[]
  const mock: TableData = {
    columns: quotaMemberCols,
    rows: [
      [
        cell('张三'),
        { text: '负责人', tone: 'primary', display: 'tag' },
        cell('186K'),
        cell('无限制'),
        { text: '● 正常', tone: 'success', display: 'tag' },
        cell('调整'),
      ],
      [
        cell('李四'),
        { text: '开发', tone: 'muted', display: 'tag' },
        { text: '180K', tone: 'danger' },
        cell('100K'),
        { text: '● 已超额', tone: 'danger', display: 'tag' },
        cell('扩容 · 暂停'),
      ],
      [
        cell('王五'),
        { text: '开发', tone: 'muted', display: 'tag' },
        cell('68K'),
        cell('100K'),
        { text: '● 正常', tone: 'success', display: 'tag' },
        cell('调整'),
      ],
      [
        cell('陈六'),
        { text: '测试', tone: 'muted', display: 'tag' },
        cell('42K'),
        cell('100K'),
        { text: '● 正常', tone: 'success', display: 'tag' },
        cell('调整'),
      ],
    ],
  }

  if (!isNumericBackendProject(projectId)) return mock
  if (projectSpaceState.error) {
    return {
      columns: quotaMemberCols,
      rows: [[cell(`加载失败：${projectSpaceState.error}`, 'danger'), ...emptyRow.slice(1)]],
    }
  }
  const apiRows = getProjectQuotaTableRows(projectId)
  if (apiRows !== undefined) {
    if (apiRows.length === 0) {
      return {
        columns: quotaMemberCols,
        rows: [[cell('暂无配额记录', 'muted'), ...emptyRow.slice(1)]],
      }
    }
    return {
      columns: quotaMemberCols,
      rows: apiRows.map((r) => {
        const usedLimit = r[2]?.text ?? '—'
        const parts = usedLimit.split(/\s*\/\s*/)
        const used = parts[0]?.trim() ?? '—'
        const lim = parts[1]?.trim() ?? '—'
        const statusCell = r[4] ?? cell('—')
        return [
          r[0] ?? cell('—'),
          { text: r[1]?.text ?? '—', display: 'tag', tone: r[1]?.tone },
          { text: used },
          { text: lim },
          { ...statusCell, display: 'tag' },
          cell('调整'),
        ]
      }),
    }
  }
  if (projectSpaceState.loadingProjectId === projectId) {
    return {
      columns: quotaMemberCols,
      rows: [[cell('正在加载成员配额…', 'primary'), ...emptyRow.slice(1)]],
    }
  }
  return {
    columns: quotaMemberCols,
    rows: [[cell('等待项目空间同步…', 'muted'), ...emptyRow.slice(1)]],
  }
}

function parseQuotaCellAmount(text: string): number {
  const s = String(text).replace(/,/g, '').trim().toUpperCase()
  if (!s || s === '—') return NaN
  const m = s.match(/^([\d.]+)\s*([KM])?/)
  if (!m) {
    const n = Number(s)
    return Number.isFinite(n) ? n : NaN
  }
  let n = parseFloat(m[1]!)
  const u = m[2]
  if (u === 'K') n *= 1000
  if (u === 'M') n *= 1_000_000
  return n
}

function countActiveConsumersFromQuotaRows(rows: TableCell[][]): number {
  let n = 0
  for (const r of rows) {
    const v = parseQuotaCellAmount(r[2]?.text ?? '')
    if (Number.isFinite(v) && v > 0) n++
  }
  return n
}

function countPersonalCapWarnings(rows: TableCell[][]): number {
  let n = 0
  for (const r of rows) {
    const limText = (r[3]?.text ?? '').trim()
    if (!limText || limText.includes('无限制')) continue
    const used = parseQuotaCellAmount(r[2]?.text ?? '')
    const cap = parseQuotaCellAmount(limText)
    if (Number.isFinite(cap) && cap > 0 && Number.isFinite(used) && used >= cap) n++
  }
  return n
}

function isQuotaTableLoading(rows: TableCell[][]): boolean {
  if (rows.length !== 1) return false
  return /加载|同步|等待/.test(rows[0]?.[0]?.text ?? '')
}

function quotaPageMetrics(projectId: string, memberCount: number, quotaTableRows: TableCell[][]): PageMetric[] {
  void tokenDashboardRevision.value
  const mock: PageMetric[] = [
    {
      id: 'pool',
      icon: '🪙',
      label: '项目 Token 池',
      value: '500K',
      delta: '本月已用 320K · 64%',
      tone: 'primary',
      deltaTone: 'success',
    },
    {
      id: 'active',
      icon: '👥',
      label: '活跃消耗成员',
      value: '5 / 6',
      delta: '1 人本月无消耗',
      tone: 'default',
      deltaTone: 'success',
    },
    {
      id: 'daily',
      icon: '📈',
      label: '日均消耗',
      value: '16K',
      delta: '预计月能用 496K（安全）',
      tone: 'default',
      deltaTone: 'success',
    },
    {
      id: 'warn',
      icon: '⚠️',
      label: '超限预警',
      value: '0',
      delta: '无成员触及个人上限',
      tone: 'success',
      deltaTone: 'success',
    },
  ]

  if (!isNumericBackendProject(projectId)) return mock
  if (projectSpaceState.error) {
    return [
      {
        id: 'err',
        icon: '⚠️',
        label: '配额数据',
        value: '加载失败',
        delta: projectSpaceState.error,
        tone: 'danger',
        deltaTone: 'default',
      },
      ...mock.slice(1),
    ]
  }

  const snap = getProjectApiSnapshot(projectId)
  const tdBundle = getProjectTokenDashboardBundle(projectId)
  const td = tdBundle?.summary
  const tdUsable =
    td &&
    (td.projectUsedTokensThisMonth != null ||
      td.projectQuotaTokens != null ||
      td.memberTotalCount != null ||
      td.membersAiEnabledCount != null ||
      td.personalPoolAtThresholdCount != null)

  if (tdUsable) {
    const sumLegacy = normalizeProjectUsageSummary(getProjectUsageSummaryRaw(projectId))
    const usedNum =
      td.projectUsedTokensThisMonth ??
      sumLegacy.usedTokens ??
      (snap?.usedTokensThisMonth != null && snap.usedTokensThisMonth >= 0 ? snap.usedTokensThisMonth : undefined)
    const quotaNum =
      td.projectQuotaTokens ??
      sumLegacy.quotaTokens ??
      (snap?.monthlyTokenQuota != null && snap.monthlyTokenQuota > 0 ? snap.monthlyTokenQuota : undefined)
    const poolValue =
      quotaNum !== undefined && Number.isFinite(quotaNum) && quotaNum > 0
        ? formatTokensShortLocal(quotaNum)
        : '—'
    let poolDelta = '配额未配置'
    if (quotaNum != null && quotaNum > 0 && usedNum != null && Number.isFinite(usedNum)) {
      const pct = Math.min(100, Math.round((usedNum / quotaNum) * 100))
      const rem =
        td.projectRemainingTokens != null && Number.isFinite(td.projectRemainingTokens)
          ? ` · 剩余 ${formatTokensShortLocal(td.projectRemainingTokens)}`
          : ''
      poolDelta = `本月已用 ${formatTokensShortLocal(usedNum)} · ${pct}%${rem}`
    } else if (usedNum != null && Number.isFinite(usedNum)) {
      poolDelta = `本月已用 ${formatTokensShortLocal(usedNum)}`
    }

    const totalM = td.memberTotalCount ?? memberCount
    const enabled = td.membersAiEnabledCount
    const disabled = td.membersAiDisabledCount
    const aiValue =
      enabled != null && totalM > 0
        ? `${enabled} / ${totalM}`
        : enabled != null
          ? `${enabled} / —`
          : '— / —'
    let aiDelta = '—'
    if (disabled != null && disabled > 0) {
      aiDelta = `未开 AI ${disabled} 人`
    } else if (totalM > 0 && enabled != null && enabled >= totalM) {
      aiDelta = '成员均已开通 AI'
    } else {
      aiDelta = '以 token-dashboard 为准'
    }

    const dayInMonth = new Date().getDate()
    let dailyStr = '—'
    let dailyDelta = '数据不足'
    if (td.dailyDigestModuleAvailable === true && (td.dailyDigestCount ?? 0) > 0) {
      dailyStr = String(td.dailyDigestCount)
      dailyDelta = '日报模块（占位已开启）'
    } else if (usedNum != null && Number.isFinite(usedNum) && usedNum >= 0) {
      const daily = usedNum / Math.max(1, dayInMonth)
      dailyStr = formatTokensShortLocal(daily)
      if (quotaNum != null && quotaNum > 0) {
        const projected = daily * 30
        const ratio = projected / quotaNum
        const tag = ratio <= 0.92 ? '（安全）' : ratio <= 1 ? '（关注）' : '（预警）'
        dailyDelta = `预计月能用 ${formatTokensShortLocal(projected)}${tag}`
      } else {
        dailyDelta = `按当前节奏折算约 ${formatTokensShortLocal(daily * 30)} / 月`
      }
    }
    const w = td.monthWarningAlertsCount
    const c = td.monthCriticalAlertsCount
    if (w != null || c != null) {
      dailyDelta += ` · 告警 W:${w ?? 0} / C:${c ?? 0}`
    }

    const capN = td.personalPoolAtThresholdCount ?? 0
    const firing = td.firingAlertsCount ?? 0
    const warnDelta =
      capN > 0
        ? `${capN} 人个人池触达告警阈值`
        : '无个人池触达告警阈值'
    const warnDelta2 =
      firing > 0 ? `${warnDelta} · FIRING ${firing}` : warnDelta

    return [
      {
        id: 'pool',
        icon: '🪙',
        label: '项目 Token 池',
        value: poolValue,
        delta: poolDelta,
        tone: 'primary',
        deltaTone: 'success',
      },
      {
        id: 'active',
        icon: '👥',
        label: '已开 AI 成员',
        value: aiValue,
        delta: aiDelta,
        tone: 'default',
        deltaTone: 'success',
      },
      {
        id: 'daily',
        icon: '📈',
        label: '日均消耗',
        value: dailyStr,
        delta: dailyDelta,
        tone: 'default',
        deltaTone: 'success',
      },
      {
        id: 'warn',
        icon: '⚠️',
        label: '超限预警',
        value: String(capN),
        delta: warnDelta2,
        tone: capN > 0 || firing > 0 ? 'warning' : 'success',
        deltaTone: 'success',
      },
    ]
  }

  const apiRows = getProjectQuotaTableRows(projectId)
  const sum = normalizeProjectUsageSummary(getProjectUsageSummaryRaw(projectId))

  if (apiRows === undefined && projectSpaceState.loadingProjectId === projectId) {
    return [
      { id: 'l1', icon: '⏳', label: '同步中', value: '…', delta: '正在加载配额', tone: 'primary', deltaTone: 'default' },
      { id: 'l2', icon: '⏳', label: '请稍候', value: '…', delta: '—', tone: 'default', deltaTone: 'default' },
      { id: 'l3', icon: '⏳', label: '—', value: '…', delta: '—', tone: 'default', deltaTone: 'default' },
      { id: 'l4', icon: '⏳', label: '—', value: '…', delta: '—', tone: 'default', deltaTone: 'default' },
    ]
  }

  const rows = quotaTableRows
  if (isQuotaTableLoading(rows)) {
    return [
      { id: 'l1', icon: '⏳', label: '同步中', value: '…', delta: '正在加载配额', tone: 'primary', deltaTone: 'default' },
      { id: 'l2', icon: '⏳', label: '请稍候', value: '…', delta: '—', tone: 'default', deltaTone: 'default' },
      { id: 'l3', icon: '⏳', label: '—', value: '…', delta: '—', tone: 'default', deltaTone: 'default' },
      { id: 'l4', icon: '⏳', label: '—', value: '…', delta: '—', tone: 'default', deltaTone: 'default' },
    ]
  }

  const usedFromSnap = snap?.usedTokensThisMonth
  const quotaFromSnap = snap?.monthlyTokenQuota
  const usedNum = sum.usedTokens ?? (usedFromSnap != null && usedFromSnap >= 0 ? usedFromSnap : undefined)
  const quotaNum = sum.quotaTokens ?? (quotaFromSnap != null && quotaFromSnap > 0 ? quotaFromSnap : undefined)

  const poolValue =
    quotaNum !== undefined && Number.isFinite(quotaNum) && quotaNum > 0
      ? formatTokensShortLocal(quotaNum)
      : '—'

  let poolDelta = '配额未配置'
  if (quotaNum != null && quotaNum > 0 && usedNum != null && Number.isFinite(usedNum)) {
    const pct =
      sum.percentUsed !== undefined
        ? Math.min(100, Math.round(sum.percentUsed))
        : Math.min(100, Math.round((usedNum / quotaNum) * 100))
    poolDelta = `本月已用 ${formatTokensShortLocal(usedNum)} · ${pct}%`
  } else if (usedNum != null && Number.isFinite(usedNum)) {
    poolDelta = `本月已用 ${formatTokensShortLocal(usedNum)}`
  }

  const totalMembers = Math.max(0, memberCount)
  const totalForActive =
    totalMembers > 0
      ? totalMembers
      : !isQuotaTableLoading(rows) && rows.length > 0
        ? rows.length
        : 0
  const activeFromRows = countActiveConsumersFromQuotaRows(rows)
  let activeN =
    sum.activeMembers != null && Number.isFinite(sum.activeMembers)
      ? Math.round(sum.activeMembers)
      : activeFromRows
  if (totalForActive > 0) {
    activeN = Math.min(Math.max(0, activeN), totalForActive)
  } else {
    activeN = Math.max(0, activeN)
  }
  const idleN = totalForActive > 0 ? Math.max(0, totalForActive - activeN) : 0
  const activeValue = totalForActive > 0 ? `${activeN} / ${totalForActive}` : `${activeN} / —`
  const activeDelta =
    idleN > 0 ? `${idleN} 人本月无消耗` : totalForActive > 0 ? '成员本月均有消耗' : '暂无成员数据'

  const dayInMonth = new Date().getDate()
  let dailyStr = '—'
  let dailyDelta = '数据不足'
  if (usedNum != null && Number.isFinite(usedNum) && usedNum >= 0) {
    const daily = usedNum / Math.max(1, dayInMonth)
    dailyStr = formatTokensShortLocal(daily)
    if (quotaNum != null && quotaNum > 0) {
      const projected = daily * 30
      const ratio = projected / quotaNum
      const tag = ratio <= 0.92 ? '（安全）' : ratio <= 1 ? '（关注）' : '（预警）'
      dailyDelta = `预计月能用 ${formatTokensShortLocal(projected)}${tag}`
    } else {
      dailyDelta = `按当前节奏折算约 ${formatTokensShortLocal(daily * 30)} / 月`
    }
  }

  const capWarnings = countPersonalCapWarnings(rows)
  const warnDelta =
    capWarnings > 0 ? `${capWarnings} 位成员已达或超过个人上限` : '无成员触及个人上限'

  return [
    {
      id: 'pool',
      icon: '🪙',
      label: '项目 Token 池',
      value: poolValue,
      delta: poolDelta,
      tone: 'primary',
      deltaTone: 'success',
    },
    {
      id: 'active',
      icon: '👥',
      label: '活跃消耗成员',
      value: activeValue,
      delta: activeDelta,
      tone: 'default',
      deltaTone: 'success',
    },
    {
      id: 'daily',
      icon: '📈',
      label: '日均消耗',
      value: dailyStr,
      delta: dailyDelta,
      tone: 'default',
      deltaTone: 'success',
    },
    {
      id: 'warn',
      icon: '⚠️',
      label: '超限预警',
      value: String(capWarnings),
      delta: warnDelta,
      tone: capWarnings > 0 ? 'warning' : 'success',
      deltaTone: 'success',
    },
  ]
}

function incidentFocusSectionForProject(projectId: string): ModuleSection {
  if (!isNumericBackendProject(projectId)) {
    return { type: 'incident-focus' }
  }
  const list = getProjectIncidentsList(projectId)
  if (list === undefined) {
    return { type: 'incident-focus' }
  }
  if (list.length === 0) {
    return {
      type: 'incident-focus',
      incident: null,
      emptyHint: '当前项目暂无事故记录。',
    }
  }
  const primary = pickPrimaryIncident(list)!
  return {
    type: 'incident-focus',
    incident: incidentToCardModel(primary),
  }
}

function workspaceMcpSlug(projectId: string): string {
  const snap = getProjectApiSnapshot(projectId)
  const code = snap?.code != null ? String(snap.code).trim() : ''
  if (code) {
    const slug = code.replace(/[^a-zA-Z0-9_-]/g, '_')
    return slug || `proj_${projectId}`
  }
  if (isNumericBackendProject(projectId)) {
    return `proj_${projectId}`
  }
  return 'proj_mall'
}

function buildWorkspaceSections(projectId: string, projectName: string): ModuleSection[] {
  const slug = workspaceMcpSlug(projectId)
  const base = 'https://ai-platform.com'
  return buildWorkspaceModuleSections({
    credentialSubtitle: '凭证有效期至 2026-06-19 · 角色：开发者',
    credentialCodeDisplay: 'plt_zhang3_8f2a91c4d7e6b350',
    credentialBadge: '✅ 已授权',
    knowledgeCountLabel: '12',
    skillCountLabel: '4',
    toolCountLabel: '8',
    integrationCountLabel: '3',
    projectMcpUrl: `${base}/mcp/project/${slug}`,
    globalMcpUrl: `${base}/mcp/global`,
    proxyUrl: `${base}/proxy/anthropic`,
    platformMcpKey: `platform-${projectName}`,
    memberRows: [
      [
        cell('张三'),
        cell('1001', undefined, true),
        cell('ADMIN'),
        cell('有效 · 至 2026-06-19', 'success', false, 'tag'),
        cell('2025-01-10'),
        cell('详情'),
      ],
      [
        cell('李四'),
        cell('1002', undefined, true),
        cell('DEVELOPER'),
        cell('有效', 'success', false, 'tag'),
        cell('2025-02-01'),
        cell('详情'),
      ],
      [
        cell('王五'),
        cell('1003', undefined, true),
        cell('DEVELOPER'),
        cell('3天后过期', 'warning', false, 'tag'),
        cell('2025-02-15'),
        cell('详情'),
      ],
      [
        cell('赵六'),
        cell('1004', undefined, true),
        cell('QA'),
        cell('未创建', 'muted', false, 'tag'),
        cell('—'),
        cell('详情'),
      ],
      [
        cell('钱七'),
        cell('1005', undefined, true),
        cell('PM'),
        cell('有效 · 剩余180天', 'success', false, 'tag'),
        cell('2026-01-20'),
        cell('详情'),
      ],
      [
        cell('ci-bot-mall（🤖 服务账号）'),
        cell('9001', undefined, true),
        cell('GUEST'),
        cell('有效', 'success', false, 'tag'),
        cell('2025-06-01'),
        cell('详情'),
      ],
    ],
  })
}

const pageConfig = computed<ModulePageConfig>(() => {
  if (!project.value) {
    return { sections: [] }
  }

  const projectId = project.value.id

  const configs: Record<string, ModulePageConfig> = {
    // ????????
    agile: {
      sections: [
        {
          type: 'hero',
          eyebrow: `${project.value.name} / 协作`,
          title: '研发流程',
          description: isNumericBackendProject(projectId)
            ? '任务与迭代看板能力规划中；接入需求管理后将在此展示列表与进度。'
            : '查看需求拆分、任务流转与协作进展（原型演示）。',
          actions: [
            { label: '新建任务', variant: 'primary' },
            { label: '生成摘要' },
          ],
        },
        ...(isNumericBackendProject(projectId)
          ? [
              {
                type: 'notes' as const,
                title: '数据说明',
                notes: [
                  {
                    content: '看板与指标均为原型数据，不代表真实迭代状态。',
                    tone: 'warning' as const,
                  },
                ],
              },
            ]
          : []),
        {
          type: 'metrics',
          items: [
            { id: 'open', icon: '📥', label: '待处理', value: '18', delta: '高优先级 5 项', tone: 'primary' },
            { id: 'doing', icon: '⚙️', label: '进行中', value: '8', delta: '本周重点 3 项', tone: 'primary' },
            { id: 'health', icon: '📈', label: '进度健康度', value: '82%', delta: '略快于计划', tone: 'success' },
            { id: 'blocked', icon: '🚧', label: '阻塞项', value: '2', delta: '集中在跨服务联调', tone: 'warning' },
          ],
        },
        {
          type: 'kanban',
          title: '任务看板',
          columns: [
            {
              title: '待开始',
              badge: '5',
              tone: 'warning',
              items: [
                { title: '搜索结果页埋点补充', meta: '产品 / 前端联合需求', badge: 'Story', tone: 'primary' },
                { title: '风控规则白名单配置', meta: '支付网关联调', badge: 'Task', tone: 'warning' },
              ],
            },
            {
              title: '进行中',
              badge: '8',
              tone: 'primary',
              items: [
                { title: '商品搜索 ES 接入', meta: 'mall-backend · 李四', badge: '高优先级', tone: 'primary' },
                { title: '购物车并发锁优化', meta: 'mall-backend · 张三', badge: 'Blocker', tone: 'warning' },
                { title: '搜索页交互体验优化', meta: 'mall-frontend · 王五', badge: 'UI', tone: 'success' },
              ],
            },
            {
              title: '已完成',
              badge: '11',
              tone: 'success',
              items: [
                { title: '支付异常链路监控补齐', meta: '已发布到 PROD', badge: 'Done', tone: 'success' },
                { title: '订单回滚补偿脚本', meta: '已通过 AI Review', badge: 'Done', tone: 'success' },
              ],
            },
          ],
        },
      ],
    },
    workspace: {
      sections: (() => {
        const name = project.value.name
        if (!isNumericBackendProject(projectId)) {
          return buildWorkspaceSections(projectId, name)
        }
        if (user.value?.id == null) {
          return [
            {
              type: 'notes' as const,
              title: '接入与凭证',
              notes: [
                {
                  content: '请先登录后加载与当前用户关联的平台凭证及项目 MCP 配置。',
                  tone: 'primary' as const,
                },
              ],
            },
          ]
        }
        if (workspaceLoading.value) {
          return [
            {
              type: 'notes' as const,
              title: '接入与凭证',
              notes: [
                {
                  content: '正在从后端加载凭证、成员与 MCP 集成…',
                  tone: 'primary' as const,
                },
              ],
            },
          ]
        }
        if (workspaceError.value) {
          return [
            {
              type: 'notes' as const,
              title: '接口提示',
              notes: [
                { content: workspaceError.value, tone: 'danger' as const },
                {
                  content: '下方为演示数据，便于对照布局；接口恢复后将自动展示真实数据。',
                  tone: 'warning' as const,
                },
              ],
            },
            ...buildWorkspaceSections(projectId, name),
          ]
        }
        if (workspaceSections.value?.length) {
          return workspaceSections.value
        }
        return buildWorkspaceSections(projectId, name)
      })(),
    },
    'ai-cap': {
      sections: [
        ...(isNumericBackendProject(projectId)
          ? [
              {
                type: 'notes' as const,
                title: '数据说明',
                notes: [
                  {
                    content:
                      '知识库 Tab：「继承自企业全局知识库」请求 knowledge-sources?source=global；「项目专属知识库」表格请求 source=PROJECT。其余区块多为原型。',
                    tone: 'warning' as const,
                  },
                ],
              },
            ]
          : []),
        {
          type: 'ai-capacity',
          projectName: project.value.name,
          projectId,
          inheritedGlobalKbs: isNumericBackendProject(projectId)
            ? getProjectInheritedGlobalKbs(projectId)
            : undefined,
          knowledgeTable: knowledgeTableForProject(projectId),
          skillTable: skillTableForProject(projectId),
          toolTable: toolTableForProject(projectId),
        },
      ],
    },
    projtools: {
      sections: [
        {
          type: 'hero',
          eyebrow: `${project.value.name} / Tools`,
          title: '工具白名单',
          description:
            isNumericBackendProject(projectId)
              ? '列出已为该项目启用的 MCP / Function 类工具，并与平台工具目录同步。'
              : '管理本项目可调用的工具定义、实现方式与审计级别（演示数据）。',
          actions: [
            { label: '查看全局工具集', variant: 'primary' },
            { label: '同步平台默认' },
          ],
        },
        {
          type: 'table',
          title: '已启用工具',
          badge: isNumericBackendProject(projectId) ? '已同步' : undefined,
          table: toolTableForProject(projectId),
        },
      ],
    },
    services: {
      sections: [
        {
          type: 'services-prototype',
          serviceCount: project.value.services.length,
          items: buildServiceCards(projectId),
        },
      ],
    },
    // ?? / ??????
    knowledge: {
      sections: [
        {
          type: 'hero',
          eyebrow: `${project.value.name} / Knowledge`,
          title: '项目知识库',
          description:
            isNumericBackendProject(projectId)
              ? '包含本项目自有知识库及已在项目侧启用的平台共享知识库，便于统一查看与维护。'
              : '沉淀需求、原型、技术文档和全局规范，供项目成员与 Agent 协同使用。',
          actions: [
            { label: '+ 上传文档', variant: 'primary' },
            { label: '启用全局知识库' },
          ],
        },
        {
          type: 'table',
          title: isNumericBackendProject(projectId) ? '知识库与继承配置' : '文档清单',
          badge: isNumericBackendProject(projectId) ? '已同步' : undefined,
          table: knowledgeTableForProject(projectId),
        },
      ],
    },
    incidents: {
      sections: [
        ...(isNumericBackendProject(projectId)
          ? [
              {
                type: 'notes' as const,
                title: '数据说明',
                notes: [
                  {
                    content:
                      '列表来自 GET /projects/{id}/incidents；展示首条未关闭事故。告警规则见 GET /alert-events（本页未全量接入）。',
                    tone: 'warning' as const,
                  },
                ],
              },
            ]
          : []),
        incidentFocusSectionForProject(projectId),
      ],
    },
    // ?? / Skill / ??????
    members: {
      sections: [
        {
          type: 'table',
          title: '项目成员权限',
          actions: [{ label: '+ 添加成员', variant: 'primary' }],
          table: membersTableForProject(projectId),
        },
      ],
    },
    skillconfig: {
      sections: [
        {
          type: 'hero',
          eyebrow: `${project.value.name} / Skill Config`,
          title: 'Skill 配置',
          description:
            isNumericBackendProject(projectId)
              ? '展示已为该项目启用的 Skill，并与平台技能库保持一致。'
              : '按项目启用或禁用 Skill，并配置其适用范围和审批要求。',
          actions: [
            { label: '保存 Skill 配置', variant: 'primary' },
            { label: '同步平台默认值' },
          ],
        },
        {
          type: 'table',
          title: 'Skill 开关',
          badge: isNumericBackendProject(projectId) ? '已同步' : undefined,
          table: skillTableForProject(projectId),
        },
      ],
    },
    keymanagement: {
      sections: [
        (() => {
          void tokenDashboardRevision.value
          const memberQuotaTable = memberQuotaTableForProject(projectId)
          return {
            type: 'quota-management' as const,
            projectId,
            metrics: quotaPageMetrics(projectId, project.value.memberCount, memberQuotaTable.rows),
            memberQuotaTable,
            tokenDashboard: getProjectTokenDashboardBundle(projectId) ?? null,
          }
        })(),
      ],
    },
    psettings: {
      sections: [
        ...(isNumericBackendProject(projectId)
          ? [
              {
                type: 'notes' as const,
                title: '说明',
                notes: [
                  {
                    content: '表单布局与原型一致；部分字段仍以后端项目档案为准，保存动作为界面占位。',
                    tone: 'warning' as const,
                  },
                ],
              },
            ]
          : []),
        {
          type: 'project-settings-forms',
          projectId,
          name: getProjectApiSnapshot(projectId)?.name?.trim() || project.value.name,
          typeLabel: project.value.typeLabel,
          description:
            getProjectApiSnapshot(projectId)?.description?.trim() || project.value.description || '—',
          tokenLabel: project.value.tokenLabel,
        },
      ],
    },
  }

  return configs[section.value] ?? {
    sections: [
      {
        type: 'hero',
        eyebrow: `${project.value.name} / Project Space`,
        title: '模块建设中',
        description: '该项目模块的路由和上下文已接入，后续可继续补充更细粒度的数据交互。',
      },
    ],
  }
})
</script>

<template>
  <NotFoundProjectState v-if="!project" />

  <section v-else data-testid="project-module-page">
    <ModuleContent :sections="pageConfig.sections" />
  </section>
</template>


