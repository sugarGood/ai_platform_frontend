<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'

import CardPanel from '../../components/ui/CardPanel.vue'
import StatCard from '../../components/ui/StatCard.vue'
import { useKbProjectPicker } from '../../composables/useKbProjectPicker'
import { useOverlay } from '../../composables/useOverlay'
import {
  AGENT_SKILL_MD,
  SKILL_EDIT_PRESETS,
  SKILL_TEST_FIXTURES,
  categoryLabelToApi,
  type SkillTestFixture,
} from '../../lib/global-skills-hub-fixtures'
import { createSkill, listSkills } from '../../services/skills'
import type { SkillResponse } from '../../types/skill'

const { openActionDialog } = useOverlay()
const { projectOptions, projectsLoading, projectsLoadError, loadProjectOptions } = useKbProjectPicker()

const skills = ref<SkillResponse[]>([])
const loadError = ref('')
const actionHint = ref('')

const createModalOpen = ref(false)
const skillFormMode = ref<'create' | 'edit-platform'>('create')
const editingBackendSkillId = ref<number | null>(null)
const editingPlatformFixtureId = ref<string | null>(null)
const modalFormError = ref('')
const submittingSkill = ref(false)

/** 与原型 `modal-skillTestRun` */
const testRunOpen = ref(false)
const testRunTitle = ref('测试运行')
const testRunSub = ref('')
const testRunKindLabel = ref('平台能力')
const testRunInputLabel = ref('请求入参（JSON）')
const testRunInput = ref('')
const testRunMetrics = ref('')
const testRunTrace = ref('')
const testRunOutput = ref('')
const testRunRag = ref('')
const testRunShowRag = ref(false)
const testRunExecuting = ref(false)
let testRunTimer: number | undefined
const activeTestFixture = ref<SkillTestFixture | null>(null)

/** 与原型 `modal-agentSkillMdPreview` / 中台 JSON 预览 */
const previewOpen = ref(false)
const previewTitle = ref('')
const previewBody = ref('')
const previewCopyLabel = ref('复制全文')
const previewIsMarkdown = ref(true)
const previewPlatformRow = ref<SkillRow | null>(null)
const previewAgentRow = ref<AgentPackRow | null>(null)

const agentEditOpen = ref(false)
const agentEditForm = ref({
  name: '',
  description: '',
  categoryLabel: '工程',
  slug: '',
  body: '',
})
const agentEditRowName = ref('')

/** 与原型创建弹窗「分类」选项一致；值为后端 `category` 字段 */
const FORM_CATEGORIES = [
  { label: '工程', value: 'ENGINEERING' },
  { label: '文档', value: 'DOCUMENTATION' },
  { label: '测试', value: 'TESTING' },
  { label: '安全', value: 'SECURITY' },
  { label: '产品', value: 'PRODUCT' },
  { label: '数据', value: 'DATA' },
] as const

const KB_OPTIONS = [
  { id: '公司代码规范', defaultOn: true },
  { id: '安全开发手册', defaultOn: true },
  { id: '微服务架构指南', defaultOn: false },
] as const

const PROMPT_FIELD_LABEL = 'System Prompt（支持变量语法 {{variable}}）'
const SYSTEM_PROMPT_PLACEHOLDER = `你是一位资深工程师，负责对代码进行专业审查。
请从以下三个维度给出具体意见：
1. 编码规范：是否符合{{company_coding_standard}}
2. 安全风险：是否存在 OWASP Top 10 相关漏洞
3. 性能问题：是否有明显的性能瓶颈`

const TOOL_OPTIONS = [
  { id: 'search_knowledge', defaultOn: true },
  { id: 'post_code_comment', defaultOn: false },
  { id: 'create_jira', defaultOn: false },
] as const

const createForm = ref({
  name: '',
  command: '',
  categoryApi: 'ENGINEERING',
  scopeUi: 'enterprise' as 'enterprise' | 'project',
  projectIdStr: '',
  description: '',
  systemPrompt: '',
})

const kbChecks = reactive<Record<string, boolean>>({})
const toolChecks = reactive<Record<string, boolean>>({})

/** 「新建中台能力」三步向导（与原型 modal-createSkill 中台轨一致） */
const createWizardStep = ref<1 | 2 | 3>(1)
const platformWorkMode = ref<'prompt' | 'tool' | 'knowledge' | 'workflow'>('prompt')
const execToolName = ref('')
const kbCollection = ref('')
const kbTopK = ref(5)
const kbFollowPrompt = ref('')

/** 流程编排：与原型 `skillWorkflowBuilder` 逐步编辑 + JSON 同步 */
type WorkflowStepType = 'tool' | 'knowledge' | 'prompt'
interface WorkflowStepRow {
  _key: string
  type: WorkflowStepType
  output: string
  name?: string
  collection?: string
  top_k?: number
  template?: string
}

const WORKFLOW_STEP_TYPE_OPTIONS: { value: WorkflowStepType; label: string }[] = [
  { value: 'tool', label: '工具调用' },
  { value: 'knowledge', label: '知识检索' },
  { value: 'prompt', label: '对话生成' },
]

const SKILL_WORKFLOW_DEFAULT_RAW: Omit<WorkflowStepRow, '_key'>[] = [
  { type: 'tool', name: 'query_sales', output: 'data' },
  { type: 'knowledge', collection: 'sales_strategy', top_k: 5, output: 'docs' },
  { type: 'prompt', template: '根据 {{docs}} 分析 {{data}}', output: 'answer' },
]

function makeWorkflowStepKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `wf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function normalizeWorkflowStep(raw: unknown, existingKey?: string): WorkflowStepRow {
  const key = existingKey ?? makeWorkflowStepKey()
  if (!raw || typeof raw !== 'object') {
    return { _key: key, type: 'prompt', template: '', output: 'out' }
  }
  const r = raw as Record<string, unknown>
  const t = r.type
  if (t === 'tool') {
    return {
      _key: key,
      type: 'tool',
      name: String(r.name ?? ''),
      output: String(r.output ?? 'data'),
    }
  }
  if (t === 'knowledge') {
    let tk = parseInt(String(r.top_k ?? '5'), 10)
    if (!Number.isFinite(tk) || tk < 1) tk = 5
    return {
      _key: key,
      type: 'knowledge',
      collection: String(r.collection ?? ''),
      top_k: tk,
      output: String(r.output ?? 'docs'),
    }
  }
  return {
    _key: key,
    type: 'prompt',
    template: String(r.template ?? ''),
    output: String(r.output ?? 'answer'),
  }
}

function cloneDefaultWorkflowSteps(): WorkflowStepRow[] {
  return SKILL_WORKFLOW_DEFAULT_RAW.map((s) => normalizeWorkflowStep(s))
}

const workflowSteps = ref<WorkflowStepRow[]>([])
/** 与步骤列表同步的 JSON 文本（可展开编辑，失焦解析） */
const workflowJsonEditor = ref('')

function workflowStepsToJsonPayload(steps: WorkflowStepRow[]) {
  return steps.map((step) => {
    if (step.type === 'tool') {
      return { type: 'tool' as const, name: step.name ?? '', output: step.output }
    }
    if (step.type === 'knowledge') {
      return {
        type: 'knowledge' as const,
        collection: step.collection ?? '',
        top_k: step.top_k ?? 5,
        output: step.output,
      }
    }
    return { type: 'prompt' as const, template: step.template ?? '', output: step.output }
  })
}

function syncWorkflowJsonFromSteps() {
  workflowJsonEditor.value = JSON.stringify(workflowStepsToJsonPayload(workflowSteps.value), null, 2)
}

function applyWorkflowJsonFromEditor() {
  try {
    const p = JSON.parse(workflowJsonEditor.value) as unknown
    if (!Array.isArray(p)) {
      modalFormError.value = '流程步骤须为 JSON 数组。'
      return
    }
    workflowSteps.value = p.map((item) => normalizeWorkflowStep(item))
    modalFormError.value = ''
  } catch {
    modalFormError.value = '流程步骤 JSON 无法解析，请检查格式。'
  }
}

/** 步骤列表与 JSON 文本框双向同步（与原型隐藏 textarea 行为一致） */
watch(
  workflowSteps,
  () => {
    syncWorkflowJsonFromSteps()
  },
  { deep: true },
)

function addWorkflowStep() {
  const n = workflowSteps.value.length
  workflowSteps.value = [
    ...workflowSteps.value,
    normalizeWorkflowStep(
      { type: 'prompt', template: '', output: `step_${n + 1}` },
      makeWorkflowStepKey(),
    ),
  ]
}

function moveWorkflowStep(index: number, delta: number) {
  const j = index + delta
  if (j < 0 || j >= workflowSteps.value.length) return
  const copy = [...workflowSteps.value]
  const a = copy[index]
  const b = copy[j]
  if (!a || !b) return
  copy[index] = b
  copy[j] = a
  workflowSteps.value = copy
}

function removeWorkflowStep(index: number) {
  workflowSteps.value = workflowSteps.value.filter((_, i) => i !== index)
}

function onWorkflowStepTypeChange(index: number, ev: Event) {
  const v = (ev.target as HTMLSelectElement).value as WorkflowStepType
  changeWorkflowStepType(index, v)
}

function changeWorkflowStepType(index: number, newType: WorkflowStepType) {
  const cur = workflowSteps.value[index]
  if (!cur) return
  const out = (cur.output || 'out').trim() || 'out'
  if (newType === 'tool') {
    workflowSteps.value[index] = { _key: cur._key, type: 'tool', name: '', output: out }
  } else if (newType === 'knowledge') {
    workflowSteps.value[index] = {
      _key: cur._key,
      type: 'knowledge',
      collection: '',
      top_k: 5,
      output: out,
    }
  } else {
    workflowSteps.value[index] = { _key: cur._key, type: 'prompt', template: '', output: out }
  }
}

function buildWizardExecutionPayload(): Record<string, unknown> {
  const m = platformWorkMode.value
  if (m === 'prompt') {
    return { type: 'prompt', template: createForm.value.systemPrompt.trim() }
  }
  if (m === 'tool') {
    return { type: 'tool', tool_name: execToolName.value }
  }
  if (m === 'knowledge') {
    const ex: Record<string, unknown> = {
      type: 'knowledge',
      collection: kbCollection.value,
      top_k: kbTopK.value,
    }
    if (kbFollowPrompt.value.trim()) ex.prompt = kbFollowPrompt.value.trim()
    return ex
  }
  return { type: 'workflow', steps: workflowStepsToJsonPayload(workflowSteps.value) }
}

const TOOL_EXEC_LONG_HINT =
  '写入 JSON 的 execution.tool_name，对应 Runner 一次主调用。主工具为单选；若还要组合其它工具，请在本向导第 3 步「还可以同时使用」勾选附加 Tool，或改用流程编排多步串联。未在列表中？请先到「工具注册中心」注册后再发布能力。'

const KB_EXEC_LONG_HINT =
  '写入 JSON 的 execution.collection。未在列表中？请先到「全局知识库」完成登记与向量化，再由管理员加入可选范围。'

const wizardRoles = reactive({ super_admin: false, platform_admin: false, member: true })
const skillPolicyConfirm = ref(false)

const PLATFORM_WORK_CARDS = [
  {
    id: 'prompt' as const,
    icon: '💬',
    title: '对话生成',
    desc: '写好说明和提示词，由大模型直接回答、总结或改写。',
  },
  {
    id: 'tool' as const,
    icon: '🔧',
    title: '调用内部工具',
    desc: '对接已在平台注册好的接口，例如查订单、查工单。',
  },
  {
    id: 'knowledge' as const,
    icon: '📚',
    title: '结合知识库',
    desc: '先从企业文档里检索，再结合大模型生成回答（常见问答场景）。',
  },
  {
    id: 'workflow' as const,
    icon: '🔀',
    title: '流程编排',
    desc: '多步串联：先查数据、再查资料、最后生成结论。适合熟手。',
  },
]

const EXEC_TOOL_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '请选择（来自工具注册中心）' },
  { value: 'query_sales', label: 'query_sales — 销售数据查询' },
  { value: 'query_crm', label: 'query_crm — CRM 客户查询' },
  { value: 'query_sentry', label: 'query_sentry — 错误与日志查询' },
  { value: 'semgrep_ci', label: 'semgrep_ci — 安全扫描结果' },
  { value: 'create_jira', label: 'create_jira — 创建工单' },
  { value: 'post_code_comment', label: 'post_code_comment — 发送代码评论' },
  { value: 'search_knowledge', label: 'search_knowledge — 知识库检索（Tool 形态）' },
  { value: 'legacy_report_export', label: 'legacy_report_export — 报表导出（示例）' },
]

const KB_COLLECTION_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '请选择（来自全局知识库 / 已登记 Collection）' },
  { value: 'company_docs', label: 'company_docs — 公司通用文档' },
  { value: 'finance_docs', label: 'finance_docs — 财务 / 报销政策' },
  { value: 'sales_strategy', label: 'sales_strategy — 销售策略与话术' },
  { value: 'kb_code_standard', label: 'kb_code_standard — 代码规范' },
  { value: 'kb_security', label: 'kb_security — 安全开发手册' },
  { value: 'kb_arch', label: 'kb_arch — 微服务架构指南' },
  { value: 'product_prd_global', label: 'product_prd_global — 产品线 PRD（示例）' },
]

const WIZARD_SUB_CREATE =
  '三步完成：先说明「是什么」，再选「怎么执行」，最后定「谁能用」。本入口仅创建中台（JSON）能力，走 Router / Runner。保存草稿不会上线；提交审核在第三步，审批在侧栏「审批中心」→「平台能力发布」（仅为审批类型之一）。'

/** 避免在模板中写 `{{` 触发 Vue 插值解析 */
const CITE_DATA = '{{' + 'data' + '}}'
const CITE_DOCS = '{{' + 'docs' + '}}'
const KB_FOLLOW_PLACEHOLDER = `例如：请仅根据检索到的资料回答，不要编造。资料：${CITE_DOCS}`

const PROMPT_STEP2_PLACEHOLDER =
  '例如：你是一位资深工程师… 可以用 {{变量名}} 插入动态内容。'

const DEFAULT_WIZARD_PROMPT =
  '你是一位资深工程师，负责对代码进行专业审查。请结合 {{company_coding_standard}} 给出规范、安全、性能三方面意见。'

function skillStepState(n: 1 | 2 | 3): 'done' | 'active' | 'upcoming' {
  const s = createWizardStep.value
  if (n < s) return 'done'
  if (n === s) return 'active'
  return 'upcoming'
}

function setPlatformWorkMode(m: 'prompt' | 'tool' | 'knowledge' | 'workflow') {
  platformWorkMode.value = m
  if (skillFormMode.value === 'create' && m === 'workflow' && workflowSteps.value.length === 0) {
    workflowSteps.value = cloneDefaultWorkflowSteps()
    syncWorkflowJsonFromSteps()
  }
}

/** 与原型 `updateSkillExecContextHint` 文案一致 */
const wizardExecContextHint = computed(() => {
  const map: Record<string, string> = {
    prompt: '补充提示词后，对话时模型会按你的说明行事。',
    tool: '填写已在「工具注册中心」注册的工具 ID。',
    knowledge: '指定要从哪个知识库检索，以及最多引用几条资料片段。',
    workflow: '用下方步骤列表编排顺序；每步可选工具、知识库或对话生成，输出变量供后续步骤引用。',
  }
  return map[platformWorkMode.value] ?? map.prompt
})

function resetCreateWizard() {
  createWizardStep.value = 1
  platformWorkMode.value = 'prompt'
  execToolName.value = ''
  kbCollection.value = ''
  kbTopK.value = 5
  kbFollowPrompt.value = ''
  workflowSteps.value = cloneDefaultWorkflowSteps()
  syncWorkflowJsonFromSteps()
  wizardRoles.super_admin = false
  wizardRoles.platform_admin = false
  wizardRoles.member = true
  skillPolicyConfirm.value = false
}

function resetCreateForm() {
  createForm.value = {
    name: '',
    command: '',
    categoryApi: 'ENGINEERING',
    scopeUi: 'enterprise',
    projectIdStr: '',
    description: '',
    systemPrompt: DEFAULT_WIZARD_PROMPT,
  }
  for (const o of KB_OPTIONS) kbChecks[o.id] = o.defaultOn
  for (const o of TOOL_OPTIONS) toolChecks[o.id] = o.defaultOn
  resetCreateWizard()
}

const createModalTitle = computed(() => {
  if (skillFormMode.value === 'edit-platform') {
    const name = createForm.value.name.trim() || '未命名能力'
    return `编辑平台能力 · ${name}`
  }
  return '新建平台能力'
})

watch(platformWorkMode, (m) => {
  if (skillFormMode.value !== 'create') return
  if (m === 'prompt' && !createForm.value.systemPrompt.trim()) {
    createForm.value.systemPrompt = DEFAULT_WIZARD_PROMPT
  }
})

function closeCreateModal() {
  createModalOpen.value = false
  skillFormMode.value = 'create'
  editingBackendSkillId.value = null
  editingPlatformFixtureId.value = null
  modalFormError.value = ''
  submittingSkill.value = false
  resetCreateWizard()
}

async function openCreateSkillModal() {
  skillFormMode.value = 'create'
  editingBackendSkillId.value = null
  editingPlatformFixtureId.value = null
  resetCreateForm()
  modalFormError.value = ''
  createModalOpen.value = true
  await loadProjectOptions()
}

function normalizeSlashCommand(
  raw: string,
): { ok: true; skillKey: string; slashCommand: string } | { ok: false; message: string } {
  let t = raw.trim()
  if (!t) return { ok: false, message: '请填写触发命令（如 /code-review）。' }
  t = t.replace(/^\/+/, '')
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(t)) {
    return { ok: false, message: '命令标识仅支持字母、数字、连字符，例如 code-review。' }
  }
  return { ok: true, skillKey: t, slashCommand: `/${t}` }
}

function validateWizardStep(step: 1 | 2 | 3): boolean {
  modalFormError.value = ''
  if (step === 1) {
    if (!createForm.value.name.trim()) {
      modalFormError.value = '请填写能力名称。'
      return false
    }
    return true
  }
  if (step === 2) {
    if (platformWorkMode.value === 'prompt' && !createForm.value.systemPrompt.trim()) {
      modalFormError.value = '请填写给 AI 的说明（提示词）。'
      return false
    }
    if (platformWorkMode.value === 'tool' && !execToolName.value) {
      modalFormError.value = '请选择要调用的工具。'
      return false
    }
    if (platformWorkMode.value === 'knowledge' && !kbCollection.value) {
      modalFormError.value = '请选择知识库 Collection。'
      return false
    }
    if (platformWorkMode.value === 'workflow') {
      if (workflowSteps.value.length === 0) {
        modalFormError.value = '请至少添加一步流程编排。'
        return false
      }
      for (let i = 0; i < workflowSteps.value.length; i++) {
        const st = workflowSteps.value[i]!
        if (st.type === 'tool' && !st.name?.trim()) {
          modalFormError.value = `步骤 ${i + 1}：请选择工具。`
          return false
        }
        if (st.type === 'knowledge' && !st.collection?.trim()) {
          modalFormError.value = `步骤 ${i + 1}：请选择知识库 Collection。`
          return false
        }
      }
      return true
    }
    return true
  }
  if (step === 3) {
    if (!wizardRoles.super_admin && !wizardRoles.platform_admin && !wizardRoles.member) {
      modalFormError.value = '请至少选择一种可使用本能力的平台角色。'
      return false
    }
    return true
  }
  return true
}

function wizardGoNext() {
  if (skillFormMode.value !== 'create') return
  if (!validateWizardStep(createWizardStep.value)) return
  if (createWizardStep.value < 3) {
    createWizardStep.value = (createWizardStep.value + 1) as 1 | 2 | 3
  }
}

function wizardGoPrev() {
  modalFormError.value = ''
  if (skillFormMode.value !== 'create') return
  if (createWizardStep.value > 1) {
    createWizardStep.value = (createWizardStep.value - 1) as 1 | 2 | 3
  }
}

function openPermissionsRefFromWizard() {
  openActionDialog({
    title: '权限管理 · 平台角色',
    description: '与向导中「谁可以使用」勾选项对应的是「权限管理 › 平台角色」中的内置角色；正式环境可从侧栏进入该页对照配置。',
    items: ['原型阶段在此说明；路由接入后可直接跳转权限管理。'],
  })
}

async function submitCreateSkill(mode: 'draft' | 'test' | 'review') {
  const name = createForm.value.name.trim()
  const cmd = normalizeSlashCommand(createForm.value.command)
  if (!name) {
    modalFormError.value = '请填写技能名称。'
    return
  }
  if (!cmd.ok) {
    modalFormError.value = cmd.message
    return
  }
  const scope = createForm.value.scopeUi === 'enterprise' ? 'GLOBAL' : 'PROJECT'
  let projectId: number | undefined
  if (scope === 'PROJECT') {
    projectId = Number(String(createForm.value.projectIdStr).trim())
    if (!Number.isFinite(projectId) || projectId <= 0) {
      modalFormError.value = '请选择所属项目。'
      return
    }
  }

  if (skillFormMode.value === 'edit-platform') {
    modalFormError.value = ''
    closeCreateModal()
    actionHint.value =
      mode === 'test'
        ? `已保存「${name}」的修改（原型示意），测试能力待与执行引擎联调。`
        : `已保存「${name}」的草稿（原型示意，后端更新待联调）。`
    window.setTimeout(() => {
      actionHint.value = ''
    }, 6000)
    return
  }

  if (
    skillFormMode.value === 'create' &&
    (!validateWizardStep(1) || !validateWizardStep(2) || !validateWizardStep(3))
  ) {
    return
  }

  modalFormError.value = ''
  submittingSkill.value = true
  try {
    const kbs = KB_OPTIONS.filter((o) => kbChecks[o.id]).map((o) => o.id)
    const tools = TOOL_OPTIONS.filter((o) => toolChecks[o.id]).map((o) => o.id)
    const wizardPayload = {
      work_mode: platformWorkMode.value,
      execution: buildWizardExecutionPayload(),
      roles: { ...wizardRoles },
      policy_sensitive_confirm: skillPolicyConfirm.value,
    }
    const created = await createSkill({
      skillKey: cmd.skillKey,
      name,
      description: createForm.value.description.trim() || undefined,
      scope,
      projectId: scope === 'PROJECT' ? projectId : undefined,
      category: createForm.value.categoryApi,
      systemPrompt: createForm.value.systemPrompt.trim() || undefined,
      knowledgeRefs: kbs.length ? JSON.stringify(kbs) : undefined,
      boundTools: tools.length ? JSON.stringify(tools) : undefined,
      slashCommand: cmd.slashCommand,
      version: '1.0.0',
      parameters: JSON.stringify(wizardPayload),
    })
    skills.value = await listSkills()
    closeCreateModal()
    if (mode === 'review') {
      openActionDialog({
        title: `已提交审核：${created.name}`,
        description:
          '能力已进入侧栏「审批中心」中「平台能力发布」队列（示意）。审批通过后状态将变为「已发布」。',
        items: ['当前为原型交互；与审批中台联调后可展示真实队列状态。'],
      })
    } else {
      actionHint.value =
        mode === 'test'
          ? `已创建草稿「${created.name}」，测试运行待与执行引擎联调。`
          : `已保存草稿「${created.name}」。`
      window.setTimeout(() => {
        actionHint.value = ''
      }, 6000)
    }
  } catch (e) {
    modalFormError.value = e instanceof Error ? e.message : '创建失败'
  } finally {
    submittingSkill.value = false
  }
}

function closeTestRunModal() {
  testRunOpen.value = false
  activeTestFixture.value = null
  if (testRunTimer != null) {
    window.clearTimeout(testRunTimer)
    testRunTimer = undefined
  }
  testRunExecuting.value = false
}

function closePreviewModal() {
  previewOpen.value = false
  previewBody.value = ''
  previewPlatformRow.value = null
  previewAgentRow.value = null
}

function closeAgentEditModal() {
  agentEditOpen.value = false
}

function onGlobalKeydown(ev: KeyboardEvent) {
  if (ev.key !== 'Escape') return
  if (createModalOpen.value) closeCreateModal()
  else if (testRunOpen.value) closeTestRunModal()
  else if (previewOpen.value) closePreviewModal()
  else if (agentEditOpen.value) closeAgentEditModal()
}

function commandToFixtureId(command: string): string {
  const t = command.replace(/^\//, '').trim()
  return t || 'code-review'
}

function openSkillTestRunFromRow(row: SkillRow) {
  const id = row.testFixtureId
  const f = SKILL_TEST_FIXTURES.platform[id]
  if (!f) {
    openActionDialog({
      title: '测试运行',
      description: '该条目暂无沙箱样例。',
      items: ['请先在编辑向导中保存能力定义', '或联系平台补充测试夹具'],
    })
    return
  }
  activeTestFixture.value = f
  testRunTitle.value = `测试运行 · ${row.name}`
  testRunSub.value =
    '沙箱环境执行平台能力（Router → Runner），结果与生产隔离，用于上线前自测与评审对齐。'
  testRunKindLabel.value = '平台能力'
  testRunInputLabel.value = f.inputLabel || '请求入参（JSON）'
  testRunInput.value = f.inputDefault
  testRunMetrics.value = '尚未运行。点击「运行测试」生成沙箱调用记录与响应（预置数据）。'
  testRunTrace.value = ''
  testRunOutput.value = ''
  if (f.ragHits) {
    testRunShowRag.value = true
    testRunRag.value = f.ragHits
  } else {
    testRunShowRag.value = false
    testRunRag.value = ''
  }
  testRunExecuting.value = false
  testRunOpen.value = true
}

function openAgentSkillTestRun(row: AgentPackRow) {
  const id = row.slug
  const f = SKILL_TEST_FIXTURES.agent[id]
  if (!f) {
    openActionDialog({
      title: '测试运行',
      description: '该条目暂无沙箱样例。',
      items: ['请先在编辑向导中保存能力定义', '或联系平台补充测试夹具'],
    })
    return
  }
  activeTestFixture.value = f
  testRunTitle.value = `测试运行 · ${row.name}`
  testRunSub.value = '客户端技能包沙箱：校验 SKILL 解析与 Workflow Dry-run，不写回模板库。'
  testRunKindLabel.value = 'Agent 技能包'
  testRunInputLabel.value = f.inputLabel || '请求入参（JSON）'
  testRunInput.value = f.inputDefault
  testRunMetrics.value = '尚未运行。点击「运行测试」生成沙箱调用记录与响应（预置数据）。'
  testRunTrace.value = ''
  testRunOutput.value = ''
  testRunShowRag.value = false
  testRunRag.value = ''
  testRunExecuting.value = false
  testRunOpen.value = true
}

function resetTestRunInput() {
  const f = activeTestFixture.value
  if (f) testRunInput.value = f.inputDefault
}

function executeSkillTestRunMock() {
  const f = activeTestFixture.value
  if (!f || !testRunOpen.value) return
  testRunExecuting.value = true
  testRunMetrics.value = 'Queued… 沙箱调度中（示意）'
  testRunTrace.value = ''
  testRunOutput.value = ''
  if (testRunTimer != null) window.clearTimeout(testRunTimer)
  testRunTimer = window.setTimeout(() => {
    testRunTimer = undefined
    testRunMetrics.value = f.metricsText
    testRunTrace.value = f.traceText
    testRunOutput.value = f.outputText
    testRunExecuting.value = false
    actionHint.value = '沙箱运行完成（示意数据）'
    window.setTimeout(() => {
      actionHint.value = ''
    }, 4000)
  }, 480)
}

function buildPlatformAbilityPreviewJson(row: SkillRow): string {
  const key = commandToFixtureId(row.command)
  return JSON.stringify(
    {
      id: key,
      name: row.name,
      description: row.subtitle,
      slash_command: row.command,
      category: row.categoryKey,
      status: row.statusKey,
      linked_knowledge: row.linkedKb,
      input_schema: {
        type: 'object',
        properties: { message: { type: 'string', description: '用户/系统输入' } },
      },
      output_schema: { type: 'object' },
    },
    null,
    2,
  )
}

function openPlatformPreview(row: SkillRow) {
  previewTitle.value = `能力定义预览 · ${row.name}`
  previewBody.value = buildPlatformAbilityPreviewJson(row)
  previewCopyLabel.value = '复制 JSON'
  previewIsMarkdown.value = false
  previewOpen.value = true
}

function openAgentSkillMdPreview(row: AgentPackRow) {
  const md = AGENT_SKILL_MD[row.slug] ?? '（暂无正文）'
  previewTitle.value = `SKILL.md · ${row.slug}`
  previewBody.value = md
  previewCopyLabel.value = '复制全文'
  previewIsMarkdown.value = true
  previewOpen.value = true
}

async function copyPreviewBody() {
  const text = previewBody.value
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    actionHint.value = '已复制到剪贴板'
    window.setTimeout(() => {
      actionHint.value = ''
    }, 3000)
  } catch {
    actionHint.value = '复制失败，请手动选择文本复制'
    window.setTimeout(() => {
      actionHint.value = ''
    }, 4000)
  }
}

async function openPlatformEditModal(row: SkillRow) {
  skillFormMode.value = 'edit-platform'
  editingPlatformFixtureId.value = row.testFixtureId
  editingBackendSkillId.value = row.backendSkillId ?? null
  modalFormError.value = ''
  const preset = SKILL_EDIT_PRESETS.platform[row.testFixtureId]
  if (preset) {
    createForm.value = {
      name: preset.name,
      command: preset.invoke.startsWith('/') ? preset.invoke.slice(1) : preset.invoke,
      categoryApi: categoryLabelToApi(preset.category),
      scopeUi: 'enterprise',
      projectIdStr: '',
      description: preset.desc,
      systemPrompt: SYSTEM_PROMPT_PLACEHOLDER,
    }
  } else if (row.backendSkillId != null) {
    const s = skills.value.find((x) => x.id === row.backendSkillId)
    if (s) {
      const cmd =
        s.skillKey && s.skillKey.length > 0
          ? s.skillKey.startsWith('/')
            ? s.skillKey.slice(1)
            : s.skillKey
          : ''
      const cat = mapCategoryFromApi(s.category)
      createForm.value = {
        name: s.name,
        command: cmd,
        categoryApi: categoryLabelToApi(cat.label),
        scopeUi: (s.scope ?? '').toUpperCase() === 'PROJECT' ? 'project' : 'enterprise',
        projectIdStr: s.projectId != null ? String(s.projectId) : '',
        description: s.description?.trim() ?? '',
        systemPrompt: s.systemPrompt?.trim() ?? '',
      }
    } else {
      createForm.value = {
        name: row.name,
        command: commandToFixtureId(row.command),
        categoryApi: categoryLabelToApi(row.categoryLabel),
        scopeUi: 'enterprise',
        projectIdStr: '',
        description: row.subtitle === '—' ? '' : row.subtitle,
        systemPrompt: '',
      }
    }
  } else {
    createForm.value = {
      name: row.name,
      command: commandToFixtureId(row.command),
      categoryApi: categoryLabelToApi(row.categoryLabel),
      scopeUi: 'enterprise',
      projectIdStr: '',
      description: row.subtitle === '—' ? '' : row.subtitle,
      systemPrompt: '',
    }
  }
  for (const o of KB_OPTIONS) kbChecks[o.id] = o.defaultOn
  for (const o of TOOL_OPTIONS) toolChecks[o.id] = o.defaultOn
  createModalOpen.value = true
  await loadProjectOptions()
}

function openAgentEditModal(row: AgentPackRow) {
  agentEditRowName.value = row.name
  const preset = SKILL_EDIT_PRESETS.agent[row.slug]
  agentEditForm.value = {
    name: preset?.name ?? row.name,
    description: preset?.desc ?? row.description,
    categoryLabel: preset?.category ?? row.categoryLabel,
    slug: row.slug,
    body: AGENT_SKILL_MD[row.slug] ?? '',
  }
  agentEditOpen.value = true
}

function editFromPreview() {
  if (previewPlatformRow.value) {
    const row = previewPlatformRow.value
    closePreviewModal()
    void openPlatformEditModal(row)
    return
  }
  if (previewAgentRow.value) {
    const row = previewAgentRow.value
    closePreviewModal()
    openAgentEditModal(row)
  }
}

function saveAgentEditModal() {
  const n = agentEditForm.value.name.trim()
  if (!n) {
    actionHint.value = '请填写技能包名称'
    window.setTimeout(() => {
      actionHint.value = ''
    }, 3500)
    return
  }
  agentEditOpen.value = false
  actionHint.value = `已保存「${n}」（原型示意，SKILL.md 持久化待联调）`
  window.setTimeout(() => {
    actionHint.value = ''
  }, 6000)
}

function onPlatformWorkflowAction(row: SkillRow, label: string) {
  openActionDialog({
    title: `${row.name} · ${label}`,
    description:
      label === '审批'
        ? '审核中能力需管理员在审批中心处理；此处为原型示意。'
        : '提交后将进入审批中心队列；此处为原型示意。',
    items: ['与原型「审批中心 › 平台能力发布」流程对齐的联调待接入。'],
  })
}

const searchQuery = ref('')
const categoryFilter = ref('全部分类')
const statusFilter = ref('全部状态')

/** 与原型 `page-skills` 中 `<select>` 选项一致（表格中可有「产品」等标签，下拉不含「产品」） */
const CATEGORY_OPTIONS = ['全部分类', '工程', '文档', '测试', '安全', '数据'] as const
const STATUS_OPTIONS = ['全部状态', '已发布', '草稿', '审核中'] as const

type PillVariant = 'primary' | 'success' | 'warning' | 'danger' | 'muted'

/** 与原型 `ai-platform-prototype.html` → `page-skills` 表格行一致 */
const PROTOTYPE_ROWS: SkillRow[] = [
  {
    id: 'p1',
    icon: '🔍',
    iconBg: '#EEF1FF',
    name: '代码审查',
    subtitle: '规范·安全·性能三维度',
    command: '/code-review',
    categoryKey: '工程',
    categoryLabel: '工程',
    categoryVariant: 'primary',
    linkedKb: '代码规范 · 安全手册',
    monthlyCalls: '312',
    satisfaction: '👍 94%',
    satisfactionWarning: false,
    statusKey: '已发布',
    statusLabel: '已发布',
    statusVariant: 'success',
    testFixtureId: 'code-review',
  },
  {
    id: 'p2',
    icon: '🐛',
    iconBg: '#FEF3F2',
    name: 'Bug 分析',
    subtitle: '日志分析+根因定位',
    command: '/bug-analysis',
    categoryKey: '工程',
    categoryLabel: '工程',
    categoryVariant: 'primary',
    linkedKb: '架构指南',
    monthlyCalls: '89',
    satisfaction: '👍 91%',
    satisfactionWarning: false,
    statusKey: '已发布',
    statusLabel: '已发布',
    statusVariant: 'success',
    testFixtureId: 'bug-analysis',
  },
  {
    id: 'p3',
    icon: '📝',
    iconBg: '#ECFDF3',
    name: '文档生成',
    subtitle: '代码→OpenAPI/README',
    command: '/doc-gen',
    categoryKey: '文档',
    categoryLabel: '文档',
    categoryVariant: 'warning',
    linkedKb: '—',
    monthlyCalls: '156',
    satisfaction: '👍 88%',
    satisfactionWarning: false,
    statusKey: '已发布',
    statusLabel: '已发布',
    statusVariant: 'success',
    testFixtureId: 'doc-gen',
  },
  {
    id: 'p4',
    icon: '📋',
    iconBg: '#FFFAEB',
    name: '需求分析',
    subtitle: 'PRD拆解+验收标准',
    command: '/requirement-analysis',
    categoryKey: '产品',
    categoryLabel: '产品',
    categoryVariant: 'muted',
    linkedKb: '产品规范',
    monthlyCalls: '74',
    satisfaction: '👍 90%',
    satisfactionWarning: false,
    statusKey: '已发布',
    statusLabel: '已发布',
    statusVariant: 'success',
    testFixtureId: 'requirement-analysis',
  },
  {
    id: 'p5',
    icon: '🔐',
    iconBg: '#F9F5FF',
    name: '安全扫描',
    subtitle: 'OWASP Top 10 检测',
    command: '/security-scan',
    categoryKey: '安全',
    categoryLabel: '安全',
    categoryVariant: 'danger',
    linkedKb: '安全手册',
    monthlyCalls: '43',
    satisfaction: '👍 96%',
    satisfactionWarning: false,
    statusKey: '已发布',
    statusLabel: '已发布',
    statusVariant: 'success',
    testFixtureId: 'security-scan',
  },
  {
    id: 'p6',
    icon: '🏗️',
    iconBg: '#F0FDF4',
    name: '技术方案评审',
    subtitle: '架构合理性+风险评估',
    command: '/tech-review',
    categoryKey: '工程',
    categoryLabel: '工程',
    categoryVariant: 'primary',
    linkedKb: '架构指南',
    monthlyCalls: '28',
    satisfaction: '👍 85%',
    satisfactionWarning: true,
    statusKey: '审核中',
    statusLabel: '审核中',
    statusVariant: 'warning',
    testFixtureId: 'tech-review',
    workflowActions: [{ label: '审批', primary: true }],
  },
  {
    id: 'p7',
    icon: '✅',
    iconBg: '#EEF1FF',
    name: '单元测试生成',
    subtitle: '自动生成测试用例',
    command: '/gen-tests',
    categoryKey: '测试',
    categoryLabel: '测试',
    categoryVariant: 'muted',
    linkedKb: '—',
    monthlyCalls: '—',
    satisfaction: '—',
    satisfactionWarning: false,
    statusKey: '草稿',
    statusLabel: '草稿',
    statusVariant: 'muted',
    testFixtureId: 'gen-tests',
    workflowActions: [{ label: '提交审核', primary: true }],
  },
]

interface SkillRow {
  id: string
  icon: string
  iconBg: string
  name: string
  subtitle: string
  command: string
  categoryKey: string
  categoryLabel: string
  categoryVariant: PillVariant
  linkedKb: string
  monthlyCalls: string
  satisfaction: string
  satisfactionWarning: boolean
  statusKey: '已发布' | '草稿' | '审核中'
  statusLabel: string
  statusVariant: PillVariant
  /** 与原型 `SKILL_TEST_FIXTURES.platform` 键一致 */
  testFixtureId: string
  backendSkillId?: number
  workflowActions?: { label: string; primary?: boolean }[]
}

function pillClass(v: PillVariant) {
  return {
    'gsl-pill': true,
    'gsl-pill--primary': v === 'primary',
    'gsl-pill--success': v === 'success',
    'gsl-pill--warning': v === 'warning',
    'gsl-pill--danger': v === 'danger',
    'gsl-pill--muted': v === 'muted',
  }
}

function mapCategoryFromApi(raw: string | null | undefined): {
  key: string
  label: string
  variant: PillVariant
} {
  const s = (raw ?? '').trim().toLowerCase()
  const map: Record<string, { key: string; label: string; variant: PillVariant }> = {
    engineering: { key: '工程', label: '工程', variant: 'primary' },
    工程: { key: '工程', label: '工程', variant: 'primary' },
    doc: { key: '文档', label: '文档', variant: 'warning' },
    document: { key: '文档', label: '文档', variant: 'warning' },
    documentation: { key: '文档', label: '文档', variant: 'warning' },
    文档: { key: '文档', label: '文档', variant: 'warning' },
    test: { key: '测试', label: '测试', variant: 'muted' },
    testing: { key: '测试', label: '测试', variant: 'muted' },
    测试: { key: '测试', label: '测试', variant: 'muted' },
    security: { key: '安全', label: '安全', variant: 'danger' },
    安全: { key: '安全', label: '安全', variant: 'danger' },
    data: { key: '数据', label: '数据', variant: 'primary' },
    数据: { key: '数据', label: '数据', variant: 'primary' },
    product: { key: '产品', label: '产品', variant: 'muted' },
    产品: { key: '产品', label: '产品', variant: 'muted' },
  }
  if (map[s]) return map[s]
  if (!raw) return { key: '工程', label: '工程', variant: 'primary' }
  return { key: raw, label: raw, variant: 'primary' }
}

function mapApiSkill(s: SkillResponse, index: number): SkillRow {
  const st = (s.status ?? '').toUpperCase()
  let statusKey: SkillRow['statusKey'] = '草稿'
  let statusVariant: PillVariant = 'muted'
  if (st === 'PUBLISHED') {
    statusKey = '已发布'
    statusVariant = 'success'
  } else if (st === 'REVIEW' || st === 'PENDING' || st === 'IN_REVIEW') {
    statusKey = '审核中'
    statusVariant = 'warning'
  }

  const cat = mapCategoryFromApi(s.category)
  const cmd =
    s.skillKey && s.skillKey.length > 0
      ? s.skillKey.startsWith('/')
        ? s.skillKey
        : `/${s.skillKey}`
      : '—'

  const icons = ['⚡', '🔍', '📝', '🐛', '📋', '🔐', '🏗️', '✅']
  const bgs = ['#EEF1FF', '#FEF3F2', '#ECFDF3', '#FFFAEB', '#F9F5FF', '#F0FDF4']

  return {
    id: `api-${s.id}-${index}`,
    icon: icons[index % icons.length] ?? '⚡',
    iconBg: bgs[index % bgs.length] ?? '#EEF1FF',
    name: s.name,
    subtitle: s.description?.trim() || '—',
    command: cmd,
    categoryKey: cat.key,
    categoryLabel: cat.label,
    categoryVariant: cat.variant,
    linkedKb: '—',
    monthlyCalls: '—',
    satisfaction: '—',
    satisfactionWarning: false,
    statusKey,
    statusLabel: statusKey,
    statusVariant,
    testFixtureId: commandToFixtureId(cmd === '—' ? '' : cmd),
    backendSkillId: s.id,
    workflowActions:
      statusKey === '审核中'
        ? [{ label: '审批', primary: true }]
        : statusKey === '草稿'
          ? [{ label: '提交审核', primary: true }]
          : undefined,
  }
}

const sourceRows = computed<SkillRow[]>(() => {
  if (skills.value.length > 0) {
    return skills.value.map((s, i) => mapApiSkill(s, i))
  }
  return PROTOTYPE_ROWS
})

const filteredRows = computed(() => {
  let rows = sourceRows.value
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    rows = rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.subtitle.toLowerCase().includes(q) ||
        r.command.toLowerCase().includes(q) ||
        r.categoryLabel.toLowerCase().includes(q) ||
        r.linkedKb.toLowerCase().includes(q),
    )
  }
  const cat = categoryFilter.value
  if (cat && cat !== '全部分类') {
    rows = rows.filter((r) => r.categoryKey === cat)
  }
  const st = statusFilter.value
  if (st && st !== '全部状态') {
    rows = rows.filter((r) => r.statusKey === st)
  }
  return rows
})

const publishedCount = computed(() => skills.value.filter((s) => (s.status ?? '').toUpperCase() === 'PUBLISHED').length)
const draftCount = computed(() => skills.value.filter((s) => (s.status ?? '').toUpperCase() === 'DRAFT').length)
const reviewLikeCount = computed(() =>
  skills.value.filter((s) => ['REVIEW', 'PENDING', 'IN_REVIEW'].includes((s.status ?? '').toUpperCase())).length,
)

const prototypePendingReviewCount =
  PROTOTYPE_ROWS.filter((r) => r.statusKey === '审核中' || r.statusKey === '草稿').length

/** 与原型 `page-skills` 顶部四块指标一致 */
const metrics = computed(() => {
  const n = skills.value.length
  const totalVal = n > 0 ? String(n) : '12'
  const totalDelta = n > 0 ? `已发布 ${publishedCount.value} · 草稿 ${draftCount.value}` : '↑ 2 本月新增'

  const pendingVal =
    n > 0 ? String(reviewLikeCount.value + draftCount.value) : String(prototypePendingReviewCount)
  const pendingDelta =
    n > 0
      ? reviewLikeCount.value > 0
        ? `含审核中 ${reviewLikeCount.value} 项`
        : '新建默认均为草稿'
      : '需管理员审批'

  return [
    {
      id: 'total',
      icon: '⚡',
      label: '全局技能总数',
      value: totalVal,
      delta: totalDelta,
      tone: 'primary' as const,
      deltaTone: 'success' as const,
    },
    {
      id: 'calls',
      icon: '🔥',
      label: '本月总调用次数',
      value: '1,847',
      delta: '↑ 23% 较上月',
      tone: undefined,
      deltaTone: 'success' as const,
    },
    {
      id: 'satisfaction',
      icon: '👍',
      label: '平均满意度',
      value: '92%',
      delta: '基于用户反馈',
      tone: 'success' as const,
      deltaTone: 'success' as const,
    },
    {
      id: 'pending',
      icon: '📋',
      label: '待审核发布',
      value: pendingVal,
      delta: pendingDelta,
      tone: 'warning' as const,
      deltaTone: 'danger' as const,
    },
  ]
})

const hubTab = ref<'platform' | 'agent'>('platform')

function setHubTab(tab: 'platform' | 'agent') {
  hubTab.value = tab
}

function openSkillAuditFlow() {
  openActionDialog({
    title: '技能审核流程',
    description: '技能发布需经过完整的审核流程。',
    items: [
      '📝 草稿：创建者编辑 Prompt 模板和配置',
      '🧪 测试：在线试运行验证效果',
      '🔍 审核中：提交审核，等待管理员审批',
      '✅ 已发布：通过审核，全员可用',
      '🔄 可回滚：支持版本回退到任意历史版本',
      '📊 反馈收集：用户可👍/👎评价技能效果',
    ],
  })
}

/** Agent（SKILL.md）侧栏分组 — 与原型一致 */
const AGENT_GROUPS = [
  { id: 'engineering', slug: 'engineering', label: '工程效能', packCount: 2 },
  { id: 'research', slug: 'research', label: '研究与文档', packCount: 1 },
] as const

interface AgentPackRow {
  id: string
  groupId: string
  groupLabel: string
  icon: string
  iconBg: string
  name: string
  subtitle: string
  slug: string
  categoryKey: string
  categoryLabel: string
  categoryVariant: PillVariant
  description: string
  version: string
  statusKey: string
  statusVariant: PillVariant
}

const PROTOTYPE_AGENT_PACKS: AgentPackRow[] = [
  {
    id: 'ap1',
    groupId: 'engineering',
    groupLabel: '工程效能',
    icon: '🧪',
    iconBg: '#ECFDF3',
    name: '单元测试生成（Agent）',
    subtitle: 'Vitest / JUnit 骨架',
    slug: 'test-gen',
    categoryKey: '测试',
    categoryLabel: '测试',
    categoryVariant: 'muted',
    description: '按项目栈生成单测骨架与边界用例',
    version: 'v0.2-draft',
    statusKey: '已发布',
    statusVariant: 'success',
  },
  {
    id: 'ap2',
    groupId: 'research',
    groupLabel: '研究与文档',
    icon: '🔬',
    iconBg: '#EEF4FF',
    name: '深度调研',
    subtitle: '多源检索 + 引用',
    slug: 'deep-research',
    categoryKey: '文档',
    categoryLabel: '文档',
    categoryVariant: 'warning',
    description: '行业/论文综合调研，固定章节报告',
    version: 'v1.3',
    statusKey: '已发布',
    statusVariant: 'success',
  },
  {
    id: 'ap3',
    groupId: 'engineering',
    groupLabel: '工程效能',
    icon: '📐',
    iconBg: '#FFFAEB',
    name: 'API 契约检查',
    subtitle: 'OpenAPI diff',
    slug: 'api-contract-check',
    categoryKey: '工程',
    categoryLabel: '工程',
    categoryVariant: 'primary',
    description: '结构化 diff，标记 breaking 与风险项',
    version: 'v1.0',
    statusKey: '已发布',
    statusVariant: 'success',
  },
]

const selectedAgentGroupId = ref<string | null>('engineering')
const agentSearchQuery = ref('')
const agentCategoryFilter = ref('全部分类')
const agentStatusFilter = ref('全部状态')

const AGENT_CATEGORY_OPTIONS = ['全部分类', '工程', '文档', '测试'] as const
const AGENT_STATUS_OPTIONS = ['全部状态', '已发布', '草稿'] as const

function selectAgentGroup(id: string) {
  selectedAgentGroupId.value = id
}

const filteredAgentPacks = computed(() => {
  const gid = selectedAgentGroupId.value
  if (!gid) return []
  let rows = PROTOTYPE_AGENT_PACKS.filter((r) => r.groupId === gid)
  const q = agentSearchQuery.value.trim().toLowerCase()
  if (q) {
    rows = rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.subtitle.toLowerCase().includes(q) ||
        r.slug.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q),
    )
  }
  const cat = agentCategoryFilter.value
  if (cat && cat !== '全部分类') {
    rows = rows.filter((r) => r.categoryKey === cat)
  }
  const st = agentStatusFilter.value
  if (st && st !== '全部状态') {
    rows = rows.filter((r) => r.statusKey === st)
  }
  return rows
})

const currentAgentGroupLabel = computed(() => {
  const g = AGENT_GROUPS.find((x) => x.id === selectedAgentGroupId.value)
  return g?.label ?? '—'
})

function exportAgentSkillGroup() {
  const label = currentAgentGroupLabel.value
  const rows = PROTOTYPE_AGENT_PACKS.filter((r) => r.groupId === selectedAgentGroupId.value)
  let bundle = '# Agent 技能包 · 分组导出（原型合并清单）\n\n'
  const seen: Record<string, boolean> = {}
  for (const r of rows) {
    if (seen[r.slug]) continue
    seen[r.slug] = true
    const md = AGENT_SKILL_MD[r.slug] || '（暂无正文）\n'
    bundle += `---\n## ${r.slug}/SKILL.md\n---\n\n${md}\n\n`
  }
  previewTitle.value = `导出本组 · ${label === '—' ? 'Agent 技能包' : label}`
  previewBody.value = bundle
  previewCopyLabel.value = '复制全文'
  previewIsMarkdown.value = true
  previewOpen.value = true
  actionHint.value = '已打开合并导出预览，可复制全文（示意）'
  window.setTimeout(() => {
    actionHint.value = ''
  }, 4000)
}

function openAgentNewGroup() {
  openActionDialog({
    title: '新建分组',
    description: '须先创建分组，再在分组下新建 SKILL.md 技能包；支持按组筛选与导出。',
    items: ['分组将映射为目录或命名空间标识。', '该能力待与后端存储联调。'],
  })
}

function openAgentNewPack() {
  const g = currentAgentGroupLabel.value
  openActionDialog({
    title: `新建技能包 · ${g}`,
    description: '在当前分组下创建本地 SKILL.md 规程包，不经中台执行链。',
    items: ['向导与模板编辑待接入。'],
  })
}

onMounted(async () => {
  window.addEventListener('keydown', onGlobalKeydown)
  try {
    skills.value = await listSkills()
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : '加载技能列表失败'
    skills.value = []
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
})
</script>

<template>
  <section class="gsl-workspace" data-testid="global-skills-workspace">
    <p v-if="loadError" class="gsl-banner" role="status">{{ loadError }}</p>
    <p v-if="actionHint" class="gsl-banner gsl-banner--success" role="status">{{ actionHint }}</p>

    <section class="gsl-metrics">
      <StatCard
        v-for="m in metrics"
        :key="m.id"
        :delta="m.delta"
        :delta-tone="m.deltaTone"
        :icon="m.icon"
        :label="m.label"
        :tone="m.tone"
        :value="m.value"
      />
    </section>

    <div class="gsl-hint-banner" role="note">
      <strong class="gsl-hint-banner__lead">分类说明：</strong>「中台（JSON）」走 Router / Runner，可配工具、知识库与权限审计；「Agent（SKILL.md）」为 Cursor / Claude Code
      等本地加载的规程包，不经过中台执行链。
      <span class="gsl-hint-banner__sub">若需两份材料，请分别在两个 Tab 下各建一条记录。</span>
    </div>

    <div class="gsl-tabs" role="tablist" aria-label="技能库类型">
      <button
        type="button"
        role="tab"
        class="gsl-tab"
        :class="{ 'gsl-tab--active': hubTab === 'platform' }"
        :aria-selected="hubTab === 'platform'"
        @click="setHubTab('platform')"
      >
        中台（JSON）
      </button>
      <button
        type="button"
        role="tab"
        class="gsl-tab"
        :class="{ 'gsl-tab--active': hubTab === 'agent' }"
        :aria-selected="hubTab === 'agent'"
        @click="setHubTab('agent')"
      >
        Agent（SKILL.md）
      </button>
    </div>

    <div v-show="hubTab === 'platform'" class="gsl-hub-panel">
      <div class="gsl-toolbar">
        <input
          v-model="searchQuery"
          class="gsl-search"
          placeholder="搜索能力名称…"
          type="search"
          aria-label="搜索能力名称"
        />
        <select v-model="categoryFilter" class="gsl-select" aria-label="分类">
          <option v-for="c in CATEGORY_OPTIONS" :key="c" :value="c">{{ c }}</option>
        </select>
        <select v-model="statusFilter" class="gsl-select" aria-label="状态">
          <option v-for="s in STATUS_OPTIONS" :key="s" :value="s">{{ s }}</option>
        </select>
        <div class="gsl-toolbar-spacer" aria-hidden="true" />
        <button class="gsl-btn" type="button" @click="openSkillAuditFlow">📋 审核流程</button>
        <button class="gsl-btn gsl-btn--primary" type="button" @click="openCreateSkillModal">+ 新建中台能力</button>
      </div>

      <CardPanel
        title="中台能力库"
        subtitle="通过 MCP Prompts 暴露，在客户端呈现为 / 命令；含路由、执行器与审计"
        class="gsl-panel"
      >
        <div class="gsl-table-wrap">
          <table class="gsl-table">
            <thead>
              <tr>
                <th>技能名称</th>
                <th>触发命令</th>
                <th>分类</th>
                <th>关联知识库</th>
                <th>本月调用</th>
                <th>满意度</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in filteredRows" :key="row.id">
                <td>
                  <div class="gsl-skill-cell">
                    <div class="gsl-skill-icon" :style="{ background: row.iconBg }">{{ row.icon }}</div>
                    <div class="gsl-skill-text">
                      <div class="gsl-skill-name">{{ row.name }}</div>
                      <div class="gsl-skill-sub">{{ row.subtitle }}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <code class="gsl-code">{{ row.command }}</code>
                </td>
                <td>
                  <span :class="pillClass(row.categoryVariant)">{{ row.categoryLabel }}</span>
                </td>
                <td>{{ row.linkedKb }}</td>
                <td>
                  <strong v-if="row.monthlyCalls !== '—'">{{ row.monthlyCalls }}</strong>
                  <span v-else class="gsl-muted">—</span>
                </td>
                <td>
                  <span
                    v-if="row.satisfaction !== '—'"
                    :class="row.satisfactionWarning ? 'gsl-sat gsl-sat--warn' : 'gsl-sat gsl-sat--ok'"
                  >
                    {{ row.satisfaction }}
                  </span>
                  <span v-else class="gsl-muted">—</span>
                </td>
                <td>
                  <span :class="pillClass(row.statusVariant)">{{ row.statusLabel }}</span>
                </td>
                <td>
                  <div class="gsl-actions">
                    <button class="gsl-mini-btn" type="button" @click="openSkillTestRunFromRow(row)">▶ 测试</button>
                    <button class="gsl-mini-btn" type="button" @click="openPlatformEditModal(row)">✏️ 编辑</button>
                    <button class="gsl-mini-btn" type="button" @click="openPlatformPreview(row)">预览</button>
                    <button
                      v-for="(a, i) in row.workflowActions ?? []"
                      :key="`${row.id}-wf-${i}`"
                      :class="['gsl-mini-btn', a.primary ? 'gsl-mini-btn--primary' : '']"
                      type="button"
                      @click="onPlatformWorkflowAction(row, a.label)"
                    >
                      {{ a.label }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardPanel>
    </div>

    <div v-show="hubTab === 'agent'" class="gsl-hub-panel gsl-agent-hub">
      <div class="gsl-agent-grid">
        <aside class="gsl-agent-rail card-panel-like">
          <header class="gsl-agent-rail__head">
            <span class="gsl-agent-rail__title">技能包分组</span>
          </header>
          <div class="gsl-agent-rail__body">
            <p class="gsl-agent-rail__hint">
              须先创建分组，再在分组下新建 SKILL.md 技能包；支持按组筛选与导出。
            </p>
            <div class="gsl-agent-rail__list">
              <button
                v-for="g in AGENT_GROUPS"
                :key="g.id"
                type="button"
                class="gsl-group-item"
                :class="{ 'gsl-group-item--active': selectedAgentGroupId === g.id }"
                @click="selectAgentGroup(g.id)"
              >
                <div class="gsl-group-item__slug">{{ g.slug }}</div>
                <div class="gsl-group-item__label">{{ g.label }}</div>
                <div class="gsl-group-item__meta">{{ g.packCount }} 个技能包</div>
              </button>
            </div>
            <button type="button" class="gsl-btn gsl-btn--block" @click="openAgentNewGroup">+ 新建分组</button>
          </div>
        </aside>

        <div class="gsl-agent-main">
          <div v-if="!selectedAgentGroupId" class="gsl-agent-empty">
            <div class="gsl-agent-empty__icon" aria-hidden="true">📂</div>
            <div class="gsl-agent-empty__title">请先选择左侧分组</div>
            <p class="gsl-agent-empty__text">
              没有分组时无法新建技能包。可先点<strong>新建分组</strong>创建目录，再选中该分组后使用「新建技能包」。
            </p>
          </div>

          <template v-else>
            <div class="gsl-toolbar">
              <input
                v-model="agentSearchQuery"
                class="gsl-search"
                placeholder="在当前分组内搜索…"
                type="search"
                aria-label="在当前分组内搜索"
              />
              <select v-model="agentCategoryFilter" class="gsl-select" aria-label="Agent 分类">
                <option v-for="c in AGENT_CATEGORY_OPTIONS" :key="c" :value="c">{{ c }}</option>
              </select>
              <select v-model="agentStatusFilter" class="gsl-select" aria-label="Agent 状态">
                <option v-for="s in AGENT_STATUS_OPTIONS" :key="s" :value="s">{{ s }}</option>
              </select>
              <div class="gsl-toolbar-spacer" aria-hidden="true" />
              <button class="gsl-btn" type="button" @click="exportAgentSkillGroup">导出本组</button>
              <button class="gsl-btn gsl-btn--primary" type="button" @click="openAgentNewPack">+ 新建技能包</button>
            </div>

            <CardPanel
              class="gsl-panel"
              title="Agent 技能包"
              :subtitle="`当前分组：${currentAgentGroupLabel} · 本地 SKILL.md，不经中台执行链`"
            >
              <div class="gsl-table-wrap">
                <table class="gsl-table">
                  <thead>
                    <tr>
                      <th>技能包名称</th>
                      <th>标识</th>
                      <th>所属分组</th>
                      <th>分类</th>
                      <th>说明</th>
                      <th>版本</th>
                      <th>状态</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in filteredAgentPacks" :key="row.id">
                      <td>
                        <div class="gsl-skill-cell">
                          <div class="gsl-skill-icon" :style="{ background: row.iconBg }">{{ row.icon }}</div>
                          <div class="gsl-skill-text">
                            <div class="gsl-skill-name">{{ row.name }}</div>
                            <div class="gsl-skill-sub">{{ row.subtitle }}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <code class="gsl-code">{{ row.slug }}</code>
                      </td>
                      <td>
                        <span class="gsl-pill gsl-pill--purple">{{ row.groupLabel }}</span>
                      </td>
                      <td>
                        <span :class="pillClass(row.categoryVariant)">{{ row.categoryLabel }}</span>
                      </td>
                      <td class="gsl-td-desc">{{ row.description }}</td>
                      <td>
                        <code class="gsl-code">{{ row.version }}</code>
                      </td>
                      <td>
                        <span :class="pillClass(row.statusVariant)">{{ row.statusKey }}</span>
                      </td>
                      <td>
                        <div class="gsl-actions">
                          <button class="gsl-mini-btn" type="button" @click="openAgentSkillTestRun(row)">▶ 测试</button>
                          <button class="gsl-mini-btn" type="button" @click="openAgentEditModal(row)">✏️ 编辑</button>
                          <button class="gsl-mini-btn" type="button" @click="openAgentSkillMdPreview(row)">预览</button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardPanel>
          </template>
        </div>
      </div>
    </div>

    <!-- 新建中台能力：与原型 modal-createSkill 三步向导（中台轨）一致；编辑仍为单页表单 -->
    <div
      v-if="createModalOpen"
      class="gsl-modal-backdrop"
      data-testid="gsl-create-skill-backdrop"
      @click.self="closeCreateModal"
    >
      <div
        class="gsl-modal"
        :class="{ 'gsl-modal--skill-wizard': skillFormMode === 'create' }"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gsl-create-skill-title"
      >
        <button class="gsl-modal-close" type="button" aria-label="关闭" @click="closeCreateModal">×</button>

        <template v-if="skillFormMode === 'create'">
          <div class="gsl-skill-wizard-head">
            <h2 id="gsl-create-skill-title" class="gsl-skill-wizard-title">{{ createModalTitle }}</h2>
            <p class="gsl-skill-wizard-sub">{{ WIZARD_SUB_CREATE }}</p>
          </div>

          <div class="gsl-skill-wizard-track" aria-hidden="true">
            <div
              class="gsl-skill-wizard-step"
              :class="{
                'gsl-skill-wizard-step--active': skillStepState(1) === 'active',
                'gsl-skill-wizard-step--done': skillStepState(1) === 'done',
              }"
            >
              <span class="gsl-skill-wizard-step-num">1</span>基本信息
            </div>
            <div
              class="gsl-skill-wizard-step"
              :class="{
                'gsl-skill-wizard-step--active': skillStepState(2) === 'active',
                'gsl-skill-wizard-step--done': skillStepState(2) === 'done',
              }"
            >
              <span class="gsl-skill-wizard-step-num">2</span>工作方式
            </div>
            <div
              class="gsl-skill-wizard-step"
              :class="{
                'gsl-skill-wizard-step--active': skillStepState(3) === 'active',
                'gsl-skill-wizard-step--done': skillStepState(3) === 'done',
              }"
            >
              <span class="gsl-skill-wizard-step-num">3</span>权限与安全
            </div>
          </div>

          <div v-if="modalFormError" class="gsl-modal-error">{{ modalFormError }}</div>

          <!-- Step 1 -->
          <div v-show="createWizardStep === 1" class="gsl-skill-wizard-panel">
            <div class="gsl-skill-section">
              <div class="gsl-skill-section-title">这一步：说清楚这是什么能力</div>
              <p class="gsl-skill-section-hint">
                名称与说明会出现在侧边栏「能力与技能」中台 Tab 的列表中。
              </p>
              <label class="gsl-field">
                <span class="gsl-field-label">能力名称</span>
                <input
                  v-model="createForm.name"
                  class="gsl-field-input"
                  placeholder="例如：代码审查助手"
                  type="text"
                />
              </label>
              <label class="gsl-field">
                <span class="gsl-field-label">它能帮同事做什么？</span>
                <textarea
                  v-model="createForm.description"
                  class="gsl-field-textarea"
                  rows="3"
                  placeholder="用一两句话描述使用场景，例如：在提交代码前，自动从规范、安全、性能三方面给出修改建议。"
                />
              </label>
              <div class="gsl-modal-grid2">
                <label class="gsl-field">
                  <span class="gsl-field-label">归类（方便筛选）</span>
                  <select v-model="createForm.categoryApi" class="gsl-field-input">
                    <option v-for="c in FORM_CATEGORIES" :key="c.value" :value="c.value">{{ c.label }}</option>
                  </select>
                </label>
                <label class="gsl-field">
                  <span class="gsl-field-label">适用范围</span>
                  <select v-model="createForm.scopeUi" class="gsl-field-input">
                    <option value="enterprise">全公司可用</option>
                    <option value="project">仅指定项目</option>
                  </select>
                </label>
              </div>
              <label v-if="createForm.scopeUi === 'project'" class="gsl-field gsl-field--full">
                <span class="gsl-field-label">所属项目</span>
                <select v-model="createForm.projectIdStr" class="gsl-field-input" :disabled="projectsLoading">
                  <option value="">{{ projectsLoading ? '加载中…' : '请选择项目' }}</option>
                  <option v-for="p in projectOptions" :key="p.id" :value="String(p.id)">
                    {{ p.name }}（ID {{ p.id }}）
                  </option>
                </select>
                <span v-if="projectsLoadError" class="gsl-field-hint gsl-field-hint--danger">{{ projectsLoadError }}</span>
              </label>
              <label class="gsl-field gsl-field--full">
                <span class="gsl-field-label">快捷唤起（可选）</span>
                <input
                  v-model="createForm.command"
                  class="gsl-field-input"
                  placeholder="在聊天里输入 /code-review 即可唤起"
                  type="text"
                />
                <span class="gsl-field-hint">不填也不影响使用，只是少一个「口令」式入口；保存时会规范为 skillKey。</span>
              </label>
            </div>
          </div>

          <!-- Step 2 -->
          <div v-show="createWizardStep === 2" class="gsl-skill-wizard-panel">
            <div class="gsl-skill-section">
              <div class="gsl-skill-section-title">选择工作方式</div>
              <p class="gsl-skill-section-hint">选最贴近的一种即可，稍后仍可改。复杂多步流程可以选「流程编排」。</p>
              <div class="gsl-skill-type-grid">
                <button
                  v-for="card in PLATFORM_WORK_CARDS"
                  :key="card.id"
                  type="button"
                  class="gsl-skill-type-card"
                  :class="{ 'gsl-skill-type-card--active': platformWorkMode === card.id }"
                  @click="setPlatformWorkMode(card.id)"
                >
                  <span class="gsl-stc-icon">{{ card.icon }}</span>
                  <span class="gsl-stc-title">{{ card.title }}</span>
                  <span class="gsl-stc-desc">{{ card.desc }}</span>
                </button>
              </div>
            </div>
            <div class="gsl-skill-section">
              <div class="gsl-skill-section-title">具体怎么执行</div>
              <p class="gsl-skill-section-hint">{{ wizardExecContextHint }}</p>

              <div v-show="platformWorkMode === 'prompt'" class="gsl-skill-exec-panel">
                <label class="gsl-field">
                  <span class="gsl-field-label">给 AI 的说明（提示词）</span>
                  <textarea
                    v-model="createForm.systemPrompt"
                    class="gsl-field-textarea"
                    rows="5"
                    :placeholder="PROMPT_STEP2_PLACEHOLDER"
                  />
                </label>
              </div>

              <div v-show="platformWorkMode === 'tool'" class="gsl-skill-exec-panel">
                <label class="gsl-field">
                  <span class="gsl-field-label">要调用的工具</span>
                  <select v-model="execToolName" class="gsl-field-input">
                    <option v-for="o in EXEC_TOOL_OPTIONS" :key="o.value || 'empty'" :value="o.value">
                      {{ o.label }}
                    </option>
                  </select>
                </label>
                <p class="gsl-skill-tool-hint">{{ TOOL_EXEC_LONG_HINT }}</p>
              </div>

              <div v-show="platformWorkMode === 'knowledge'" class="gsl-skill-exec-panel">
                <div class="gsl-modal-grid2">
                  <label class="gsl-field">
                    <span class="gsl-field-label">知识库 Collection</span>
                    <select v-model="kbCollection" class="gsl-field-input">
                      <option v-for="o in KB_COLLECTION_OPTIONS" :key="o.value || 'k0'" :value="o.value">
                        {{ o.label }}
                      </option>
                    </select>
                  </label>
                  <label class="gsl-field">
                    <span class="gsl-field-label">最多引用几条片段</span>
                    <input v-model.number="kbTopK" class="gsl-field-input" type="number" min="1" max="20" />
                  </label>
                </div>
                <label class="gsl-field gsl-field--full">
                  <span class="gsl-field-label">检索之后怎样组织回答（可选）</span>
                  <textarea
                    v-model="kbFollowPrompt"
                    class="gsl-field-textarea"
                    rows="2"
                    :placeholder="KB_FOLLOW_PLACEHOLDER"
                  />
                </label>
                <p class="gsl-skill-kb-hint">{{ KB_EXEC_LONG_HINT }}</p>
              </div>

              <div v-show="platformWorkMode === 'workflow'" class="gsl-skill-exec-panel gsl-wf-root">
                <div class="gsl-workflow-banner">
                  步骤<strong>自上而下顺序执行</strong>。每步可写入命名输出（如 <code>data</code>），后续在「对话生成」里用
                  <code>{{ CITE_DATA }}</code>、<code>{{ CITE_DOCS }}</code> 引用。
                </div>
                <div class="gsl-wf-list">
                  <div v-for="(step, idx) in workflowSteps" :key="step._key" class="gsl-wf-card">
                    <div class="gsl-wf-card-head">
                      <span class="gsl-wf-step-label">步骤 {{ idx + 1 }}</span>
                      <div class="gsl-wf-card-actions">
                        <button
                          type="button"
                          class="gsl-wf-act"
                          :disabled="idx === 0"
                          @click="moveWorkflowStep(idx, -1)"
                        >
                          上移
                        </button>
                        <button
                          type="button"
                          class="gsl-wf-act"
                          :disabled="idx >= workflowSteps.length - 1"
                          @click="moveWorkflowStep(idx, 1)"
                        >
                          下移
                        </button>
                        <button type="button" class="gsl-wf-act gsl-wf-act--danger" @click="removeWorkflowStep(idx)">
                          删除
                        </button>
                      </div>
                    </div>
                    <div class="gsl-wf-card-body">
                      <label class="gsl-field gsl-wf-field">
                        <span class="gsl-field-label">步骤类型</span>
                        <select
                          class="gsl-field-input"
                          :value="step.type"
                          @change="onWorkflowStepTypeChange(idx, $event)"
                        >
                          <option v-for="o in WORKFLOW_STEP_TYPE_OPTIONS" :key="o.value" :value="o.value">
                            {{ o.label }}
                          </option>
                        </select>
                      </label>
                      <label class="gsl-field gsl-wf-field">
                        <span class="gsl-field-label">输出变量名</span>
                        <input
                          v-model="step.output"
                          class="gsl-field-input"
                          type="text"
                          placeholder="如 data、docs、answer"
                          autocomplete="off"
                        />
                      </label>
                      <template v-if="step.type === 'tool'">
                        <label class="gsl-field gsl-wf-field gsl-wf-field--full">
                          <span class="gsl-field-label">工具</span>
                          <select v-model="step.name" class="gsl-field-input">
                            <option v-for="o in EXEC_TOOL_OPTIONS" :key="o.value || 't0'" :value="o.value">
                              {{ o.label }}
                            </option>
                          </select>
                        </label>
                      </template>
                      <template v-else-if="step.type === 'knowledge'">
                        <div class="gsl-wf-grid2">
                          <label class="gsl-field gsl-wf-field">
                            <span class="gsl-field-label">知识库 Collection</span>
                            <select v-model="step.collection" class="gsl-field-input">
                              <option v-for="o in KB_COLLECTION_OPTIONS" :key="o.value || 'k0'" :value="o.value">
                                {{ o.label }}
                              </option>
                            </select>
                          </label>
                          <label class="gsl-field gsl-wf-field">
                            <span class="gsl-field-label">最多引用几条</span>
                            <input
                              v-model.number="step.top_k"
                              class="gsl-field-input"
                              type="number"
                              min="1"
                              max="20"
                            />
                          </label>
                        </div>
                      </template>
                      <template v-else>
                        <label class="gsl-field gsl-wf-field gsl-wf-field--full">
                          <span class="gsl-field-label">对话模板（可用 {{ CITE_DATA }} 等引用上步输出）</span>
                          <textarea
                            v-model="step.template"
                            class="gsl-field-textarea"
                            rows="3"
                            spellcheck="false"
                            placeholder="例如：根据资料总结要点…"
                          />
                        </label>
                      </template>
                    </div>
                  </div>
                </div>
                <button type="button" class="gsl-wf-add" @click="addWorkflowStep">+ 添加步骤</button>
                <details class="gsl-wf-json-details">
                  <summary class="gsl-wf-json-summary">高级：查看 / 编辑 JSON（与上方步骤同步，失焦后解析）</summary>
                  <textarea
                    v-model="workflowJsonEditor"
                    class="gsl-field-textarea gsl-wf-json-textarea"
                    rows="10"
                    spellcheck="false"
                    @blur="applyWorkflowJsonFromEditor"
                  />
                </details>
              </div>
            </div>
          </div>

          <!-- Step 3 -->
          <div v-show="createWizardStep === 3" class="gsl-skill-wizard-panel">
            <div class="gsl-lifecycle-banner">
              <strong>流程说明</strong>（中台）：<strong>① 草稿</strong> — 本向导编辑 /「保存草稿」仅保留配置，<strong>不进入审核、不对外生效</strong>。<strong>② 提交审核</strong>
              — 点「提交审核」进入侧栏<strong>审批中心</strong>中「平台能力发布」队列。<strong>③ 审批</strong> — 通过后才进入「已发布」。
            </div>
            <div class="gsl-skill-section">
              <div class="gsl-skill-section-title">谁可以使用</div>
              <p class="gsl-skill-section-hint">
                与<strong>权限管理</strong> › <strong>平台角色</strong>中的系统内置角色一致；至少选一项。
              </p>
              <button type="button" class="gsl-btn gsl-btn--text" @click="openPermissionsRefFromWizard">
                打开权限管理 · 对照平台角色
              </button>
              <div class="gsl-role-row">
                <label class="gsl-role-pill">
                  <input v-model="wizardRoles.super_admin" type="checkbox" /> 👑 超级管理员
                </label>
                <label class="gsl-role-pill">
                  <input v-model="wizardRoles.platform_admin" type="checkbox" /> 🔧 平台管理员
                </label>
                <label class="gsl-role-pill">
                  <input v-model="wizardRoles.member" type="checkbox" /> 👤 普通成员
                </label>
              </div>
            </div>
            <div class="gsl-skill-section">
              <div class="gsl-skill-section-title">还可以同时使用（可选）</div>
              <p class="gsl-skill-section-hint">勾选后，执行时自动带上这些能力，不必在提示词里重复写。</p>
              <div class="gsl-modal-grid2 gsl-modal-grid2--assoc">
                <div class="gsl-field gsl-field--assoc">
                  <span class="gsl-field-label">内部工具</span>
                  <div class="gsl-check-list">
                    <label v-for="o in TOOL_OPTIONS" :key="o.id" class="gsl-check-row">
                      <input v-model="toolChecks[o.id]" type="checkbox" />
                      <span>{{ o.id }}</span>
                    </label>
                  </div>
                </div>
                <div class="gsl-field gsl-field--assoc">
                  <span class="gsl-field-label">知识库范围</span>
                  <div class="gsl-check-list">
                    <label v-for="o in KB_OPTIONS" :key="o.id" class="gsl-check-row">
                      <input v-model="kbChecks[o.id]" type="checkbox" />
                      <span>{{ o.id }}</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
            <div class="gsl-skill-section">
              <label class="gsl-policy-row">
                <input v-model="skillPolicyConfirm" type="checkbox" />
                <span>
                  <strong>敏感操作需人工确认</strong><br />
                  <span class="gsl-policy-sub">涉及写数据、对外发消息等，建议开启；执行前会多一步确认。</span>
                </span>
              </label>
            </div>
          </div>

          <div class="gsl-skill-wizard-footer">
            <button class="gsl-btn" type="button" @click="closeCreateModal">取消</button>
            <span class="gsl-wizard-spacer" />
            <button
              v-show="createWizardStep > 1"
              class="gsl-btn"
              type="button"
              @click="wizardGoPrev"
            >
              上一步
            </button>
            <button
              v-show="createWizardStep < 3"
              class="gsl-btn gsl-btn--primary"
              type="button"
              @click="wizardGoNext"
            >
              下一步
            </button>
            <button
              v-show="createWizardStep === 3"
              class="gsl-btn"
              type="button"
              :disabled="submittingSkill"
              @click="submitCreateSkill('draft')"
            >
              {{ submittingSkill ? '提交中…' : '保存草稿' }}
            </button>
            <button
              v-show="createWizardStep === 3"
              class="gsl-btn gsl-btn--primary"
              type="button"
              :disabled="submittingSkill"
              @click="submitCreateSkill('review')"
            >
              提交审核
            </button>
            <button
              v-show="createWizardStep === 3"
              class="gsl-btn"
              type="button"
              :disabled="submittingSkill"
              @click="submitCreateSkill('test')"
            >
              试运行
            </button>
          </div>
        </template>

        <template v-else>
          <h2 id="gsl-create-skill-title" class="gsl-modal-title">{{ createModalTitle }}</h2>
          <div v-if="modalFormError" class="gsl-modal-error">{{ modalFormError }}</div>
          <div class="gsl-modal-section">基础信息</div>
          <div class="gsl-modal-grid2">
            <label class="gsl-field">
              <span class="gsl-field-label">技能名称</span>
              <input v-model="createForm.name" class="gsl-field-input" placeholder="例：代码审查" type="text" />
            </label>
            <label class="gsl-field">
              <span class="gsl-field-label">触发命令</span>
              <input v-model="createForm.command" class="gsl-field-input" placeholder="例：/code-review" type="text" />
            </label>
            <label class="gsl-field">
              <span class="gsl-field-label">分类</span>
              <select v-model="createForm.categoryApi" class="gsl-field-input">
                <option v-for="c in FORM_CATEGORIES" :key="c.value" :value="c.value">{{ c.label }}</option>
              </select>
            </label>
            <label class="gsl-field">
              <span class="gsl-field-label">范围</span>
              <select v-model="createForm.scopeUi" class="gsl-field-input">
                <option value="enterprise">企业全局</option>
                <option value="project">项目级</option>
              </select>
            </label>
          </div>
          <label v-if="createForm.scopeUi === 'project'" class="gsl-field gsl-field--full">
            <span class="gsl-field-label">所属项目</span>
            <select v-model="createForm.projectIdStr" class="gsl-field-input" :disabled="projectsLoading">
              <option value="">{{ projectsLoading ? '加载中…' : '请选择项目' }}</option>
              <option v-for="p in projectOptions" :key="p.id" :value="String(p.id)">
                {{ p.name }}（ID {{ p.id }}）
              </option>
            </select>
            <span v-if="projectsLoadError" class="gsl-field-hint gsl-field-hint--danger">{{ projectsLoadError }}</span>
          </label>
          <label class="gsl-field gsl-field--full">
            <span class="gsl-field-label">技能描述（AI 理解用途）</span>
            <input
              v-model="createForm.description"
              class="gsl-field-input"
              placeholder="对提交的代码进行全面审查，包含规范、安全、性能三个维度"
              type="text"
            />
          </label>
          <div class="gsl-modal-section">Prompt 模板</div>
          <label class="gsl-field gsl-field--full">
            <span class="gsl-field-label">{{ PROMPT_FIELD_LABEL }}</span>
            <textarea
              v-model="createForm.systemPrompt"
              class="gsl-field-textarea"
              rows="5"
              :placeholder="SYSTEM_PROMPT_PLACEHOLDER"
            />
          </label>
          <div class="gsl-modal-section">关联配置</div>
          <div class="gsl-modal-grid2 gsl-modal-grid2--assoc">
            <div class="gsl-field gsl-field--assoc">
              <span class="gsl-field-label">关联知识库</span>
              <div class="gsl-check-list">
                <label v-for="o in KB_OPTIONS" :key="o.id" class="gsl-check-row">
                  <input v-model="kbChecks[o.id]" type="checkbox" />
                  <span>{{ o.id }}</span>
                </label>
              </div>
            </div>
            <div class="gsl-field gsl-field--assoc">
              <span class="gsl-field-label">绑定工具</span>
              <div class="gsl-check-list">
                <label v-for="o in TOOL_OPTIONS" :key="o.id" class="gsl-check-row">
                  <input v-model="toolChecks[o.id]" type="checkbox" />
                  <span>{{ o.id }}</span>
                </label>
              </div>
            </div>
          </div>
          <div class="gsl-modal-footer">
            <button class="gsl-btn" type="button" :disabled="submittingSkill" @click="closeCreateModal">取消</button>
            <button
              class="gsl-btn"
              type="button"
              :disabled="submittingSkill"
              @click="submitCreateSkill('draft')"
            >
              {{ submittingSkill ? '提交中…' : '💾 保存草稿' }}
            </button>
            <button
              class="gsl-btn gsl-btn--primary"
              type="button"
              :disabled="submittingSkill"
              @click="submitCreateSkill('test')"
            >
              {{ submittingSkill ? '提交中…' : '▶ 测试运行' }}
            </button>
          </div>
        </template>
      </div>
    </div>

    <!-- 与原型 modal-skillTestRun -->
    <div
      v-if="testRunOpen"
      class="gsl-modal-backdrop gsl-modal-backdrop--front"
      data-testid="gsl-skill-test-run-backdrop"
      @click.self="closeTestRunModal"
    >
      <div class="gsl-modal gsl-modal--wide" role="dialog" aria-modal="true" aria-labelledby="gsl-test-run-title">
        <div class="gsl-test-run-head">
          <div class="gsl-test-run-head__text">
            <h2 id="gsl-test-run-title" class="gsl-modal-title gsl-test-run-title">{{ testRunTitle }}</h2>
            <p class="gsl-test-run-sub">{{ testRunSub }}</p>
          </div>
          <div class="gsl-test-run-head__badges">
            <span class="gsl-badge gsl-badge--green" title="不计入生产配额">沙箱</span>
            <span class="gsl-badge gsl-badge--gray">{{ testRunKindLabel }}</span>
            <button class="gsl-inline-close" type="button" aria-label="关闭" @click="closeTestRunModal">
              ×
            </button>
          </div>
        </div>

        <div class="gsl-test-run-grid">
          <div>
            <label class="gsl-field-label" for="gsl-test-run-input">{{ testRunInputLabel }}</label>
            <textarea
              id="gsl-test-run-input"
              v-model="testRunInput"
              class="gsl-test-run-textarea"
              rows="11"
            />
            <div class="gsl-test-run-actions">
              <button
                class="gsl-btn gsl-btn--primary"
                type="button"
                :disabled="testRunExecuting"
                @click="executeSkillTestRunMock"
              >
                {{ testRunExecuting ? '运行中…' : '运行测试' }}
              </button>
              <button class="gsl-btn" type="button" :disabled="testRunExecuting" @click="resetTestRunInput">
                恢复示例入参
              </button>
            </div>
            <p class="gsl-test-run-footnote">
              以上为原型示意：可改 JSON 再运行，结果仍为预置沙箱数据，用于评审交互与字段是否齐全。
            </p>
          </div>
          <div>
            <div class="gsl-preview-section-label">执行指标</div>
            <div class="gsl-test-run-metrics">{{ testRunMetrics }}</div>
            <div class="gsl-preview-section-label gsl-test-run-trace-label">调用 Trace</div>
            <pre class="gsl-test-run-trace">{{ testRunTrace }}</pre>
          </div>
        </div>

        <div v-if="testRunShowRag" class="gsl-test-run-rag-block">
          <div class="gsl-preview-section-label">RAG 命中片段</div>
          <div class="gsl-test-run-rag">{{ testRunRag }}</div>
        </div>

        <div class="gsl-preview-section-label">输出 / 响应正文</div>
        <div class="gsl-test-run-output">{{ testRunOutput }}</div>

        <div class="gsl-modal-footer gsl-test-run-footer">
          <button class="gsl-btn" type="button" @click="closeTestRunModal">关闭</button>
        </div>
      </div>
    </div>

    <!-- 与原型 modal-agentSkillMdPreview + 中台 JSON 预览 -->
    <div
      v-if="previewOpen"
      class="gsl-modal-backdrop gsl-modal-backdrop--front"
      data-testid="gsl-skill-preview-backdrop"
      @click.self="closePreviewModal"
    >
      <div class="gsl-modal gsl-modal--wide gsl-modal--flexcol" role="dialog" aria-modal="true">
        <div class="gsl-preview-head">
          <h2 class="gsl-modal-title" style="margin: 0">{{ previewTitle }}</h2>
          <button class="gsl-inline-close" type="button" aria-label="关闭" @click="closePreviewModal">×</button>
        </div>
        <pre class="gsl-preview-body">{{ previewBody }}</pre>
        <div class="gsl-modal-footer">
          <button class="gsl-btn" type="button" @click="copyPreviewBody">{{ previewCopyLabel }}</button>
          <button
            v-if="previewPlatformRow || previewAgentRow"
            class="gsl-btn"
            type="button"
            @click="editFromPreview"
          >
            ??
          </button>
          <button class="gsl-btn gsl-btn--primary" type="button" @click="closePreviewModal">??</button>
        </div>
      </div>
    </div>

    <!-- Agent 技能包编辑（与原型向导第一步预填对齐的简化表单） -->
    <div
      v-if="agentEditOpen"
      class="gsl-modal-backdrop gsl-modal-backdrop--front"
      data-testid="gsl-agent-edit-backdrop"
      @click.self="closeAgentEditModal"
    >
      <div class="gsl-modal" role="dialog" aria-modal="true" aria-labelledby="gsl-agent-edit-title">
        <button class="gsl-modal-close" type="button" aria-label="关闭" @click="closeAgentEditModal">×</button>
        <h2 id="gsl-agent-edit-title" class="gsl-modal-title">
          编辑 Agent 技能包 · {{ agentEditForm.name || agentEditRowName }}
        </h2>
        <p class="gsl-modal-desc">修改名称、说明与 SKILL.md 正文；保存为原型示意，持久化待联调。</p>
        <div class="gsl-modal-grid2">
          <label class="gsl-field">
            <span class="gsl-field-label">技能包名称</span>
            <input v-model="agentEditForm.name" class="gsl-field-input" type="text" />
          </label>
          <label class="gsl-field">
            <span class="gsl-field-label">分类</span>
            <select v-model="agentEditForm.categoryLabel" class="gsl-field-input">
              <option value="工程">工程</option>
              <option value="文档">文档</option>
              <option value="测试">测试</option>
              <option value="安全">安全</option>
            </select>
          </label>
        </div>
        <label class="gsl-field gsl-field--full">
          <span class="gsl-field-label">说明（frontmatter description）</span>
          <input v-model="agentEditForm.description" class="gsl-field-input" type="text" />
        </label>
        <label class="gsl-field gsl-field--full">
          <span class="gsl-field-label">标识 slug</span>
          <input v-model="agentEditForm.slug" class="gsl-field-input" type="text" readonly />
        </label>
        <label class="gsl-field gsl-field--full">
          <span class="gsl-field-label">SKILL.md 正文</span>
          <textarea v-model="agentEditForm.body" class="gsl-field-textarea" rows="14" spellcheck="false" />
        </label>
        <div class="gsl-modal-footer">
          <button class="gsl-btn" type="button" @click="closeAgentEditModal">取消</button>
          <button class="gsl-btn gsl-btn--primary" type="button" @click="saveAgentEditModal">保存</button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.gsl-workspace {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
}

.gsl-banner {
  margin: 0 0 12px;
  padding: 10px 14px;
  border-radius: 10px;
  background: rgba(239, 68, 68, 0.08);
  color: #b91c1c;
  font-size: 13px;
}

.gsl-banner--success {
  background: rgba(34, 197, 94, 0.12);
  color: #15803d;
}

.gsl-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.gsl-hint-banner {
  margin: 0 0 14px;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid var(--card-border);
  background: linear-gradient(90deg, #eef4ff, transparent);
  font-size: 12px;
  line-height: 1.55;
  color: var(--text-subtle);
}

.gsl-hint-banner__lead {
  color: var(--text-main, #111827);
}

.gsl-hint-banner__sub {
  display: block;
  margin-top: 6px;
}

.gsl-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--card-border);
}

.gsl-tab {
  margin: 0;
  padding: 10px 18px;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  background: transparent;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-subtle);
  cursor: pointer;
}

.gsl-tab:hover {
  color: var(--text-main, #111827);
}

.gsl-tab--active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}

.gsl-hub-panel {
  min-width: 0;
}

.gsl-agent-hub {
  margin-top: 0;
}

.gsl-agent-grid {
  display: grid;
  grid-template-columns: minmax(200px, 240px) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.card-panel-like {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid var(--card-border);
  border-radius: 24px;
  box-shadow: var(--shadow-soft);
  min-width: 0;
}

.gsl-agent-rail__head {
  padding: 18px 20px 8px;
  border-bottom: 1px solid rgba(17, 24, 39, 0.06);
}

.gsl-agent-rail__title {
  font-size: 16px;
  font-weight: 700;
}

.gsl-agent-rail__body {
  padding: 12px 20px 20px;
}

.gsl-agent-rail__hint {
  margin: 0 0 12px;
  font-size: 11px;
  line-height: 1.55;
  color: var(--text-subtle);
}

.gsl-agent-rail__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 10px;
}

.gsl-group-item {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgba(17, 24, 39, 0.1);
  border-radius: 10px;
  background: #fff;
  text-align: left;
  font: inherit;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.gsl-group-item:hover {
  border-color: rgba(79, 110, 247, 0.35);
}

.gsl-group-item--active {
  border-color: var(--primary);
  box-shadow: 0 0 0 1px rgba(79, 110, 247, 0.2);
}

.gsl-group-item__slug {
  font-size: 11px;
  color: var(--text-subtle);
  font-family: ui-monospace, Menlo, Monaco, monospace;
}

.gsl-group-item__label {
  font-weight: 600;
  margin-top: 2px;
  font-size: 14px;
}

.gsl-group-item__meta {
  font-size: 11px;
  color: var(--text-subtle);
  margin-top: 4px;
}

.gsl-btn--block {
  display: block;
  width: 100%;
  border-radius: 10px;
  white-space: normal;
  text-align: center;
}

.gsl-agent-main {
  min-width: 0;
}

.gsl-agent-empty {
  padding: 20px;
  border: 1px dashed var(--card-border);
  border-radius: 10px;
  background: var(--bg, #f8fafc);
  text-align: center;
  font-size: 13px;
  color: var(--text-subtle);
  line-height: 1.6;
}

.gsl-agent-empty__icon {
  font-size: 28px;
  margin-bottom: 8px;
}

.gsl-agent-empty__title {
  color: var(--text-main, #111827);
  font-weight: 600;
  margin-bottom: 6px;
}

.gsl-agent-empty__text {
  margin: 0;
}

.gsl-td-desc {
  max-width: 180px;
  font-size: 12px;
  color: var(--text-subtle);
  vertical-align: middle;
}

.gsl-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
  min-width: 0;
}

.gsl-toolbar-spacer {
  flex: 1 1 auto;
  min-width: 12px;
  height: 1px;
}

.gsl-search {
  max-width: 260px;
  min-width: 140px;
  flex: 0 1 260px;
  font: inherit;
  border: 1px solid rgba(17, 24, 39, 0.12);
  border-radius: 10px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.95);
}

.gsl-select {
  width: auto;
  min-width: 120px;
  font: inherit;
  border: 1px solid rgba(17, 24, 39, 0.12);
  border-radius: 10px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.95);
}

.gsl-btn {
  border: 1px solid rgba(17, 24, 39, 0.12);
  border-radius: 999px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.9);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
}

.gsl-btn--primary {
  background: linear-gradient(135deg, #4f6ef7 0%, #5d7bff 100%);
  color: #fff;
  border-color: transparent;
}

.gsl-panel {
  min-width: 0;
}

.gsl-table-wrap {
  overflow: auto;
}

.gsl-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.gsl-table th,
.gsl-table td {
  text-align: left;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(17, 24, 39, 0.08);
  vertical-align: middle;
}

.gsl-table th {
  color: var(--text-subtle);
  font-weight: 600;
  white-space: nowrap;
}

.gsl-skill-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.gsl-skill-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}

.gsl-skill-name {
  font-weight: 500;
}

.gsl-skill-sub {
  font-size: 11px;
  color: var(--text-subtle);
  margin-top: 2px;
}

.gsl-code {
  font-size: 11px;
  background: var(--bg, #f8fafc);
  padding: 2px 6px;
  border-radius: 4px;
}

.gsl-pill {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
}

.gsl-pill--primary {
  background: rgba(79, 110, 247, 0.15);
  color: var(--primary);
}

.gsl-pill--success {
  background: rgba(34, 197, 94, 0.15);
  color: #15803d;
}

.gsl-pill--warning {
  background: rgba(245, 158, 11, 0.18);
  color: #b45309;
}

.gsl-pill--danger {
  background: rgba(239, 68, 68, 0.15);
  color: #b91c1c;
}

.gsl-pill--muted {
  background: rgba(15, 23, 42, 0.06);
  color: var(--text-subtle);
}

.gsl-pill--purple {
  background: rgba(121, 74, 232, 0.14);
  color: #6d28d9;
}

.gsl-sat--ok {
  color: var(--success);
}

.gsl-sat--warn {
  color: var(--warning);
}

.gsl-muted {
  color: var(--text-subtle);
}

.gsl-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.gsl-mini-btn {
  border: 1px solid rgba(17, 24, 39, 0.12);
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 11px;
  background: #fff;
  cursor: pointer;
}

.gsl-mini-btn--primary {
  background: var(--primary);
  color: #fff;
  border-color: transparent;
}

@media (max-width: 1100px) {
  .gsl-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .gsl-agent-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .gsl-metrics {
    grid-template-columns: 1fr;
  }

  .gsl-toolbar-spacer {
    display: none;
  }

  .gsl-toolbar .gsl-btn {
    flex: 1 1 auto;
  }
}

/* 创建技能弹窗 — 对齐原型 modal-createSkill */
.gsl-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.48);
}

.gsl-modal {
  position: relative;
  width: 100%;
  max-width: 600px;
  max-height: min(92vh, 880px);
  overflow: auto;
  border-radius: 14px;
  border: 1px solid var(--card-border);
  background: #fff;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.2);
  padding: 20px 22px 16px;
}

.gsl-modal--skill-wizard {
  max-width: min(640px, 96vw);
}

.gsl-skill-wizard-head {
  margin-bottom: 18px;
  padding-right: 28px;
}

.gsl-skill-wizard-title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.gsl-skill-wizard-sub {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: var(--text-subtle);
}

.gsl-skill-wizard-track {
  display: flex;
  gap: 0;
  margin-bottom: 18px;
  border-radius: 10px;
  background: var(--bg, #f8fafc);
  padding: 4px;
  border: 1px solid rgba(17, 24, 39, 0.06);
}

.gsl-skill-wizard-step {
  flex: 1;
  text-align: center;
  padding: 10px 6px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-subtle);
  transition:
    background 0.2s ease,
    color 0.2s ease;
}

.gsl-skill-wizard-step-num {
  display: inline-flex;
  width: 22px;
  height: 22px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(17, 24, 39, 0.08);
  color: var(--text-subtle);
  font-size: 11px;
  margin-right: 6px;
  vertical-align: middle;
}

.gsl-skill-wizard-step--active {
  background: #fff;
  color: var(--text-main, #111827);
  box-shadow: 0 1px 3px rgba(16, 24, 40, 0.08);
}

.gsl-skill-wizard-step--active .gsl-skill-wizard-step-num {
  background: var(--primary);
  color: #fff;
}

.gsl-skill-wizard-step--done {
  color: var(--success, #15803d);
}

.gsl-skill-wizard-step--done .gsl-skill-wizard-step-num {
  background: #ecfdf3;
  color: #027a48;
}

.gsl-skill-wizard-panel {
  animation: gsl-skill-fade 0.2s ease;
}

@keyframes gsl-skill-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.gsl-skill-section {
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 16px 18px;
  margin-bottom: 14px;
}

.gsl-skill-section-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
  color: var(--text-main, #111827);
}

.gsl-skill-section-hint {
  font-size: 12px;
  color: var(--text-subtle);
  margin: 0 0 14px;
  line-height: 1.45;
}

.gsl-skill-type-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.gsl-skill-type-card {
  display: block;
  width: 100%;
  text-align: left;
  padding: 14px;
  border-radius: 10px;
  border: 2px solid rgba(17, 24, 39, 0.1);
  background: #fff;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    box-shadow 0.15s ease;
  font: inherit;
}

.gsl-skill-type-card:hover {
  border-color: rgba(79, 110, 247, 0.45);
  background: rgba(79, 110, 247, 0.06);
}

.gsl-skill-type-card--active {
  border-color: var(--primary);
  background: rgba(79, 110, 247, 0.08);
  box-shadow: 0 0 0 1px rgba(79, 110, 247, 0.25);
}

.gsl-stc-icon {
  font-size: 22px;
  display: block;
  margin-bottom: 8px;
}

.gsl-stc-title {
  font-weight: 600;
  font-size: 14px;
  display: block;
  margin-bottom: 4px;
  color: var(--text-main, #111827);
}

.gsl-stc-desc {
  font-size: 12px;
  color: var(--text-subtle);
  line-height: 1.4;
  display: block;
}

.gsl-skill-exec-panel {
  margin-top: 4px;
}

.gsl-skill-tool-hint {
  font-size: 11px;
  color: var(--text-subtle);
  margin: 10px 0 0;
  line-height: 1.45;
}

.gsl-skill-kb-hint {
  font-size: 11px;
  color: var(--text-subtle);
  margin: 10px 0 0;
  line-height: 1.45;
}

/* 流程编排构建器（对齐原型 skillWorkflowBuilder） */
.gsl-wf-root {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.gsl-wf-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.gsl-wf-card {
  border: 1px solid var(--card-border);
  border-radius: 10px;
  background: #fff;
  overflow: hidden;
}

.gsl-wf-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  padding: 8px 12px;
  background: var(--bg, #f8fafc);
  border-bottom: 1px solid rgba(17, 24, 39, 0.08);
}

.gsl-wf-step-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-main, #111827);
}

.gsl-wf-card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.gsl-wf-act {
  font: inherit;
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid rgba(17, 24, 39, 0.14);
  background: #fff;
  color: var(--text-main, #111827);
  cursor: pointer;
}

.gsl-wf-act:hover:not(:disabled) {
  border-color: rgba(79, 110, 247, 0.45);
  color: var(--primary);
}

.gsl-wf-act:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.gsl-wf-act--danger {
  border-color: rgba(220, 38, 38, 0.25);
  color: #b91c1c;
}

.gsl-wf-act--danger:hover:not(:disabled) {
  background: rgba(254, 226, 226, 0.5);
}

.gsl-wf-card-body {
  padding: 12px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 12px;
  align-items: start;
}

.gsl-wf-field {
  min-width: 0;
}

.gsl-wf-field--full {
  grid-column: 1 / -1;
}

.gsl-wf-grid2 {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 12px;
}

@media (max-width: 560px) {
  .gsl-wf-card-body,
  .gsl-wf-grid2 {
    grid-template-columns: 1fr;
  }
}

.gsl-wf-add {
  align-self: flex-start;
  font: inherit;
  font-size: 13px;
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px dashed rgba(79, 110, 247, 0.4);
  background: rgba(79, 110, 247, 0.06);
  color: var(--primary);
  cursor: pointer;
}

.gsl-wf-add:hover {
  background: rgba(79, 110, 247, 0.1);
}

.gsl-wf-json-details {
  border: 1px solid rgba(17, 24, 39, 0.1);
  border-radius: 8px;
  padding: 0 10px 10px;
  background: rgba(15, 23, 42, 0.02);
}

.gsl-wf-json-summary {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-subtle);
  cursor: pointer;
  padding: 10px 4px 8px;
  list-style: none;
}

.gsl-wf-json-summary::-webkit-details-marker {
  display: none;
}

.gsl-wf-json-details[open] .gsl-wf-json-summary {
  color: var(--text-main, #111827);
}

.gsl-wf-json-textarea {
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 11px;
}

.gsl-workflow-banner {
  margin-bottom: 12px;
  font-size: 12px;
  line-height: 1.55;
  color: var(--warning, #b45309);
  background: #fffaeb;
  border-radius: 8px;
  padding: 10px 12px;
}

.gsl-workflow-banner code {
  font-size: 11px;
  padding: 1px 4px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.06);
}

.gsl-lifecycle-banner {
  font-size: 12px;
  line-height: 1.55;
  color: var(--text-main, #111827);
  background: var(--bg, #f8fafc);
  border: 1px solid var(--card-border);
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 14px;
}

.gsl-btn--text {
  margin: 0 0 12px;
  border-radius: 8px;
  border: 1px dashed rgba(79, 110, 247, 0.35);
  background: rgba(79, 110, 247, 0.06);
  color: var(--primary);
  font-size: 12px;
  padding: 6px 12px;
}

.gsl-role-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.gsl-role-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid rgba(17, 24, 39, 0.1);
  font-size: 13px;
  cursor: pointer;
  background: #fff;
}

.gsl-role-pill input {
  width: auto;
  margin: 0;
}

.gsl-policy-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  cursor: pointer;
  font-size: 13px;
  line-height: 1.5;
}

.gsl-policy-row input {
  width: auto;
  margin-top: 3px;
  flex-shrink: 0;
}

.gsl-policy-sub {
  color: var(--text-subtle);
  font-size: 12px;
}

.gsl-skill-wizard-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--card-border);
  flex-wrap: wrap;
}

.gsl-wizard-spacer {
  flex: 1;
  min-width: 8px;
}

.gsl-modal-close {
  position: absolute;
  top: 10px;
  right: 12px;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  font-size: 22px;
  line-height: 1;
  color: var(--text-subtle);
  cursor: pointer;
}

.gsl-modal-close:hover {
  background: rgba(15, 23, 42, 0.06);
  color: var(--text-main);
}

.gsl-modal-title {
  margin: 0 36px 14px 0;
  font-size: 17px;
  font-weight: 700;
}

.gsl-modal-error {
  margin-bottom: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(239, 68, 68, 0.1);
  color: #b91c1c;
  font-size: 13px;
}

.gsl-modal-section {
  margin: 16px 0 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-subtle);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.gsl-modal-section:first-of-type {
  margin-top: 0;
}

.gsl-modal-grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.gsl-modal-grid2--assoc {
  align-items: start;
}

.gsl-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.gsl-field--full {
  grid-column: 1 / -1;
  margin-top: 4px;
}

.gsl-field-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-main);
}

.gsl-field-input,
.gsl-field-textarea {
  font: inherit;
  border: 1px solid rgba(17, 24, 39, 0.12);
  border-radius: 8px;
  padding: 8px 10px;
  background: #fff;
  min-width: 0;
}

.gsl-field-textarea {
  resize: vertical;
  line-height: 1.5;
}

.gsl-field-hint {
  font-size: 12px;
  color: var(--text-subtle);
}

.gsl-field-hint--danger {
  color: #b91c1c;
}

.gsl-field--assoc .gsl-field-label {
  margin-bottom: 2px;
}

.gsl-check-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 4px;
}

.gsl-check-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  cursor: pointer;
}

.gsl-check-row input {
  width: auto;
  margin: 0;
}

.gsl-modal-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
  padding-top: 4px;
}

@media (max-width: 560px) {
  .gsl-modal-grid2 {
    grid-template-columns: 1fr;
  }

  .gsl-test-run-grid {
    grid-template-columns: 1fr;
  }

  .gsl-skill-type-grid {
    grid-template-columns: 1fr;
  }
}

.gsl-modal-backdrop--front {
  z-index: 90;
}

.gsl-modal--wide {
  max-width: min(920px, 96vw);
}

.gsl-modal--flexcol {
  display: flex;
  flex-direction: column;
  max-height: min(92vh, 880px);
}

.gsl-modal-desc {
  margin: 0 0 14px;
  font-size: 12px;
  line-height: 1.55;
  color: var(--text-subtle);
}

.gsl-inline-close {
  border: 1px solid rgba(17, 24, 39, 0.12);
  border-radius: 8px;
  padding: 4px 10px;
  font-size: 14px;
  line-height: 1;
  background: rgba(255, 255, 255, 0.95);
  cursor: pointer;
  color: var(--text-subtle);
}

.gsl-inline-close:hover {
  background: rgba(15, 23, 42, 0.06);
  color: var(--text-main);
}

.gsl-test-run-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.gsl-test-run-head__text {
  min-width: 200px;
}

.gsl-test-run-title {
  margin: 0 0 6px !important;
}

.gsl-test-run-sub {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-subtle);
}

.gsl-test-run-head__badges {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.gsl-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
}

.gsl-badge--green {
  background: rgba(34, 197, 94, 0.18);
  color: #15803d;
}

.gsl-badge--gray {
  background: rgba(15, 23, 42, 0.08);
  color: var(--text-subtle);
}

.gsl-test-run-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  align-items: start;
}

.gsl-test-run-textarea {
  width: 100%;
  box-sizing: border-box;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.45;
  padding: 10px;
  border: 1px solid rgba(17, 24, 39, 0.12);
  border-radius: 8px;
  resize: vertical;
  min-height: 0;
}

.gsl-test-run-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
}

.gsl-test-run-footnote {
  font-size: 11px;
  color: var(--text-subtle);
  margin: 10px 0 0;
  line-height: 1.45;
}

.gsl-preview-section-label {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 6px;
}

.gsl-test-run-trace-label {
  margin-top: 14px;
}

.gsl-test-run-metrics {
  font-size: 12px;
  line-height: 1.55;
  color: var(--text-main, #111827);
  background: var(--bg, #f8fafc);
  border: 1px solid var(--card-border);
  border-radius: 8px;
  padding: 10px 12px;
  min-height: 52px;
}

.gsl-test-run-trace {
  margin: 0;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 11px;
  line-height: 1.5;
  background: #0f172a;
  color: #e2e8f0;
  border-radius: 8px;
  padding: 12px;
  max-height: 200px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  min-height: 72px;
}

.gsl-test-run-rag-block {
  margin-top: 16px;
}

.gsl-test-run-rag {
  font-size: 12px;
  line-height: 1.55;
  border: 1px solid var(--card-border);
  border-radius: 8px;
  padding: 12px;
  background: #fffaeb;
  max-height: 160px;
  overflow: auto;
}

.gsl-test-run-output {
  font-size: 12px;
  line-height: 1.6;
  border: 1px solid var(--card-border);
  border-radius: 8px;
  padding: 12px;
  min-height: 120px;
  background: #fff;
  white-space: pre-wrap;
  word-break: break-word;
}

.gsl-test-run-footer {
  margin-top: 18px;
}

.gsl-preview-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.gsl-preview-body {
  flex: 1;
  min-height: 220px;
  max-height: calc(70vh - 24px);
  overflow: auto;
  margin: 0;
  padding: 12px;
  background: var(--bg, #f8fafc);
  border: 1px solid var(--card-border);
  border-radius: 8px;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
