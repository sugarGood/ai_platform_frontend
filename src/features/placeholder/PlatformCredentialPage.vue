<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'

import PlaceholderState from '../../components/ui/PlaceholderState.vue'
import { listProjects } from '../../services/projects'
import { listUsers } from '../../services/users'
import {
  createPlatformCredential,
  listPlatformCredentialsByUser,
  renewPlatformCredential,
  revokePlatformCredential,
  rotatePlatformCredential,
} from '../../services/platform-credentials'
import { listMemberQuotas, createMemberQuota } from '../../services/member-quotas'
import { listProviders } from '../../services/ai-providers'
import { createProviderApiKey, listProviderApiKeys } from '../../services/provider-api-keys'

import type { PlatformCredentialResponse, PlatformCredentialType } from '../../types/credentials'
import type { MemberAiQuotaResponse } from '../../types/platform-usage'
import type { AiProviderResponse } from '../../types/ai-providers'
import type { ProviderApiKeyResponse } from '../../types/provider-api-keys'
import type { UserResponse } from '../../types/user'

type KeysTab = 'members' | 'upstream' | 'service' | 'quota'

type ModalState =
  | { kind: 'none' }
  | { kind: 'create-credential' }
  | { kind: 'revoke-credential'; credentialId: number }
  | { kind: 'renew-credential'; credentialId: number }
  | { kind: 'rotate-credential'; credentialId: number }
  | { kind: 'credential-detail'; credential: PlatformCredentialResponse; user: UserResponse }
  | { kind: 'create-provider-key' }
  | { kind: 'create-member-quota' }

const activeTab = ref<KeysTab>('members')
const modal = ref<ModalState>({ kind: 'none' })

const users = ref<UserResponse[]>([])
const selectedUserId = ref<number | null>(null)
const selectedProviderId = ref<number | null>(null)
const selectedProjectId = ref<number | null>(null)
const quotaScope = ref<'user' | 'project'>('user')

const providers = ref<AiProviderResponse[]>([])
const projects = ref<Array<{ id: number; name: string }>>([])

/** 各用户凭证列表（用于对齐原型「全员凭证表」与统计） */
const credentialsByUserId = ref<Map<number, PlatformCredentialResponse[]>>(new Map())
const providerKeys = ref<ProviderApiKeyResponse[]>([])
const memberQuotas = ref<MemberAiQuotaResponse[]>([])

const memberStatusFilter = ref<'all' | 'ok' | 'expiring' | 'unused'>('all')
const createCredentialKind = ref<PlatformCredentialType>('PERSONAL')
const bannerMessage = ref('')

const loading = reactive({
  users: false,
  allCredentials: false,
  providers: false,
  providerKeys: false,
  projects: false,
  quotas: false,
})

function userDisplayName(u: UserResponse): string {
  return u.fullName ?? u.username ?? `用户 #${u.id}`
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr).getTime()
  if (Number.isNaN(d)) return null
  return Math.ceil((d - Date.now()) / 86_400_000)
}

/** 接入状态（用于筛选与健康度，近似原型规则） */
function accessStatusLabel(c: PlatformCredentialResponse | null): 'ok' | 'expiring' | 'unused' | 'none' {
  if (!c) return 'none'
  if (/REVOK|INACTIVE/i.test(c.status)) return 'unused'
  const days = daysUntil(c.expiresAt)
  if (days !== null && days <= 7 && days >= 0) return 'expiring'
  if (!c.lastUsedAt) return 'unused'
  return 'ok'
}

function formatTokens(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return '—'
  const x = Number(n)
  if (x >= 1_000_000) return `${(x / 1_000_000).toFixed(1)}M Token`
  if (x >= 1000) return `${(x / 1000).toFixed(1)}K Token`
  return `${x} Token`
}

function showBanner(msg: string) {
  bannerMessage.value = msg
  window.setTimeout(() => {
    if (bannerMessage.value === msg) bannerMessage.value = ''
  }, 4000)
}

function parseModelBadges(modelsAllowed: string): string[] {
  try {
    const v = JSON.parse(modelsAllowed) as unknown
    if (Array.isArray(v)) return v.map(String).filter(Boolean)
  } catch {
    /* ignore */
  }
  return modelsAllowed ? [modelsAllowed] : []
}

function projectNameForId(id: number | null | undefined): string | null {
  if (id == null) return null
  return projects.value.find((p) => p.id === id)?.name ?? `项目 #${id}`
}

const memberRows = computed(() => {
  return users.value.map((user) => {
    const list = credentialsByUserId.value.get(user.id) ?? []
    const personal = list.find((c) => c.credentialType === 'PERSONAL') ?? null
    return { user, personal }
  })
})

const memberRowsFiltered = computed(() => {
  return memberRows.value.filter(({ personal }) => {
    const s = accessStatusLabel(personal)
    if (memberStatusFilter.value === 'all') return true
    if (memberStatusFilter.value === 'ok') return s === 'ok'
    if (memberStatusFilter.value === 'expiring') return s === 'expiring'
    if (memberStatusFilter.value === 'unused') return s === 'none' || s === 'unused'
    return true
  })
})

const personalCredentials = computed(() => {
  const out: PlatformCredentialResponse[] = []
  for (const list of credentialsByUserId.value.values()) {
    for (const c of list) {
      if (c.credentialType === 'PERSONAL') out.push(c)
    }
  }
  return out
})

const statActiveCount = computed(
  () => personalCredentials.value.filter((c) => !/REVOK/i.test(c.status)).length,
)

const statExpiringCount = computed(() =>
  personalCredentials.value.filter((c) => accessStatusLabel(c) === 'expiring').length,
)

const healthTotal = computed(() => Math.max(users.value.length, 1))
const healthOk = computed(() => memberRows.value.filter(({ personal }) => accessStatusLabel(personal) === 'ok').length)
const healthExpiring = computed(() =>
  memberRows.value.filter(({ personal }) => accessStatusLabel(personal) === 'expiring').length,
)
const healthIdle = computed(() =>
  memberRows.value.filter(({ personal }) => personal && !personal.lastUsedAt && accessStatusLabel(personal) !== 'expiring').length,
)
const healthNoCred = computed(() => memberRows.value.filter(({ personal }) => !personal).length)

function healthPct(n: number) {
  return `${Math.min(100, Math.round((n / healthTotal.value) * 1000) / 10)}%`
}

const serviceRows = computed(() => {
  const rows: Array<{ user: UserResponse; c: PlatformCredentialResponse }> = []
  for (const u of users.value) {
    const list = credentialsByUserId.value.get(u.id) ?? []
    for (const c of list) {
      if (c.credentialType === 'SERVICE_ACCOUNT' || c.credentialType === 'TEMPORARY') {
        rows.push({ user: u, c })
      }
    }
  }
  return rows
})

const upstreamKeyCount = computed(() => providerKeys.value.length)
const upstreamUsedRatio = computed(() => {
  let cap = 0
  let used = 0
  for (const k of providerKeys.value) {
    cap += k.monthlyQuotaTokens || 0
    used += k.usedTokensMonth || 0
  }
  if (cap <= 0) return null
  return Math.min(100, Math.round((used / cap) * 100))
})

// ---- Create Credential Modal ----
const createCredentialForm = reactive({
  userId: null as number | null,
  name: '',
  boundProjectId: '' as string,
  error: '',
  submitting: false,
  plainKey: '',
})

function openCreateCredentialModal(kind: PlatformCredentialType = 'PERSONAL') {
  createCredentialKind.value = kind
  createCredentialForm.userId = selectedUserId.value ?? users.value[0]?.id ?? null
  createCredentialForm.name = ''
  createCredentialForm.boundProjectId = ''
  createCredentialForm.error = ''
  createCredentialForm.submitting = false
  createCredentialForm.plainKey = ''
  modal.value = { kind: 'create-credential' }
}

async function submitCreateCredential() {
  if (createCredentialForm.userId == null) return

  createCredentialForm.error = ''
  createCredentialForm.submitting = true
  try {
    const boundProjectId = createCredentialForm.boundProjectId.trim()
      ? Number(createCredentialForm.boundProjectId.trim())
      : null

    const res = await createPlatformCredential({
      userId: createCredentialForm.userId,
      credentialType: createCredentialKind.value,
      name: createCredentialForm.name.trim() || undefined,
      boundProjectId,
    })

    createCredentialForm.plainKey = res.plainKey
    await refreshAllCredentialsByUser()
  } catch (e) {
    createCredentialForm.error = e instanceof Error ? e.message : '创建失败，请稍后重试。'
  } finally {
    createCredentialForm.submitting = false
  }
}

// ---- Revoke ----
const revokeReason = ref('')
const revokeSubmitting = ref(false)
const revokeError = ref('')

function openRevokeCredentialModal(credentialId: number) {
  revokeReason.value = ''
  revokeSubmitting.value = false
  revokeError.value = ''
  modal.value = { kind: 'revoke-credential', credentialId }
}

async function submitRevokeCredential() {
  if (modal.value.kind !== 'revoke-credential') return
  revokeSubmitting.value = true
  revokeError.value = ''
  try {
    const id = modal.value.credentialId
    await revokePlatformCredential(id, revokeReason.value.trim() || '用户操作吊销')
    modal.value = { kind: 'none' }
    await refreshAllCredentialsByUser()
    showBanner('凭证已吊销')
  } catch (e) {
    revokeError.value = e instanceof Error ? e.message : '吊销失败，请稍后重试。'
  } finally {
    revokeSubmitting.value = false
  }
}

// ---- Renew ----
const renewForm = reactive({
  renewDays: 90 as 30 | 90 | 180,
  error: '',
  submitting: false,
})

function openRenewModal(credentialId: number) {
  renewForm.renewDays = 90
  renewForm.error = ''
  renewForm.submitting = false
  modal.value = { kind: 'renew-credential', credentialId }
}

async function submitRenewCredential() {
  if (modal.value.kind !== 'renew-credential') return
  renewForm.error = ''
  renewForm.submitting = true
  try {
    await renewPlatformCredential(modal.value.credentialId, renewForm.renewDays)
    modal.value = { kind: 'none' }
    await refreshAllCredentialsByUser()
    showBanner(`已续签 ${renewForm.renewDays} 天`)
  } catch (e) {
    renewForm.error = e instanceof Error ? e.message : '续签失败，请稍后重试。'
  } finally {
    renewForm.submitting = false
  }
}

// ---- Rotate ----
const rotateForm = reactive({
  plainKey: '',
  error: '',
  submitting: false,
})

function openRotateModal(credentialId: number) {
  rotateForm.plainKey = ''
  rotateForm.error = ''
  rotateForm.submitting = false
  modal.value = { kind: 'rotate-credential', credentialId }
}

async function submitRotateCredential() {
  if (modal.value.kind !== 'rotate-credential') return
  rotateForm.error = ''
  rotateForm.submitting = true
  try {
    const res = await rotatePlatformCredential(modal.value.credentialId)
    rotateForm.plainKey = res.plainKey
    await refreshAllCredentialsByUser()
    showBanner('已生成新凭证，请妥善保存明文 Key')
  } catch (e) {
    rotateForm.error = e instanceof Error ? e.message : '轮换失败，请稍后重试。'
  } finally {
    rotateForm.submitting = false
  }
}

function openDetailModal(credential: PlatformCredentialResponse, user: UserResponse) {
  modal.value = { kind: 'credential-detail', credential, user }
}

// ---- Create Provider Key Modal ----
const createProviderKeyForm = reactive({
  label: '',
  apiKey: '',
  modelsAllowed: '[]',
  monthlyQuotaTokens: 0,
  rateLimitRpm: 60,
  rateLimitTpm: 60000,
  proxyEndpoint: '',
  error: '',
  submitting: false,
})

function openCreateProviderKeyModal() {
  createProviderKeyForm.label = ''
  createProviderKeyForm.apiKey = ''
  createProviderKeyForm.modelsAllowed = '[]'
  createProviderKeyForm.monthlyQuotaTokens = 0
  createProviderKeyForm.rateLimitRpm = 60
  createProviderKeyForm.rateLimitTpm = 60000
  createProviderKeyForm.proxyEndpoint = ''
  createProviderKeyForm.error = ''
  createProviderKeyForm.submitting = false
  modal.value = { kind: 'create-provider-key' }
}

async function submitCreateProviderKey() {
  if (!selectedProviderId.value) return

  createProviderKeyForm.error = ''
  createProviderKeyForm.submitting = true
  try {
    await createProviderApiKey({
      providerId: selectedProviderId.value,
      label: createProviderKeyForm.label.trim(),
      apiKey: createProviderKeyForm.apiKey.trim(),
      modelsAllowed: createProviderKeyForm.modelsAllowed,
      monthlyQuotaTokens: createProviderKeyForm.monthlyQuotaTokens,
      rateLimitRpm: createProviderKeyForm.rateLimitRpm,
      rateLimitTpm: createProviderKeyForm.rateLimitTpm,
      proxyEndpoint: createProviderKeyForm.proxyEndpoint.trim() || undefined,
    })
    modal.value = { kind: 'none' }
    await refreshProviderKeys()
    showBanner('上游 Key 已添加')
  } catch (e) {
    createProviderKeyForm.error = e instanceof Error ? e.message : '创建失败，请稍后重试。'
  } finally {
    createProviderKeyForm.submitting = false
  }
}

// ---- Create Member Quota Modal ----
const createQuotaForm = reactive({
  quotaType: 'TOKEN_QUOTA',
  quotaLimit: 0,
  resetCycle: 'MONTHLY',
  error: '',
  submitting: false,
})

function openCreateMemberQuotaModal() {
  createQuotaForm.quotaType = 'TOKEN_QUOTA'
  createQuotaForm.quotaLimit = 0
  createQuotaForm.resetCycle = 'MONTHLY'
  createQuotaForm.error = ''
  createQuotaForm.submitting = false
  modal.value = { kind: 'create-member-quota' }
}

async function submitCreateMemberQuota() {
  if (!selectedUserId.value) return

  createQuotaForm.error = ''
  createQuotaForm.submitting = true
  try {
    const res = await createMemberQuota({
      userId: selectedUserId.value,
      projectId: quotaScope.value === 'project' ? selectedProjectId.value : null,
      quotaType: createQuotaForm.quotaType,
      quotaLimit: createQuotaForm.quotaLimit,
      resetCycle: createQuotaForm.resetCycle,
    })

    void res
    modal.value = { kind: 'none' }
    await refreshQuotas()
    showBanner('配额已创建')
  } catch (e) {
    createQuotaForm.error = e instanceof Error ? e.message : '创建配额失败，请稍后重试。'
  } finally {
    createQuotaForm.submitting = false
  }
}

// ---- Refreshers ----
async function refreshUsers() {
  loading.users = true
  try {
    users.value = await listUsers()
    const u0 = users.value[0]
    if (selectedUserId.value == null && u0) selectedUserId.value = u0.id
  } finally {
    loading.users = false
  }
}

async function refreshAllCredentialsByUser() {
  if (users.value.length === 0) {
    credentialsByUserId.value = new Map()
    return
  }
  loading.allCredentials = true
  try {
    const entries = await Promise.all(
      users.value.map(async (u) => {
        const list = await listPlatformCredentialsByUser(u.id)
        return [u.id, list] as const
      }),
    )
    credentialsByUserId.value = new Map(entries)
  } finally {
    loading.allCredentials = false
  }
}

async function refreshProviders() {
  loading.providers = true
  try {
    providers.value = await listProviders()
    const p0 = providers.value[0]
    if (!selectedProviderId.value && p0) selectedProviderId.value = p0.id
  } finally {
    loading.providers = false
  }
}

async function refreshProviderKeys() {
  loading.providerKeys = true
  try {
    providerKeys.value = await listProviderApiKeys(selectedProviderId.value)
  } finally {
    loading.providerKeys = false
  }
}

async function refreshProjects() {
  loading.projects = true
  try {
    const res = await listProjects(1, 100)
    projects.value = res.data.map((p) => ({ id: p.id, name: p.name }))
    const pr0 = projects.value[0]
    if (!selectedProjectId.value && pr0) selectedProjectId.value = pr0.id
  } finally {
    loading.projects = false
  }
}

async function refreshQuotas() {
  if (!selectedUserId.value) return
  loading.quotas = true
  try {
    const userId = selectedUserId.value
    const projectId = quotaScope.value === 'project' ? selectedProjectId.value : null
    memberQuotas.value = await listMemberQuotas({ userId, projectId })
  } finally {
    loading.quotas = false
  }
}

onMounted(async () => {
  await refreshUsers()
  await refreshAllCredentialsByUser()
  void refreshProviders()
  void refreshProjects()
  void refreshProviderKeys()
  void refreshQuotas()
})

watch(selectedProviderId, async () => {
  await refreshProviderKeys()
})

watch([quotaScope, selectedProjectId, selectedUserId], async () => {
  await refreshQuotas()
})

const topTabs = [
  { id: 'members', label: '成员凭证管理', icon: '👤' },
  { id: 'upstream', label: '上游 API Key', icon: '🔑' },
  { id: 'service', label: '服务账号', icon: '🤖' },
  { id: 'quota', label: '配额策略', icon: '📊' },
] as const

function closeModal() {
  modal.value = { kind: 'none' }
}

function modalOpen() {
  return modal.value.kind !== 'none'
}

function formatCredentialTypeLabel(t: PlatformCredentialType) {
  if (t === 'PERSONAL') return '个人凭证'
  if (t === 'SERVICE_ACCOUNT') return '服务账号'
  if (t === 'TEMPORARY') return '临时凭证'
  return String(t)
}

function statusBadgeClass(c: PlatformCredentialResponse | null) {
  const s = accessStatusLabel(c)
  if (s === 'ok') return 'badge-green'
  if (s === 'expiring') return 'badge-yellow'
  if (s === 'unused') return 'badge-gray'
  return 'badge-gray'
}

function statusBadgeText(c: PlatformCredentialResponse | null) {
  const s = accessStatusLabel(c)
  if (s === 'ok') return '✅ 正常'
  if (s === 'expiring') {
    const d = c ? daysUntil(c.expiresAt) : null
    return d != null ? `⚠️ ${d} 天内过期` : '⚠️ 即将过期'
  }
  if (s === 'unused') return c ? '📦 未接入' : '📦 未发证'
  return '—'
}

function openBatchHint() {
  window.alert(
    '批量操作（原型）：\n· 批量续签即将过期凭证\n· 批量发送接入指南\n· 批量吊销离职成员凭证\n· 导出凭证状态报告\n\n实际能力待对接审批流与邮件服务。',
  )
}
</script>

<template>
  <section class="keys-page" data-testid="platform-credential-page">
    <p v-if="bannerMessage" class="keys-toast" role="status">{{ bannerMessage }}</p>

    <div class="tabs" aria-label="凭证管理 Tab">
      <div
        v-for="t in topTabs"
        :key="t.id"
        class="tab"
        :class="{ active: activeTab === t.id }"
        role="button"
        tabindex="0"
        @click="activeTab = t.id"
        @keydown.enter="activeTab = t.id"
      >
        <span style="margin-right: 6px">{{ t.icon }}</span>
        {{ t.label }}
      </div>
    </div>

    <!-- 成员凭证管理（对齐原型 page-keys / cred-members） -->
    <div v-if="activeTab === 'members'" class="keys-tab-panel">
      <div class="keys-callout keys-callout--primary">
        💡 <strong>凭证模型：一人一证，多项目共用。</strong>凭证在成员加入平台时自动生成，添加到项目时自动扩展访问权限。成员无需为不同项目切换凭证。
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">🪪</div>
          <div class="stat-label">活跃平台凭证</div>
          <div class="stat-value" style="color: var(--primary)">{{ statActiveCount }}</div>
          <div class="stat-delta">按当前成员列表汇总</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">⚠️</div>
          <div class="stat-label">即将过期（≤7天）</div>
          <div class="stat-value" style="color: var(--warning)">{{ statExpiringCount }}</div>
          <div class="stat-delta" :class="{ down: statExpiringCount > 0 }">需提醒续签</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🔑</div>
          <div class="stat-label">本月轮换次数</div>
          <div class="stat-value">—</div>
          <div class="stat-delta">详见审计安全模块</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">📊</div>
          <div class="stat-label">平均接入耗时</div>
          <div class="stat-value" style="color: var(--success)">—</div>
          <div class="stat-delta">待接入埋点</div>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-header"><span class="card-title">⚙️ 凭证策略</span></div>
          <div class="card-body" style="padding: 0 16px">
            <div class="skill-item">
              <div style="flex: 1">
                <div class="skill-name">默认有效期</div>
                <div class="skill-desc">新凭证默认有效 90 天，支持续签</div>
              </div>
              <select style="width: auto; padding: 3px 8px; font-size: 12px">
                <option>30 天</option>
                <option selected>90 天</option>
                <option>180 天</option>
              </select>
            </div>
            <div class="skill-item">
              <div style="flex: 1">
                <div class="skill-name">自动续签</div>
                <div class="skill-desc">凭证到期前 7 天自动续签一次</div>
              </div>
              <span class="keys-toggle keys-toggle--on" aria-hidden="true"><span class="keys-toggle-knob" /></span>
            </div>
            <div class="skill-item">
              <div style="flex: 1">
                <div class="skill-name">过期提醒</div>
                <div class="skill-desc">提前 7 天通过邮件和站内信提醒</div>
              </div>
              <span class="keys-toggle keys-toggle--on" aria-hidden="true"><span class="keys-toggle-knob" /></span>
            </div>
            <div class="skill-item">
              <div style="flex: 1">
                <div class="skill-name">闲置凭证自动吊销</div>
                <div class="skill-desc">超过 30 天无活动自动吊销</div>
              </div>
              <span class="keys-toggle" aria-hidden="true"><span class="keys-toggle-knob" /></span>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">📊 凭证健康度</span></div>
          <div class="card-body">
            <div style="margin-bottom: 12px">
              <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px">
                <span>✅ 正常使用</span><span style="font-weight: 600">{{ healthOk }} / {{ healthTotal }}</span>
              </div>
              <div style="background: var(--bg); border-radius: 4px; height: 8px">
                <div
                  style="background: var(--success); height: 100%; border-radius: 4px"
                  :style="{ width: healthPct(healthOk) }"
                />
              </div>
            </div>
            <div style="margin-bottom: 12px">
              <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px">
                <span>⚠️ 即将过期</span><span style="font-weight: 600">{{ healthExpiring }} / {{ healthTotal }}</span>
              </div>
              <div style="background: var(--bg); border-radius: 4px; height: 8px">
                <div
                  style="background: var(--warning); height: 100%; border-radius: 4px"
                  :style="{ width: healthPct(healthExpiring) }"
                />
              </div>
            </div>
            <div style="margin-bottom: 12px">
              <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px">
                <span>📦 已配置未使用</span><span style="font-weight: 600">{{ healthIdle }} / {{ healthTotal }}</span>
              </div>
              <div style="background: var(--bg); border-radius: 4px; height: 8px">
                <div
                  style="background: var(--primary); height: 100%; border-radius: 4px"
                  :style="{ width: healthPct(healthIdle) }"
                />
              </div>
            </div>
            <div>
              <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px">
                <span>❌ 未完成接入</span><span style="font-weight: 600">{{ healthNoCred }} / {{ healthTotal }}</span>
              </div>
              <div style="background: var(--bg); border-radius: 4px; height: 8px">
                <div
                  style="background: var(--danger); height: 100%; border-radius: 4px"
                  :style="{ width: healthPct(healthNoCred) }"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title">成员凭证状态</span>
          <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center">
            <select v-model="memberStatusFilter" style="width: auto; padding: 3px 8px; font-size: 12px">
              <option value="all">全部状态</option>
              <option value="ok">正常</option>
              <option value="expiring">即将过期</option>
              <option value="unused">未接入 / 未发证</option>
            </select>
            <button class="btn" type="button" style="padding: 3px 10px; font-size: 12px" @click="openBatchHint">
              📦 批量操作
            </button>
            <button class="btn btn-primary" type="button" style="font-size: 12px; padding: 5px 12px" @click="openCreateCredentialModal('PERSONAL')">
              + 为成员生成凭证
            </button>
          </div>
        </div>
        <div class="card-body" style="padding: 0">
          <table>
            <thead>
              <tr>
                <th>成员</th>
                <th>凭证 ID</th>
                <th>可访问项目</th>
                <th>接入状态</th>
                <th>有效期</th>
                <th>本月用量</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="{ user, personal } in memberRowsFiltered" :key="user.id">
                <td>
                  <strong>{{ userDisplayName(user) }}</strong>
                  <div style="font-size: 11px; color: var(--sub)">{{ user.jobTitle ?? user.platformRole ?? '—' }}</div>
                </td>
                <td>
                  <code v-if="personal" style="font-size: 11px">{{ personal.keyPrefix }}</code>
                  <span v-else style="color: var(--sub)">—</span>
                </td>
                <td>
                  <template v-if="personal?.boundProjectId != null">
                    <span class="badge badge-blue" style="font-size: 10px">{{ projectNameForId(personal.boundProjectId) }}</span>
                  </template>
                  <span v-else-if="personal" class="badge badge-blue" style="font-size: 10px">平台共享</span>
                  <span v-else style="color: var(--sub)">—</span>
                </td>
                <td><span class="badge" :class="statusBadgeClass(personal)">{{ statusBadgeText(personal) }}</span></td>
                <td :style="accessStatusLabel(personal) === 'expiring' ? { color: 'var(--danger)' } : {}">
                  {{ personal?.expiresAt ?? '—' }}
                </td>
                <td>{{ formatTokens(personal?.usedTokensThisMonth ?? null) }}</td>
                <td>
                  <button
                    v-if="personal"
                    class="btn"
                    type="button"
                    style="padding: 3px 8px; font-size: 11px"
                    @click="openDetailModal(personal, user)"
                  >
                    详情
                  </button>
                  <button
                    v-if="personal && accessStatusLabel(personal) === 'expiring'"
                    class="btn"
                    type="button"
                    style="padding: 3px 8px; font-size: 11px"
                    @click="openRenewModal(personal.id)"
                  >
                    续签
                  </button>
                  <button
                    v-if="personal"
                    class="btn"
                    type="button"
                    style="padding: 3px 8px; font-size: 11px"
                    @click="openRevokeCredentialModal(personal.id)"
                  >
                    吊销
                  </button>
                  <span v-if="!personal" style="color: var(--sub); font-size: 12px">—</span>
                </td>
              </tr>
              <tr v-if="!loading.allCredentials && memberRowsFiltered.length === 0">
                <td colspan="7" style="padding: 18px 12px; color: var(--sub); text-align: center">暂无数据</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 上游 API Key -->
    <div v-else-if="activeTab === 'upstream'" class="keys-tab-panel">
      <div class="keys-callout keys-callout--warn">
        <strong>⚠ 安全架构说明：</strong>此处管理平台持有的上游真实 API Key。成员侧只持有平台凭证（plt_...），平台代理层使用此处 Key 转发请求，<strong>真实 Key 永不下发给成员</strong>。所有操作记录审计日志。
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">🔑</div>
          <div class="stat-label">上游 Key 总数</div>
          <div class="stat-value" style="color: var(--primary)">{{ upstreamKeyCount }}</div>
          <div class="stat-delta">当前所选供应商</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">💰</div>
          <div class="stat-label">本月配额使用</div>
          <div class="stat-value">{{ upstreamUsedRatio != null ? `${upstreamUsedRatio}%` : '—' }}</div>
          <div class="stat-delta">按当前列表估算</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">⚡</div>
          <div class="stat-label">限流 RPM（首条）</div>
          <div class="stat-value" style="font-size: 18px">{{ providerKeys[0]?.rateLimitRpm ?? '—' }}</div>
          <div class="stat-delta">详见各 Key 行</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🛡️</div>
          <div class="stat-label">轮换 / 测试</div>
          <div class="stat-value" style="font-size: 16px">—</div>
          <div class="stat-delta">待对接上游控制台流程</div>
        </div>
      </div>

      <div class="card" style="margin-bottom: 16px">
        <div class="card-header">
          <span class="card-title">🔑 上游 AI 供应商 API Key</span>
          <div style="display: flex; gap: 8px; flex-wrap: wrap">
            <label class="keys-inline-label">
              <span class="keys-inline-label-text">供应商</span>
              <select v-model="selectedProviderId">
                <option v-for="p in providers" :key="p.id" :value="p.id">{{ p.name }} ({{ p.code }})</option>
              </select>
            </label>
            <button class="btn btn-primary" type="button" style="font-size: 12px; padding: 5px 12px" @click="openCreateProviderKeyModal">
              + 添加供应商 Key
            </button>
          </div>
        </div>
        <div class="card-body" style="padding: 0">
          <table>
            <thead>
              <tr>
                <th>供应商 / 标识</th>
                <th>可用模型</th>
                <th>Key 前缀</th>
                <th>月配额</th>
                <th>本月已用</th>
                <th>速率限制</th>
                <th>代理端点</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="k in providerKeys" :key="k.id">
                <td>
                  <div style="font-weight: 600">{{ providers.find((p) => p.id === k.providerId)?.name ?? '—' }}</div>
                  <div style="font-size: 11px; color: var(--sub)">{{ k.label }}</div>
                </td>
                <td>
                  <div style="display: flex; flex-wrap: wrap; gap: 3px">
                    <span
                      v-for="(m, i) in parseModelBadges(k.modelsAllowed).slice(0, 4)"
                      :key="i"
                      class="badge"
                      :class="i === 0 ? 'badge-blue' : 'badge-gray'"
                      style="font-size: 10px"
                    >
                      {{ m }}
                    </span>
                  </div>
                </td>
                <td><code style="font-size: 11px">{{ k.keyPrefix }}</code></td>
                <td>
                  <strong>{{ k.monthlyQuotaTokens >= 1000000 ? `${(k.monthlyQuotaTokens / 1000000).toFixed(0)}M` : k.monthlyQuotaTokens }}</strong>
                </td>
                <td>
                  <div style="font-weight: 600">{{ formatTokens(k.usedTokensMonth).replace(' Token', '') }}</div>
                  <div v-if="k.monthlyQuotaTokens > 0" class="progress-wrap" style="width: 80px; margin-top: 3px">
                    <div
                      class="progress-bar"
                      :style="{ width: `${Math.min(100, Math.round((k.usedTokensMonth / k.monthlyQuotaTokens) * 100))}%` }"
                    />
                  </div>
                </td>
                <td>
                  <div style="font-size: 12px">{{ k.rateLimitRpm }} RPM</div>
                  <div style="font-size: 11px; color: var(--sub)">{{ k.rateLimitTpm }} TPM</div>
                </td>
                <td><code style="font-size: 11px">{{ k.proxyEndpoint || '—' }}</code></td>
                <td>
                  <span class="badge badge-green">{{ k.status }}</span>
                </td>
                <td>
                  <span style="color: var(--sub); font-size: 12px">详情 / 轮换 / 测试（待接入）</span>
                </td>
              </tr>
              <tr v-if="!loading.providerKeys && providerKeys.length === 0">
                <td colspan="9" style="padding: 18px 12px; color: var(--sub); text-align: center">暂无数据</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="keys-footnote">
        💡 故障转移策略、费用趋势与 Key 审计流水与原型一致的能力将挂在「用量看板 / 审计安全」或后续接口，此处保留核心列表与录入。
      </div>
    </div>

    <!-- 服务账号 -->
    <div v-else-if="activeTab === 'service'" class="keys-tab-panel">
      <div class="keys-toolbar">
        <span class="keys-toolbar-desc">管理 CI/CD、自动化脚本、Agent 使用的服务账号凭证</span>
        <button class="btn btn-primary" type="button" style="margin-left: auto" @click="openCreateCredentialModal('SERVICE_ACCOUNT')">
          + 创建服务账号
        </button>
        <button class="btn" type="button" @click="openCreateCredentialModal('TEMPORARY')">+ 创建临时凭证</button>
      </div>

      <div class="card">
        <div class="card-body" style="padding: 0">
          <table>
            <thead>
              <tr>
                <th>服务账号</th>
                <th>绑定项目</th>
                <th>凭证类型</th>
                <th>创建时间</th>
                <th>最后使用</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="{ user, c } in serviceRows" :key="c.id">
                <td>
                  <strong>{{ c.name || c.keyPrefix }}</strong>
                  <div style="font-size: 11px; color: var(--sub)">{{ userDisplayName(user) }}</div>
                </td>
                <td>
                  <span v-if="c.boundProjectId != null" class="badge badge-blue">{{ projectNameForId(c.boundProjectId) }}</span>
                  <span v-else class="badge badge-blue">全局</span>
                </td>
                <td>{{ formatCredentialTypeLabel(c.credentialType) }}</td>
                <td>{{ c.createdAt?.slice(0, 10) ?? '—' }}</td>
                <td>{{ c.lastUsedAt ?? '—' }}</td>
                <td><span class="badge badge-green">{{ c.status }}</span></td>
                <td>
                  <button class="btn" type="button" style="padding: 3px 8px; font-size: 11px" @click="openDetailModal(c, user)">详情</button>
                  <button class="btn" type="button" style="padding: 3px 8px; font-size: 11px" @click="openRotateModal(c.id)">轮换</button>
                  <button class="btn btn-danger" type="button" style="padding: 3px 8px; font-size: 11px" @click="openRevokeCredentialModal(c.id)">
                    吊销
                  </button>
                </td>
              </tr>
              <tr v-if="!loading.allCredentials && serviceRows.length === 0">
                <td colspan="7" style="padding: 18px 12px; color: var(--sub); text-align: center">暂无数据</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="keys-footnote">
        💡 <strong>凭证类型说明：</strong>个人凭证（30/90 天，绑定员工身份）· 服务账号（自定义有效期，绑定项目角色，需审批）· 临时凭证（24h，权限受限，无需审批）
      </div>
    </div>

    <!-- 配额策略 -->
    <div v-else class="keys-tab-panel">
      <div class="keys-callout keys-callout--primary">
        💡 <strong>双维度配额模型</strong>：个人上限（平台管理员管控）+ 项目池（项目经理管控），每次 API 调用同时扣减两个池，任一触顶即限流。
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-header"><span class="card-title">👤 个人配额策略（全局默认）</span></div>
          <div class="card-body" style="padding: 0 16px">
            <div class="skill-item">
              <div style="flex: 1"><div class="skill-name">开发者 (Developer)</div><div class="skill-desc">默认个人月上限</div></div>
              <div style="display: flex; align-items: center; gap: 8px">
                <input value="200K" readonly style="width: 80px; padding: 3px 8px; font-size: 12px; text-align: right" />
                <span style="font-size: 12px; color: var(--sub)">Token/月</span>
              </div>
            </div>
            <div class="skill-item">
              <div style="flex: 1"><div class="skill-name">测试 (QA)</div><div class="skill-desc">默认个人月上限</div></div>
              <div style="display: flex; align-items: center; gap: 8px">
                <input value="100K" readonly style="width: 80px; padding: 3px 8px; font-size: 12px; text-align: right" />
                <span style="font-size: 12px; color: var(--sub)">Token/月</span>
              </div>
            </div>
            <div class="skill-item">
              <div style="flex: 1"><div class="skill-name">产品 (PM)</div><div class="skill-desc">默认个人月上限</div></div>
              <div style="display: flex; align-items: center; gap: 8px">
                <input value="100K" readonly style="width: 80px; padding: 3px 8px; font-size: 12px; text-align: right" />
                <span style="font-size: 12px; color: var(--sub)">Token/月</span>
              </div>
            </div>
            <div class="skill-item">
              <div style="flex: 1"><div class="skill-name">管理员 (Admin)</div><div class="skill-desc">默认个人月上限</div></div>
              <div style="display: flex; align-items: center; gap: 8px">
                <input value="300K" readonly style="width: 80px; padding: 3px 8px; font-size: 12px; text-align: right" />
                <span style="font-size: 12px; color: var(--sub)">Token/月</span>
              </div>
            </div>
            <div class="skill-item">
              <div style="flex: 1"><div class="skill-name">访客 (Guest)</div><div class="skill-desc">默认个人月上限</div></div>
              <div style="display: flex; align-items: center; gap: 8px">
                <input value="10K" readonly style="width: 80px; padding: 3px 8px; font-size: 12px; text-align: right" />
                <span style="font-size: 12px; color: var(--sub)">Token/月</span>
              </div>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">📁 项目池配额策略（全局默认）</span></div>
          <div class="card-body" style="padding: 0 16px">
            <div class="skill-item">
              <div style="flex: 1"><div class="skill-name">对外产品型项目</div><div class="skill-desc">默认项目池月上限</div></div>
              <div style="display: flex; align-items: center; gap: 8px">
                <input value="500K" readonly style="width: 80px; padding: 3px 8px; font-size: 12px; text-align: right" />
                <span style="font-size: 12px; color: var(--sub)">Token/月</span>
              </div>
            </div>
            <div class="skill-item">
              <div style="flex: 1"><div class="skill-name">内部系统型项目</div><div class="skill-desc">默认项目池月上限</div></div>
              <div style="display: flex; align-items: center; gap: 8px">
                <input value="300K" readonly style="width: 80px; padding: 3px 8px; font-size: 12px; text-align: right" />
                <span style="font-size: 12px; color: var(--sub)">Token/月</span>
              </div>
            </div>
            <div class="skill-item">
              <div style="flex: 1"><div class="skill-name">技术中台型项目</div><div class="skill-desc">默认项目池月上限</div></div>
              <div style="display: flex; align-items: center; gap: 8px">
                <input value="800K" readonly style="width: 80px; padding: 3px 8px; font-size: 12px; text-align: right" />
                <span style="font-size: 12px; color: var(--sub)">Token/月</span>
              </div>
            </div>
            <div class="skill-item">
              <div style="flex: 1">
                <div class="skill-name">超额自动扩容</div>
                <div class="skill-desc">项目池用完后自动扩容 20%（需审批）</div>
              </div>
              <span class="keys-toggle" aria-hidden="true"><span class="keys-toggle-knob" /></span>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title">📊 全平台配额消耗总览</span>
          <span style="font-size: 12px; color: var(--sub)">（示意，待对接项目维度用量接口）</span>
        </div>
        <div class="card-body" style="padding: 0">
          <table>
            <thead>
              <tr>
                <th>项目</th>
                <th>类型</th>
                <th>项目池</th>
                <th>已用</th>
                <th>使用率</th>
                <th>活跃成员</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in projects" :key="p.id">
                <td>
                  <strong>{{ p.name }}</strong>
                </td>
                <td><span class="badge badge-blue" style="font-size: 10px">—</span></td>
                <td>—</td>
                <td>—</td>
                <td>—</td>
                <td>—</td>
                <td><span class="badge badge-gray">待接入</span></td>
              </tr>
              <tr v-if="projects.length === 0">
                <td colspan="7" style="padding: 18px 12px; color: var(--sub); text-align: center">暂无项目数据</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card" style="margin-top: 16px">
        <div class="card-header">
          <span class="card-title">成员配额明细（后端数据）</span>
          <button class="btn btn-primary" type="button" style="font-size: 12px; padding: 5px 12px" @click="openCreateMemberQuotaModal">+ 新建配额</button>
        </div>
        <div class="card-body" style="padding-top: 0">
          <div class="keys-quota-filters">
            <label class="keys-inline-label">
              <span class="keys-inline-label-text">成员</span>
              <select v-model="selectedUserId">
                <option v-for="u in users" :key="u.id" :value="u.id">{{ userDisplayName(u) }}</option>
              </select>
            </label>
            <label class="keys-inline-label">
              <span class="keys-inline-label-text">配额范围</span>
              <select v-model="quotaScope">
                <option value="user">个人总配额</option>
                <option value="project">项目内配额</option>
              </select>
            </label>
            <label v-if="quotaScope === 'project'" class="keys-inline-label">
              <span class="keys-inline-label-text">项目</span>
              <select v-model="selectedProjectId">
                <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.name }}</option>
              </select>
            </label>
          </div>
          <table>
            <thead>
              <tr>
                <th>配额类型</th>
                <th>上限</th>
                <th>已使用</th>
                <th>重置周期</th>
                <th>最后重置</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="q in memberQuotas" :key="q.id">
                <td>{{ q.quotaType }}</td>
                <td>{{ q.quotaLimit }}</td>
                <td>{{ q.usedAmount }}</td>
                <td>{{ q.resetCycle }}</td>
                <td>{{ q.lastResetAt ?? '—' }}</td>
                <td>{{ q.status }}</td>
              </tr>
              <tr v-if="!loading.quotas && memberQuotas.length === 0">
                <td colspan="6" style="padding: 18px 12px; color: var(--sub); text-align: center">暂无数据</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="keys-quota-actions">
        <button class="btn" type="button" @click="showBanner('配额策略已保存（本地预览，待对接全局策略接口）')">💾 保存策略</button>
      </div>
    </div>

    <!-- Modals -->
    <div v-if="modalOpen()" class="modal open" role="dialog" aria-modal="true" @click.self="closeModal">
      <div class="modal-box keys-modal-wide">
        <div class="modal-title" v-if="modal.kind === 'create-credential'">
          新增 {{ createCredentialKind === 'SERVICE_ACCOUNT' ? '服务账号' : createCredentialKind === 'TEMPORARY' ? '临时凭证' : '成员凭证' }}
        </div>
        <div class="modal-title" v-else-if="modal.kind === 'revoke-credential'">吊销凭证</div>
        <div class="modal-title" v-else-if="modal.kind === 'renew-credential'">续签凭证</div>
        <div class="modal-title" v-else-if="modal.kind === 'rotate-credential'">轮换凭证</div>
        <div class="modal-title" v-else-if="modal.kind === 'credential-detail'">凭证详情</div>
        <div class="modal-title" v-else-if="modal.kind === 'create-provider-key'">添加供应商 Key</div>
        <div class="modal-title" v-else-if="modal.kind === 'create-member-quota'">新建配额</div>

        <div v-if="modal.kind === 'create-credential'">
          <p class="modal-desc">创建后仅返回一次明文 Key，请务必立即保存。</p>

          <label class="form-group">
            <span class="form-label">成员</span>
            <select v-model="createCredentialForm.userId">
              <option v-for="u in users" :key="u.id" :value="u.id">{{ userDisplayName(u) }}</option>
            </select>
          </label>

          <label class="form-group">
            <span class="form-label">名称（可选）</span>
            <input v-model="createCredentialForm.name" placeholder="例：claude-personal-01" />
          </label>

          <label class="form-group">
            <span class="form-label">绑定项目 ID（可选）</span>
            <input v-model="createCredentialForm.boundProjectId" placeholder="不填则为平台级/未绑定" />
          </label>

          <p v-if="createCredentialForm.error" class="form-error">{{ createCredentialForm.error }}</p>
          <div class="modal-actions" style="margin-top: 16px">
            <button class="btn" type="button" @click="closeModal" :disabled="createCredentialForm.submitting">取消</button>
            <button class="btn btn-primary" type="button" @click="submitCreateCredential" :disabled="createCredentialForm.submitting">
              {{ createCredentialForm.submitting ? '创建中...' : '创建' }}
            </button>
          </div>

          <div v-if="createCredentialForm.plainKey" style="margin-top: 14px">
            <div style="font-size: 12px; color: var(--sub); margin-bottom: 6px">明文 Key（仅展示一次）</div>
            <pre class="code-block" style="white-space: pre-wrap">{{ createCredentialForm.plainKey }}</pre>
          </div>
        </div>

        <div v-else-if="modal.kind === 'revoke-credential'">
          <p class="modal-desc">吊销后将阻止该凭证继续使用。可填写原因用于审计留痕。</p>
          <label class="form-group">
            <span class="form-label">吊销原因</span>
            <textarea v-model="revokeReason" rows="3" placeholder="例：密钥泄露风险/离职/轮换到新版本" />
          </label>

          <p v-if="revokeError" class="form-error">{{ revokeError }}</p>
          <div class="modal-actions" style="margin-top: 16px">
            <button class="btn" type="button" @click="closeModal" :disabled="revokeSubmitting">取消</button>
            <button class="btn btn-primary" type="button" @click="submitRevokeCredential" :disabled="revokeSubmitting">
              {{ revokeSubmitting ? '吊销中...' : '确认吊销' }}
            </button>
          </div>
        </div>

        <div v-else-if="modal.kind === 'renew-credential'">
          <p class="modal-desc">延长凭证有效期（按后端支持的续签天数）。</p>
          <label class="form-group">
            <span class="form-label">续签天数</span>
            <select v-model="renewForm.renewDays">
              <option :value="30">30 天</option>
              <option :value="90">90 天</option>
              <option :value="180">180 天</option>
            </select>
          </label>
          <p v-if="renewForm.error" class="form-error">{{ renewForm.error }}</p>
          <div class="modal-actions" style="margin-top: 16px">
            <button class="btn" type="button" @click="closeModal" :disabled="renewForm.submitting">取消</button>
            <button class="btn btn-primary" type="button" @click="submitRenewCredential" :disabled="renewForm.submitting">
              {{ renewForm.submitting ? '提交中...' : '确认续签' }}
            </button>
          </div>
        </div>

        <div v-else-if="modal.kind === 'rotate-credential'">
          <p class="modal-desc">将生成新凭证并废弃旧凭证；新明文仅展示一次。</p>
          <p v-if="rotateForm.error" class="form-error">{{ rotateForm.error }}</p>
          <div class="modal-actions" style="margin-top: 16px">
            <button class="btn" type="button" @click="closeModal" :disabled="rotateForm.submitting">关闭</button>
            <button
              v-if="!rotateForm.plainKey"
              class="btn btn-primary"
              type="button"
              @click="submitRotateCredential"
              :disabled="rotateForm.submitting"
            >
              {{ rotateForm.submitting ? '处理中...' : '确认轮换' }}
            </button>
          </div>
          <div v-if="rotateForm.plainKey" style="margin-top: 14px">
            <div style="font-size: 12px; color: var(--sub); margin-bottom: 6px">新明文 Key</div>
            <pre class="code-block" style="white-space: pre-wrap">{{ rotateForm.plainKey }}</pre>
          </div>
        </div>

        <div v-else-if="modal.kind === 'credential-detail'">
          <dl class="keys-detail-dl">
            <dt>成员</dt>
            <dd>{{ userDisplayName(modal.user) }}</dd>
            <dt>前缀</dt>
            <dd><code>{{ modal.credential.keyPrefix }}</code></dd>
            <dt>类型</dt>
            <dd>{{ formatCredentialTypeLabel(modal.credential.credentialType) }}</dd>
            <dt>状态</dt>
            <dd>{{ modal.credential.status }}</dd>
            <dt>有效期</dt>
            <dd>{{ modal.credential.expiresAt ?? '—' }}</dd>
            <dt>最后使用</dt>
            <dd>{{ modal.credential.lastUsedAt ?? '—' }}</dd>
            <dt>本月用量</dt>
            <dd>{{ formatTokens(modal.credential.usedTokensThisMonth ?? null) }}</dd>
          </dl>
          <div class="modal-actions">
            <button class="btn btn-primary" type="button" @click="closeModal">关闭</button>
          </div>
        </div>

        <div v-else-if="modal.kind === 'create-provider-key'">
          <p class="modal-desc">创建后仅返回密钥前缀与管理信息；明文不再回传。</p>

          <div class="form-group">
            <span class="form-label">Key 名称</span>
            <input v-model="createProviderKeyForm.label" placeholder="例：claude-prod-main" />
          </div>
          <div class="form-group">
            <span class="form-label">API Key 明文</span>
            <input v-model="createProviderKeyForm.apiKey" placeholder="请输入上游密钥明文" />
          </div>
          <div class="form-group">
            <span class="form-label">允许模型（JSON 字符串，可选）</span>
            <textarea v-model="createProviderKeyForm.modelsAllowed" rows="3" placeholder='例：["Claude-3","GPT-4"]' />
          </div>
          <div class="form-group">
            <span class="form-label">月度配额（tokens）</span>
            <input v-model.number="createProviderKeyForm.monthlyQuotaTokens" type="number" min="0" />
          </div>
          <div class="form-group">
            <span class="form-label">限流 RPM</span>
            <input v-model.number="createProviderKeyForm.rateLimitRpm" type="number" min="0" />
          </div>
          <div class="form-group">
            <span class="form-label">限流 TPM</span>
            <input v-model.number="createProviderKeyForm.rateLimitTpm" type="number" min="0" />
          </div>
          <div class="form-group">
            <span class="form-label">代理端点（可选）</span>
            <input v-model="createProviderKeyForm.proxyEndpoint" placeholder="例：https://proxy.example.com" />
          </div>

          <p v-if="createProviderKeyForm.error" class="form-error">{{ createProviderKeyForm.error }}</p>
          <div class="modal-actions" style="margin-top: 16px">
            <button class="btn" type="button" @click="closeModal" :disabled="createProviderKeyForm.submitting">取消</button>
            <button class="btn btn-primary" type="button" @click="submitCreateProviderKey" :disabled="createProviderKeyForm.submitting">
              {{ createProviderKeyForm.submitting ? '创建中...' : '创建' }}
            </button>
          </div>
        </div>

        <div v-else-if="modal.kind === 'create-member-quota'">
          <p class="modal-desc">为当前所选成员创建/补充配额策略（按后端规则：userId 必填，projectId 可选）。</p>

          <label class="form-group">
            <span class="form-label">配额类型</span>
            <select v-model="createQuotaForm.quotaType">
              <option value="TOKEN_QUOTA">TOKEN_QUOTA</option>
              <option value="COST_QUOTA">COST_QUOTA</option>
              <option value="REQUEST_QUOTA">REQUEST_QUOTA</option>
            </select>
          </label>

          <label class="form-group">
            <span class="form-label">配额上限</span>
            <input v-model.number="createQuotaForm.quotaLimit" type="number" min="0" />
          </label>

          <label class="form-group">
            <span class="form-label">重置周期</span>
            <select v-model="createQuotaForm.resetCycle">
              <option value="DAILY">DAILY</option>
              <option value="WEEKLY">WEEKLY</option>
              <option value="MONTHLY">MONTHLY</option>
            </select>
          </label>

          <p v-if="createQuotaForm.error" class="form-error">{{ createQuotaForm.error }}</p>
          <div class="modal-actions" style="margin-top: 16px">
            <button class="btn" type="button" @click="closeModal" :disabled="createQuotaForm.submitting">取消</button>
            <button class="btn btn-primary" type="button" @click="submitCreateMemberQuota" :disabled="createQuotaForm.submitting">
              {{ createQuotaForm.submitting ? '创建中...' : '创建配额' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <PlaceholderState
      v-if="(loading.users && users.length === 0) || (loading.providers && providers.length === 0)"
      title="加载中…"
      description="正在从后端拉取成员与供应商数据。"
      eyebrow="凭证管理"
      :highlights="[]"
    />
  </section>
</template>

<style scoped>
.keys-page {
  padding: 4px 0 28px;
}

.keys-toast {
  margin: 0 0 12px;
  padding: 10px 14px;
  border-radius: 10px;
  background: var(--primary-light);
  border: 1px solid var(--primary);
  font-size: 13px;
  color: var(--text);
}

.keys-tab-panel {
  margin-top: 0;
}

.keys-callout {
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 16px;
  font-size: 12px;
  line-height: 1.65;
}

.keys-callout--primary {
  background: var(--primary-light);
  border: 1px solid var(--primary);
}

.keys-callout--warn {
  background: #fffaeb;
  border: 1px solid #fec84b;
  color: #b54708;
}

.keys-toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  align-items: center;
  flex-wrap: wrap;
}

.keys-toolbar-desc {
  font-size: 13px;
  color: var(--sub);
}

.keys-footnote {
  margin-top: 16px;
  background: var(--bg);
  border-radius: 8px;
  padding: 12px 16px;
  font-size: 12px;
  color: var(--sub);
  line-height: 1.65;
}

.keys-inline-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
}

.keys-inline-label-text {
  color: var(--sub);
  font-weight: 600;
}

.keys-quota-filters {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 16px;
  align-items: flex-end;
}

.keys-quota-actions {
  margin-top: 16px;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.keys-toggle {
  display: inline-block;
  width: 36px;
  height: 20px;
  border-radius: 10px;
  background: var(--border);
  position: relative;
  flex-shrink: 0;
}

.keys-toggle--on {
  background: #12b76a;
}

.keys-toggle-knob {
  position: absolute;
  width: 16px;
  height: 16px;
  background: white;
  border-radius: 50%;
  top: 2px;
  left: 2px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
}

.keys-toggle--on .keys-toggle-knob {
  left: auto;
  right: 2px;
}

.keys-modal-wide.modal-box {
  max-width: 520px;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.form-error {
  color: var(--danger);
  font-size: 13px;
  margin-top: 8px;
}

.keys-detail-dl {
  display: grid;
  grid-template-columns: 100px 1fr;
  gap: 8px 12px;
  font-size: 13px;
  margin: 0;
}

.keys-detail-dl dt {
  margin: 0;
  color: var(--sub);
  font-weight: 600;
}

.keys-detail-dl dd {
  margin: 0;
}
</style>
