import { reactive } from 'vue'

import router from '../router'
import { enableProjectKnowledgeBase } from '../services/knowledge'
import { addProjectMember, getProject, updateProject } from '../services/projects'
import { enableProjectSkill } from '../services/skills'
import type { BackendProjectResponse, BackendProjectType, UpdateBackendProjectPayload } from '../types/project'
import {
  createProject,
  loadProjectQuotaTokenDashboardFromApi,
  loadProjects,
  projectTypeLabelMap,
  refreshProjectCoreFromApi,
} from './useProjects'

export type OverlayKind = 'none' | 'notifications' | 'new-project' | 'edit-project' | 'action'

export interface OverlayShortcut {
  label: string
  to?: string
}

interface NewProjectDraft {
  name: string
  code: string
  description: string
  icon: string
  type: BackendProjectType
  team: string
  ownerUserId: number | null
  memberSearch: string
  memberPickIds: number[]
  kbSearch: string
  skillSearch: string
  kbPickIds: number[]
  skillPickIds: number[]
  tokenPoolInput: string
}

interface EditProjectDraft {
  projectId: number
  name: string
  description: string
  icon: string
  ownerUserId: number | null
  tokenPoolInput: string
  alertThresholdPctInput: string
  overQuotaStrategy: string
  code: string
  projectTypeLabel: string
}

interface OverlayState {
  open: boolean
  kind: OverlayKind
  title: string
  description: string
  items: string[]
  shortcuts: OverlayShortcut[]
  draft: NewProjectDraft
  editDraft: EditProjectDraft
  editLoading: boolean
  submitError: string
  submitting: boolean
}

function parseMonthlyTokenQuota(raw: string): number | undefined {
  const s = raw.trim().toUpperCase().replace(/,/g, '')
  if (!s) return undefined
  const m = s.match(/^([\d.]+)\s*([KMG])?\s*$/)
  if (!m) {
    const n = Number(s)
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined
  }
  const numPart = m[1]
  if (numPart === undefined) return undefined
  let v = parseFloat(numPart)
  if (!Number.isFinite(v) || v < 0) return undefined
  const u = m[2]
  if (u === 'K') v *= 1000
  else if (u === 'M') v *= 1_000_000
  else if (u === 'G') v *= 1_000_000_000
  return Math.floor(v)
}

const defaultDraft = (): NewProjectDraft => ({
  name: '',
  code: '',
  description: '',
  icon: '📁',
  type: 'PRODUCT',
  team: '业务研发部',
  ownerUserId: null,
  memberSearch: '',
  memberPickIds: [],
  kbSearch: '',
  skillSearch: '',
  kbPickIds: [],
  skillPickIds: [],
  tokenPoolInput: '500K',
})

const defaultEditDraft = (): EditProjectDraft => ({
  projectId: 0,
  name: '',
  description: '',
  icon: '📁',
  ownerUserId: null,
  tokenPoolInput: '',
  alertThresholdPctInput: '',
  overQuotaStrategy: '',
  code: '',
  projectTypeLabel: '',
})

const state = reactive<OverlayState>({
  open: false,
  kind: 'none',
  title: '',
  description: '',
  items: [],
  shortcuts: [],
  draft: defaultDraft(),
  editDraft: defaultEditDraft(),
  editLoading: false,
  submitError: '',
  submitting: false,
})

function resetDraft() {
  state.draft = defaultDraft()
  state.editDraft = defaultEditDraft()
  state.editLoading = false
  state.submitError = ''
  state.submitting = false
}

export function closeOverlay() {
  state.open = false
  state.kind = 'none'
  state.title = ''
  state.description = ''
  state.items = []
  state.shortcuts = []
  resetDraft()
}

export function resetOverlayState() {
  closeOverlay()
}

export function openNotifications() {
  state.open = true
  state.kind = 'notifications'
  state.title = '通知中心'
  state.description = '集中查看审批提醒、事故进展和 Agent 执行状态。'
  state.items = [
    '支付服务空指针异常已完成 AI 根因分析，等待人工确认修复方案。',
    'mall-backend PR#51 的代码 Review Agent 正在发布 3 条评论。',
    '支付网关生产部署仍待双人审批，已等待 23 分钟。',
  ]
  state.shortcuts = []
  state.submitError = ''
}

export function openNewProjectModal() {
  state.open = true
  state.kind = 'new-project'
  state.title = '新建项目'
  state.description = '创建后可在项目内继续补充成员、代码仓库与更多配置。'
  state.items = []
  state.shortcuts = []
  resetDraft()
}

function fillEditDraftFromProjectApi(proj: BackendProjectResponse) {
  const pt = proj.projectType?.toUpperCase() as BackendProjectType
  const typeOk = (['PRODUCT', 'PLATFORM', 'DATA', 'OTHER'] as const).includes(pt)
  const typeLabel = typeOk ? projectTypeLabelMap[pt] : proj.projectType
  const q = proj.monthlyTokenQuota
  const tokenStr =
    q == null ? '' : q === 0 ? '0' : q >= 1_000_000_000 && q % 1_000_000_000 === 0 ? `${q / 1_000_000_000}G` : String(q)

  state.editDraft = {
    projectId: proj.id,
    name: proj.name?.trim() ?? '',
    description: proj.description?.trim() ?? '',
    icon: proj.icon?.trim() || '📁',
    ownerUserId: proj.ownerUserId ?? null,
    tokenPoolInput: tokenStr,
    alertThresholdPctInput:
      proj.alertThresholdPct != null && Number.isFinite(proj.alertThresholdPct) ? String(proj.alertThresholdPct) : '',
    overQuotaStrategy: proj.overQuotaStrategy?.trim() ?? '',
    code: proj.code?.trim() ?? '',
    projectTypeLabel: typeLabel,
  }
}

export async function openEditProjectModal(projectId: string) {
  if (!/^\d+$/.test(projectId)) return

  state.open = true
  state.kind = 'edit-project'
  state.title = '编辑项目'
  state.description = '修改名称、描述、负责人与 Token 配额等；项目编码与类型变更请走平台流程。'
  state.items = []
  state.shortcuts = []
  state.submitError = ''
  state.submitting = false
  state.editDraft = defaultEditDraft()
  state.editLoading = true

  try {
    const proj = await getProject(Number(projectId))
    fillEditDraftFromProjectApi(proj)
  } catch (error) {
    state.submitError = error instanceof Error ? error.message : '加载项目信息失败'
  } finally {
    state.editLoading = false
  }
}

export function openActionDialog(options: {
  title: string
  description: string
  items?: string[]
  shortcuts?: OverlayShortcut[]
}) {
  state.open = true
  state.kind = 'action'
  state.title = options.title
  state.description = options.description
  state.items = options.items ?? []
  state.shortcuts = options.shortcuts ?? []
  state.submitError = ''
  state.submitting = false
}

export async function submitEditProjectDraft() {
  const pid = state.editDraft.projectId
  if (!pid) {
    state.submitError = '无效的项目。'
    return
  }

  const name = state.editDraft.name.trim()
  if (!name) {
    state.submitError = '请填写项目名称。'
    return
  }

  state.submitError = ''
  state.submitting = true

  try {
    const desc = state.editDraft.description.trim()
    const icon = state.editDraft.icon.trim()
    const quota = parseMonthlyTokenQuota(state.editDraft.tokenPoolInput)
    const alertRaw = state.editDraft.alertThresholdPctInput.trim()
    const alertN = alertRaw === '' ? undefined : Number.parseInt(alertRaw, 10)
    const strategy = state.editDraft.overQuotaStrategy.trim()

    const payload: UpdateBackendProjectPayload = {
      name,
      description: desc,
      icon: icon || null,
      ownerUserId: state.editDraft.ownerUserId,
    }

    if (quota !== undefined) {
      payload.monthlyTokenQuota = quota
    }
    if (alertRaw !== '') {
      if (!Number.isFinite(alertN) || alertN == null || alertN < 0 || alertN > 100) {
        state.submitError = '告警阈值请输入 0–100 之间的整数，或留空不修改。'
        return
      }
      payload.alertThresholdPct = alertN
    }
    if (strategy) {
      payload.overQuotaStrategy = strategy
    }

    await updateProject(pid, payload)
    const idStr = String(pid)
    await refreshProjectCoreFromApi(idStr)
    await loadProjectQuotaTokenDashboardFromApi(idStr)
    await loadProjects(true)
    closeOverlay()
  } catch (error) {
    state.submitError = error instanceof Error ? error.message : '保存失败，请稍后重试。'
  } finally {
    state.submitting = false
  }
}

export async function submitNewProjectDraft() {
  const name = state.draft.name.trim()
  const code = state.draft.code.trim().toUpperCase()

  if (!name || !code) {
    state.submitError = '请先填写项目名称和项目编码。'
    return
  }

  state.submitError = ''
  state.submitting = true

  try {
    const desc = state.draft.description.trim()
    const icon = state.draft.icon.trim()
    const quota = parseMonthlyTokenQuota(state.draft.tokenPoolInput)

    const createdProject = await createProject({
      name,
      code,
      projectType: state.draft.type,
      ...(desc ? { description: desc } : {}),
      ...(icon ? { icon } : {}),
      ...(state.draft.ownerUserId != null ? { ownerUserId: state.draft.ownerUserId } : {}),
      ...(quota != null ? { monthlyTokenQuota: quota } : {}),
    })

    const pid = createdProject.id
    const ownerId = state.draft.ownerUserId

    const memberIds = [...new Set(state.draft.memberPickIds)].filter((id) => id !== ownerId)
    const tasks: Promise<unknown>[] = [
      ...memberIds.map((userId) => addProjectMember(pid, { userId, role: 'MEMBER' })),
      ...state.draft.kbPickIds.map((kbId) => enableProjectKnowledgeBase(pid, kbId)),
      ...state.draft.skillPickIds.map((skillId) => enableProjectSkill(pid, skillId)),
    ]

    const settled = await Promise.allSettled(tasks)
    const failed = settled.filter((r) => r.status === 'rejected').length

    const overviewPath = `/projects/${createdProject.id}/overview`
    const items = [
      `项目编码：${code}`,
      `项目类型：${projectTypeLabelMap[state.draft.type]}`,
      '项目列表已和后端重新同步。',
      ...(failed ? [`部分成员或 AI 能力绑定未成功（${failed} 项），可在项目内继续配置。`] : []),
    ]

    openActionDialog({
      title: `项目已创建：${createdProject.name}`,
      description: '后端创建接口调用成功，项目空间列表已经刷新。',
      items,
      shortcuts: [
        { label: '进入项目概览', to: overviewPath },
        { label: '返回项目列表', to: '/projects' },
      ],
    })

    void router.replace('/projects')
  } catch (error) {
    state.submitError = error instanceof Error ? error.message : '项目创建失败，请稍后重试。'
  } finally {
    state.submitting = false
  }
}

export function triggerModuleAction(actionLabel: string, contextTitle?: string) {
  const title = contextTitle ? `${contextTitle} · ${actionLabel}` : actionLabel

  const descriptionMap: Record<string, string> = {
    新建工作流: '已打开工作流创建入口，可继续补充触发器、LLM 节点、工具调用和审批链。',
    导入模板: '可从模板库选择预设流程，快速初始化当前页面的标准能力。',
    导出周报: '已触发周报导出动作，后续可接入真实下载接口。',
    生成评估报告: '已触发评估报告生成入口，可继续接入异步任务与文件下载。',
    保存配置: '已记录当前配置保存动作，后续可接入后端持久化。',
    保存项目设置: '已记录项目设置保存动作，后续可接入后端持久化。',
    '分配新 Key': 'Key 分配功能已准备就绪，可选择成员并配置对应的模型权限与配额限制。',
    导出使用报告: '正在生成 Key 使用情况报告，包含成员活跃度、配额使用率和异常告警分析。',
    生成成员使用指南: '正在根据项目配置生成个性化的 Key 使用指南，包含权限说明和最佳实践。',
  }

  openActionDialog({
    title,
    description:
      descriptionMap[actionLabel] ?? '该按钮已接入交互逻辑，当前会打开对应操作入口或说明弹层。',
    items: ['按钮事件已绑定。', '当前为原型阶段，后续可继续接入真实接口或任务流。'],
  })
}

export function useOverlay() {
  return {
    overlayState: state,
    closeOverlay,
    openActionDialog,
    openNewProjectModal,
    openEditProjectModal,
    openNotifications,
    resetOverlayState,
    submitNewProjectDraft,
    submitEditProjectDraft,
    triggerModuleAction,
  }
}
