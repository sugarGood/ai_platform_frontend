<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useAuth } from '../../composables/useAuth'
import { fetchMyUsageSummary, listMyUsageEvents } from '../../services/me-usage'
import {
  listPlatformCredentialsByUser,
  renewPlatformCredential,
  rotatePlatformCredential,
} from '../../services/platform-credentials'
import { listProjectMembers, listProjects } from '../../services/projects'
import { listMcpServers } from '../../services/mcp'
import type { PlatformCredentialResponse } from '../../types/credentials'
import type { BackendProjectResponse } from '../../types/project'
import type { AiUsageEventResponse } from '../../types/platform-usage'
import { buildApiUrl } from '../../lib/api-url'
import { getStoredAccessToken } from '../../lib/auth-storage'
import { fetchWithApiTimeout } from '../../lib/fetch-with-api-timeout'

const LS_WORK_PROJECT = 'ai-platform-current-work-project-id'

const isDev = import.meta.env.DEV

const router = useRouter()
const { user, isAuthenticated } = useAuth()

const loading = ref(true)
const loadError = ref<string | null>(null)
const pageHint = ref<string | null>(null)

const credentials = ref<PlatformCredentialResponse[]>([])
const projectsWithRole = ref<
  { project: BackendProjectResponse; role: string | null; member: boolean }[]
>([])
const mcpGlobalUrl = ref<string>('')
const usageSummary = ref<Record<string, unknown> | null>(null)
const usageEvents = ref<AiUsageEventResponse[]>([])

const renewModalOpen = ref(false)
const renewBusy = ref(false)
const rotateBusy = ref(false)
const rotatePlainKey = ref<string | null>(null)

const activeSetupTab = ref<'claude' | 'cursor' | 'codex' | 'oneclick'>('claude')
const workProjectId = ref<number | null>(null)

const primaryCredential = computed(() => {
  const list = credentials.value
  const personal = list.find((c) => String(c.credentialType).toUpperCase() === 'PERSONAL')
  const active = list.find((c) => String(c.status).toUpperCase() === 'ACTIVE')
  return personal ?? active ?? list[0]
})

function publicPlatformOrigin(): string {
  const env = import.meta.env.VITE_PUBLIC_PLATFORM_BASE_URL?.trim()
  if (env) {
    try {
      return new URL(env.startsWith('http') ? env : `https://${env}`).origin
    } catch {
      /* fall through */
    }
  }
  const api = import.meta.env.VITE_API_BASE_URL?.trim() || '/api'
  if (api.startsWith('http')) {
    try {
      return new URL(api).origin
    } catch {
      /* fall through */
    }
  }
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return 'https://ai-platform.com'
}

const platformOrigin = computed(() => publicPlatformOrigin())

const anthropicProxyUrl = computed(() => {
  const v = import.meta.env.VITE_AI_PROXY_URL?.trim()
  if (v) return v
  return `${platformOrigin.value}/api/proxy/anthropic`
})

const openaiProxyUrl = computed(() => `${platformOrigin.value}/api/proxy/openai`)

function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return '—'
  const s = String(iso)
  return s.length >= 10 ? s.slice(0, 10) : s
}

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return null
  return Math.ceil((t - Date.now()) / 86400000)
}

const credentialSubtitle = computed(() => {
  const c = primaryCredential.value
  if (!c) return '尚未创建个人平台凭证'
  const d = daysUntil(c.expiresAt)
  const tail = d != null ? `（剩余 ${d} 天）` : ''
  return `个人凭证 · 有效期至 ${formatDateShort(c.expiresAt)}${tail}`
})

const credentialStatusBadge = computed(() => {
  const c = primaryCredential.value
  if (!c) return '⚠️ 未创建'
  const s = String(c.status).toUpperCase()
  if (s === 'ACTIVE') return '✅ 正常'
  return `状态：${c.status}`
})

const keyDisplay = computed(() => primaryCredential.value?.keyPrefix?.trim() || '（无 key 前缀）')

const accessibleProjects = computed(() => projectsWithRole.value.filter((x) => x.member))

async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let index = 0
  async function worker() {
    for (;;) {
      const i = index++
      if (i >= items.length) break
      const item = items[i]!
      results[i] = await fn(item)
    }
  }
  const n = Math.max(1, Math.min(concurrency, items.length))
  await Promise.all(Array.from({ length: n }, () => worker()))
  return results
}

function readWorkProjectId(): number | null {
  try {
    const raw = localStorage.getItem(LS_WORK_PROJECT)
    if (!raw) return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

function saveWorkProject() {
  if (workProjectId.value == null) {
    localStorage.removeItem(LS_WORK_PROJECT)
  } else {
    localStorage.setItem(LS_WORK_PROJECT, String(workProjectId.value))
  }
  pageHint.value = '已保存。AI 工具下次请求将按所选项目理解上下文（需在工具侧配合项目 MCP）。'
  setTimeout(() => {
    pageHint.value = null
  }, 4000)
}

const currentWorkProject = computed(() => {
  const id = workProjectId.value
  if (id == null) return null
  return accessibleProjects.value.find((x) => x.project.id === id) ?? null
})

const usageAggregates = computed(() => {
  const events = usageEvents.value
  let totalTok = 0
  let calls = 0
  let skillCalls = 0
  let latSum = 0
  let latN = 0
  const byProject = new Map<number, number>()

  for (const e of events) {
    calls += 1
    const tt = e.totalTokens ?? 0
    totalTok += tt
    if (e.skillId != null) skillCalls += 1
    if (e.latencyMs != null && e.latencyMs >= 0) {
      latSum += e.latencyMs
      latN += 1
    }
    if (e.projectId != null) {
      byProject.set(e.projectId, (byProject.get(e.projectId) ?? 0) + tt)
    }
  }

  const avgLat = latN > 0 ? Math.round(latSum / latN) : null

  const rows: { name: string; icon: string; tokens: number; pct: number }[] = []
  if (totalTok > 0) {
    const projById = new Map(accessibleProjects.value.map((x) => [x.project.id, x.project]))
    const sorted = [...byProject.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
    for (const [pid, tok] of sorted) {
      const p = projById.get(pid)
      rows.push({
        name: p?.name ?? `项目 #${pid}`,
        icon: p?.icon?.trim() || '📁',
        tokens: tok,
        pct: Math.round((tok / totalTok) * 1000) / 10,
      })
    }
  }

  const cred = primaryCredential.value
  const quotaTok = cred?.usedTokensThisMonth
  const fallbackDisplay =
    quotaTok != null ? `${(quotaTok / 1000).toFixed(1)}K` : totalTok > 0 ? `${(totalTok / 1000).toFixed(1)}K` : '—'

  return {
    totalTok,
    totalDisplay: totalTok > 0 ? `${(totalTok / 1000).toFixed(1)}K` : fallbackDisplay,
    calls: calls || '—',
    skillCalls: skillCalls || '—',
    avgLat: avgLat != null ? `${avgLat}ms` : '—',
    byProjectRows: rows,
  }
})

const mcpSnippetProjects = computed(() =>
  accessibleProjects.value.slice(0, 8).map((x) => ({
    key: `platform-${x.project.name.replace(/"/g, "'")}`,
    url: `${platformOrigin.value}/mcp/project/${encodeURIComponent(String(x.project.code || x.project.id))}`,
  })),
)

const oneclickCurl = computed(
  () => `curl -fsSL "${platformOrigin.value}/api/setup?token=YOUR_TOKEN" | bash`,
)

const claudeMcpServersJson = computed(() => {
  const k = keyDisplay.value
  const globalU = mcpGlobalUrl.value
  const lines: string[] = [
    `    "platform-global": {`,
    `      "url": ${JSON.stringify(globalU)},`,
    `      "headers": { "Authorization": "Bearer ${k}..." }`,
    `    }`,
  ]
  for (const p of mcpSnippetProjects.value) {
    lines.push(
      `    ${JSON.stringify(p.key)}: {`,
      `      "url": ${JSON.stringify(p.url)},`,
      `      "headers": { "Authorization": "Bearer ${k}..." }`,
      `    }`,
    )
  }
  return `{\n  "mcpServers": {\n${lines.join(',\n')}\n  }\n}`
})

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    pageHint.value = '已复制到剪贴板'
  } catch {
    pageHint.value = '复制失败，请手动选择文本复制'
  }
  setTimeout(() => {
    pageHint.value = null
  }, 2500)
}

function copyRotatedPlainKey() {
  const k = rotatePlainKey.value
  if (k) void copyText(k)
}

async function runConnectivityTest() {
  try {
    const t0 = performance.now()
    const token = getStoredAccessToken()
    const r = await fetchWithApiTimeout(buildApiUrl('/projects?page=1&size=1'), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
    const ms = Math.round(performance.now() - t0)
    pageHint.value = r.ok ? `连通性正常 · API 往返约 ${ms}ms` : `请求完成 · HTTP ${r.status} · ${ms}ms`
  } catch {
    pageHint.value = '连通性测试失败（网络或鉴权）'
  }
  setTimeout(() => {
    pageHint.value = null
  }, 4000)
}

async function onRenew(days: 30 | 90 | 180) {
  const c = primaryCredential.value
  if (!c) return
  renewBusy.value = true
  try {
    const next = await renewPlatformCredential(c.id, days)
    const idx = credentials.value.findIndex((x) => x.id === c.id)
    if (idx >= 0) credentials.value[idx] = next
    renewModalOpen.value = false
    pageHint.value = '续签成功'
  } catch (e) {
    pageHint.value = e instanceof Error ? e.message : String(e)
  } finally {
    renewBusy.value = false
  }
  setTimeout(() => {
    pageHint.value = null
  }, 4000)
}

async function onRotate() {
  const c = primaryCredential.value
  if (!c) return
  if (!window.confirm('轮换后将生成新密钥，旧密钥在宽限期内仍可用。是否继续？')) return
  rotateBusy.value = true
  try {
    const res = await rotatePlatformCredential(c.id)
    rotatePlainKey.value = res.plainKey
    const idx = credentials.value.findIndex((x) => x.id === res.credential.id)
    if (idx >= 0) credentials.value[idx] = res.credential
    pageHint.value = '轮换成功，请保存下方弹窗中的新密钥'
  } catch (e) {
    pageHint.value = e instanceof Error ? e.message : String(e)
  } finally {
    rotateBusy.value = false
  }
}

function enterProject(projectId: number) {
  void router.push({ name: 'project-overview', params: { projectId: String(projectId) } })
}

async function loadAll() {
  const uid = user.value?.id
  if (uid == null) {
    loading.value = false
    return
  }

  loading.value = true
  loadError.value = null

  try {
    const [creds, projPage, servers, summary, eventsPage] = await Promise.all([
      listPlatformCredentialsByUser(uid),
      listProjects(1, 100),
      listMcpServers().catch(() => []),
      fetchMyUsageSummary().catch(() => null),
      listMyUsageEvents(1, 200).catch(() => ({ data: [], total: 0, page: 1, size: 0 })),
    ])

    credentials.value = creds
    usageSummary.value = summary
    usageEvents.value = eventsPage.data ?? []

    const globalSrv = servers.find((s) => (s.projectId == null || s.projectId === 0) && s.serverUrl?.trim())
    mcpGlobalUrl.value =
      globalSrv?.serverUrl?.trim() ?? `${platformOrigin.value}/mcp/global`

    const projects = projPage.data ?? []
    const enriched = await mapPool(projects, 5, async (p) => {
      try {
        const members = await listProjectMembers(p.id)
        const m = members.find((x) => x.userId === uid)
        return { project: p, role: m?.role ?? null, member: Boolean(m) }
      } catch {
        return { project: p, role: null, member: false }
      }
    })
    projectsWithRole.value = enriched

    workProjectId.value = readWorkProjectId()
    if (workProjectId.value != null && !enriched.some((e) => e.project.id === workProjectId.value && e.member)) {
      workProjectId.value = null
    }
    if (workProjectId.value == null) {
      const first = enriched.find((e) => e.member)
      if (first) workProjectId.value = first.project.id
    }
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadAll()
})
</script>

<template>
  <section class="my-cred-root" data-testid="my-credential-page">
    <p v-if="pageHint" class="my-cred-banner">{{ pageHint }}</p>

    <div v-if="!isAuthenticated || !user" class="my-cred-callout">
      <span class="my-cred-callout-icon" aria-hidden="true">💡</span>
      <p class="my-cred-callout-text">请先登录后查看与管理你的平台凭证。</p>
    </div>

    <template v-else>
      <p v-if="loadError" class="my-cred-error">{{ loadError }}</p>
      <p v-if="loading" class="my-cred-loading">加载中…</p>

      <template v-if="!loading">
        <div class="my-cred-callout">
          <span class="my-cred-callout-icon" aria-hidden="true">💡</span>
          <p class="my-cred-callout-text">
            <strong>一人一证，多项目共用</strong>
            — 你的平台凭证是唯一的身份标识，可访问你被授权的所有项目。无需为不同项目切换凭证。
          </p>
        </div>

        <div class="my-cred-grid2">
          <article class="my-cred-card my-cred-card--ok">
            <header class="my-cred-card-head my-cred-card-head--ok">
              <div class="my-cred-card-head-main">
                <span class="my-cred-card-emoji" aria-hidden="true">🪪</span>
                <div>
                  <div class="my-cred-card-title">我的平台凭证</div>
                  <div class="my-cred-card-sub">{{ credentialSubtitle }}</div>
                </div>
              </div>
              <span class="my-cred-pill my-cred-pill--ok">{{ credentialStatusBadge }}</span>
            </header>
            <div class="my-cred-card-body">
              <div class="my-cred-key-row">
                <code class="my-cred-code">{{ keyDisplay }}</code>
                <button type="button" class="my-cred-btn my-cred-btn--sm" @click="copyText(keyDisplay)">
                  📋 复制
                </button>
              </div>
              <div class="my-cred-actions">
                <button type="button" class="my-cred-btn" :disabled="!primaryCredential" @click="renewModalOpen = true">
                  🔄 续签
                </button>
                <button type="button" class="my-cred-btn" :disabled="!primaryCredential || rotateBusy" @click="onRotate">
                  🔑 轮换
                </button>
                <button type="button" class="my-cred-btn" @click="runConnectivityTest">🧪 测试连通性</button>
              </div>
            </div>
          </article>

          <article class="my-cred-card">
            <header class="my-cred-card-head">
              <span class="my-cred-card-title-plain">📋 凭证可访问的项目</span>
              <span class="my-cred-pill my-cred-pill--blue">{{ accessibleProjects.length }} 个项目</span>
            </header>
            <div class="my-cred-card-body my-cred-card-body--flush">
              <div
                v-for="row in accessibleProjects"
                :key="row.project.id"
                class="my-cred-proj-row"
                role="button"
                tabindex="0"
                @click="enterProject(row.project.id)"
                @keydown.enter="enterProject(row.project.id)"
              >
                <div class="my-cred-proj-icon" :style="{ background: '#EEF1FF' }">
                  {{ row.project.icon?.trim() || '📁' }}
                </div>
                <div class="my-cred-proj-main">
                  <div class="my-cred-proj-name">{{ row.project.name }}</div>
                  <div class="my-cred-proj-meta">
                    角色：{{ row.role ?? '—' }} · 项目状态 {{ row.project.status }}
                  </div>
                </div>
                <span class="my-cred-pill my-cred-pill--ok my-cred-pill--sm">成员</span>
              </div>
              <div v-if="accessibleProjects.length === 0" class="my-cred-empty">暂无已加入的项目</div>
            </div>
          </article>
        </div>

        <article class="my-cred-card my-cred-card--focus">
          <header class="my-cred-card-head my-cred-card-head--focus">
            <div class="my-cred-card-head-main">
              <span aria-hidden="true">🎯</span>
              <span class="my-cred-card-title-plain">当前工作项目</span>
            </div>
            <span class="my-cred-muted">决定 AI 工具的 RAG 检索范围与上下文注入（前端偏好，存于浏览器）</span>
          </header>
          <div class="my-cred-card-body">
            <div v-if="currentWorkProject" class="my-cred-work-active">
              <div class="my-cred-work-icon">{{ currentWorkProject.project.icon?.trim() || '📁' }}</div>
              <div class="my-cred-work-text">
                <div class="my-cred-work-name">{{ currentWorkProject.project.name }}</div>
                <div class="my-cred-work-sub">
                  角色 {{ currentWorkProject.role ?? '—' }} · Cursor / Claude Code 请为该项目配置对应 MCP 端点
                </div>
              </div>
              <span class="my-cred-pill my-cred-pill--ok">● 生效中</span>
            </div>
            <div v-else class="my-cred-empty">请选择一个已加入的项目</div>
            <div class="my-cred-work-switch">
              <span class="my-cred-muted">切换到：</span>
              <select v-model.number="workProjectId" class="my-cred-select">
                <option v-for="row in accessibleProjects" :key="row.project.id" :value="row.project.id">
                  {{ row.project.icon?.trim() || '📁' }} {{ row.project.name }}
                </option>
              </select>
              <button type="button" class="my-cred-btn my-cred-btn--primary" @click="saveWorkProject">
                保存切换
              </button>
            </div>
            <div class="my-cred-warn-tip">
              <span>💡</span>
              <span>切换后无需改环境变量中的 API Key；请在各工具中使用对应项目的 MCP 配置。</span>
            </div>
          </div>
        </article>

        <article class="my-cred-card">
          <header class="my-cred-card-head">
            <span class="my-cred-card-title-plain">🔧 接入配置</span>
            <span class="my-cred-muted">同一凭证，所有项目共用 · 无需切换</span>
          </header>
          <div class="my-cred-card-body">
            <div class="my-cred-tabs">
              <button
                type="button"
                :class="['my-cred-tab', activeSetupTab === 'claude' && 'my-cred-tab--on']"
                @click="activeSetupTab = 'claude'"
              >
                Claude Code
              </button>
              <button
                type="button"
                :class="['my-cred-tab', activeSetupTab === 'cursor' && 'my-cred-tab--on']"
                @click="activeSetupTab = 'cursor'"
              >
                Cursor
              </button>
              <button
                type="button"
                :class="['my-cred-tab', activeSetupTab === 'codex' && 'my-cred-tab--on']"
                @click="activeSetupTab = 'codex'"
              >
                Codex / Agent
              </button>
              <button
                type="button"
                :class="['my-cred-tab', activeSetupTab === 'oneclick' && 'my-cred-tab--on']"
                @click="activeSetupTab = 'oneclick'"
              >
                ⚡ 一键安装
              </button>
            </div>

            <div v-show="activeSetupTab === 'claude'" class="my-cred-setup-block">
              <div class="my-cred-setup-k">1. 环境变量（设一次）</div>
              <pre class="my-cred-pre">export ANTHROPIC_BASE_URL="{{ anthropicProxyUrl }}"
export ANTHROPIC_API_KEY="{{ keyDisplay }}"</pre>
              <div class="my-cred-setup-k">2. MCP 配置（多项目并存）</div>
              <pre class="my-cred-pre my-cred-pre--sm">// ~/.claude/settings.json 片段
{{ claudeMcpServersJson }}</pre>
              <div class="my-cred-success-tip">
                ✅ <strong>零切换体验</strong>：同一 API Key；按工作目录或 MCP 条目区分项目端点。
              </div>
            </div>

            <div v-show="activeSetupTab === 'cursor'" class="my-cred-setup-block">
              <pre class="my-cred-pre my-cred-pre--sm">Settings → Models → OpenAI API Key:
  {{ keyDisplay }}

Settings → Models → Override OpenAI Base URL:
  {{ openaiProxyUrl }}

在 MCP 中按项目添加上表中的各「platform-项目」URL。</pre>
              <div class="my-cred-success-tip">✅ API Key 只需设一次，按项目添加多个 MCP Server。</div>
            </div>

            <div v-show="activeSetupTab === 'codex'" class="my-cred-setup-block">
              <pre class="my-cred-pre">export OPENAI_BASE_URL="{{ openaiProxyUrl }}"
export OPENAI_API_KEY="{{ keyDisplay }}"</pre>
              <div class="my-cred-muted-block">
                💡 自建 Agent 若需指定项目上下文，请在请求头传递项目标识（需与网关约定，例如
                <code>X-Project-ID</code>
                ）。
              </div>
            </div>

            <div v-show="activeSetupTab === 'oneclick'" class="my-cred-setup-block">
              <div class="my-cred-oneclick">
                <p>复制以下命令到终端执行（示例，实际以运维提供的安装脚本为准）：</p>
                <pre class="my-cred-pre">{{ oneclickCurl }}</pre>
                <button type="button" class="my-cred-btn" @click="copyText(oneclickCurl)">
                  📋 复制命令
                </button>
              </div>
            </div>
          </div>
        </article>

        <article class="my-cred-card">
          <header class="my-cred-card-head">
            <span class="my-cred-card-title-plain">📊 我的凭证使用统计</span>
            <span class="my-cred-muted">本月 · 来自用量事件聚合</span>
          </header>
          <div class="my-cred-card-body">
            <div class="my-cred-stats4">
              <div class="my-cred-stat-cell">
                <div class="my-cred-stat-num">{{ usageAggregates.totalDisplay }}</div>
                <div class="my-cred-stat-label">总 Token 消耗（样本）</div>
              </div>
              <div class="my-cred-stat-cell">
                <div class="my-cred-stat-num">{{ usageAggregates.calls }}</div>
                <div class="my-cred-stat-label">用量事件条数</div>
              </div>
              <div class="my-cred-stat-cell">
                <div class="my-cred-stat-num">{{ usageAggregates.skillCalls }}</div>
                <div class="my-cred-stat-label">含 skillId 事件</div>
              </div>
              <div class="my-cred-stat-cell">
                <div class="my-cred-stat-num">{{ usageAggregates.avgLat }}</div>
                <div class="my-cred-stat-label">平均延迟（样本）</div>
              </div>
            </div>
            <div v-if="primaryCredential && primaryCredential.usedTokensThisMonth != null" class="my-cred-muted">
              凭证 DTO：本月已用 Token（个人池）约
              <strong>{{ primaryCredential.usedTokensThisMonth }}</strong>
              <template v-if="primaryCredential.monthlyTokenQuota"
                >，月上限 {{ primaryCredential.monthlyTokenQuota }}</template
              >
            </div>
            <div
              v-if="isDev && usageSummary && Object.keys(usageSummary).length"
              class="my-cred-muted my-cred-summary-raw"
            >
              服务端 /me/usage 原始字段（便于联调）：
              <code>{{ JSON.stringify(usageSummary) }}</code>
            </div>
            <div class="my-cred-setup-k">按项目分布（按用量事件聚合）</div>
            <div v-for="(r, i) in usageAggregates.byProjectRows" :key="i" class="my-cred-bar-row">
              <div class="my-cred-bar-label">
                <span>{{ r.icon }} {{ r.name }}</span>
                <span>{{ (r.tokens / 1000).toFixed(1) }}K（{{ r.pct }}%）</span>
              </div>
              <div class="my-cred-bar-track">
                <div class="my-cred-bar-fill" :style="{ width: `${Math.min(100, r.pct)}%` }" />
              </div>
            </div>
            <div v-if="usageAggregates.byProjectRows.length === 0" class="my-cred-empty">暂无带 projectId 的用量样本</div>
          </div>
        </article>

        <aside class="my-cred-api-gap" aria-label="接口缺口说明">
          <div class="my-cred-api-gap-title">后端可补充的接口（当前前端已用替代方案）</div>
          <ul>
            <li>
              <strong>我的项目列表（含角色）</strong>：现为 <code>GET /projects</code> + 每个项目
              <code>GET /projects/{id}/members</code> 解析当前用户角色，项目多时请求偏多。建议
              <code>GET /api/me/projects</code> 或列表项直接带 <code>myRole</code>。
            </li>
            <li>
              <strong>我的凭证</strong>：现为 <code>GET /credentials?userId=</code>，依赖前端传当前用户 id。建议
              <code>GET /api/me/credentials</code> 或 <code>GET /api/credentials/mine</code>。
            </li>
            <li>
              <strong>当前工作项目</strong>：现用浏览器 localStorage。建议
              <code>GET/PUT /api/me/preferences</code> 持久化到账号。
            </li>
            <li>
              <strong>用量汇总</strong>：<code>/api/me/usage</code> 若返回结构化汇总（总 Token、按项目占比等），可替代前端拉全量 events 聚合。
            </li>
            <li>
              <strong>一键安装脚本</strong>：示例 URL 为占位，需运维/后端提供真实 <code>/api/setup</code> 或静态安装页。
            </li>
          </ul>
        </aside>
      </template>
    </template>

    <div v-if="renewModalOpen" class="my-cred-modal-back" @click.self="renewModalOpen = false">
      <div class="my-cred-modal">
        <div class="my-cred-modal-title">续签凭证</div>
        <p class="my-cred-muted">选择续签时长（对接 <code>POST /credentials/{id}/renew</code>）</p>
        <div class="my-cred-modal-actions">
          <button type="button" class="my-cred-btn" :disabled="renewBusy" @click="onRenew(30)">30 天</button>
          <button type="button" class="my-cred-btn" :disabled="renewBusy" @click="onRenew(90)">90 天</button>
          <button type="button" class="my-cred-btn" :disabled="renewBusy" @click="onRenew(180)">180 天</button>
          <button type="button" class="my-cred-btn" @click="renewModalOpen = false">取消</button>
        </div>
      </div>
    </div>

    <div v-if="rotatePlainKey" class="my-cred-modal-back" @click.self="rotatePlainKey = null">
      <div class="my-cred-modal">
        <div class="my-cred-modal-title">新密钥（仅展示一次）</div>
        <pre class="my-cred-pre">{{ rotatePlainKey }}</pre>
        <button type="button" class="my-cred-btn my-cred-btn--primary" @click="copyRotatedPlainKey">复制</button>
        <button type="button" class="my-cred-btn" @click="rotatePlainKey = null">关闭</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.my-cred-root {
  width: 100%;
  max-width: 100%;
  margin: 0;
  /* 主栏 .page-scroll 已有 24px 内边距，此处不再收窄内容区 */
  padding: 8px 0 40px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.my-cred-banner {
  margin: 0;
  padding: 10px 14px;
  border-radius: 8px;
  background: var(--primary-light);
  border: 1px solid var(--primary);
  font-size: 13px;
}

.my-cred-error {
  margin: 0;
  color: var(--danger, #b42318);
  font-size: 13px;
}

.my-cred-loading {
  margin: 0;
  color: var(--text-muted, #667085);
}

.my-cred-callout {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 16px;
  font-size: 13px;
  line-height: 1.55;
  background: var(--primary-light);
  border: 1px solid var(--primary);
  border-radius: 8px;
}

.my-cred-callout-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.my-cred-callout-text {
  margin: 0;
}

.my-cred-grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

@media (max-width: 900px) {
  .my-cred-grid2 {
    grid-template-columns: 1fr;
  }
}

.my-cred-card {
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--card-border, #e4e7ec);
  border-radius: 12px;
  box-shadow: var(--shadow-soft, 0 8px 24px rgba(15, 23, 42, 0.06));
  overflow: hidden;
}

.my-cred-card--ok {
  border-color: var(--success);
}

.my-cred-card--focus {
  border-color: var(--primary);
}

.my-cred-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px 12px;
  flex-wrap: wrap;
}

.my-cred-card-head--ok {
  background: #ecfdf3;
}

.my-cred-card-head--focus {
  background: var(--primary-light);
}

.my-cred-card-head-main {
  display: flex;
  align-items: center;
  gap: 10px;
}

.my-cred-card-emoji {
  font-size: 20px;
}

.my-cred-card-title {
  font-weight: 700;
  font-size: 14px;
}

.my-cred-card-title-plain {
  font-weight: 700;
  font-size: 14px;
}

.my-cred-card-sub {
  font-size: 12px;
  color: var(--text-muted, #667085);
  margin-top: 2px;
}

.my-cred-pill {
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.my-cred-pill--ok {
  background: #ecfdf3;
  color: #027a48;
}

.my-cred-pill--blue {
  background: var(--primary-light);
  color: var(--primary);
}

.my-cred-pill--sm {
  font-size: 11px;
  padding: 2px 8px;
}

.my-cred-card-body {
  padding: 0 18px 18px;
}

.my-cred-card-body--flush {
  padding-left: 0;
  padding-right: 0;
}

.my-cred-key-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: var(--bg);
  border-radius: 8px;
  margin-bottom: 12px;
}

.my-cred-code {
  flex: 1;
  min-width: 0;
  font-family: ui-monospace, monospace;
  font-size: 13px;
  overflow: auto;
}

.my-cred-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.my-cred-btn {
  border: 1px solid var(--card-border, #e4e7ec);
  background: #fff;
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 13px;
  cursor: pointer;
}

.my-cred-btn:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary);
}

.my-cred-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.my-cred-btn--sm {
  padding: 4px 10px;
  font-size: 11px;
}

.my-cred-btn--primary {
  background: var(--primary);
  color: #fff;
  border-color: var(--primary);
}

.my-cred-btn--primary:hover:not(:disabled) {
  filter: brightness(1.05);
  color: #fff;
}

.my-cred-proj-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
  border-bottom: 1px solid var(--bg);
  cursor: pointer;
}

.my-cred-proj-row:hover {
  background: var(--bg);
}

.my-cred-proj-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.my-cred-proj-main {
  flex: 1;
  min-width: 0;
}

.my-cred-proj-name {
  font-weight: 600;
  font-size: 14px;
}

.my-cred-proj-meta {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.my-cred-empty {
  padding: 16px 18px;
  font-size: 13px;
  color: var(--text-muted);
}

.my-cred-work-active {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--bg);
  border-radius: 8px;
  margin-bottom: 14px;
}

.my-cred-work-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: #eef1ff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.my-cred-work-text {
  flex: 1;
  min-width: 0;
}

.my-cred-work-name {
  font-weight: 700;
  font-size: 14px;
}

.my-cred-work-sub {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.my-cred-work-switch {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.my-cred-select {
  flex: 1;
  min-width: 200px;
  padding: 8px 12px;
  border: 1px solid var(--card-border);
  border-radius: 6px;
  font-size: 13px;
  background: #fff;
}

.my-cred-warn-tip {
  margin-top: 12px;
  padding: 10px 12px;
  background: #fffaeb;
  border-radius: 6px;
  font-size: 12px;
  color: #b54708;
  display: flex;
  gap: 6px;
  align-items: flex-start;
}

.my-cred-muted {
  font-size: 12px;
  color: var(--text-muted);
}

.my-cred-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
}

.my-cred-tab {
  border: 1px solid var(--card-border);
  background: var(--bg);
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
}

.my-cred-tab--on {
  background: #fff;
  border-color: var(--primary);
  color: var(--primary);
  font-weight: 600;
}

.my-cred-setup-block {
  font-size: 13px;
}

.my-cred-setup-k {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 8px;
}

.my-cred-pre {
  margin: 0 0 16px;
  padding: 12px 14px;
  background: var(--bg);
  border-radius: 8px;
  font-family: ui-monospace, monospace;
  font-size: 12px;
  line-height: 1.5;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.my-cred-pre--sm {
  font-size: 11px;
  line-height: 1.6;
}

.my-cred-success-tip {
  background: #ecfdf3;
  border-radius: 6px;
  padding: 10px 12px;
  font-size: 12px;
  color: #027a48;
  margin-top: 8px;
}

.my-cred-muted-block {
  margin-top: 12px;
  padding: 10px 12px;
  background: var(--bg);
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-muted);
}

.my-cred-oneclick {
  text-align: center;
}

.my-cred-stats4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

@media (max-width: 720px) {
  .my-cred-stats4 {
    grid-template-columns: repeat(2, 1fr);
  }
}

.my-cred-stat-cell {
  text-align: center;
  padding: 12px;
  background: var(--bg);
  border-radius: 8px;
}

.my-cred-stat-num {
  font-size: 22px;
  font-weight: 800;
  color: var(--primary);
}

.my-cred-stat-label {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 4px;
}

.my-cred-bar-row {
  margin-bottom: 8px;
}

.my-cred-bar-label {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  margin-bottom: 4px;
}

.my-cred-bar-track {
  background: var(--bg);
  border-radius: 4px;
  height: 6px;
}

.my-cred-bar-fill {
  background: var(--primary);
  height: 100%;
  border-radius: 4px;
}

.my-cred-summary-raw {
  margin: 10px 0;
  word-break: break-all;
}

.my-cred-summary-raw code {
  font-size: 11px;
}

.my-cred-api-gap {
  border: 1px dashed var(--card-border);
  border-radius: 10px;
  padding: 14px 18px;
  font-size: 12px;
  color: var(--text-muted);
  background: rgba(255, 255, 255, 0.5);
}

.my-cred-api-gap-title {
  font-weight: 700;
  color: var(--text);
  margin-bottom: 8px;
}

.my-cred-api-gap ul {
  margin: 0;
  padding-left: 18px;
  line-height: 1.6;
}

.my-cred-modal-back {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 80;
  padding: 20px;
}

.my-cred-modal {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  max-width: 480px;
  width: 100%;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15);
}

.my-cred-modal-title {
  font-weight: 700;
  font-size: 16px;
  margin-bottom: 8px;
}

.my-cred-modal-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}
</style>
