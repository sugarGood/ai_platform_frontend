<script setup lang="ts">
import { computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'

import ModuleContent from '../../components/ui/ModuleContent.vue'
import KeyManagementMonitor from '../../components/ui/KeyManagementMonitor.vue'
import {
  getProjectApiSnapshot,
  getProjectById,
  getProjectKeyMetrics,
  getProjectKnowledgeTableRows,
  getProjectMemberTableRows,
  getProjectQuotaTableRows,
  getProjectSkillTableRows,
  getProjectToolTableRows,
  getProjectUsageActivity,
  getProjectUsageTop,
  projectSpaceState,
  projectTypeLabelMap,
  refreshProjectSpaceFromApi,
} from '../../composables/useProjects'
import type { BackendProjectType } from '../../types/project'
import type {
  CatalogItem,
  ListItem,
  ModulePageConfig,
  ModuleSection,
  PageMetric,
  TableCell,
  TableData,
} from '../../types/module-page'
import NotFoundProjectState from './NotFoundProjectState.vue'
import { useAuth } from '../../composables/useAuth'
import { useKeyMonitoring } from '../../composables/useKeyMonitoring'
import { useProjectWorkspaceApi } from '../../composables/useProjectWorkspace'
import { buildWorkspaceModuleSections } from '../../lib/workspace-module-sections'

const route = useRoute()

// Initialize key monitoring
const { startMonitoring, stopMonitoring, isMonitoring } = useKeyMonitoring()

function isNumericBackendProject(projectId: string) {
  return /^\d+$/.test(projectId)
}

function cell(text: string, tone?: TableCell['tone'], mono = false): TableCell {
  return { text, tone, mono }
}

function membersTableForProject(projectId: string): TableData {
  const apiRows = getProjectMemberTableRows(projectId)
  if (apiRows !== undefined) {
    return {
      columns: ['成员', '用户 ID', '角色', '加入时间'],
      rows: apiRows.length > 0 ? apiRows : [[cell('暂无成员', 'muted'), cell('—'), cell('—'), cell('—')]],
    }
  }
  if (isNumericBackendProject(projectId)) {
    if (projectSpaceState.error) {
      return {
        columns: ['成员', '用户 ID', '角色', '加入时间'],
        rows: [[cell(`加载失败：${projectSpaceState.error}`, 'danger'), cell('—'), cell('—'), cell('—')]],
      }
    }
    return {
      columns: ['成员', '用户 ID', '角色', '加入时间'],
      rows: [[cell('正在从后端加载成员…', 'primary'), cell('—'), cell('—'), cell('—')]],
    }
  }
  return {
    columns: ['成员', '角色', 'Token 配额', '知识库权限', 'Skill 权限', '状态'],
    rows: [
      [cell('张三'), cell('项目负责人'), cell('120K / 月'), cell('读写'), cell('全部'), cell('在线', 'success')],
      [cell('李四'), cell('后端开发'), cell('80K / 月'), cell('读写'), cell('研发类'), cell('在线', 'success')],
      [cell('王五'), cell('前端开发'), cell('60K / 月'), cell('读取'), cell('研发类'), cell('在线', 'success')],
      [cell('赵六'), cell('测试'), cell('40K / 月'), cell('读取'), cell('测试类'), cell('离线', 'muted')],
    ],
  }
}

function knowledgeTableForProject(projectId: string): TableData {
  const apiRows = getProjectKnowledgeTableRows(projectId)
  if (apiRows !== undefined) {
    return {
      columns: ['知识库名称', '来源', '文档数', '状态', '备注'],
      rows:
        apiRows.length > 0 ? apiRows : [[cell('暂无知识库或继承配置', 'muted'), cell('—'), cell('—'), cell('—'), cell('—')]],
    }
  }
  if (isNumericBackendProject(projectId)) {
    if (projectSpaceState.error) {
      return {
        columns: ['知识库名称', '来源', '文档数', '状态', '备注'],
        rows: [[cell(`加载失败：${projectSpaceState.error}`, 'danger'), cell('—'), cell('—'), cell('—'), cell('—')]],
      }
    }
    return {
      columns: ['知识库名称', '来源', '文档数', '状态', '备注'],
      rows: [[cell('正在从后端加载知识库…', 'primary'), cell('—'), cell('—'), cell('—'), cell('—')]],
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
  () => route.params.projectId,
  (pid) => {
    if (typeof pid === 'string') {
      void refreshProjectSpaceFromApi(pid)
    }
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

const mockKeyMetrics: PageMetric[] = [
  { id: 'keys', icon: '🔑', label: '启用 Key', value: '6', delta: 'Claude / GPT / 文心 多模型', tone: 'primary' },
  { id: 'members', icon: '👥', label: '已分配成员', value: '12', delta: '4 个高级权限', tone: 'success' },
  { id: 'usage', icon: '📊', label: '本月使用', value: '68%', delta: '较上月 +12%', tone: 'warning' },
  { id: 'alerts', icon: '⚠️', label: '异常告警', value: '1', delta: '王五配额超限', tone: 'danger' },
]

const mockKeyQuotaTable: TableData = {
  columns: ['成员', '角色', '状态', '配额', '使用量', '操作'],
  rows: [
    [cell('张三'), cell('Owner'), cell('已分配', 'success'), cell('120K'), cell('87K (73%)', 'warning'), cell('调整配额')],
    [cell('李四'), cell('Member'), cell('已分配', 'success'), cell('80K'), cell('52K (65%)', 'primary'), cell('查看详情')],
    [cell('王五'), cell('Member'), cell('已分配', 'success'), cell('60K'), cell('64K (107%)', 'danger'), cell('紧急调整')],
    [cell('赵六'), cell('Viewer'), cell('未分配', 'muted'), cell('--'), cell('--'), cell('分配 Key')],
  ],
}

const mockKeySplitLists: [ListItem[], ListItem[]] = [
  [
    { title: '14:23 李四使用 GPT-4', meta: '消耗 2.3K tokens', badge: '刚刚', tone: 'primary' },
    { title: '14:18 张三使用 Claude-3', meta: '消耗 1.8K tokens', badge: '5分钟前', tone: 'success' },
    { title: '14:15 王五使用 GPT-4', meta: '消耗 4.2K tokens', badge: '8分钟前', tone: 'primary' },
  ],
  [
    { title: '1. 张三', meta: '892K tokens', badge: '第1名', tone: 'success' },
    { title: '2. 王五', meta: '856K tokens', badge: '第2名', tone: 'primary' },
    { title: '3. 李四', meta: '654K tokens', badge: '第3名', tone: 'primary' },
  ],
]

function keyMetricsForProject(projectId: string): PageMetric[] {
  if (!isNumericBackendProject(projectId)) return mockKeyMetrics
  if (projectSpaceState.error) {
    return [
      {
        id: 'err',
        icon: '⚠️',
        label: '项目空间',
        value: '加载失败',
        delta: projectSpaceState.error,
        tone: 'danger',
      },
      ...mockKeyMetrics.slice(1),
    ]
  }
  const api = getProjectKeyMetrics(projectId)
  if (api) return api
  if (projectSpaceState.loadingProjectId === projectId) {
    return [
      { id: 'load', icon: '⏳', label: '同步中', value: '…', delta: '正在拉取项目、配额与用量', tone: 'primary' },
      { id: 'load2', icon: '⏳', label: '请稍候', value: '…', delta: '与项目详情一并刷新', tone: 'default' },
      { id: 'load3', icon: '⏳', label: '—', value: '…', delta: '—', tone: 'default' },
      { id: 'load4', icon: '⏳', label: '—', value: '…', delta: '—', tone: 'default' },
    ]
  }
  return mockKeyMetrics
}

function quotaTableForKeyManagement(projectId: string): TableData {
  const apiCols = ['成员', '配额类型', '已用 / 上限', '重置周期', '状态']
  const emptyApiRow = [cell('—'), cell('—'), cell('—'), cell('—'), cell('—')] as TableCell[]

  if (!isNumericBackendProject(projectId)) return mockKeyQuotaTable
  if (projectSpaceState.error) {
    return {
      columns: apiCols,
      rows: [[cell(`加载失败：${projectSpaceState.error}`, 'danger'), ...emptyApiRow.slice(1)]],
    }
  }
  const rows = getProjectQuotaTableRows(projectId)
  if (rows !== undefined) {
    return {
      columns: apiCols,
      rows:
        rows.length > 0
          ? rows
          : [[cell('暂无配额记录', 'muted'), cell('—'), cell('—'), cell('—'), cell('—')]],
    }
  }
  if (projectSpaceState.loadingProjectId === projectId) {
    return {
      columns: apiCols,
      rows: [[cell('正在加载成员配额…', 'primary'), ...emptyApiRow.slice(1)]],
    }
  }
  return {
    columns: apiCols,
    rows: [[cell('等待项目空间同步…', 'muted'), ...emptyApiRow.slice(1)]],
  }
}

function keyManagementSplitItems(projectId: string) {
  const [mockLeft, mockRight] = mockKeySplitLists
  const emptyMuted = (title: string, meta: string): ListItem => ({ title, meta, tone: 'muted' })

  if (!isNumericBackendProject(projectId)) {
    return [
      { title: '实时使用监控', list: mockLeft },
      { title: 'Top 活跃成员', list: mockRight },
    ]
  }
  if (projectSpaceState.error) {
    const err: ListItem = { title: '加载失败', meta: projectSpaceState.error, tone: 'danger' }
    return [
      { title: '最近用量事件', list: [err] },
      { title: 'Top 成员', list: [emptyMuted('—', '—')] },
    ]
  }
  const left = getProjectUsageActivity(projectId)
  const right = getProjectUsageTop(projectId)
  if (left !== undefined && right !== undefined) {
    return [
      {
        title: '最近用量事件（分页样本）',
        list: left.length > 0 ? left : [emptyMuted('暂无事件', '当前分页内没有用量记录')],
      },
      {
        title: '本页 Top 成员（按 tokens）',
        list: right.length > 0 ? right : [emptyMuted('暂无汇总', '本页事件中无 userId')],
      },
    ]
  }
  if (projectSpaceState.loadingProjectId === projectId) {
    const loading: ListItem = { title: '正在加载用量数据…', meta: '请稍候', tone: 'primary' }
    return [
      { title: '最近用量事件', list: [loading] },
      { title: 'Top 成员', list: [loading] },
    ]
  }
  return [
    { title: '实时使用监控', list: mockLeft },
    { title: 'Top 活跃成员', list: mockRight },
  ]
}

function keyManagementListGridCards(projectId: string) {
  const mockCards = [
    {
      title: '异常告警',
      items: [
        {
          title: '配额预警',
          meta: '王五本月使用量已超额7%',
          description: '建议调整配额或优化使用模式',
          badge: '需处理',
          tone: 'danger' as const,
        },
      ],
    },
    {
      title: '优化建议',
      items: [
        {
          title: '配额建议',
          meta: '项目整体使用率68%',
          description: '可考虑为新成员分配剩余配额',
          badge: '建议',
          tone: 'primary' as const,
        },
      ],
    },
  ]

  if (!isNumericBackendProject(projectId)) return mockCards

  const metrics = getProjectKeyMetrics(projectId)
  const failN = Number(metrics?.find((m) => m.id === 'fail')?.value ?? 0)
  const quotaN = Number(metrics?.find((m) => m.id === 'quotas')?.value ?? 0)
  const tokMetric = metrics?.find((m) => m.id === 'tokens')

  const alertItems: ListItem[] =
    failN > 0
      ? [
          {
            title: '存在非成功调用',
            meta: `本页用量样本中约 ${failN} 条未成功`,
            description: '请结合下方「最近用量事件」查看失败原因说明。',
            badge: '需关注',
            tone: 'danger' as const,
          },
        ]
      : [
          {
            title: '调用状态正常',
            meta: '本页用量样本中未发现失败记录',
            badge: 'OK',
            tone: 'success' as const,
          },
        ]

  const suggestItems: ListItem[] = [
    {
      title: '成员配额',
      meta: `成员配额共 ${Number.isFinite(quotaN) ? quotaN : 0} 条`,
      description: '与上方「成员 AI 配额」表一致，只读展示。',
      badge: '只读',
      tone: 'primary' as const,
    },
    {
      title: '用量样本',
      meta: tokMetric ? `近页合计约 ${tokMetric.value} tokens` : '—',
      description: tokMetric?.delta ?? '按时间分页汇总的用量样本。',
      badge: '样本',
      tone: 'warning' as const,
    },
  ]

  return [
    { title: '告警与状态（后端样本）', items: alertItems },
    { title: '说明', items: suggestItems },
  ]
}

function psettingsSplitItems(projectId: string, detailName: string, typeLabel: string, description: string) {
  const snap = getProjectApiSnapshot(projectId)
  if (!snap) {
    return [
      {
        title: '基础信息',
        lines: [
          { label: '项目名称', value: detailName },
          { label: '项目类型', value: typeLabel },
          { label: 'AI 能力', value: project.value!.aiCapabilityLabel },
          { label: '项目描述', value: description },
        ],
      },
      {
        title: '研发配置',
        lines: [
          { label: '分支策略', value: 'Git Flow（推荐）' },
          { label: 'CI/CD 模板', value: '标准 Java / Web 双通道' },
          { label: 'Token 配额', value: `${project.value!.tokenLabel} / 月` },
          { label: '默认评审模型', value: 'claude-sonnet-4-6', mono: true },
        ],
      },
      {
        title: '已关联原子能力',
        list: [
          {
            title: '统一认证 SSO',
            meta: '已在用户登录与后台管理接入',
            badge: '启用',
            tone: 'success' as const,
          },
          {
            title: '短信服务',
            meta: '验证码与消息通知均已开通',
            badge: '启用',
            tone: 'success' as const,
          },
          {
            title: 'OSS 对象存储',
            meta: '商品图片与订单附件统一托管',
            badge: '启用',
            tone: 'success' as const,
          },
        ],
      },
      {
        title: '治理提醒',
        notes: [
          { label: '建议', content: '将支付相关服务加入高风险审批清单，并提高事故演练频率。', tone: 'warning' as const },
          { label: '说明', content: '项目设置会同步影响 MCP Server 暴露的工具集合与权限边界。', tone: 'primary' as const },
        ],
      },
    ]
  }

  const pt = projectTypeLabelMap[snap.projectType as BackendProjectType] ?? snap.projectType
  const created = snap.createdAt?.slice(0, 10) ?? '—'
  const updated = snap.updatedAt?.replace('T', ' ').slice(0, 19) ?? '—'

  return [
    {
      title: '基础信息',
      lines: [
        { label: '项目 ID', value: String(snap.id), mono: true },
        { label: '编码 code', value: snap.code, mono: true },
        { label: '名称', value: snap.name },
        { label: '类型', value: pt },
        { label: '状态', value: snap.status },
        { label: '描述', value: snap.description?.trim() || '—' },
        { label: '图标', value: snap.icon?.trim() || '—' },
        { label: '创建日期', value: created },
        {
          label: '负责人 ownerUserId',
          value: snap.ownerUserId != null ? String(snap.ownerUserId) : '—',
          mono: true,
        },
        {
          label: '创建人 createdBy',
          value: snap.createdBy != null ? String(snap.createdBy) : '—',
          mono: true,
        },
        { label: 'updatedAt', value: updated },
      ],
    },
    {
      title: '研发配置（演示）',
      lines: [
        { label: '说明', value: '下列为 UI 占位；后端暂无统一「项目级研发模板」接口。' },
        { label: 'CI/CD 模板', value: '标准 Java / Web 双通道（演示）' },
        { label: 'Token 展示', value: `${project.value!.tokenLabel} / 月（列表或用量摘要）` },
        { label: '默认评审模型', value: 'claude-sonnet-4-6', mono: true },
      ],
    },
    {
      title: '已关联原子能力（演示）',
      list: [
        { title: '统一认证 SSO', meta: '演示数据', badge: '演示', tone: 'muted' as const },
        { title: '短信服务', meta: '演示数据', badge: '演示', tone: 'muted' as const },
        { title: 'OSS 对象存储', meta: '演示数据', badge: '演示', tone: 'muted' as const },
      ],
    },
    {
      title: '治理提醒',
      notes: [
        {
          label: '说明',
          content: '基础信息来自后端项目 DTO；原子能力与部分流程仍为原型。',
          tone: 'primary' as const,
        },
        {
          label: '建议',
          content: '将支付相关服务加入高风险审批清单，并提高事故演练频率。',
          tone: 'warning' as const,
        },
      ],
    },
  ]
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
        cell('技术负责人'),
        cell('有效', 'success'),
        cell('✅ 已接入', 'success'),
        cell('5 分钟前'),
        cell('详情'),
      ],
      [
        cell('李四'),
        cell('前端开发'),
        cell('有效', 'success'),
        cell('✅ 已接入', 'success'),
        cell('20 分钟前'),
        cell('详情'),
      ],
      [
        cell('王五'),
        cell('后端开发'),
        cell('3天后过期', 'warning'),
        cell('✅ 已接入', 'success'),
        cell('1 小时前'),
        cell('详情 · 提醒续签'),
      ],
      [
        cell('赵六'),
        cell('测试工程师'),
        cell('有效', 'success'),
        cell('📦 未接入', 'muted'),
        cell('—'),
        cell('详情 · 发送指南'),
      ],
      [
        cell('钱七'),
        cell('产品经理'),
        cell('有效', 'success'),
        cell('✅ 已接入', 'success'),
        cell('今天 14:00'),
        cell('详情'),
      ],
      [
        cell('ci-bot-mall（🤖 服务账号）'),
        cell('CI/CD'),
        cell('有效', 'success'),
        cell('✅ 运行中', 'success'),
        cell('2 分钟前'),
        cell('详情'),
      ],
    ],
  })
}

function aiCapCatalogItems(projectId: string): CatalogItem[] {
  const mockItems: CatalogItem[] = [
    {
      icon: '🧠',
      title: '模型路由',
      subtitle: '默认 / 高风险 / 低成本',
      badge: '已配置',
      tone: 'success',
      description: 'Review 走 Sonnet，生产变更走 Opus 审批，低成本场景回退 Haiku。',
    },
    {
      icon: '📚',
      title: '知识库',
      subtitle: '全局 + 项目',
      badge: '继承',
      tone: 'primary',
      description: '全局规范默认开启；可挂载项目需求 / 接口 / 原型资产。',
    },
    {
      icon: '🔩',
      title: '工具白名单',
      subtitle: 'MCP / Function',
      badge: '最小权限',
      tone: 'warning',
      description: '按角色裁剪可调用的工具；高风险工具绑定二次确认与审计。',
    },
  ]

  if (!isNumericBackendProject(projectId)) return mockItems

  const [m0, m1, m2] = mockItems
  if (!m0 || !m1 || !m2) return mockItems

  const loading = projectSpaceState.loadingProjectId === projectId
  const kb = getProjectKnowledgeTableRows(projectId)
  const sk = getProjectSkillTableRows(projectId)
  const tl = getProjectToolTableRows(projectId)

  const countBadge = (rows: TableCell[][] | undefined) => {
    if (rows === undefined) return loading ? '加载中' : '—'
    return `${rows.length} 条`
  }

  const kbDesc = kb === undefined ? (loading ? '…' : '—') : String(kb.length)

  return [
    {
      icon: m0.icon,
      title: m0.title,
      subtitle: m0.subtitle,
      badge: '原型',
      tone: m0.tone,
      description: '模型路由配置走后端能力中心；此处为能力总览占位。',
    },
    {
      icon: m1.icon,
      title: m1.title,
      subtitle: '知识库 Tab 行数（当前后端未接则恒为 0）',
      badge: countBadge(kb),
      tone: m1.tone,
      description: `刷新后表格行数：${kbDesc}（占位模块，待接入知识库 API）。`,
    },
    {
      icon: m2.icon,
      title: m2.title,
      subtitle: `Skill ${countBadge(sk)} · 工具 ${countBadge(tl)}`,
      badge: '行数',
      tone: m2.tone,
      description: 'Skill / 工具 Tab 为占位行数；待接入对应后端接口后替换。',
    },
  ]
}

// Monitor section changes for key management
watch(
  section,
  (newSection, oldSection) => {
    if (oldSection === 'keymanagement' && newSection !== 'keymanagement') {
      console.log('离开Key管理页面，停止监控')
      stopMonitoring()
    }

    if (newSection === 'keymanagement' && oldSection !== 'keymanagement') {
      console.log('进入Key管理页面，启动监控')
      setTimeout(() => {
        startMonitoring()
      }, 1000) // Delay to ensure component is fully mounted
    }
  },
  { immediate: false }
)

// Auto-start monitoring if landing directly on key management
onMounted(() => {
  if (section.value === 'keymanagement') {
    console.log('直接访问Key管理页面，启动监控')
    setTimeout(() => {
      startMonitoring()
    }, 1500)
  }
})

// Cleanup on unmount
onUnmounted(() => {
  if (isMonitoring.value) {
    console.log('组件卸载，停止监控')
    stopMonitoring()
  }
})

// ??????? section ??????????????????????
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
        {
          type: 'hero',
          eyebrow: `${project.value.name} / AI`,
          title: 'AI 能力配置',
          description: isNumericBackendProject(projectId)
            ? '数字项目下，知识库 / Skill / 工具行数来自已接入的查询接口；模型路由等仍以占位说明为主。'
            : '为本项目启用模型路由、知识库继承、Skill 与工具白名单；变更会同步影响 MCP 暴露集合。',
          actions: [{ label: '保存配置', variant: 'primary' }, { label: '同步平台默认' }],
        },
        {
          type: 'catalog-grid',
          columns: 3,
          items: aiCapCatalogItems(projectId),
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
          type: 'hero',
          eyebrow: `${project.value.name} / Services`,
          title: '代码服务',
          description: '管理项目下的代码服务、仓库信息、环境状态和接入方式。',
          actions: [
            { label: '+ 添加服务', variant: 'primary' },
            { label: '查看仓库接入规范' },
          ],
        },
        {
          type: 'catalog-grid',
          columns: 3,
          items: buildServiceCards(projectId),
        },
        {
          type: 'catalog-grid',
          columns: 3,
          title: '添加新服务',
          items: [
            { icon: '🗂️', title: '选择模板创建', subtitle: '从公司标准模板快速初始化服务', description: '适合新建 BFF、前端控制台、Java 服务或 Python 数据服务。' },
            { icon: '🔗', title: '关联已有仓库', subtitle: '填入 Git 地址，自动识别技术栈', description: '会自动补全主干分支、CI/CD 模板与基础监控配置。' },
            { icon: '📥', title: '导入 Git 仓库', subtitle: '从 GitHub / GitLab / 自建 Git 导入', description: '支持批量导入并自动生成 MCP Server 接入信息。' },
          ],
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
        {
          type: 'hero',
          eyebrow: `${project.value.name} / Incident`,
          title: '项目事故',
          description: isNumericBackendProject(projectId)
            ? '下方列表为事故响应流程的原型演示，后端暂无事故 / 诊断 API；请勿当作真实工单。'
            : '查看项目事故详情、AI 根因分析和修复建议，支持直接在 IDE 领取处理。',
          actions: [
            { label: '新建事故', variant: 'primary' },
            { label: '拉取诊断报告' },
          ],
        },
        ...(isNumericBackendProject(projectId)
          ? [
              {
                type: 'notes' as const,
                title: '数据说明',
                notes: [
                  {
                    content: '卡片中的事故与 AI 诊断文案均为静态示例。',
                    tone: 'warning' as const,
                  },
                ],
              },
            ]
          : []),
        {
          type: 'list-grid',
          columns: 2,
          cards: [
            {
              title: '当前重点事故',
              items: [
                {
                  title: '支付服务 NullPointerException - mall-backend',
                  meta: '严重 · 处理中',
                  description: 'AI 诊断认为 checkout 接口未对 paymentMethod 做非空校验，建议在 OrderController 增加参数校验并补偿回滚。',
                  badge: '处理中',
                  tone: 'danger',
                },
                {
                  title: '前端打包体积超限',
                  meta: '提示 · 观察中',
                  description: '搜索模块引入的图表依赖导致 bundle 增大，建议拆分懒加载。',
                  badge: 'AI 分析中',
                  tone: 'primary',
                },
              ],
            },
            {
              title: 'AI 诊断',
              items: [
                { title: '根因定位', meta: 'OrderController:89 参数校验缺失', badge: '已完成', tone: 'success' },
                { title: '修复建议', meta: '增加空值校验 + 失败补偿事务', badge: '待确认', tone: 'warning' },
                { title: 'IDE 接力', meta: '可直接创建修复任务并在 IDE 中一键领取', badge: '可执行', tone: 'primary' },
              ],
            },
          ],
        },
      ],
    },
    // ?? / Skill / ??????
    members: {
      sections: [
        {
          type: 'hero',
          eyebrow: `${project.value.name} / Members`,
          title: '成员权限',
          description: '管理项目成员、角色、Token 配额以及知识库和 Skill 的使用权限。',
          actions: [
            { label: '邀请成员', variant: 'primary' },
            { label: '批量调整权限' },
          ],
        },
        {
          type: 'table',
          title: '成员列表',
          badge: isNumericBackendProject(projectId) ? '已同步' : undefined,
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
        {
          type: 'hero',
          eyebrow: `${project.value.name} / Key Management`,
          title: 'Key 管理中心',
          description: isNumericBackendProject(projectId)
            ? '上方为成员配额与用量列表等实时拉取数据；下方「实时使用」区块为界面演示，不代表生产监控。'
            : '统一管理项目 API Key 分配、配额监控、使用统计和异常告警。',
          actions: [
            { label: '分配新 Key', variant: 'primary' },
            { label: '导出使用报告' },
          ],
        },
        {
          type: 'metrics',
          items: keyMetricsForProject(projectId),
        },
        {
          type: 'table',
          title: isNumericBackendProject(projectId) ? '成员 AI 配额' : '成员 Key 分配',
          badge: isNumericBackendProject(projectId) ? '配额' : undefined,
          table: quotaTableForKeyManagement(projectId),
        },
        {
          type: 'split',
          columns: 2,
          items: keyManagementSplitItems(projectId),
        },
        {
          type: 'list-grid',
          columns: 2,
          cards: keyManagementListGridCards(projectId),
        },
      ],
    },
    psettings: {
      sections: [
        {
          type: 'hero',
          eyebrow: `${project.value.name} / Settings`,
          title: '项目设置',
          description: isNumericBackendProject(projectId)
            ? '基础信息与平台项目档案同步；研发配置、原子能力关联等模块仍为界面原型，便于评审布局。'
            : '维护项目基础信息、Token 配额、模板和原子能力关联。',
          actions: [
            { label: '保存项目设置', variant: 'primary' },
            { label: '查看变更记录' },
          ],
        },
        {
          type: 'split',
          columns: 2,
          items: psettingsSplitItems(projectId, project.value.name, project.value.typeLabel, project.value.description),
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

    <!-- Key Management Monitor - only show for keymanagement section -->
    <KeyManagementMonitor
      v-if="section === 'keymanagement'"
      :auto-start="false"
    />
  </section>
</template>


