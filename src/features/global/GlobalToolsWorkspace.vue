<script setup lang="ts">
import { computed, reactive, ref } from 'vue'

import CardPanel from '../../components/ui/CardPanel.vue'
import PrototypeModal from '../../components/ui/PrototypeModal.vue'
import StatCard from '../../components/ui/StatCard.vue'

type PillVariant = 'primary' | 'success' | 'warning' | 'danger' | 'muted'
type RegisterImpl = 'mcp' | 'http' | 'internal'
type AuditLevel = 'normal' | 'sensitive' | 'critical'
type HitlLevel = 'none' | 'first' | 'always'

interface ToolRow {
  id: string
  icon: string
  toolId: string
  displayName: string
  categoryKey: string
  categoryLabel: string
  categoryVariant: PillVariant
  sourceLabel: string
  sourceVariant: PillVariant
  impl: string
  implType: RegisterImpl
  connection: string
  createdAt: string
  auditLabel: string
  auditCode: AuditLevel
  auditVariant: PillVariant
  statusLabel: string
  statusVariant: PillVariant
  desc: string
  inputSchema: string
  outputSchema: string
  calls: string
  successRate: string
  p99: string
  projects: string
  hitl: string
  sensitive: string
}

interface ParamRow {
  id: string
  name: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  required: boolean
  desc: string
}

interface CategoryPreset {
  hint: string
  idPrefix: string
  namePlaceholder: string
  descPlaceholder: string
  implType: RegisterImpl
  connections: string[]
  params: Omit<ParamRow, 'id'>[]
  audit: AuditLevel
  hitl: HitlLevel
}

interface KnowledgeBaseRow {
  id: string
  name: string
  icon: string
  type: string
  typeVariant: PillVariant
  chunks: string
  hits: string
  mode: string
  ready: boolean
}

interface RegisterFormState {
  toolId: string
  displayName: string
  category: string
  description: string
  implType: RegisterImpl
  connection: string
  mcpToolName: string
  callbackUrl: string
  httpMethod: 'POST' | 'GET'
  httpAuth: 'Bearer Token' | 'API Key (Header)' | '无（内网信任）'
  audit: AuditLevel
  hitl: HitlLevel
  kbTopK: string
  kbThreshold: string
  kbSelected: string[]
}

const CATEGORY_OPTIONS = ['全部分类', '知识库', '代码', '项目管理', '通知', '数据'] as const
const REGISTER_CATEGORY_OPTIONS = ['知识库', '代码', '项目管理', '通知', '数据', 'CRM', '审批', '监控'] as const
const ALL_CONNECTIONS = ['GitHub', 'GitLab', 'Jira', '飞书 / Lark', '内部 CRM', 'OA 审批系统', '运维监控'] as const
const PARAM_TYPES = ['string', 'number', 'boolean', 'array', 'object'] as const
const HTTP_AUTH_OPTIONS = ['Bearer Token', 'API Key (Header)', '无（内网信任）'] as const
const DEFAULT_KB = ['kb-company-code', 'kb-security', 'kb-ui', 'kb-arch'] as const

const INITIAL_TOOLS: ToolRow[] = [
  {
    id: 't1',
    icon: '📚',
    toolId: 'search_knowledge',
    displayName: '搜索知识库',
    categoryKey: '知识库',
    categoryLabel: '知识库',
    categoryVariant: 'primary',
    sourceLabel: '内置',
    sourceVariant: 'success',
    impl: '内部函数',
    implType: 'internal',
    connection: '平台知识库引擎（内置）',
    createdAt: '2025-06-01',
    auditLabel: '普通',
    auditCode: 'normal',
    auditVariant: 'muted',
    statusLabel: '● 启用',
    statusVariant: 'success',
    desc: '当用户提出与文档、知识、规范相关的问题时调用此工具。在企业知识库中进行语义检索，支持按项目、知识源类型筛选，返回最相关的文档片段及其来源和相关度评分。',
    inputSchema: '{\n  "query": "string",\n  "project": "string?",\n  "top_k": "number?",\n  "source_type": "string?"\n}',
    outputSchema: '{\n  "results": [{ "text": "...", "score": 0.94, "source": "技术规范/支付模块.md" }],\n  "total": 12\n}',
    calls: '2,841',
    successRate: '99.8%',
    p99: '180ms',
    projects: '全部项目',
    hitl: '无需人工确认',
    sensitive: '不涉及敏感数据',
  },
  {
    id: 't2',
    icon: '📋',
    toolId: 'query_jira',
    displayName: '查询 Jira 工单',
    categoryKey: '项目管理',
    categoryLabel: '项目管理',
    categoryVariant: 'warning',
    sourceLabel: '企业级',
    sourceVariant: 'primary',
    impl: 'MCP 代理',
    implType: 'mcp',
    connection: 'Jira（company.atlassian.net）',
    createdAt: '2025-08-15',
    auditLabel: '普通',
    auditCode: 'normal',
    auditVariant: 'muted',
    statusLabel: '● 启用',
    statusVariant: 'success',
    desc: '当用户需要查询项目任务、Bug、需求等工单信息时调用。支持按工单号、关键词、状态、经办人筛选。',
    inputSchema: '{\n  "jql": "string?",\n  "issue_key": "string?",\n  "keyword": "string?",\n  "status": "string?",\n  "max_results": "number?"\n}',
    outputSchema: '{\n  "issues": [{ "key": "SHOP-1234", "summary": "支付超时处理优化" }],\n  "total": 38\n}',
    calls: '1,562',
    successRate: '97.8%',
    p99: '420ms',
    projects: '3 个',
    hitl: '无需人工确认',
    sensitive: '不涉及敏感数据',
  },
  {
    id: 't3',
    icon: '📝',
    toolId: 'create_jira',
    displayName: '创建 Jira 工单',
    categoryKey: '项目管理',
    categoryLabel: '项目管理',
    categoryVariant: 'warning',
    sourceLabel: '企业级',
    sourceVariant: 'primary',
    impl: 'MCP 代理',
    implType: 'mcp',
    connection: 'Jira（company.atlassian.net）',
    createdAt: '2025-08-15',
    auditLabel: '敏感',
    auditCode: 'sensitive',
    auditVariant: 'warning',
    statusLabel: '● 启用',
    statusVariant: 'success',
    desc: '当用户需要创建新的任务、Bug 报告或需求工单时调用。创建操作为写入操作，每次调用需记录审计日志。',
    inputSchema: '{\n  "project": "string",\n  "issue_type": "string",\n  "summary": "string",\n  "description": "string?",\n  "priority": "string?"\n}',
    outputSchema: '{\n  "key": "SHOP-1289",\n  "url": "https://company.atlassian.net/browse/SHOP-1289",\n  "status": "created"\n}',
    calls: '389',
    successRate: '99.2%',
    p99: '650ms',
    projects: '2 个',
    hitl: '首次调用需人工确认',
    sensitive: '涉及项目数据写入',
  },
  {
    id: 't4',
    icon: '🦊',
    toolId: 'query_gitlab',
    displayName: '查询 GitLab 信息',
    categoryKey: '代码',
    categoryLabel: '代码',
    categoryVariant: 'muted',
    sourceLabel: '企业级',
    sourceVariant: 'primary',
    impl: 'HTTP 回调',
    implType: 'http',
    connection: 'GitLab（gitlab.company.com）',
    createdAt: '2025-09-20',
    auditLabel: '普通',
    auditCode: 'normal',
    auditVariant: 'muted',
    statusLabel: '● 启用',
    statusVariant: 'success',
    desc: '查询 GitLab 代码仓库信息，包括项目列表、分支、MR 状态、Pipeline 结果和文件内容。',
    inputSchema: '{\n  "action": "string",\n  "project_id": "number",\n  "ref": "string?",\n  "path": "string?"\n}',
    outputSchema: '{\n  "data": {},\n  "total": 15\n}',
    calls: '876',
    successRate: '98.1%',
    p99: '380ms',
    projects: '3 个',
    hitl: '无需人工确认',
    sensitive: '涉及源代码读取',
  },
  {
    id: 't5',
    icon: '🔔',
    toolId: 'send_notification',
    displayName: '发送企业通知',
    categoryKey: '通知',
    categoryLabel: '通知',
    categoryVariant: 'muted',
    sourceLabel: '企业级',
    sourceVariant: 'primary',
    impl: 'HTTP 回调',
    implType: 'http',
    connection: '飞书 / Lark（open.feishu.cn）',
    createdAt: '2025-10-05',
    auditLabel: '敏感',
    auditCode: 'sensitive',
    auditVariant: 'warning',
    statusLabel: '● 启用',
    statusVariant: 'success',
    desc: '向指定用户或群组发送企业通知消息。支持飞书消息卡片、文本消息和富文本格式。',
    inputSchema: '{\n  "target": "string",\n  "type": "string",\n  "content": "string",\n  "urgent": "boolean?"\n}',
    outputSchema: '{\n  "message_id": "om_xxxxxx",\n  "status": "sent"\n}',
    calls: '1,923',
    successRate: '99.5%',
    p99: '220ms',
    projects: '全部',
    hitl: '加急消息需人工确认',
    sensitive: '涉及用户通讯信息',
  },
  {
    id: 't6',
    icon: '📊',
    toolId: 'query_data_platform',
    displayName: '查询数据平台',
    categoryKey: '数据',
    categoryLabel: '数据',
    categoryVariant: 'warning',
    sourceLabel: '企业级',
    sourceVariant: 'primary',
    impl: 'HTTP 回调',
    implType: 'http',
    connection: '内部数据平台（data-api.internal）',
    createdAt: '2025-11-12',
    auditLabel: '关键',
    auditCode: 'critical',
    auditVariant: 'danger',
    statusLabel: '● 启用',
    statusVariant: 'success',
    desc: '查询企业内部数据平台的业务指标和报表数据。涉及核心业务数据，需双人审批确认。',
    inputSchema: '{\n  "mode": "string",\n  "query": "string?",\n  "metric_id": "string?",\n  "time_range": "string?",\n  "datasource": "string"\n}',
    outputSchema: '{\n  "columns": ["date", "revenue", "orders"],\n  "rows": [["2026-03-01", 128000, 342]],\n  "row_count": 30\n}',
    calls: '456',
    successRate: '96.2%',
    p99: '1.8s',
    projects: '2 个',
    hitl: '每次调用需双人审批',
    sensitive: '涉及核心业务数据（收入/订单/用户）',
  },
]

const CATEGORY_PRESETS: Record<string, CategoryPreset> = {
  知识库: {
    hint: '<strong>知识库类工具</strong>：用于企业知识检索、文档查询和知识问答。通常为<strong>内部函数</strong>实现，关联平台知识库引擎。',
    idPrefix: 'search_',
    namePlaceholder: '例如：搜索产品文档',
    descPlaceholder: '当用户提出与文档、规范、FAQ 相关的问题时调用。在指定知识库中进行语义检索，返回最相关的文档片段。',
    implType: 'internal',
    connections: [],
    params: [
      { name: 'query', type: 'string', required: true, desc: '搜索关键词或自然语言问题' },
      { name: 'project', type: 'string', required: false, desc: '限定项目范围（可选）' },
      { name: 'top_k', type: 'number', required: false, desc: '返回条数，默认 5' },
      { name: 'source_type', type: 'string', required: false, desc: '知识源类型：doc / api / code' },
    ],
    audit: 'normal',
    hitl: 'none',
  },
  代码: {
    hint: '<strong>代码类工具</strong>：用于代码仓库查询、MR 管理、Pipeline 状态。通常为 <strong>MCP 代理</strong>实现，关联 GitHub 或 GitLab 连接。',
    idPrefix: 'query_',
    namePlaceholder: '例如：查询代码仓库',
    descPlaceholder: '查询代码仓库中的项目、分支、MR 状态和 Pipeline 结果。',
    implType: 'mcp',
    connections: ['GitHub', 'GitLab'],
    params: [
      { name: 'action', type: 'string', required: true, desc: '操作类型：list_mrs / get_pipeline / get_file / search_code' },
      { name: 'project_id', type: 'string', required: true, desc: '仓库项目 ID 或路径' },
      { name: 'ref', type: 'string', required: false, desc: '分支名，默认 main' },
      { name: 'path', type: 'string', required: false, desc: '文件路径（get_file 时使用）' },
    ],
    audit: 'normal',
    hitl: 'none',
  },
  项目管理: {
    hint: '<strong>项目管理类工具</strong>：用于工单查询/创建、Sprint 管理。通常为 <strong>MCP 代理</strong>实现，关联 Jira 连接。',
    idPrefix: '',
    namePlaceholder: '例如：查询 Jira 工单',
    descPlaceholder: '查询或管理项目工单信息，支持按工单号、关键词、状态、经办人筛选。',
    implType: 'mcp',
    connections: ['Jira', '飞书 / Lark'],
    params: [
      { name: 'issue_key', type: 'string', required: false, desc: '工单号，如 SHOP-1234' },
      { name: 'keyword', type: 'string', required: false, desc: '关键词搜索' },
      { name: 'status', type: 'string', required: false, desc: '状态筛选：open / in_progress / done' },
      { name: 'project', type: 'string', required: true, desc: '项目 Key，如 SHOP' },
    ],
    audit: 'normal',
    hitl: 'none',
  },
  通知: {
    hint: '<strong>通知类工具</strong>：向用户或群组发送消息、告警和任务提醒。通常关联<strong>飞书</strong>连接。涉及通讯信息，建议设置<strong>敏感</strong>审计。',
    idPrefix: 'send_',
    namePlaceholder: '例如：发送飞书通知',
    descPlaceholder: '向指定用户或群组发送企业通知消息。支持文本、消息卡片和富文本格式。',
    implType: 'mcp',
    connections: ['飞书 / Lark', 'OA 审批系统'],
    params: [
      { name: 'target', type: 'string', required: true, desc: '用户邮箱或群组 ID' },
      { name: 'type', type: 'string', required: true, desc: '消息类型：text / card / rich_text' },
      { name: 'content', type: 'string', required: true, desc: '消息内容' },
      { name: 'urgent', type: 'boolean', required: false, desc: '是否加急（默认 false）' },
    ],
    audit: 'sensitive',
    hitl: 'first',
  },
  数据: {
    hint: '<strong>数据类工具</strong>：查询业务指标和报表数据。涉及核心业务数据，<strong>必须</strong>设置为关键审计级别，建议开启双人审批。',
    idPrefix: 'query_',
    namePlaceholder: '例如：查询销售报表',
    descPlaceholder: '查询企业数据平台的业务指标和报表数据。支持 SQL 查询和预定义指标两种模式。',
    implType: 'http',
    connections: [],
    params: [
      { name: 'mode', type: 'string', required: true, desc: '查询模式：sql / metric' },
      { name: 'query', type: 'string', required: false, desc: 'SQL 语句（mode=sql 时）' },
      { name: 'metric_id', type: 'string', required: false, desc: '指标 ID（mode=metric 时）' },
      { name: 'time_range', type: 'string', required: false, desc: '时间范围：7d / 30d / 90d' },
      { name: 'datasource', type: 'string', required: true, desc: '数据源名称' },
    ],
    audit: 'critical',
    hitl: 'always',
  },
  CRM: {
    hint: '<strong>CRM 类工具</strong>：查询客户信息、商机和跟进记录。关联<strong>内部 CRM</strong>连接。涉及客户隐私，建议设置敏感审计。',
    idPrefix: 'query_',
    namePlaceholder: '例如：查询客户信息',
    descPlaceholder: '查询 CRM 系统中的客户基本信息、商机阶段和历史跟进记录。',
    implType: 'mcp',
    connections: ['内部 CRM'],
    params: [
      { name: 'customer_id', type: 'string', required: false, desc: '客户 ID' },
      { name: 'keyword', type: 'string', required: false, desc: '客户名称或关键词' },
      { name: 'deal_stage', type: 'string', required: false, desc: '商机阶段筛选' },
      { name: 'include_history', type: 'boolean', required: false, desc: '是否返回跟进历史' },
    ],
    audit: 'sensitive',
    hitl: 'none',
  },
  审批: {
    hint: '<strong>审批类工具</strong>：发起或查询审批流程。关联 <strong>OA 审批系统</strong>连接。发起审批为写入操作，建议设置敏感审计 + 人工确认。',
    idPrefix: '',
    namePlaceholder: '例如：发起请假审批',
    descPlaceholder: '在 OA 系统中发起审批流程或查询审批状态。',
    implType: 'mcp',
    connections: ['OA 审批系统', '飞书 / Lark'],
    params: [
      { name: 'action', type: 'string', required: true, desc: '操作类型：create / query_status' },
      { name: 'approval_type', type: 'string', required: true, desc: '审批类型：leave / expense / purchase' },
      { name: 'form_data', type: 'object', required: false, desc: '审批表单数据（create 时）' },
      { name: 'approval_id', type: 'string', required: false, desc: '审批单号（query 时）' },
    ],
    audit: 'sensitive',
    hitl: 'first',
  },
  监控: {
    hint: '<strong>监控类工具</strong>：查询运维指标、告警和服务状态。关联<strong>运维监控</strong>连接。只读操作，建议普通审计。',
    idPrefix: 'query_',
    namePlaceholder: '例如：查询服务告警',
    descPlaceholder: '查询运维监控平台的服务指标、告警列表和 Dashboard 数据。',
    implType: 'mcp',
    connections: ['运维监控'],
    params: [
      { name: 'action', type: 'string', required: true, desc: '操作类型：query_metrics / list_alerts / get_dashboard' },
      { name: 'service', type: 'string', required: false, desc: '服务名称' },
      { name: 'time_range', type: 'string', required: false, desc: '时间范围：1h / 6h / 24h / 7d' },
      { name: 'severity', type: 'string', required: false, desc: '告警级别：critical / warning / info' },
    ],
    audit: 'normal',
    hitl: 'none',
  },
}

const KNOWLEDGE_BASES: KnowledgeBaseRow[] = [
  { id: 'kb-company-code', name: '公司代码规范 v3.0', icon: '📄', type: '规范', typeVariant: 'primary', chunks: '312', hits: '1240', mode: '自动注入', ready: true },
  { id: 'kb-security', name: '安全开发手册', icon: '🔒', type: '安全', typeVariant: 'danger', chunks: '186', hits: '892', mode: '自动注入', ready: true },
  { id: 'kb-ui', name: 'UI 设计规范', icon: '📐', type: '设计', typeVariant: 'warning', chunks: '94', hits: '341', mode: '按需检索', ready: true },
  { id: 'kb-arch', name: '微服务架构指南', icon: '🏗️', type: '架构', typeVariant: 'success', chunks: '228', hits: '567', mode: '按需检索', ready: true },
  { id: 'kb-product', name: '产品线文档 v1.0', icon: '📋', type: '产品', typeVariant: 'muted', chunks: '0', hits: '0', mode: '向量化中', ready: false },
  { id: 'kb-mall-prd', name: '商城需求文档 v2.3', icon: '📄', type: '需求', typeVariant: 'primary', chunks: '248', hits: '0', mode: '项目级', ready: true },
  { id: 'kb-mall-wireframe', name: '原型图 v1.5', icon: '📐', type: '原型', typeVariant: 'warning', chunks: '62', hits: '0', mode: '项目级', ready: true },
  { id: 'kb-arch-system', name: '系统架构设计文档', icon: '📋', type: '技术', typeVariant: 'success', chunks: '0', hits: '0', mode: '向量化中', ready: false },
]

const tools = ref(INITIAL_TOOLS.map((row) => ({ ...row })))
const searchQuery = ref('')
const categoryFilter = ref<(typeof CATEGORY_OPTIONS)[number]>('全部分类')
const registerOpen = ref(false)
const detailOpen = ref(false)
const ackOpen = ref(false)
const ackTitle = ref('')
const ackDesc = ref('')
const editingToolId = ref<string | null>(null)
const detailToolId = ref<string | null>(null)

let paramSeed = 0
function createParamRow(preset?: Omit<ParamRow, 'id'> | Partial<ParamRow>) {
  paramSeed += 1
  return {
    id: `param-${paramSeed}`,
    name: preset?.name ?? '',
    type: preset?.type ?? 'string',
    required: preset?.required ?? false,
    desc: preset?.desc ?? '',
  } as ParamRow
}

function buildDefaultForm(): RegisterFormState {
  return {
    toolId: '',
    displayName: '',
    category: '',
    description: '',
    implType: 'mcp',
    connection: ALL_CONNECTIONS[0],
    mcpToolName: '',
    callbackUrl: '',
    httpMethod: 'POST',
    httpAuth: 'Bearer Token',
    audit: 'normal',
    hitl: 'none',
    kbTopK: '5',
    kbThreshold: '0.7',
    kbSelected: [...DEFAULT_KB],
  }
}

const registerForm = reactive<RegisterFormState>(buildDefaultForm())
const registerParams = ref<ParamRow[]>([createParamRow()])

const filteredRows = computed(() => {
  let rows = tools.value
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    rows = rows.filter((row) =>
      [row.toolId, row.displayName, row.impl, row.connection].some((value) => value.toLowerCase().includes(q)),
    )
  }
  if (categoryFilter.value !== '全部分类') {
    rows = rows.filter((row) => row.categoryKey === categoryFilter.value)
  }
  return rows
})

const selectedTool = computed(() => tools.value.find((row) => row.id === detailToolId.value) ?? null)
const currentPreset = computed(() => CATEGORY_PRESETS[registerForm.category] ?? null)
const registerConnectionOptions = computed(() => currentPreset.value?.connections ?? [...ALL_CONNECTIONS])
const showKnowledgeSection = computed(() => registerForm.category === '知识库')
const showMcpSection = computed(() => registerForm.implType === 'mcp')
const showHttpSection = computed(() => registerForm.implType === 'http')
const registerTitle = computed(() => (editingToolId.value ? '编辑工具' : '注册新工具'))
const registerDescription = computed(() =>
  editingToolId.value
    ? '修改工具注册信息后将重新进入审批流，审批通过后更新平台路由与权限策略。'
    : '将外部 API 或内部函数注册为 AI 可调用的工具。工具描述直接影响 AI 的调用决策质量。',
)

function pillClass(v: PillVariant) {
  return {
    'gtw-pill': true,
    'gtw-pill--primary': v === 'primary',
    'gtw-pill--success': v === 'success',
    'gtw-pill--warning': v === 'warning',
    'gtw-pill--danger': v === 'danger',
    'gtw-pill--muted': v === 'muted',
  }
}

function auditHint(label: string) {
  if (label === '关键') return '双人审批 + 实时告警'
  if (label === '敏感') return '需人工审批'
  return '记录调用日志'
}

function resetRegisterForm() {
  editingToolId.value = null
  Object.assign(registerForm, buildDefaultForm())
  registerParams.value = [createParamRow()]
}

function applyCategoryPreset(category: string) {
  registerForm.category = category
  const preset = CATEGORY_PRESETS[category]
  if (!preset) return
  registerForm.toolId = preset.idPrefix
  registerForm.displayName = ''
  registerForm.description = ''
  registerForm.implType = preset.implType
  registerForm.connection = preset.connections[0] ?? ALL_CONNECTIONS[0]
  registerForm.mcpToolName = ''
  registerForm.callbackUrl = ''
  registerForm.httpMethod = 'POST'
  registerForm.httpAuth = 'Bearer Token'
  registerForm.audit = preset.audit
  registerForm.hitl = preset.hitl
  registerParams.value = preset.params.map((row) => createParamRow(row))
  if (category === '知识库') registerForm.kbSelected = [...DEFAULT_KB]
}

function handleCategoryChange(event: Event) {
  applyCategoryPreset((event.target as HTMLSelectElement).value)
}

function openRegisterTool() {
  resetRegisterForm()
  registerOpen.value = true
}

function openToolDetail(row: ToolRow) {
  detailToolId.value = row.id
  detailOpen.value = true
}

function openEditModal(row: ToolRow) {
  detailToolId.value = row.id
  const tool = tools.value.find((item) => item.id === row.id) ?? row
  resetRegisterForm()
  editingToolId.value = tool.id
  applyCategoryPreset(tool.categoryKey)
  registerForm.toolId = tool.toolId
  registerForm.displayName = tool.displayName
  registerForm.category = tool.categoryKey
  registerForm.description = tool.desc
  registerForm.implType = tool.implType
  registerForm.connection = tool.connection.split('（')[0] ?? ''
  registerForm.mcpToolName = tool.toolId
  registerForm.callbackUrl = tool.implType === 'http' ? `https://api.internal.com/tools/${tool.toolId}` : ''
  registerForm.audit = tool.auditCode
  registerForm.hitl = hitlToCode(tool.hitl)
  detailOpen.value = false
  registerOpen.value = true
}

function hitlToCode(label: string): HitlLevel {
  if (label.includes('每次')) return 'always'
  if (label.includes('首次') || label.includes('加急')) return 'first'
  return 'none'
}

function editFromDetail() {
  const tool = selectedTool.value
  if (!tool) return
  openEditModal(tool)
}

function toggleKnowledgeSelection(id: string) {
  const kb = KNOWLEDGE_BASES.find((item) => item.id === id)
  if (!kb || !kb.ready) return
  registerForm.kbSelected = registerForm.kbSelected.includes(id)
    ? registerForm.kbSelected.filter((item) => item !== id)
    : [...registerForm.kbSelected, id]
}

function addParamRow() {
  registerParams.value = [...registerParams.value, createParamRow()]
}

function removeParamRow(id: string) {
  if (registerParams.value.length <= 1) return
  registerParams.value = registerParams.value.filter((row) => row.id !== id)
}

function openAck(title: string, desc: string) {
  ackTitle.value = title
  ackDesc.value = desc
  ackOpen.value = true
}

function runDescriptionCheck() {
  openAck('描述质量检测', '工具描述质量检测通过，评分 8.5 / 10。原型态未接入真实 Router 评估服务。')
}

function submitRegister() {
  registerOpen.value = false
  openAck(
    editingToolId.value ? '变更已提交审批' : '已提交注册审批',
    editingToolId.value ? '工具变更已进入审批队列，审批通过后更新平台可用版本与权限注入。' : '工具已提交注册审批，等待安全审核与平台管理员确认后生效。',
  )
}

function toggleToolStatus() {
  const tool = selectedTool.value
  if (!tool) return
  const enabled = tool.statusLabel.includes('启用')
  tools.value = tools.value.map((row) =>
    row.id === tool.id
      ? {
          ...row,
          statusLabel: enabled ? '● 停用' : '● 启用',
          statusVariant: enabled ? 'danger' : 'success',
        }
      : row,
  )
  openAck(enabled ? '工具已停用' : '工具已启用', enabled ? '已停用工具（原型态演示）。' : '已启用工具（原型态演示）。')
}

function toggleBtnLabel(tool: ToolRow | null) {
  return tool?.statusLabel.includes('启用') ? '停用' : '启用'
}

function toggleBtnClass(tool: ToolRow | null) {
  return {
    'pm-btn': true,
    'gtw-state-btn--danger': !!tool && tool.statusLabel.includes('启用'),
    'gtw-state-btn--success': !!tool && !tool.statusLabel.includes('启用'),
  }
}
</script>
<template>
  <section class="gtw-workspace" data-testid="global-tools-workspace">
    <div class="gtw-toolbar">
      <input
        v-model="searchQuery"
        class="gtw-search"
        type="search"
        placeholder="搜索工具..."
        aria-label="搜索工具"
      />
      <select v-model="categoryFilter" class="gtw-select" aria-label="分类">
        <option v-for="c in CATEGORY_OPTIONS" :key="c" :value="c">{{ c }}</option>
      </select>
      <div class="gtw-toolbar-spacer" aria-hidden="true" />
      <button type="button" class="gtw-btn gtw-btn--primary" @click="openRegisterTool">+ 注册新工具</button>
    </div>

    <section class="gtw-metrics">
      <StatCard icon="🔩" label="已注册工具" value="18" delta="3 内置 · 15 自定义" tone="primary" delta-tone="success" />
      <StatCard icon="⚡" label="今日调用次数" value="1,247" delta="成功率 98.6%" delta-tone="success" />
      <StatCard icon="⏱️" label="平均响应时长" value="340ms" delta="↓ -60ms 较昨日" />
      <StatCard icon="🔑" label="权限策略" value="最小权限" delta="按角色过滤注入" />
    </section>

    <CardPanel class="gtw-panel" title="工具注册中心" subtitle="AI 根据描述质量决策是否调用">
      <div class="gtw-table-wrap">
        <table class="gtw-table">
          <thead>
            <tr>
              <th>工具名称</th>
              <th>展示名称</th>
              <th>分类</th>
              <th>来源</th>
              <th>实现方式</th>
              <th>审计级别</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody v-if="filteredRows.length">
            <tr v-for="row in filteredRows" :key="row.id">
              <td><strong class="gtw-mono">{{ row.toolId }}</strong></td>
              <td>{{ row.displayName }}</td>
              <td><span :class="pillClass(row.categoryVariant)">{{ row.categoryLabel }}</span></td>
              <td><span :class="pillClass(row.sourceVariant)">{{ row.sourceLabel }}</span></td>
              <td>{{ row.impl }}</td>
              <td><span :class="pillClass(row.auditVariant)">{{ row.auditLabel }}</span></td>
              <td><span :class="pillClass(row.statusVariant)">{{ row.statusLabel }}</span></td>
              <td>
                <div class="gtw-row-actions">
                  <button type="button" class="gtw-mini-btn" @click="openToolDetail(row)">详情</button>
                  <button type="button" class="gtw-mini-btn" @click="openEditModal(row)">编辑</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="!filteredRows.length" class="gtw-empty">没有匹配到工具，请调整搜索词或分类。</div>
      </div>
    </CardPanel>

    <PrototypeModal v-model:open="registerOpen" :title="registerTitle" :description="registerDescription" max-width="680px">
      <div class="pm-section">基本信息</div>
      <div class="pm-grid2">
        <div class="pm-field">
          <span class="pm-label">工具 ID</span>
          <input v-model="registerForm.toolId" class="pm-input pm-mono" placeholder="例如：query_order_status（英文+下划线）" />
        </div>
        <div class="pm-field">
          <span class="pm-label">展示名称</span>
          <input v-model="registerForm.displayName" class="pm-input" :placeholder="currentPreset?.namePlaceholder ?? '例如：查询订单状态'" />
        </div>
      </div>

      <div class="pm-field">
        <span class="pm-label">分类</span>
        <select :value="registerForm.category" class="pm-select" @change="handleCategoryChange">
          <option value="">请选择分类</option>
          <option v-for="c in REGISTER_CATEGORY_OPTIONS" :key="c" :value="c">{{ c }}</option>
        </select>
      </div>

      <div v-if="currentPreset" class="gtw-reg-hint" v-html="currentPreset.hint" />

      <div v-if="showKnowledgeSection" class="gtw-kb-wrap">
        <div class="pm-section gtw-inline-section">检索范围（选择知识库）</div>
        <div class="gtw-kb-inner">
          <div class="gtw-kb-caption">选择该工具可检索的知识库，支持多选。勾选后 AI 将在对应知识库中进行语义检索。</div>
          <table class="gtw-kb-table">
            <thead>
              <tr>
                <th />
                <th>知识库</th>
                <th>分类</th>
                <th>分块数</th>
                <th>命中</th>
                <th>注入方式</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="kb in KNOWLEDGE_BASES" :key="kb.id" :class="{ 'gtw-kb-row--disabled': !kb.ready }">
                <td class="gtw-kb-check">
                  <input :checked="registerForm.kbSelected.includes(kb.id)" :disabled="!kb.ready" type="checkbox" @change="toggleKnowledgeSelection(kb.id)" />
                </td>
                <td><span class="gtw-kb-name"><span>{{ kb.icon }}</span><strong>{{ kb.name }}</strong></span></td>
                <td><span :class="pillClass(kb.typeVariant)">{{ kb.type }}</span></td>
                <td class="gtw-kb-num">{{ kb.chunks }}</td>
                <td class="gtw-kb-num">{{ kb.hits }}</td>
                <td>{{ kb.mode }}</td>
              </tr>
            </tbody>
          </table>
          <div class="gtw-kb-config">
            <div class="pm-field">
              <span class="pm-label">默认 Top-K</span>
              <input v-model="registerForm.kbTopK" class="pm-input gtw-compact-input" />
            </div>
            <div class="pm-field">
              <span class="pm-label">最低相关度阈值</span>
              <input v-model="registerForm.kbThreshold" class="pm-input gtw-compact-input" />
            </div>
          </div>
        </div>
      </div>

      <div class="pm-field">
        <span class="pm-label">工具描述 <span class="gtw-label-note">（关键：AI 根据此描述决定何时调用此工具）</span></span>
        <textarea v-model="registerForm.description" class="pm-textarea" rows="3" :placeholder="currentPreset?.descPlaceholder ?? '用自然语言描述工具的用途、适用场景和能力边界。'" />
      </div>

      <div class="pm-section">实现方式</div>
      <div class="pm-field">
        <span class="pm-label">实现类型</span>
        <select v-model="registerForm.implType" class="pm-select">
          <option value="mcp">MCP 代理（通过已有连接）</option>
          <option value="http">HTTP 回调（自定义端点）</option>
          <option value="internal">内部函数</option>
        </select>
      </div>

      <div v-if="showMcpSection" class="pm-grid2">
        <div class="pm-field">
          <span class="pm-label">关联连接</span>
          <select v-model="registerForm.connection" class="pm-select">
            <option v-for="conn in registerConnectionOptions" :key="conn" :value="conn">{{ conn }}</option>
          </select>
        </div>
        <div class="pm-field">
          <span class="pm-label">MCP Tool Name</span>
          <input v-model="registerForm.mcpToolName" class="pm-input pm-mono" placeholder="连接暴露的原始 Tool 名称" />
        </div>
      </div>

      <div v-if="showHttpSection">
        <div class="pm-field">
          <span class="pm-label">回调 URL</span>
          <input v-model="registerForm.callbackUrl" class="pm-input pm-mono" placeholder="https://api.internal.com/tools/my-tool" />
        </div>
        <div class="pm-grid2">
          <div class="pm-field">
            <span class="pm-label">请求方式</span>
            <select v-model="registerForm.httpMethod" class="pm-select">
              <option value="POST">POST</option>
              <option value="GET">GET</option>
            </select>
          </div>
          <div class="pm-field">
            <span class="pm-label">认证方式</span>
            <select v-model="registerForm.httpAuth" class="pm-select">
              <option v-for="option in HTTP_AUTH_OPTIONS" :key="option" :value="option">{{ option }}</option>
            </select>
          </div>
        </div>
      </div>

      <div v-if="registerForm.implType === 'internal'" class="gtw-reg-hint">内部函数由平台托管实现，无需配置回调 URL 或外部连接，发布后仍需走审批流。</div>

      <div class="pm-section">输入参数定义</div>
      <div class="gtw-param-box">
        <div class="gtw-param-head">
          <span>参数名</span>
          <span>类型</span>
          <span>必填</span>
          <span>描述</span>
          <span />
        </div>
        <div v-for="param in registerParams" :key="param.id" class="gtw-param-row">
          <input v-model="param.name" class="pm-input pm-mono gtw-param-input" />
          <select v-model="param.type" class="pm-select gtw-param-select">
            <option v-for="type in PARAM_TYPES" :key="type" :value="type">{{ type }}</option>
          </select>
          <label class="gtw-param-check"><input v-model="param.required" type="checkbox" /><span>是</span></label>
          <input v-model="param.desc" class="pm-input gtw-param-input" />
          <button type="button" class="gtw-mini-btn gtw-mini-btn--danger" :disabled="registerParams.length <= 1" @click="removeParamRow(param.id)">删除</button>
        </div>
        <button type="button" class="gtw-mini-btn" @click="addParamRow">+ 添加参数</button>
      </div>

      <div class="pm-section">安全与权限</div>
      <div class="pm-grid2">
        <div class="pm-field">
          <span class="pm-label">审计级别</span>
          <select v-model="registerForm.audit" class="pm-select">
            <option value="normal">普通 — 记录调用日志</option>
            <option value="sensitive">敏感 — 需人工审批</option>
            <option value="critical">关键 — 双人审批 + 实时告警</option>
          </select>
        </div>
        <div class="pm-field">
          <span class="pm-label">Human-in-Loop</span>
          <select v-model="registerForm.hitl" class="pm-select">
            <option value="none">无需人工确认</option>
            <option value="first">首次调用需确认</option>
            <option value="always">每次调用需确认</option>
          </select>
        </div>
      </div>

      <template #footer>
        <button type="button" class="pm-btn" @click="registerOpen = false">取消</button>
        <button type="button" class="pm-btn" @click="runDescriptionCheck">🔍 描述质量检测</button>
        <button type="button" class="pm-btn pm-btn--primary" @click="submitRegister">{{ editingToolId ? '提交变更' : '提交注册' }}</button>
      </template>
    </PrototypeModal>

    <PrototypeModal v-if="selectedTool" v-model:open="detailOpen" :title="selectedTool.toolId" max-width="720px">
      <div class="gtw-detail-head">
        <span class="gtw-detail-icon" aria-hidden="true">{{ selectedTool.icon }}</span>
        <div class="gtw-detail-meta">
          <div class="gtw-detail-title-row">
            <div class="pm-mono gtw-detail-title">{{ selectedTool.toolId }}</div>
            <span :class="pillClass(selectedTool.statusVariant)">{{ selectedTool.statusLabel }}</span>
          </div>
          <div class="gtw-detail-sub">{{ selectedTool.displayName }} · {{ selectedTool.sourceLabel }}工具</div>
        </div>
        <span :class="pillClass(selectedTool.auditVariant)">{{ selectedTool.auditLabel }}</span>
      </div>

      <div class="pm-section">工具描述（AI 决策依据）</div>
      <div class="gtw-detail-box">{{ selectedTool.desc }}</div>

      <div class="pm-section">基本信息</div>
      <table class="pm-kv">
        <tr><td>工具 ID</td><td><code class="pm-mono gtw-inline-code">{{ selectedTool.toolId }}</code></td></tr>
        <tr><td>展示名称</td><td>{{ selectedTool.displayName }}</td></tr>
        <tr><td>分类</td><td><span :class="pillClass(selectedTool.categoryVariant)">{{ selectedTool.categoryLabel }}</span></td></tr>
        <tr><td>来源</td><td><span :class="pillClass(selectedTool.sourceVariant)">{{ selectedTool.sourceLabel }}</span></td></tr>
        <tr><td>实现方式</td><td>{{ selectedTool.impl }}</td></tr>
        <tr><td>关联连接</td><td>{{ selectedTool.connection }}</td></tr>
        <tr><td>注册时间</td><td>{{ selectedTool.createdAt }}</td></tr>
      </table>

      <div class="pm-section">输入参数 (Input Schema)</div>
      <pre class="pm-codeblock">{{ selectedTool.inputSchema }}</pre>

      <div class="pm-section">输出参数 (Output Schema)</div>
      <pre class="pm-codeblock">{{ selectedTool.outputSchema }}</pre>

      <div class="pm-section">调用统计（近 7 日）</div>
      <div class="gtw-detail-stats">
        <div class="gtw-detail-stat"><strong>{{ selectedTool.calls }}</strong><span>总调用</span></div>
        <div class="gtw-detail-stat"><strong class="gtw-detail-stat--success">{{ selectedTool.successRate }}</strong><span>成功率</span></div>
        <div class="gtw-detail-stat"><strong class="gtw-detail-stat--neutral">{{ selectedTool.p99 }}</strong><span>P99 延迟</span></div>
        <div class="gtw-detail-stat"><strong class="gtw-detail-stat--neutral">{{ selectedTool.projects }}</strong><span>使用项目</span></div>
      </div>

      <div class="pm-section">权限与安全</div>
      <table class="pm-kv">
        <tr><td>审计级别</td><td><span :class="pillClass(selectedTool.auditVariant)">{{ selectedTool.auditLabel }}</span><span class="gtw-inline-desc">— {{ auditHint(selectedTool.auditLabel) }}</span></td></tr>
        <tr><td>Human-in-Loop</td><td>{{ selectedTool.hitl }}</td></tr>
        <tr><td>敏感数据</td><td>{{ selectedTool.sensitive }}</td></tr>
      </table>

      <template #footer>
        <button type="button" class="pm-btn" @click="detailOpen = false">关闭</button>
        <button type="button" class="pm-btn" @click="editFromDetail">编辑</button>
        <button type="button" :class="toggleBtnClass(selectedTool)" @click="toggleToolStatus">{{ toggleBtnLabel(selectedTool) }}</button>
      </template>
    </PrototypeModal>

    <PrototypeModal v-model:open="ackOpen" :title="ackTitle" :description="ackDesc" max-width="480px">
      <template #footer>
        <button type="button" class="pm-btn pm-btn--primary" @click="ackOpen = false">知道了</button>
      </template>
    </PrototypeModal>
  </section>
</template>
<style scoped>
.gtw-workspace {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.gtw-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 20px;
}

.gtw-toolbar-spacer {
  flex: 1 1 auto;
  min-width: 12px;
  height: 1px;
}

.gtw-search,
.gtw-select {
  font: inherit;
  border: 1px solid rgba(17, 24, 39, 0.12);
  border-radius: 10px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.95);
}

.gtw-search {
  max-width: 260px;
  min-width: 140px;
  flex: 0 1 260px;
}

.gtw-select {
  width: auto;
  min-width: 120px;
}

.gtw-btn {
  border: 1px solid rgba(17, 24, 39, 0.12);
  border-radius: 999px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.9);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.gtw-btn--primary {
  background: linear-gradient(135deg, #4f6ef7 0%, #5d7bff 100%);
  color: #fff;
  border-color: transparent;
}

.gtw-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.gtw-panel {
  min-width: 0;
}

.gtw-table-wrap {
  overflow: auto;
}

.gtw-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.gtw-table th,
.gtw-table td {
  text-align: left;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(17, 24, 39, 0.08);
  vertical-align: middle;
}

.gtw-table th {
  color: var(--text-subtle);
  font-weight: 600;
  white-space: nowrap;
}

.gtw-empty {
  padding: 18px 8px 6px;
  color: var(--text-subtle);
  font-size: 12px;
}

.gtw-mono {
  font-family: ui-monospace, Menlo, Monaco, monospace;
  font-size: 12px;
  font-weight: 600;
}

.gtw-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
}

.gtw-pill--primary {
  background: rgba(79, 110, 247, 0.15);
  color: var(--primary);
}

.gtw-pill--success {
  background: rgba(34, 197, 94, 0.15);
  color: #15803d;
}

.gtw-pill--warning {
  background: rgba(245, 158, 11, 0.18);
  color: #b45309;
}

.gtw-pill--danger {
  background: rgba(239, 68, 68, 0.15);
  color: #b91c1c;
}

.gtw-pill--muted {
  background: rgba(15, 23, 42, 0.06);
  color: var(--text-subtle);
}

.gtw-mini-btn {
  border: 1px solid rgba(17, 24, 39, 0.12);
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 11px;
  background: #fff;
  cursor: pointer;
}

.gtw-row-actions {
  display: inline-flex;
  gap: 6px;
}

.gtw-mini-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.gtw-mini-btn--danger {
  color: #b91c1c;
}

.gtw-reg-hint {
  margin: -4px 0 12px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(79, 110, 247, 0.35);
  background: rgba(79, 110, 247, 0.08);
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-subtle);
}

.gtw-inline-section {
  margin-top: 0;
}

.gtw-label-note {
  color: #b45309;
  font-weight: 400;
}

.gtw-kb-wrap {
  margin-bottom: 12px;
}

.gtw-kb-inner {
  border: 1px solid rgba(17, 24, 39, 0.08);
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.03);
  padding: 12px 14px;
}

.gtw-kb-caption {
  margin-bottom: 10px;
  font-size: 11px;
  color: var(--text-subtle);
}

.gtw-kb-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.gtw-kb-table th,
.gtw-kb-table td {
  padding: 7px 4px;
  border-bottom: 1px solid rgba(17, 24, 39, 0.08);
}

.gtw-kb-table th {
  font-size: 11px;
  color: var(--text-subtle);
  font-weight: 600;
}

.gtw-kb-check {
  width: 28px;
  text-align: center;
}

.gtw-kb-row--disabled {
  opacity: 0.5;
  color: var(--text-subtle);
}

.gtw-kb-name {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.gtw-kb-num {
  text-align: right;
  font-family: ui-monospace, Menlo, Monaco, monospace;
}

.gtw-kb-config {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(17, 24, 39, 0.08);
}

.gtw-compact-input {
  max-width: 90px;
}

.gtw-param-box {
  border: 1px solid rgba(17, 24, 39, 0.08);
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.03);
  padding: 12px;
}

.gtw-param-head,
.gtw-param-row {
  display: grid;
  grid-template-columns: 2fr 1.4fr 0.9fr 3fr auto;
  gap: 6px;
  align-items: center;
}

.gtw-param-head {
  margin-bottom: 6px;
  padding: 0 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-subtle);
}

.gtw-param-row {
  margin-bottom: 6px;
}

.gtw-param-input,
.gtw-param-select {
  font-size: 11px;
}

.gtw-param-check {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}

.gtw-detail-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}

.gtw-detail-icon {
  font-size: 22px;
}

.gtw-detail-meta {
  flex: 1;
  min-width: 0;
}

.gtw-detail-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.gtw-detail-title {
  font-size: 17px;
  font-weight: 700;
}

.gtw-detail-sub {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-subtle);
}

.gtw-detail-box {
  background: rgba(15, 23, 42, 0.04);
  border: 1px solid rgba(17, 24, 39, 0.08);
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 12px;
  line-height: 1.8;
}

.gtw-inline-code {
  background: rgba(15, 23, 42, 0.06);
  padding: 2px 6px;
  border-radius: 4px;
}

.gtw-detail-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.gtw-detail-stat {
  text-align: center;
  padding: 10px;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.04);
  color: var(--text-subtle);
  font-size: 11px;
}

.gtw-detail-stat strong {
  display: block;
  margin-bottom: 4px;
  font-size: 18px;
  font-weight: 700;
  color: var(--primary);
}

.gtw-detail-stat--success {
  color: #15803d !important;
}

.gtw-detail-stat--neutral {
  color: var(--text-main) !important;
}

.gtw-inline-desc {
  margin-left: 6px;
  color: var(--text-subtle);
}

.gtw-state-btn--danger {
  background: #dc2626;
  color: #fff;
  border-color: transparent;
}

.gtw-state-btn--success {
  background: #16a34a;
  color: #fff;
  border-color: transparent;
}

@media (max-width: 1100px) {
  .gtw-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .gtw-kb-config,
  .gtw-detail-stats,
  .gtw-param-head,
  .gtw-param-row {
    grid-template-columns: 1fr;
  }

  .gtw-param-head {
    display: none;
  }
}

@media (max-width: 560px) {
  .gtw-metrics {
    grid-template-columns: 1fr;
  }

  .gtw-toolbar-spacer {
    display: none;
  }
}
</style>
