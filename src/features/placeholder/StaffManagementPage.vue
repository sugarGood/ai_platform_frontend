<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'

import { openActionDialog } from '../../composables/useOverlay'
import { listAdminAuditLogs } from '../../services/admin-audit'
import { listDepartments } from '../../services/departments'
import { listMemberQuotasByUser } from '../../services/member-quotas'
import {
  listPlatformCredentialsByUser,
  renewPlatformCredential,
  rotatePlatformCredential,
} from '../../services/platform-credentials'
import { listProjectMembers, listProjects } from '../../services/projects'
import {
  createUser,
  listUsers,
  reinviteUser,
  resetUserPasswordByAdmin,
  updateUser,
  updateUserStatus,
} from '../../services/users'
import type { ActivityLog } from '../../types/activity-log'
import type { DepartmentResponse } from '../../types/department'
import type { PlatformCredentialResponse } from '../../types/credentials'
import type { MemberAiQuotaResponse } from '../../types/platform-usage'
import type { UserResponse } from '../../types/user'
import { STAFF_JOB_TITLES, isKnownStaffJobTitle } from '../../constants/staff-job-titles'
import { parseMonthlyTokenQuotaForApi } from '../../lib/monthly-token-quota'

/** 与后端平台凭证 `overQuotaStrategy` 常见取值对齐 */
const OVER_QUOTA_STRATEGY_OPTIONS = [
  { value: 'BLOCK', label: 'BLOCK · 超配额拒绝' },
  { value: 'ALLOW_WITH_ALERT', label: 'ALLOW_WITH_ALERT · 告警仍放行' },
  { value: 'DOWNGRADE_MODEL', label: 'DOWNGRADE_MODEL · 降级模型' },
] as const

const users = ref<UserResponse[]>([])
const departments = ref<DepartmentResponse[]>([])
const loading = ref(false)
const error = ref('')

const searchKeyword = ref('')
const filterRole = ref('')
const filterStatus = ref('')
const filterDepartment = ref('')

const selectedIds = ref<Set<number>>(new Set())

const showCreateModal = ref(false)
const showDetailModal = ref(false)
const showEditModal = ref(false)
const showSuspendConfirm = ref(false)
const detailUser = ref<UserResponse | null>(null)
const editUser = ref<UserResponse | null>(null)

const staffFlash = ref<{ message: string; kind: 'success' | 'error' } | null>(null)
const reinviteBusyId = ref<number | null>(null)

const editCredential = ref<PlatformCredentialResponse | null>(null)
const editCredLoading = ref(false)
const credBusy = ref(false)

const showAuditModal = ref(false)
const auditModalTitle = ref('')
const auditLogs = ref<ActivityLog[]>([])
const auditLoading = ref(false)
const auditError = ref('')

const showRotateKeyModal = ref(false)
const rotatedPlainKey = ref('')

const showResetPasswordConfirm = ref(false)
const resetPasswordTargetUser = ref<UserResponse | null>(null)
const resetPasswordBusy = ref(false)
/** 管理员设置的新登录密码（必填，≥8，与后端 `AdminResetPasswordRequest` 一致） */
const resetPasswordNewPassword = ref('')
const resetPasswordFormError = ref('')

/** 员工详情弹层：参与项目 + 凭证信息 */
interface DetailProjectRow {
  projectId: number
  icon: string
  name: string
  role: string
  joinedAtLabel: string
  usageLabel: string
}

const detailProjectRows = ref<DetailProjectRow[]>([])
const detailProjectsLoading = ref(false)
const detailProjectsError = ref('')
const detailCredInfo = ref<PlatformCredentialResponse | null>(null)
const detailCredInfoLoading = ref(false)

const generatedPassword = ref('')

function randomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#%'
  let s = ''
  for (let i = 0; i < 14; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

const createForm = reactive({
  email: '',
  username: '',
  fullName: '',
  phone: '',
  avatarUrl: '',
  jobTitle: '',
  departmentIdStr: '',
  platformRole: 'MEMBER',
  credentialName: '',
  tokenQuota: '100',
  tokenUnit: 'K Token/月',
  alertThresholdPct: '80',
  overQuotaStrategy: 'BLOCK',
  submitting: false,
  error: '',
  plainKey: '',
})

const editForm = reactive({
  email: '',
  username: '',
  departmentIdStr: '',
  fullName: '',
  phone: '',
  avatarUrl: '',
  jobTitle: '',
  credentialName: '',
  tokenQuota: '200',
  tokenUnit: 'K Token/月',
  alertThresholdPctStr: '80',
  overQuotaStrategy: 'BLOCK',
  submitting: false,
  error: '',
})

const rowMenuOpenFor = ref<number | null>(null)
const suspendTargetUser = ref<UserResponse | null>(null)

const showRenewCredentialModal = ref(false)
const renewTargetUser = ref<UserResponse | null>(null)
const renewModalDays = ref<30 | 90 | 180>(90)

const departmentNameById = computed(() => {
  const m = new Map<number, string>()
  for (const d of departments.value) m.set(d.id, d.name)
  return m
})

/** 编辑时若后端已有不在预设内的职位，下拉中保留该项 */
const editJobTitleOptions = computed(() => {
  const cur = editForm.jobTitle?.trim() ?? ''
  if (cur && !isKnownStaffJobTitle(cur)) {
    return [cur, ...STAFF_JOB_TITLES]
  }
  return [...STAFF_JOB_TITLES]
})

function deptLabel(user: UserResponse) {
  if (user.departmentId == null) return '—'
  return departmentNameById.value.get(user.departmentId) ?? `部门 #${user.departmentId}`
}

async function fetchUsers() {
  loading.value = true
  error.value = ''
  try {
    const base = {
      keyword: searchKeyword.value || undefined,
      platformRole: filterRole.value || undefined,
      departmentId: filterDepartment.value ? Number(filterDepartment.value) : undefined,
    }
    if (filterStatus.value === 'UNACTIVATED') {
      const all = await listUsers(base)
      users.value = all.filter(
        (u) => !u.status || (u.status !== 'ACTIVE' && u.status !== 'DISABLED'),
      )
    } else {
      users.value = await listUsers({
        ...base,
        status: filterStatus.value || undefined,
      })
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

async function loadDepartments() {
  try {
    departments.value = await listDepartments()
  } catch {
    departments.value = []
  }
}

function closeRowMenu() {
  rowMenuOpenFor.value = null
}

function toggleRowMenu(userId: number, ev: Event) {
  ev.stopPropagation()
  rowMenuOpenFor.value = rowMenuOpenFor.value === userId ? null : userId
}

function onGlobalClickCloseMenu(ev: Event) {
  const el = ev.target
  if (!(el instanceof Element)) return
  if (el.closest('.staff-row-menu')) return
  closeRowMenu()
}

onMounted(async () => {
  document.addEventListener('click', onGlobalClickCloseMenu)
  await loadDepartments()
  await fetchUsers()
})

onUnmounted(() => {
  document.removeEventListener('click', onGlobalClickCloseMenu)
})

watch(showCreateModal, (open) => {
  if (open) generatedPassword.value = randomPassword()
})

async function applyFilters() {
  await fetchUsers()
}

function openCreateModal() {
  Object.assign(createForm, {
    email: '',
    username: '',
    fullName: '',
    phone: '',
    avatarUrl: '',
    jobTitle: '',
    departmentIdStr: '',
    platformRole: 'MEMBER',
    credentialName: '',
    tokenQuota: '100',
    tokenUnit: 'K Token/月',
    alertThresholdPct: '80',
    overQuotaStrategy: 'BLOCK',
    submitting: false,
    error: '',
    plainKey: '',
  })
  generatedPassword.value = randomPassword()
  showCreateModal.value = true
}

function openBatchDialog() {
  openActionDialog({
    title: '批量操作',
    description: '对选中员工执行批量操作（对齐原型步骤，后续可接入异步任务与权限服务）。',
    items: [
      '批量调整平台角色',
      '批量续签凭证',
      '批量分配到项目',
      '批量导出信息',
      '批量停用账号',
    ],
  })
}

function flashStaff(message: string, kind: 'success' | 'error' = 'success') {
  staffFlash.value = { message, kind }
  window.setTimeout(() => {
    staffFlash.value = null
  }, 5000)
}

async function submitCreate() {
  createForm.error = ''
  const pwd = generatedPassword.value.trim()
  if (pwd.length < 8) {
    createForm.error = '登录密码至少 8 位，请重新生成或手动修改。'
    return
  }
  const alertRaw = createForm.alertThresholdPct.trim()
  const alertN = alertRaw === '' ? null : Number.parseInt(alertRaw, 10)
  if (
    alertRaw !== '' &&
    (!Number.isFinite(alertN) || alertN == null || alertN < 0 || alertN > 100)
  ) {
    createForm.error = '告警阈值请输入 0–100 之间的整数，或留空使用后端默认。'
    return
  }
  createForm.submitting = true
  try {
    const deptId = createForm.departmentIdStr ? Number(createForm.departmentIdStr) : undefined
    const phoneTrim = createForm.phone.trim()
    const avatarTrim = createForm.avatarUrl.trim()
    const credNameTrim = createForm.credentialName.trim()
    const monthly = parseMonthlyTokenQuotaForApi(createForm.tokenQuota, createForm.tokenUnit)
    const payload = {
      email: createForm.email.trim(),
      username: createForm.username.trim(),
      password: pwd,
      fullName: createForm.fullName.trim() || undefined,
      jobTitle: createForm.jobTitle.trim() || undefined,
      platformRole: createForm.platformRole,
      ...(phoneTrim ? { phone: phoneTrim } : {}),
      ...(avatarTrim ? { avatarUrl: avatarTrim } : {}),
      ...(credNameTrim ? { credentialName: credNameTrim } : {}),
      ...(deptId != null && !Number.isNaN(deptId) ? { departmentId: deptId } : {}),
      ...(monthly !== undefined ? { monthlyTokenQuota: monthly } : {}),
      ...(alertRaw !== '' && alertN != null ? { alertThresholdPct: alertN } : {}),
      ...(createForm.overQuotaStrategy.trim()
        ? { overQuotaStrategy: createForm.overQuotaStrategy.trim() }
        : {}),
    }
    const res = await createUser(payload)
    createForm.plainKey = res.credentialPlainKey
    await fetchUsers()
    flashStaff('员工已创建，凭证明文 Key 请立即保存。', 'success')
  } catch (e) {
    createForm.error = e instanceof Error ? e.message : '创建失败'
  } finally {
    createForm.submitting = false
  }
}

function formatJoinDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function projectRoleBadgeClass(role: string) {
  const r = role.toUpperCase()
  if (r.includes('ADMIN') || r === 'OWNER') return 'badge-blue'
  return 'badge-gray'
}

function platformCredStatusUi(c: PlatformCredentialResponse | null) {
  if (!c) return { cls: 'badge-gray' as const, text: '—' }
  const s = (c.status || '').toUpperCase()
  if (s === 'ACTIVE' || s === 'VALID' || s === 'ENABLED')
    return { cls: 'badge-green' as const, text: '有效' }
  if (s.includes('EXPIR') || s === 'REVOKED' || s === 'DISABLED')
    return { cls: 'badge-red' as const, text: c.status || '异常' }
  return { cls: 'badge-yellow' as const, text: c.status || '—' }
}

function monthlyQuotaLine(c: PlatformCredentialResponse | null): string {
  if (!c) return '—'
  const q = c.monthlyTokenQuota
  if (q == null) return '—'
  if (q <= 0) return '不限制'
  return `${formatTokenAmount(q)} Token/月`
}

const detailCredUsagePct = computed(() => {
  const c = detailCredInfo.value
  const cap = c?.monthlyTokenQuota
  if (c == null || cap == null || cap <= 0) return null
  const used = c.usedTokensThisMonth ?? 0
  return Math.min(100, Math.round((used / cap) * 1000) / 10)
})

const detailCredUsedDisplay = computed(() => {
  const c = detailCredInfo.value
  if (!c) return '—'
  const used = c.usedTokensThisMonth
  const u = used != null ? formatTokenAmount(used) : '—'
  const p = detailCredUsagePct.value
  if (p == null) return u
  return `${u} (${p}%)`
})

async function loadDetailPanelData(userId: number) {
  detailProjectsLoading.value = true
  detailProjectsError.value = ''
  detailProjectRows.value = []
  detailCredInfoLoading.value = true
  detailCredInfo.value = null

  const projectsTask = (async () => {
    try {
      const [page, quotas] = await Promise.all([listProjects(1, 200), listMemberQuotasByUser(userId)])
      const quotaByProject = new Map<number, MemberAiQuotaResponse>()
      for (const q of quotas) {
        quotaByProject.set(q.projectId, q)
      }
      const projects = page.data ?? []
      const settled = await Promise.allSettled(
        projects.map(async (proj) => {
          const members = await listProjectMembers(proj.id)
          const m = members.find((x) => x.userId === userId)
          if (!m) return null
          const q = quotaByProject.get(proj.id)
          const used = q?.usedAmount
          const usageLabel = used != null && used >= 0 ? formatTokenAmount(used) : '—'
          return {
            projectId: proj.id,
            icon: proj.icon?.trim() || '📁',
            name: proj.name,
            role: m.role,
            joinedAtLabel: formatJoinDate(m.joinedAt),
            usageLabel,
          } satisfies DetailProjectRow
        }),
      )
      const rows: DetailProjectRow[] = []
      for (const r of settled) {
        if (r.status === 'fulfilled' && r.value) rows.push(r.value)
      }
      rows.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
      detailProjectRows.value = rows
    } catch (e) {
      detailProjectsError.value = e instanceof Error ? e.message : '加载项目失败'
    } finally {
      detailProjectsLoading.value = false
    }
  })()

  const credTask = (async () => {
    try {
      const creds = await listPlatformCredentialsByUser(userId)
      detailCredInfo.value =
        creds.find((c) => c.credentialType === 'PERSONAL') ?? creds[0] ?? null
    } catch {
      detailCredInfo.value = null
    } finally {
      detailCredInfoLoading.value = false
    }
  })()

  await Promise.all([projectsTask, credTask])
}

function openDetail(user: UserResponse) {
  closeRowMenu()
  detailUser.value = user
  showDetailModal.value = true
  void loadDetailPanelData(user.id)
}

function syncEditTokenFieldsFromCredential(c: PlatformCredentialResponse | null) {
  if (!c || c.monthlyTokenQuota == null || c.monthlyTokenQuota <= 0) {
    editForm.tokenQuota = '200'
    editForm.tokenUnit = 'K Token/月'
    return
  }
  const q = c.monthlyTokenQuota
  if (q >= 1_000_000 && q % 1_000_000 === 0) {
    editForm.tokenQuota = String(q / 1_000_000)
    editForm.tokenUnit = 'M Token/月'
  } else if (q >= 1000) {
    editForm.tokenQuota = String(Math.round(q / 1000))
    editForm.tokenUnit = 'K Token/月'
  } else {
    editForm.tokenQuota = String(q)
    editForm.tokenUnit = 'K Token/月'
  }
}

function syncEditCredentialMetaFields(c: PlatformCredentialResponse | null) {
  if (!c) {
    editForm.credentialName = ''
    editForm.alertThresholdPctStr = '80'
    editForm.overQuotaStrategy = 'BLOCK'
    return
  }
  editForm.credentialName = c.name ?? ''
  editForm.alertThresholdPctStr =
    c.alertThresholdPct != null ? String(c.alertThresholdPct) : '80'
  editForm.overQuotaStrategy = c.overQuotaStrategy?.trim() || 'BLOCK'
}

async function loadEditCredential() {
  if (!editUser.value) return
  editCredLoading.value = true
  editCredential.value = null
  try {
    const list = await listPlatformCredentialsByUser(editUser.value.id)
    editCredential.value =
      list.find((c) => c.credentialType === 'PERSONAL') ?? list[0] ?? null
    syncEditTokenFieldsFromCredential(editCredential.value)
    syncEditCredentialMetaFields(editCredential.value)
  } catch {
    editCredential.value = null
    syncEditTokenFieldsFromCredential(null)
    syncEditCredentialMetaFields(null)
  } finally {
    editCredLoading.value = false
  }
}

async function openEdit(user: UserResponse) {
  closeRowMenu()
  editUser.value = user
  editForm.email = user.email ?? ''
  editForm.username = user.username ?? ''
  editForm.departmentIdStr = user.departmentId != null ? String(user.departmentId) : ''
  editForm.fullName = user.fullName ?? ''
  editForm.phone = user.phone ?? ''
  editForm.avatarUrl = user.avatarUrl ?? ''
  editForm.jobTitle = user.jobTitle ?? ''
  editForm.credentialName = ''
  editForm.tokenQuota = '200'
  editForm.tokenUnit = 'K Token/月'
  editForm.alertThresholdPctStr = '80'
  editForm.overQuotaStrategy = 'BLOCK'
  editForm.error = ''
  editForm.submitting = false
  showEditModal.value = true
  await loadEditCredential()
}

async function submitEdit() {
  if (!editUser.value) return
  editForm.error = ''
  const alertRaw = editForm.alertThresholdPctStr.trim()
  const alertN = alertRaw === '' ? null : Number.parseInt(alertRaw, 10)
  if (
    alertRaw !== '' &&
    (!Number.isFinite(alertN) || alertN == null || alertN < 0 || alertN > 100)
  ) {
    editForm.error = '告警阈值请输入 0–100 之间的整数，或留空表示不修改。'
    return
  }
  editForm.submitting = true
  try {
    const eDept = editForm.departmentIdStr ? Number(editForm.departmentIdStr) : null
    const monthly = parseMonthlyTokenQuotaForApi(editForm.tokenQuota, editForm.tokenUnit)
    const credPatch = editCredential.value
      ? {
          credentialName: editForm.credentialName.trim() || null,
          monthlyTokenQuota: monthly !== undefined ? monthly : null,
          ...(alertRaw !== '' && alertN != null ? { alertThresholdPct: alertN } : {}),
          overQuotaStrategy: editForm.overQuotaStrategy.trim() || null,
        }
      : {}
    await updateUser(editUser.value.id, {
      departmentId: Number.isNaN(eDept as number) ? null : eDept,
      fullName: editForm.fullName.trim() || null,
      phone: editForm.phone.trim() || null,
      avatarUrl: editForm.avatarUrl.trim() || null,
      jobTitle: editForm.jobTitle.trim() || null,
      email: editForm.email.trim() || null,
      username: editForm.username.trim() || null,
      ...credPatch,
    })
    showEditModal.value = false
    await fetchUsers()
    flashStaff('员工信息已保存。', 'success')
  } catch (e) {
    editForm.error = e instanceof Error ? e.message : '保存失败'
  } finally {
    editForm.submitting = false
  }
}

function openSuspendConfirmFor(user: UserResponse) {
  closeRowMenu()
  suspendTargetUser.value = user
  showSuspendConfirm.value = true
}

function cancelSuspendConfirm() {
  showSuspendConfirm.value = false
  suspendTargetUser.value = null
}

async function confirmSuspend() {
  const u = suspendTargetUser.value
  if (!u) return
  try {
    await updateUserStatus(u.id, 'DISABLED')
    showSuspendConfirm.value = false
    suspendTargetUser.value = null
    if (editUser.value?.id === u.id) showEditModal.value = false
    await fetchUsers()
    flashStaff('账号已停用。', 'success')
  } catch (e) {
    flashStaff(e instanceof Error ? e.message : '操作失败', 'error')
  }
}

async function enableUserFromMenu(user: UserResponse) {
  closeRowMenu()
  try {
    await updateUserStatus(user.id, 'ACTIVE')
    await fetchUsers()
    if (editUser.value?.id === user.id) await loadEditCredential()
    flashStaff('账号已启用。', 'success')
  } catch (e) {
    flashStaff(e instanceof Error ? e.message : '操作失败', 'error')
  }
}

async function resendInvite(user: UserResponse) {
  closeRowMenu()
  reinviteBusyId.value = user.id
  try {
    const r = await reinviteUser(user.id)
    flashStaff(r.message || '邀请邮件已重新发送', 'success')
    await fetchUsers()
  } catch (e) {
    flashStaff(e instanceof Error ? e.message : '重发邀请失败', 'error')
  } finally {
    reinviteBusyId.value = null
  }
}

async function openStaffAudit(u: UserResponse, kind: 'activity' | 'permission') {
  closeRowMenu()
  auditModalTitle.value =
    kind === 'activity'
      ? `员工活动日志 · ${u.fullName ?? u.username ?? u.email ?? u.id}`
      : `权限历史 · ${u.fullName ?? u.username ?? u.email ?? u.id}`
  auditLoading.value = true
  auditError.value = ''
  auditLogs.value = []
  showAuditModal.value = true
  try {
    const res = await listAdminAuditLogs({ userId: u.id, page: 1, size: 80 })
    let rows = res.data ?? []
    if (kind === 'permission') {
      rows = rows.filter((l) => {
        const t = `${l.actionType ?? ''} ${l.summary ?? ''} ${l.targetType ?? ''}`.toLowerCase()
        return /角色|权限|role|permission|平台|分配|邀请|停用|启用/.test(t)
      })
    }
    auditLogs.value = rows
  } catch (e) {
    auditError.value = e instanceof Error ? e.message : '加载审计日志失败'
  } finally {
    auditLoading.value = false
  }
}

async function rotateCredentialForUser(user: UserResponse) {
  closeRowMenu()
  credBusy.value = true
  try {
    const creds = await listPlatformCredentialsByUser(user.id)
    const c = creds.find((x) => x.credentialType === 'PERSONAL') ?? creds[0] ?? null
    if (!c) {
      flashStaff('未找到该员工的平台凭证，无法轮换。', 'error')
      return
    }
    const res = await rotatePlatformCredential(c.id)
    rotatedPlainKey.value = res.plainKey
    showRotateKeyModal.value = true
    if (editUser.value?.id === user.id) await loadEditCredential()
    flashStaff('凭证已轮换，新明文 Key 请立即保存。', 'success')
  } catch (e) {
    flashStaff(e instanceof Error ? e.message : '轮换凭证失败', 'error')
  } finally {
    credBusy.value = false
  }
}

function openRenewCredentialModal(user: UserResponse) {
  closeRowMenu()
  renewTargetUser.value = user
  renewModalDays.value = 90
  showRenewCredentialModal.value = true
}

function cancelRenewCredentialModal() {
  showRenewCredentialModal.value = false
  renewTargetUser.value = null
}

/** @returns 是否续期成功（用于关闭弹窗） */
async function executeRenewCredential(user: UserResponse, days: 30 | 90 | 180): Promise<boolean> {
  credBusy.value = true
  try {
    const creds = await listPlatformCredentialsByUser(user.id)
    const c = creds.find((x) => x.credentialType === 'PERSONAL') ?? creds[0] ?? null
    if (!c) {
      flashStaff('未找到该员工的平台凭证，无法续期。', 'error')
      return false
    }
    await renewPlatformCredential(c.id, days)
    if (editUser.value?.id === user.id) await loadEditCredential()
    flashStaff(`凭证已续期 ${days} 天。`, 'success')
    return true
  } catch (e) {
    flashStaff(e instanceof Error ? e.message : '续期失败', 'error')
    return false
  } finally {
    credBusy.value = false
  }
}

async function confirmRenewCredentialModal() {
  const u = renewTargetUser.value
  if (!u || credBusy.value) return
  const days = renewModalDays.value
  const ok = await executeRenewCredential(u, days)
  if (ok) cancelRenewCredentialModal()
}

function openResetPasswordForUser(user: UserResponse) {
  closeRowMenu()
  resetPasswordTargetUser.value = user
  resetPasswordNewPassword.value = ''
  resetPasswordFormError.value = ''
  showResetPasswordConfirm.value = true
}

function cancelResetPasswordConfirm() {
  showResetPasswordConfirm.value = false
  resetPasswordTargetUser.value = null
  resetPasswordNewPassword.value = ''
  resetPasswordFormError.value = ''
}

async function confirmResetPassword() {
  const u = resetPasswordTargetUser.value
  if (!u || resetPasswordBusy.value) return
  resetPasswordFormError.value = ''
  const rawNew = resetPasswordNewPassword.value.trim()
  if (!rawNew) {
    resetPasswordFormError.value = '请输入新密码（至少 8 位），与后端 AdminResetPasswordRequest 一致。'
    return
  }
  if (rawNew.length < 8) {
    resetPasswordFormError.value = '新密码长度须至少 8 位。'
    return
  }
  resetPasswordBusy.value = true
  try {
    await resetUserPasswordByAdmin(u.id, { newPassword: rawNew })
    showResetPasswordConfirm.value = false
    resetPasswordTargetUser.value = null
    resetPasswordNewPassword.value = ''
    await fetchUsers()
    flashStaff('登录密码已重置。', 'success')
  } catch (e) {
    flashStaff(e instanceof Error ? e.message : '重置密码失败', 'error')
  } finally {
    resetPasswordBusy.value = false
  }
}

function noForceLogoutApi() {
  closeRowMenu()
  openActionDialog({
    title: '强制下线',
    description:
      '当前 OpenAPI 中无「按用户强制下线所有会话」接口；可临时通过轮换/吊销平台凭证达到类似效果。',
    items: ['可后续接入会话表 + 管理端 revoke 接口。'],
  })
}

function credentialBadge(user: UserResponse) {
  if (user.status === 'DISABLED') return { cls: 'badge-red', text: '🚫 已吊销' }
  if (user.status === 'ACTIVE') return { cls: 'badge-green', text: '✅ 有效' }
  return { cls: 'badge-yellow', text: '❌ 未配置' }
}

function formatTokenAmount(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}

const credQuotaPct = computed(() => {
  const c = editCredential.value
  const cap = c?.monthlyTokenQuota
  if (c == null || cap == null || cap <= 0) return null
  const used = c.usedTokensThisMonth ?? 0
  return Math.min(100, Math.round((used / cap) * 1000) / 10)
})

const stats = computed(() => {
  const total = users.value.length
  const active = users.value.filter((u) => u.status === 'ACTIVE').length
  const disabled = users.value.filter((u) => u.status === 'DISABLED').length
  const pending = users.value.filter(
    (u) => !u.status || (u.status !== 'ACTIVE' && u.status !== 'DISABLED'),
  ).length
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const newThisMonth = users.value.filter((u) => {
    if (!u.createdAt) return false
    const d = new Date(u.createdAt)
    return d.getFullYear() === y && d.getMonth() === m
  }).length
  const pct = total ? Math.round((active / total) * 100) : 0
  return {
    total,
    active,
    disabled,
    pending,
    newThisMonth,
    activePct: pct,
    credentialValid: active,
    needAttention: disabled + pending,
  }
})

const roleDistribution = computed(() => {
  const list = users.value
  const superA = list.filter((u) => u.platformRole === 'SUPER_ADMIN')
  const plat = list.filter((u) => u.platformRole === 'PLATFORM_ADMIN')
  const mem = list.filter(
    (u) => u.platformRole !== 'SUPER_ADMIN' && u.platformRole !== 'PLATFORM_ADMIN',
  )
  const suspended = list.filter((u) => u.status === 'DISABLED')
  const hint = (arr: UserResponse[]) => {
    if (arr.length === 0) return '—'
    const names = arr
      .slice(0, 2)
      .map((u) => u.fullName || u.username || '—')
      .join('、')
    return arr.length > 2 ? `${names}…` : names
  }
  return [
    {
      border: 'var(--danger)',
      label: '👑 超级管理员',
      count: superA.length,
      hint: hint(superA),
    },
    {
      border: 'var(--primary)',
      label: '🔧 平台管理员',
      count: plat.length,
      hint: hint(plat),
    },
    {
      border: 'var(--success)',
      label: '👤 普通成员',
      count: mem.length,
      hint: mem.length ? '按角色统计' : '—',
    },
    {
      border: 'var(--warning)',
      label: '⏸ 已停用',
      count: suspended.length,
      hint: hint(suspended),
    },
  ]
})

function roleBadgeClass(role: string | null) {
  if (role === 'SUPER_ADMIN') return 'badge-red'
  if (role === 'PLATFORM_ADMIN') return 'badge-blue'
  return 'badge-gray'
}

function roleLabel(role: string | null) {
  if (role === 'SUPER_ADMIN') return '👑 超级管理员'
  if (role === 'PLATFORM_ADMIN') return '🔧 平台管理员'
  return '👤 普通成员'
}

function statusBadgeClass(status: string | null) {
  if (status === 'ACTIVE') return 'badge-green'
  if (status === 'DISABLED') return 'badge-red'
  return 'badge-yellow'
}

function statusLabel(status: string | null) {
  if (status === 'ACTIVE') return '在职活跃'
  if (status === 'DISABLED') return '已停用'
  return '未激活'
}

const PALETTE = ['#4F6EF7', '#F04438', '#12B76A', '#F79009', '#7A5AF8', '#06AED4', '#EE46BC', '#667085']

function avatarBg(id: number) {
  return PALETTE[id % PALETTE.length] as string
}

function avatarChar(user: UserResponse) {
  return (user.fullName ?? user.username ?? user.email ?? '?').charAt(0).toUpperCase()
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const diff = Date.now() - d.getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days === 1) return '昨天'
  if (days < 8) return `${days} 天前`
  return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

function isRowSelected(id: number) {
  return selectedIds.value.has(id)
}

function toggleRowSelect(id: number, checked: boolean) {
  const next = new Set(selectedIds.value)
  if (checked) next.add(id)
  else next.delete(id)
  selectedIds.value = next
}

function toggleSelectAll(checked: boolean) {
  if (!checked) {
    selectedIds.value = new Set()
    return
  }
  selectedIds.value = new Set(users.value.map((u) => u.id))
}

function onToggleAllChange(ev: Event) {
  const t = ev.target as HTMLInputElement | null
  toggleSelectAll(!!t?.checked)
}

function onRowSelectChange(userId: number, ev: Event) {
  const t = ev.target as HTMLInputElement | null
  toggleRowSelect(userId, !!t?.checked)
}

function openEditFromDetail() {
  const u = detailUser.value
  if (!u) return
  showDetailModal.value = false
  openEdit(u)
}

const allSelected = computed(
  () => users.value.length > 0 && users.value.every((u) => selectedIds.value.has(u.id)),
)
</script>

<template>
  <section class="staff-page" data-testid="staff-management-page">
    <div class="stats-grid" style="margin-bottom: 20px">
      <div class="stat-card">
        <div class="stat-icon">👥</div>
        <div class="stat-label">平台总人数</div>
        <div class="stat-value">{{ loading ? '…' : stats.total }}</div>
        <div class="stat-delta">↑ {{ stats.newThisMonth }} 本月新增</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">✅</div>
        <div class="stat-label">已激活</div>
        <div class="stat-value" style="color: var(--success)">{{ loading ? '…' : stats.active }}</div>
        <div class="stat-delta">占比 {{ stats.activePct }}%</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🔑</div>
        <div class="stat-label">凭证有效</div>
        <div class="stat-value" style="color: var(--primary)">{{ loading ? '…' : stats.credentialValid }}</div>
        <div class="stat-delta">与在职账号一致</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">⚠️</div>
        <div class="stat-label">需关注</div>
        <div class="stat-value" style="color: var(--warning)">{{ loading ? '…' : stats.needAttention }}</div>
        <div class="stat-delta down">
          {{ stats.pending }} 未激活 · {{ stats.disabled }} 已停用
        </div>
      </div>
    </div>

    <div class="staff-toolbar">
      <input
        v-model="searchKeyword"
        class="staff-search"
        type="search"
        placeholder="搜索姓名 / 邮箱 / 部门..."
        @keydown.enter="applyFilters"
      />
      <select v-model="filterRole" class="staff-select">
        <option value="">全部平台角色</option>
        <option value="SUPER_ADMIN">超级管理员</option>
        <option value="PLATFORM_ADMIN">平台管理员</option>
        <option value="MEMBER">普通成员</option>
      </select>
      <select v-model="filterStatus" class="staff-select">
        <option value="">全部状态</option>
        <option value="ACTIVE">在职活跃</option>
        <option value="UNACTIVATED">未激活</option>
        <option value="DISABLED">已停用</option>
      </select>
      <select v-model="filterDepartment" class="staff-select">
        <option value="">全部部门</option>
        <option v-for="d in departments" :key="d.id" :value="String(d.id)">{{ d.name }}</option>
      </select>
      <button class="btn staff-toolbar-btn" type="button" @click="applyFilters">🔍 查询</button>
      <button class="btn staff-toolbar-btn" type="button" @click="openBatchDialog">📦 批量操作</button>
      <button class="btn btn-primary staff-toolbar-primary" type="button" @click="openCreateModal">
        + 新增员工
      </button>
    </div>

    <div
      v-if="staffFlash"
      class="staff-flash"
      :class="staffFlash.kind === 'success' ? 'staff-flash--ok' : 'staff-flash--err'"
    >
      {{ staffFlash.message }}
    </div>

    <div v-if="error" style="color: var(--danger); margin-bottom: 12px; font-size: 13px">⚠️ {{ error }}</div>

    <div class="role-dist">
      <div
        v-for="(card, idx) in roleDistribution"
        :key="idx"
        class="card role-dist-card"
        :style="{ borderLeft: `3px solid ${card.border}` }"
      >
        <div class="card-body role-dist-body">
          <div>
            <div class="role-dist-label">{{ card.label }}</div>
            <div class="role-dist-value">{{ card.count }}</div>
          </div>
          <div class="role-dist-hint">{{ card.hint }}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">全体员工</span>
        <span style="font-size: 12px; color: var(--sub)">共 {{ users.length }} 人</span>
      </div>
      <div class="card-body staff-table-wrap">
        <table>
          <thead>
            <tr>
              <th class="th-check">
                <input type="checkbox" :checked="allSelected" @change="onToggleAllChange($event)" />
              </th>
              <th>姓名</th>
              <th>部门</th>
              <th>平台角色</th>
              <th>Token 配额</th>
              <th>凭证状态</th>
              <th>最后活跃</th>
              <th>账号状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="9" style="padding: 20px; text-align: center; color: var(--sub)">加载中…</td>
            </tr>
            <tr v-else-if="users.length === 0">
              <td colspan="9" style="padding: 20px; text-align: center; color: var(--sub)">暂无数据</td>
            </tr>
            <tr
              v-for="user in users"
              v-else
              :key="user.id"
              :class="{
                'row-dimmed': user.status === 'DISABLED',
                'row-super': user.platformRole === 'SUPER_ADMIN',
              }"
            >
              <td class="td-check">
                <input
                  type="checkbox"
                  :checked="isRowSelected(user.id)"
                  @change="onRowSelectChange(user.id, $event)"
                />
              </td>
              <td>
                <div class="staff-user">
                  <div class="staff-avatar" :style="{ background: avatarBg(user.id) }">{{ avatarChar(user) }}</div>
                  <div>
                    <div class="staff-name">{{ user.fullName ?? user.username ?? '—' }}</div>
                    <div class="staff-email">{{ user.email ?? '—' }}</div>
                  </div>
                </div>
              </td>
              <td style="font-size: 12px">{{ deptLabel(user) }}</td>
              <td>
                <span class="badge" :class="roleBadgeClass(user.platformRole)" style="font-size: 10px">
                  {{ roleLabel(user.platformRole) }}
                </span>
              </td>
              <td>
                <span class="badge badge-gray" style="font-size: 10px">接入项目后展示</span>
              </td>
              <td>
                <span class="badge" :class="credentialBadge(user).cls" style="font-size: 10px">
                  {{ credentialBadge(user).text }}
                </span>
              </td>
              <td style="font-size: 12px">{{ formatRelativeTime(user.updatedAt) }}</td>
              <td>
                <span class="badge" :class="statusBadgeClass(user.status)" style="font-size: 10px">
                  {{ statusLabel(user.status) }}
                </span>
              </td>
              <td class="td-actions">
                <div class="staff-row-actions">
                  <button class="btn staff-action-btn" type="button" @click="openEdit(user)">编辑</button>
                  <button class="btn staff-action-btn" type="button" @click="openDetail(user)">详情</button>
                  <button
                    v-if="user.status !== 'ACTIVE' && user.status !== 'DISABLED'"
                    class="btn staff-action-btn"
                    type="button"
                    :disabled="reinviteBusyId === user.id"
                    @click="resendInvite(user)"
                  >
                    {{ reinviteBusyId === user.id ? '发送中…' : '重发邀请' }}
                  </button>
                  <div class="staff-row-menu">
                    <button
                      type="button"
                      class="btn staff-action-btn staff-row-menu-trigger"
                      :aria-expanded="rowMenuOpenFor === user.id"
                      @click.stop="toggleRowMenu(user.id, $event)"
                    >
                      更多 ▾
                    </button>
                    <div v-if="rowMenuOpenFor === user.id" class="staff-row-menu-panel" role="menu" @click.stop>
                      <button
                        type="button"
                        class="staff-row-menu-item"
                        :disabled="credBusy"
                        @click="rotateCredentialForUser(user)"
                      >
                        🔑 重签凭证
                      </button>
                      <button
                        type="button"
                        class="staff-row-menu-item"
                        :disabled="credBusy"
                        @click="openRenewCredentialModal(user)"
                      >
                        📅 续期凭证
                      </button>
                      <button
                        type="button"
                        class="staff-row-menu-item"
                        :disabled="resetPasswordBusy"
                        @click="openResetPasswordForUser(user)"
                      >
                        🔒 重置密码
                      </button>
                      <button type="button" class="staff-row-menu-item" @click="noForceLogoutApi">⚡ 强制下线</button>
                      <button
                        type="button"
                        class="staff-row-menu-item"
                        :disabled="auditLoading"
                        @click="openStaffAudit(user, 'activity')"
                      >
                        📋 活动日志
                      </button>
                      <button
                        type="button"
                        class="staff-row-menu-item"
                        :disabled="auditLoading"
                        @click="openStaffAudit(user, 'permission')"
                      >
                        📜 权限历史
                      </button>
                      <button
                        v-if="user.status === 'ACTIVE'"
                        type="button"
                        class="staff-row-menu-item staff-row-menu-item--warn"
                        @click="openSuspendConfirmFor(user)"
                      >
                        ⏸ 停用账号
                      </button>
                      <button
                        v-if="user.status === 'DISABLED'"
                        type="button"
                        class="staff-row-menu-item"
                        @click="enableUserFromMenu(user)"
                      >
                        ▶ 启用账号
                      </button>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 新增员工（对齐原型 modal-addStaff） -->
    <div
      v-if="showCreateModal"
      class="modal open"
      role="dialog"
      aria-modal="true"
      @click.self="showCreateModal = false"
    >
      <div class="modal-box staff-modal-wide">
        <div class="modal-title">新增员工到平台</div>

        <template v-if="!createForm.plainKey">
          <div class="modal-section-label">基础信息</div>
          <div class="staff-form-grid-2">
            <label class="form-group">
              <span class="form-label">员工姓名</span>
              <input v-model="createForm.fullName" placeholder="张三" />
            </label>
            <label class="form-group">
              <span class="form-label">员工邮箱</span>
              <input v-model="createForm.email" type="email" placeholder="zhangsan@company.com" />
            </label>
            <label class="form-group">
              <span class="form-label">所属部门</span>
              <select v-model="createForm.departmentIdStr">
                <option value="">请选择</option>
                <option v-for="d in departments" :key="d.id" :value="String(d.id)">{{ d.name }}</option>
              </select>
            </label>
            <label class="form-group">
              <span class="form-label">用户名 *</span>
              <input v-model="createForm.username" placeholder="zhangsan" />
            </label>
            <label class="form-group">
              <span class="form-label">手机号</span>
              <input v-model="createForm.phone" type="tel" placeholder="选填" />
            </label>
            <label class="form-group full-span">
              <span class="form-label">头像 URL</span>
              <input v-model="createForm.avatarUrl" type="url" placeholder="选填，https://..." />
            </label>
            <label class="form-group full-span">
              <span class="form-label">凭证展示名称</span>
              <input v-model="createForm.credentialName" placeholder="选填，默认「姓名/用户名 + 的凭证」" />
            </label>
            <label class="form-group full-span">
              <span class="form-label">职位</span>
              <select v-model="createForm.jobTitle" class="staff-select staff-select-block">
                <option value="">请选择</option>
                <option v-for="t in STAFF_JOB_TITLES" :key="t" :value="t">{{ t }}</option>
              </select>
            </label>
            <div class="form-group">
              <span class="form-label">初始密码</span>
              <div class="pwd-row">
                <input v-model="generatedPassword" class="pwd-readonly" autocomplete="new-password" />
                <button class="btn staff-toolbar-btn" type="button" @click="generatedPassword = randomPassword()">
                  🔄 重新生成
                </button>
              </div>
              <p class="field-hint">将提交至后端 `POST /users`（BCrypt 存储），至少 8 位。</p>
            </div>
          </div>

          <div class="modal-section-label">权限配置</div>
          <div class="staff-form-grid-2">
            <label class="form-group">
              <span class="form-label">平台角色</span>
              <select v-model="createForm.platformRole">
                <option value="MEMBER">👤 普通成员</option>
                <option value="PLATFORM_ADMIN">🔧 平台管理员</option>
                <option value="SUPER_ADMIN">👑 超级管理员</option>
              </select>
            </label>
            <label class="form-group">
              <span class="form-label">Token 配额</span>
              <div class="token-row">
                <input v-model="createForm.tokenQuota" style="width: 70px" />
                <select v-model="createForm.tokenUnit" class="staff-select token-unit">
                  <option>K Token/月</option>
                  <option>M Token/月</option>
                </select>
              </div>
              <p class="field-hint">
                对应 <code>monthlyTokenQuota</code>（按 Token 个数）；留空则不传，由后端默认（如 200K）。填 0 表示不限制。
              </p>
            </label>
            <label class="form-group">
              <span class="form-label">配额告警阈值 %</span>
              <input v-model="createForm.alertThresholdPct" style="width: 70px" placeholder="80" />
              <p class="field-hint">0–100；留空则由后端默认（如 80%）。</p>
            </label>
            <label class="form-group">
              <span class="form-label">超配额策略</span>
              <select v-model="createForm.overQuotaStrategy" class="staff-select staff-select-block">
                <option v-for="opt in OVER_QUOTA_STRATEGY_OPTIONS" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </label>
          </div>

          <div class="create-flow-tip">
            <strong>✅ 创建流程：</strong>创建账号 → 自动签发平台凭证 → 发送欢迎邮件（含初始密码和接入指南）→
            员工首次登录后修改密码
          </div>

          <p v-if="createForm.error" class="create-error">{{ createForm.error }}</p>

          <div class="modal-actions">
            <button class="btn" type="button" :disabled="createForm.submitting" @click="showCreateModal = false">
              取消
            </button>
            <button class="btn btn-primary" type="button" :disabled="createForm.submitting" @click="submitCreate">
              {{ createForm.submitting ? '创建中...' : '创建员工' }}
            </button>
          </div>
        </template>

        <template v-else>
          <p class="create-success">✅ 员工创建成功！</p>
          <p class="modal-desc">平台凭证明文 Key（仅展示一次，请立即保存）：</p>
          <pre class="code-block code-block-key">{{ createForm.plainKey }}</pre>
          <div class="modal-actions">
            <button class="btn btn-primary" type="button" @click="showCreateModal = false">关闭</button>
          </div>
        </template>
      </div>
    </div>

    <!-- 员工详情 -->
    <div
      v-if="showDetailModal && detailUser"
      class="modal open"
      role="dialog"
      aria-modal="true"
      @click.self="showDetailModal = false"
    >
      <div class="modal-box staff-modal-detail">
        <div class="modal-title">员工详情</div>
        <div class="detail-head">
          <div class="staff-avatar detail-avatar" :style="{ background: avatarBg(detailUser.id) }">
            {{ avatarChar(detailUser) }}
          </div>
          <div class="detail-head-text">
            <div class="detail-name">{{ detailUser.fullName ?? detailUser.username ?? '—' }}</div>
            <div class="detail-sub">{{ detailUser.email ?? '—' }} · {{ deptLabel(detailUser) }}</div>
            <div class="detail-badges">
              <span class="badge" :class="roleBadgeClass(detailUser.platformRole)" style="font-size: 10px">
                {{ roleLabel(detailUser.platformRole) }}
              </span>
              <span class="badge" :class="statusBadgeClass(detailUser.status)" style="font-size: 10px">
                {{ statusLabel(detailUser.status) }}
              </span>
            </div>
          </div>
        </div>
        <div class="detail-section-title">📁 参与的项目</div>
        <div class="detail-section-card">
          <p v-if="detailProjectsLoading" class="detail-muted">加载中…</p>
          <p v-else-if="detailProjectsError" class="create-error">{{ detailProjectsError }}</p>
          <div v-else-if="detailProjectRows.length === 0" class="detail-muted">暂无参与项目</div>
          <div v-else class="detail-table-wrap">
            <table class="detail-projects-table">
              <thead>
                <tr>
                  <th>项目</th>
                  <th>项目角色</th>
                  <th>加入时间</th>
                  <th>本月用量</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in detailProjectRows" :key="row.projectId">
                  <td>
                    <span class="detail-proj-cell">
                      <span class="detail-proj-icon">{{ row.icon }}</span>
                      <span>{{ row.name }}</span>
                    </span>
                  </td>
                  <td>
                    <span class="badge" :class="projectRoleBadgeClass(row.role)" style="font-size: 10px">
                      {{ row.role }}
                    </span>
                  </td>
                  <td class="detail-muted">{{ row.joinedAtLabel }}</td>
                  <td>{{ row.usageLabel }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="detail-section-title">🔑 凭证与配额信息</div>
        <div class="detail-section-card">
          <p v-if="detailCredInfoLoading" class="detail-muted">加载凭证中…</p>
          <template v-else-if="detailCredInfo">
            <div class="detail-kv">
              <div class="detail-kv-row">
                <span class="detail-kv-k">凭证状态</span>
                <span class="detail-kv-v">
                  <span class="badge" :class="platformCredStatusUi(detailCredInfo).cls" style="font-size: 10px">
                    {{ platformCredStatusUi(detailCredInfo).text }}
                  </span>
                </span>
              </div>
              <div class="detail-kv-row">
                <span class="detail-kv-k">到期时间</span>
                <span class="detail-kv-v">{{ formatJoinDate(detailCredInfo.expiresAt) }}</span>
              </div>
              <div class="detail-kv-row">
                <span class="detail-kv-k">Token 配额</span>
                <span class="detail-kv-v">{{ monthlyQuotaLine(detailCredInfo) }}</span>
              </div>
              <div class="detail-kv-row">
                <span class="detail-kv-k">已用配额</span>
                <span class="detail-kv-v">{{ detailCredUsedDisplay }}</span>
              </div>
              <div class="detail-kv-row">
                <span class="detail-kv-k">最后活跃</span>
                <span class="detail-kv-v">{{ formatRelativeTime(detailCredInfo.lastUsedAt) }}</span>
              </div>
            </div>
          </template>
          <p v-else class="detail-muted">未查询到平台凭证</p>
        </div>

        <div class="modal-actions">
          <button class="btn" type="button" @click="showDetailModal = false">关闭</button>
          <button class="btn btn-primary" type="button" @click="openEditFromDetail">编辑</button>
        </div>
      </div>
    </div>

    <!-- 编辑员工（对齐原型 modal-editStaff，可保存字段以后端为准） -->
    <div
      v-if="showEditModal && editUser"
      class="modal open"
      role="dialog"
      aria-modal="true"
      @click.self="showEditModal = false"
    >
      <div class="modal-box staff-modal-wide">
        <div class="modal-title">编辑员工信息</div>
        <div class="edit-user-banner">
          <div class="staff-avatar" :style="{ background: avatarBg(editUser.id) }">{{ avatarChar(editUser) }}</div>
          <div>
            <div style="font-weight: 600">{{ editUser.fullName ?? editUser.username ?? '—' }}</div>
            <div class="edit-user-sub">{{ editUser.email ?? '—' }} · {{ deptLabel(editUser) }}</div>
          </div>
          <div class="edit-user-status">
            <span class="badge" :class="statusBadgeClass(editUser.status)" style="font-size: 10px">
              {{ statusLabel(editUser.status) }}
            </span>
          </div>
        </div>

        <div class="modal-section-label">基础信息</div>
        <div class="staff-form-grid-2">
          <label class="form-group">
            <span class="form-label">登录邮箱</span>
            <input v-model="editForm.email" type="email" />
          </label>
          <label class="form-group">
            <span class="form-label">用户名</span>
            <input v-model="editForm.username" maxlength="64" />
          </label>
          <label class="form-group">
            <span class="form-label">部门</span>
            <select v-model="editForm.departmentIdStr">
              <option value="">未分配</option>
              <option v-for="d in departments" :key="d.id" :value="String(d.id)">{{ d.name }}</option>
            </select>
          </label>
          <label class="form-group">
            <span class="form-label">平台角色</span>
            <input :value="roleLabel(editUser.platformRole)" readonly class="pwd-readonly" />
            <p class="field-hint">角色变更请走权限管理或后端管理接口。</p>
          </label>
          <label class="form-group full-span">
            <span class="form-label">姓名</span>
            <input v-model="editForm.fullName" />
          </label>
          <label class="form-group full-span">
            <span class="form-label">头像 URL</span>
            <input v-model="editForm.avatarUrl" type="url" placeholder="选填" />
          </label>
          <label class="form-group full-span">
            <span class="form-label">手机号</span>
            <input v-model="editForm.phone" type="tel" placeholder="选填" />
          </label>
          <label class="form-group full-span">
            <span class="form-label">职位</span>
            <select v-model="editForm.jobTitle" class="staff-select staff-select-block">
              <option value="">未填写</option>
              <option v-for="t in editJobTitleOptions" :key="t" :value="t">{{ t }}</option>
            </select>
          </label>
        </div>

        <div class="modal-section-label">配额管理</div>
        <p v-if="editCredLoading" class="field-hint">正在加载凭证…</p>
        <template v-else>
          <div class="staff-form-grid-2">
            <label class="form-group">
              <span class="form-label">凭证展示名称</span>
              <input v-model="editForm.credentialName" :disabled="!editCredential" placeholder="个人平台凭证名称" />
              <p class="field-hint">对应 <code>credentialName</code>；无凭证时不可编辑。</p>
            </label>
            <label class="form-group">
              <span class="form-label">Token 配额</span>
              <div class="token-row">
                <input v-model="editForm.tokenQuota" style="width: 70px" :disabled="!editCredential" />
                <select v-model="editForm.tokenUnit" class="staff-select token-unit" :disabled="!editCredential">
                  <option>K Token/月</option>
                  <option>M Token/月</option>
                </select>
              </div>
              <p class="field-hint">
                与新建一致；保存时提交 <code>monthlyTokenQuota</code>。留空数值则不修改该项（传 null）。
              </p>
            </label>
            <label class="form-group">
              <span class="form-label">配额告警阈值 %</span>
              <input
                v-model="editForm.alertThresholdPctStr"
                style="width: 70px"
                :disabled="!editCredential"
                placeholder="留空不修改"
              />
              <p class="field-hint">0–100；留空则不传，不修改后端阈值。</p>
            </label>
            <label class="form-group">
              <span class="form-label">超配额策略</span>
              <select
                v-model="editForm.overQuotaStrategy"
                class="staff-select staff-select-block"
                :disabled="!editCredential"
              >
                <option v-for="opt in OVER_QUOTA_STRATEGY_OPTIONS" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </label>
            <div v-if="editCredential" class="form-group full-span">
              <span class="form-label">配额状态</span>
              <div class="quota-placeholder">
                已用 {{ formatTokenAmount(editCredential.usedTokensThisMonth) }} /
                {{ formatTokenAmount(editCredential.monthlyTokenQuota) }}
                <span v-if="credQuotaPct != null">（{{ credQuotaPct }}%）</span>
                <br />
                <div class="quota-bar-bg">
                  <div
                    class="quota-bar-fill"
                    :style="{ width: (credQuotaPct != null ? credQuotaPct : 0) + '%' }"
                  />
                </div>
              </div>
              <p class="field-hint">Key 前缀 {{ editCredential.keyPrefix }} · 状态 {{ editCredential.status }}；续期请在列表「更多」中选择天数。</p>
            </div>
          </div>
          <p v-if="!editCredential" class="field-hint">未查询到该用户的平台凭证（新建用户后应自动创建 PERSONAL 凭证）。</p>
        </template>

        <p v-if="editForm.error" class="create-error">{{ editForm.error }}</p>

        <div class="modal-actions">
          <button class="btn" type="button" :disabled="editForm.submitting" @click="showEditModal = false">
            取消
          </button>
          <button class="btn btn-primary" type="button" :disabled="editForm.submitting" @click="submitEdit">
            {{ editForm.submitting ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 续期凭证（列表「更多」） -->
    <div
      v-if="showRenewCredentialModal && renewTargetUser"
      class="modal open"
      role="dialog"
      aria-modal="true"
      @click.self="cancelRenewCredentialModal"
    >
      <div class="modal-box staff-modal-suspend">
        <div class="modal-title">📅 续期平台凭证</div>
        <p class="modal-desc">
          员工：{{
            renewTargetUser.fullName ?? renewTargetUser.username ?? renewTargetUser.email ?? '—'
          }}
        </p>
        <label class="form-group">
          <span class="form-label">续期时长</span>
          <select v-model.number="renewModalDays" class="staff-select staff-select-block">
            <option :value="30">30 天</option>
            <option :value="90">90 天</option>
            <option :value="180">180 天</option>
          </select>
        </label>
        <p class="field-hint">对应 <code>POST /api/credentials/{id}/renew</code>，按该用户 PERSONAL 凭证续期。</p>
        <div class="suspend-actions">
          <button class="btn" type="button" :disabled="credBusy" @click="cancelRenewCredentialModal">取消</button>
          <button
            class="btn btn-primary"
            type="button"
            :disabled="credBusy"
            @click="confirmRenewCredentialModal"
          >
            {{ credBusy ? '处理中…' : '确认续期' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 重置登录密码（列表「更多」→ POST /api/users/{id}/reset-password） -->
    <div
      v-if="showResetPasswordConfirm && resetPasswordTargetUser"
      class="modal open"
      role="dialog"
      aria-modal="true"
      @click.self="cancelResetPasswordConfirm"
    >
      <div class="modal-box staff-modal-suspend">
        <div class="modal-title">🔒 重置登录密码</div>
        <p class="modal-desc">
          确定重置「{{
            resetPasswordTargetUser.fullName ??
            resetPasswordTargetUser.username ??
            resetPasswordTargetUser.email ??
            '—'
          }}」的登录密码？
        </p>
        <p class="field-hint">
          请求体为 <code>AdminResetPasswordRequest</code>：必填 <code>newPassword</code>（明文 ≥8 位，后端 BCrypt 存储）。接口返回
          <code>UserResponse</code>，不含密码字段。
        </p>
        <label class="form-group">
          <span class="form-label">新登录密码（必填）</span>
          <input
            v-model="resetPasswordNewPassword"
            type="password"
            autocomplete="new-password"
            placeholder="至少 8 位"
          />
        </label>
        <p v-if="resetPasswordFormError" class="create-error">{{ resetPasswordFormError }}</p>
        <div class="suspend-actions">
          <button class="btn" type="button" :disabled="resetPasswordBusy" @click="cancelResetPasswordConfirm">
            取消
          </button>
          <button
            class="btn btn-primary"
            type="button"
            :disabled="resetPasswordBusy"
            @click="confirmResetPassword"
          >
            {{ resetPasswordBusy ? '处理中…' : '确认重置' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 停用确认 -->
    <div
      v-if="showSuspendConfirm && suspendTargetUser"
      class="modal open"
      role="dialog"
      aria-modal="true"
      @click.self="cancelSuspendConfirm"
    >
      <div class="modal-box staff-modal-suspend">
        <div class="modal-title">⚠️ 确认停用账号</div>
        <div class="suspend-body">
          <div class="suspend-icon">⏸</div>
          <div class="suspend-title">
            停用「{{ suspendTargetUser.fullName ?? suspendTargetUser.username ?? suspendTargetUser.email }}」的平台账号？
          </div>
          <div class="suspend-list">
            停用后将产生以下影响：<br />
            · 平台凭证立即吊销，无法通过 AI 代理访问<br />
            · 所有项目权限冻结，不可使用 AI 能力<br />
            · 账号无法登录平台控制台<br />
            · 历史数据和操作记录保留<br />
            · 可随时恢复账号
          </div>
        </div>
        <div class="suspend-actions">
          <button class="btn" type="button" @click="cancelSuspendConfirm">取消</button>
          <button class="btn btn-warn" type="button" @click="confirmSuspend">确认停用</button>
        </div>
      </div>
    </div>

    <!-- 审计日志 -->
    <div
      v-if="showAuditModal"
      class="modal open"
      role="dialog"
      aria-modal="true"
      @click.self="showAuditModal = false"
    >
      <div class="modal-box staff-modal-audit">
        <div class="modal-title">{{ auditModalTitle }}</div>
        <p class="modal-desc">数据来源：<code>GET /admin/audit-logs?userId=</code></p>
        <p v-if="auditLoading" class="field-hint">加载中…</p>
        <p v-else-if="auditError" class="create-error">{{ auditError }}</p>
        <div v-else class="audit-table-wrap">
          <table v-if="auditLogs.length" class="audit-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>类型</th>
                <th>摘要</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in auditLogs" :key="row.id">
                <td class="audit-cell-time">{{ row.occurredAt ?? row.createdAt ?? '—' }}</td>
                <td>{{ row.actionType ?? '—' }}</td>
                <td>{{ row.summary ?? '—' }}</td>
              </tr>
            </tbody>
          </table>
          <p v-else class="field-hint">暂无记录（权限历史已按关键词做过滤）。</p>
        </div>
        <div class="modal-actions">
          <button class="btn btn-primary" type="button" @click="showAuditModal = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- 轮换后的明文 Key -->
    <div
      v-if="showRotateKeyModal"
      class="modal open"
      role="dialog"
      aria-modal="true"
      @click.self="showRotateKeyModal = false"
    >
      <div class="modal-box staff-modal-wide">
        <div class="modal-title">新凭证明文 Key</div>
        <p class="modal-desc">仅展示一次，请立即复制保存（对应 <code>POST /credentials/{id}/rotate</code>）。</p>
        <pre class="code-block code-block-key">{{ rotatedPlainKey }}</pre>
        <div class="modal-actions">
          <button class="btn btn-primary" type="button" @click="showRotateKeyModal = false">关闭</button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.staff-page {
  max-width: 100%;
}

.staff-flash {
  padding: 10px 14px;
  border-radius: 8px;
  margin-bottom: 12px;
  font-size: 13px;
  line-height: 1.45;
}

.staff-flash--ok {
  background: #ecfdf3;
  border: 1px solid var(--success);
  color: #027a48;
}

.staff-flash--err {
  background: #fef3f2;
  border: 1px solid var(--danger);
  color: #b42318;
}

.cred-meta {
  font-size: 14px;
  font-weight: 600;
}

.cred-meta-sub {
  font-weight: 400;
  font-size: 11px;
  color: var(--sub);
}

.staff-modal-audit {
  width: 640px;
  max-width: calc(100vw - 32px);
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.audit-table-wrap {
  max-height: 360px;
  overflow: auto;
  margin-bottom: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
}

.audit-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.audit-table th,
.audit-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
  text-align: left;
  vertical-align: top;
}

.audit-cell-time {
  white-space: nowrap;
  color: var(--sub);
  max-width: 160px;
}

.staff-toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  align-items: center;
  flex-wrap: wrap;
}

.staff-search {
  max-width: 260px;
  width: 100%;
}

.staff-select {
  width: auto;
  font-size: 12px;
  padding: 3px 8px;
  max-width: 160px;
}

.staff-select-block {
  max-width: 100%;
  width: 100%;
}

.staff-toolbar-btn {
  font-size: 12px;
  padding: 3px 10px;
}

.staff-toolbar-primary {
  margin-left: auto;
  font-size: 12px;
  padding: 5px 12px;
}

.role-dist {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

@media (max-width: 1100px) {
  .role-dist {
    grid-template-columns: repeat(2, 1fr);
  }
}

.role-dist-card {
  cursor: pointer;
}

.role-dist-body {
  padding: 10px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.role-dist-label {
  font-size: 11px;
  color: var(--sub);
}

.role-dist-value {
  font-weight: 700;
  font-size: 18px;
}

.role-dist-hint {
  font-size: 11px;
  color: var(--sub);
  text-align: right;
  max-width: 48%;
}

.staff-table-wrap {
  padding: 0;
  overflow-x: auto;
}

.th-check,
.td-check {
  width: 36px;
  text-align: center;
}

.staff-user {
  display: flex;
  align-items: center;
  gap: 8px;
}

.staff-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-size: 12px;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-weight: 600;
}

.staff-name {
  font-weight: 600;
}

.staff-email {
  font-size: 11px;
  color: var(--sub);
}

.staff-action-btn {
  padding: 2px 6px;
  font-size: 10px;
  margin-right: 4px;
}

.td-actions {
  min-width: 200px;
  vertical-align: middle;
}

.staff-row-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.staff-row-menu {
  position: relative;
  display: inline-block;
}

.staff-row-menu-trigger {
  margin-right: 0;
}

.staff-row-menu-panel {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 50;
  min-width: 168px;
  padding: 4px;
  background: var(--card, #fff);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(15, 22, 41, 0.12);
}

.staff-row-menu-item {
  display: block;
  width: 100%;
  padding: 8px 10px;
  margin: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  color: var(--text);
}

.staff-row-menu-item:hover:not(:disabled) {
  background: var(--bg);
}

.staff-row-menu-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.staff-row-menu-item--warn {
  color: var(--warning);
}

.row-dimmed {
  opacity: 0.5;
}

.row-super {
  background: #f0f4ff;
}

:deep(tr.row-super:hover td) {
  background: #e8eefe;
}

.modal-section-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--sub);
  text-transform: uppercase;
  letter-spacing: 0.6px;
  border-top: 1px solid var(--border);
  padding-top: 14px;
  margin-top: 8px;
  margin-bottom: 12px;
}

.modal-section-label:first-of-type {
  border-top: none;
  padding-top: 0;
  margin-top: 0;
}

.staff-modal-wide {
  width: 520px;
  max-width: calc(100vw - 32px);
}

.staff-modal-detail {
  width: 580px;
  max-width: calc(100vw - 32px);
  max-height: min(90vh, 720px);
  overflow-y: auto;
}

.staff-modal-suspend {
  width: 440px;
  max-width: calc(100vw - 32px);
}

.staff-form-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.staff-form-grid-2 .full-span {
  grid-column: 1 / -1;
}

.pwd-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.pwd-readonly {
  flex: 1;
  background: var(--bg);
}

.token-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.token-unit {
  max-width: none;
}

.field-hint {
  font-size: 11px;
  color: var(--sub);
  margin: 4px 0 0;
}

.create-flow-tip {
  background: var(--success-light, #ecfdf3);
  border: 1px solid var(--success);
  border-radius: 8px;
  padding: 10px;
  margin-bottom: 16px;
  font-size: 12px;
}

.create-error {
  color: var(--danger);
  font-size: 13px;
  margin-top: 8px;
}

.create-success {
  color: var(--success);
  font-size: 13px;
  margin-bottom: 12px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

.code-block-key {
  white-space: pre-wrap;
  word-break: break-all;
}

.detail-head {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.detail-avatar {
  width: 56px;
  height: 56px;
  font-size: 24px;
}

.detail-name {
  font-weight: 700;
  font-size: 16px;
  margin-bottom: 4px;
}

.detail-sub {
  font-size: 12px;
  color: var(--sub);
  margin-bottom: 6px;
}

.detail-badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.detail-section-title {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 8px;
  margin-top: 4px;
}

.detail-section-card {
  background: var(--bg);
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 16px;
  font-size: 12px;
  line-height: 1.5;
}

.detail-muted {
  color: var(--sub);
  font-size: 12px;
  margin: 0;
}

.detail-table-wrap {
  overflow-x: auto;
  margin: 0 -4px;
}

.detail-projects-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.detail-projects-table th,
.detail-projects-table td {
  padding: 8px 10px;
  text-align: left;
  border-bottom: 1px solid var(--border);
}

.detail-projects-table th {
  font-weight: 600;
  color: var(--sub);
  font-size: 11px;
}

.detail-projects-table tr:last-child td {
  border-bottom: none;
}

.detail-proj-cell {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.detail-proj-icon {
  font-size: 16px;
  line-height: 1;
}

.detail-kv {
  display: grid;
  gap: 10px 16px;
}

.detail-kv-row {
  display: grid;
  grid-template-columns: 100px 1fr;
  gap: 12px;
  align-items: center;
}

.detail-kv-k {
  color: var(--sub);
  font-size: 12px;
}

.detail-kv-v {
  font-size: 12px;
  font-weight: 500;
}

.edit-user-banner {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 12px;
  background: var(--bg);
  border-radius: 8px;
  margin-bottom: 16px;
}

.edit-user-sub {
  font-size: 12px;
  color: var(--sub);
}

.edit-user-status {
  margin-left: auto;
}

.quota-placeholder {
  font-size: 12px;
  color: var(--sub);
  padding: 6px 0;
}

.quota-bar-bg {
  background: var(--border);
  height: 4px;
  border-radius: 2px;
  margin-top: 4px;
}

.quota-bar-fill {
  background: var(--primary);
  height: 4px;
  width: 40%;
  border-radius: 2px;
}

.btn-warn {
  background: var(--warning);
  color: white;
  border-color: var(--warning);
}

.suspend-body {
  text-align: center;
  padding: 16px 0;
}

.suspend-icon {
  font-size: 40px;
  margin-bottom: 12px;
}

.suspend-title {
  font-weight: 600;
  margin-bottom: 8px;
}

.suspend-list {
  font-size: 12px;
  color: var(--sub);
  line-height: 1.6;
  margin-bottom: 16px;
  text-align: left;
}

.suspend-actions {
  display: flex;
  justify-content: center;
  gap: 8px;
}
</style>
