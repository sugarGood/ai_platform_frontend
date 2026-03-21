<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'

import PlaceholderState from '../../components/ui/PlaceholderState.vue'
import { listProjects } from '../../services/projects'
import { listUsers } from '../../services/users'
import { createPlatformCredential, listPlatformCredentialsByUser, revokePlatformCredential } from '../../services/platform-credentials'
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

const credentialList = ref<PlatformCredentialResponse[]>([])
const providerKeys = ref<ProviderApiKeyResponse[]>([])
const memberQuotas = ref<MemberAiQuotaResponse[]>([])

const loading = reactive({
  users: false,
  credentials: false,
  providers: false,
  providerKeys: false,
  projects: false,
  quotas: false,
})

function tabCredentialType(t: KeysTab): PlatformCredentialType {
  if (t === 'service') return 'SERVICE_ACCOUNT'
  if (t === 'members') return 'PERSONAL'
  // upstream/quota tabs are not credentialType-filtered
  return 'PERSONAL'
}

const filteredCredentials = computed(() => {
  if (!selectedUserId.value) return []
  if (activeTab.value !== 'members' && activeTab.value !== 'service') return []

  const type = tabCredentialType(activeTab.value)
  const list = credentialList.value.filter((c) => c.userId === selectedUserId.value && c.credentialType === type)
  return list
})

// (selectedProvider/selectedUser could be used for more advanced UI later)

// ---- Create Credential Modal ----
const createCredentialForm = reactive({
  name: '',
  boundProjectId: '' as string,
  error: '',
  submitting: false,
  plainKey: '',
})

const createCredentialType = computed(() => {
  if (activeTab.value === 'service') return 'SERVICE_ACCOUNT'
  return 'PERSONAL'
})

function openCreateCredentialModal() {
  createCredentialForm.name = ''
  createCredentialForm.boundProjectId = ''
  createCredentialForm.error = ''
  createCredentialForm.submitting = false
  createCredentialForm.plainKey = ''
  modal.value = { kind: 'create-credential' }
}

async function submitCreateCredential() {
  if (!selectedUserId.value) return

  createCredentialForm.error = ''
  createCredentialForm.submitting = true
  try {
    const boundProjectId = createCredentialForm.boundProjectId.trim()
      ? Number(createCredentialForm.boundProjectId.trim())
      : null

    const res = await createPlatformCredential({
      userId: selectedUserId.value,
      credentialType: createCredentialType.value,
      name: createCredentialForm.name.trim() || undefined,
      boundProjectId,
    })

    createCredentialForm.plainKey = res.plainKey
    await refreshCredentials()
  } catch (e) {
    createCredentialForm.error = e instanceof Error ? e.message : '创建失败，请稍后重试。'
  } finally {
    createCredentialForm.submitting = false
  }
}

// ---- Revoke Credential Modal ----
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
    await refreshCredentials()
  } catch (e) {
    revokeError.value = e instanceof Error ? e.message : '吊销失败，请稍后重试。'
  } finally {
    revokeSubmitting.value = false
  }
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

    // backend create returns quota but list refresh is simpler & consistent
    void res
    modal.value = { kind: 'none' }
    await refreshQuotas()
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
  } finally {
    loading.users = false
  }
}

async function refreshCredentials() {
  if (!selectedUserId.value) return
  loading.credentials = true
  try {
    credentialList.value = await listPlatformCredentialsByUser(selectedUserId.value)
  } finally {
    loading.credentials = false
  }
}

async function refreshProviders() {
  loading.providers = true
  try {
    providers.value = await listProviders()
    if (!selectedProviderId.value && providers.value.length) selectedProviderId.value = providers.value[0].id
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
    if (!selectedProjectId.value && projects.value.length) selectedProjectId.value = projects.value[0].id
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
  // Load dropdown dependencies first.
  await refreshUsers()
  if (users.value.length && selectedUserId.value == null) selectedUserId.value = users.value[0].id

  // Data for other tabs.
  void refreshProviders()
  void refreshProjects()

  void refreshCredentials()
  void refreshProviderKeys()
  void refreshQuotas()
})

watch(selectedUserId, async () => {
  await refreshCredentials()
  await refreshQuotas()
})

watch(selectedProviderId, async () => {
  await refreshProviderKeys()
})

watch([quotaScope, selectedProjectId], async () => {
  await refreshQuotas()
})

const pageTitle = computed(() => '凭证管理')

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

watch(modal, () => {
  // Best-effort focus management for modal inputs could be added later.
}, { deep: true })

function formatCredentialTypeLabel(t: PlatformCredentialType) {
  if (t === 'PERSONAL') return '成员凭证'
  if (t === 'SERVICE_ACCOUNT') return '服务账号'
  if (t === 'TEMPORARY') return '临时凭证'
  return t
}
</script>

<template>
  <section class="keys-page" data-testid="platform-credential-page">
    <header class="keys-hero">
      <div class="keys-hero-left">
        <div class="keys-hero-eyebrow">{{ pageTitle }}</div>
        <div class="keys-hero-title">统一管理成员平台凭证、上游 API Key、服务账号、配额策略与使用审计</div>
        <div class="keys-hero-sub">对齐原型交互：切换 Tab、选择成员/供应商/项目、创建与吊销动作均可联动后端。</div>
      </div>
      <div class="keys-hero-right">
        <button class="btn btn-primary" type="button" @click="openCreateCredentialModal" v-if="activeTab === 'members' || activeTab === 'service'">
          + 新增 Key
        </button>
        <button class="btn btn-primary" type="button" @click="openCreateProviderKeyModal" v-else-if="activeTab === 'upstream'">
          + 创建上游 Key
        </button>
        <button class="btn btn-primary" type="button" @click="openCreateMemberQuotaModal" v-else>
          + 新建配额
        </button>
      </div>
    </header>

    <div class="tabs" aria-label="keys tabs">
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

    <!-- Members credentials -->
    <div class="page active" v-if="activeTab === 'members'">
      <div class="panel-row">
        <label class="form-group">
          <span class="form-label">成员</span>
          <select v-model="selectedUserId">
            <option v-for="u in users" :key="u.id" :value="u.id">
              {{ u.fullName ?? u.username ?? `用户 #${u.id}` }}
            </option>
          </select>
        </label>
      </div>

      <div class="table-shell" style="margin-top: 16px">
        <table class="module-table">
          <thead>
            <tr>
              <th>凭证</th>
              <th>类型</th>
              <th>绑定项目</th>
              <th>状态</th>
              <th>过期时间</th>
              <th>最近使用</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in filteredCredentials" :key="c.id">
              <td>{{ c.keyPrefix }}</td>
              <td>{{ formatCredentialTypeLabel(c.credentialType) }}</td>
              <td>{{ c.boundProjectId ?? '—' }}</td>
              <td>{{ c.status }}</td>
              <td>{{ c.expiresAt ?? '—' }}</td>
              <td>{{ c.lastUsedAt ?? '—' }}</td>
              <td>
                <button class="btn" type="button" style="padding:4px 10px" @click="openRevokeCredentialModal(c.id)">
                  吊销
                </button>
              </td>
            </tr>
            <tr v-if="!loading.credentials && filteredCredentials.length === 0">
              <td colspan="7" style="padding: 18px 12px; color: var(--sub); text-align: center">暂无数据</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Service accounts (same credential endpoint, client-filtered by credentialType) -->
    <div class="page active" v-else-if="activeTab === 'service'">
      <div class="panel-row">
        <label class="form-group">
          <span class="form-label">成员</span>
          <select v-model="selectedUserId">
            <option v-for="u in users" :key="u.id" :value="u.id">
              {{ u.fullName ?? u.username ?? `用户 #${u.id}` }}
            </option>
          </select>
        </label>
      </div>

      <div class="table-shell" style="margin-top: 16px">
        <table class="module-table">
          <thead>
            <tr>
              <th>账号</th>
              <th>作用域</th>
              <th>状态</th>
              <th>过期时间</th>
              <th>最近使用</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in filteredCredentials" :key="c.id">
              <td>{{ c.name || c.keyPrefix }}</td>
              <td>{{ c.boundProjectId ?? '平台级/未绑定' }}</td>
              <td>{{ c.status }}</td>
              <td>{{ c.expiresAt ?? '—' }}</td>
              <td>{{ c.lastUsedAt ?? '—' }}</td>
              <td>
                <button class="btn" type="button" style="padding:4px 10px" @click="openRevokeCredentialModal(c.id)">
                  吊销
                </button>
              </td>
            </tr>
            <tr v-if="!loading.credentials && filteredCredentials.length === 0">
              <td colspan="6" style="padding: 18px 12px; color: var(--sub); text-align: center">暂无数据</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Upstream provider API keys -->
    <div class="page active" v-else-if="activeTab === 'upstream'">
      <div class="panel-row">
        <label class="form-group">
          <span class="form-label">供应商</span>
          <select v-model="selectedProviderId">
            <option v-for="p in providers" :key="p.id" :value="p.id">
              {{ p.name }} ({{ p.code }})
            </option>
          </select>
        </label>
      </div>

      <div class="table-shell" style="margin-top: 16px">
        <table class="module-table">
          <thead>
            <tr>
              <th>Key 名称</th>
              <th>前缀</th>
              <th>模型</th>
              <th>月度配额</th>
              <th>本月已用</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="k in providerKeys" :key="k.id">
              <td>{{ k.label }}</td>
              <td>{{ k.keyPrefix }}</td>
              <td>{{ k.modelsAllowed }}</td>
              <td>{{ k.monthlyQuotaTokens }}</td>
              <td>{{ k.usedTokensMonth }}</td>
              <td>{{ k.status }}</td>
              <td>
                <span style="color: var(--sub); font-size: 12px">暂未接入轮转</span>
              </td>
            </tr>
            <tr v-if="!loading.providerKeys && providerKeys.length === 0">
              <td colspan="7" style="padding: 18px 12px; color: var(--sub); text-align: center">暂无数据</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Quota strategy -->
    <div class="page active" v-else>
      <div class="panel-row" style="display:flex; gap:16px; flex-wrap: wrap">
        <label class="form-group" style="min-width: 240px">
          <span class="form-label">成员</span>
          <select v-model="selectedUserId">
            <option v-for="u in users" :key="u.id" :value="u.id">
              {{ u.fullName ?? u.username ?? `用户 #${u.id}` }}
            </option>
          </select>
        </label>

        <label class="form-group" style="min-width: 220px">
          <span class="form-label">配额范围</span>
          <select v-model="quotaScope">
            <option value="user">个人总配额</option>
            <option value="project">项目内配额</option>
          </select>
        </label>

        <label v-if="quotaScope === 'project'" class="form-group" style="min-width: 220px">
          <span class="form-label">项目</span>
          <select v-model="selectedProjectId">
            <option v-for="p in projects" :key="p.id" :value="p.id">
              {{ p.name }}
            </option>
          </select>
        </label>
      </div>

      <div class="table-shell" style="margin-top: 16px">
        <table class="module-table">
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

    <!-- Create Credential Modal -->
    <div v-if="modalOpen()" class="modal open" role="dialog" aria-modal="true" @click.self="closeModal">
      <div class="modal-box">
        <div class="modal-title" v-if="modal.kind === 'create-credential'">新增 {{ createCredentialType === 'SERVICE_ACCOUNT' ? '服务账号 Key' : '成员凭证 Key' }}</div>
        <div class="modal-title" v-else-if="modal.kind === 'revoke-credential'">吊销凭证</div>
        <div class="modal-title" v-else-if="modal.kind === 'create-provider-key'">创建上游 API Key</div>
        <div class="modal-title" v-else-if="modal.kind === 'create-member-quota'">新建配额</div>

        <div v-if="modal.kind === 'create-credential'">
          <p class="modal-desc">创建后仅返回一次明文 Key，请务必立即保存。</p>

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
            <button class="btn" type="button" @click="closeModal" :disabled="createCredentialForm.submitting" style="justify-content:center; padding: 8px 14px">
              取消
            </button>
            <button class="btn btn-primary" type="button" @click="submitCreateCredential" :disabled="createCredentialForm.submitting" style="justify-content:center; padding: 8px 14px">
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
            <button class="btn" type="button" @click="closeModal" :disabled="revokeSubmitting" style="justify-content:center; padding: 8px 14px">
              取消
            </button>
            <button class="btn btn-primary" type="button" @click="submitRevokeCredential" :disabled="revokeSubmitting" style="justify-content:center; padding: 8px 14px">
              {{ revokeSubmitting ? '吊销中...' : '确认吊销' }}
            </button>
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
            <button class="btn" type="button" @click="closeModal" :disabled="createProviderKeyForm.submitting" style="justify-content:center; padding: 8px 14px">
              取消
            </button>
            <button class="btn btn-primary" type="button" @click="submitCreateProviderKey" :disabled="createProviderKeyForm.submitting" style="justify-content:center; padding: 8px 14px">
              {{ createProviderKeyForm.submitting ? '创建中...' : '创建' }}
            </button>
          </div>
        </div>

        <div v-else-if="modal.kind === 'create-member-quota'">
          <p class="modal-desc">为当前成员创建/补充配额策略（按后端规则：userId 必填，projectId 可选）。</p>

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
            <button class="btn" type="button" @click="closeModal" :disabled="createQuotaForm.submitting" style="justify-content:center; padding: 8px 14px">
              取消
            </button>
            <button class="btn btn-primary" type="button" @click="submitCreateMemberQuota" :disabled="createQuotaForm.submitting" style="justify-content:center; padding: 8px 14px">
              {{ createQuotaForm.submitting ? '创建中...' : '创建配额' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <PlaceholderState
      v-if="(loading.users && users.length === 0) || (loading.providers && providers.length === 0) || (loading.projects && projects.length === 0)"
      title="加载中…"
      description="正在从后端拉取成员/供应商/项目数据。"
      eyebrow="凭证管理"
      :highlights="[]"
    />
  </section>
</template>

<style scoped>
.keys-page {
  padding: 18px 18px 28px;
}

.keys-hero {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 18px;
}

.keys-hero-left {
  max-width: 720px;
}

.keys-hero-eyebrow {
  font-size: 12px;
  color: var(--sub);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.keys-hero-title {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 6px;
}

.keys-hero-sub {
  color: var(--sub);
  font-size: 13px;
  line-height: 1.7;
}

.keys-hero-right {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
}

.panel-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: flex-end;
}

.modal-box .form-error {
  margin: 10px 0 0;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  flex-wrap: wrap;
}
</style>

