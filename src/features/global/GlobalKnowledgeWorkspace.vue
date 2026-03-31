<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import { useKbProjectPicker } from '../../composables/useKbProjectPicker'
import { useRouter } from 'vue-router'

import CardPanel from '../../components/ui/CardPanel.vue'
import StatCard from '../../components/ui/StatCard.vue'
import { normalizeKnowledgeWorkspaceDashboard } from '../../lib/normalize-knowledge-workspace-dashboard'
import type { KnowledgeWorkspaceDashboardStats } from '../../types/knowledge-dashboard'
import {
  archiveKnowledgeBase,
  createKnowledgeBase,
  getKnowledgeBase,
  getKnowledgeBasesDashboard,
  listKnowledgeBases,
  updateKnowledgeBase,
} from '../../services/knowledge'
import {
  KNOWLEDGE_CATEGORY_OPTIONS,
  KNOWLEDGE_CATEGORY_VALUES,
} from '../../lib/knowledge-category-options'
import {
  KNOWLEDGE_EMBEDDING_MODEL_OPTIONS,
  KNOWLEDGE_EMBEDDING_MODEL_VALUES,
} from '../../lib/knowledge-embedding-model-options'
import {
  KNOWLEDGE_INJECT_MODE_OPTIONS,
  KNOWLEDGE_INJECT_MODE_VALUES,
} from '../../lib/knowledge-inject-mode-options'
import { knowledgeScopeLabel, knowledgeScopeTone } from '../../lib/knowledge-scope'
import type { CreateKnowledgeBaseRequest, KnowledgeBaseResponse } from '../../types/knowledge'

type MainTab = 'bases' | 'project' | 'rag'
type ModalKind = 'none' | 'create-kb' | 'edit-kb'

const router = useRouter()
const {
  projectOptions,
  projectsLoading,
  projectsLoadError,
  loadProjectOptions,
  optionsWithFallback,
} = useKbProjectPicker()

const mainTab = ref<MainTab>('bases')
const modalKind = ref<ModalKind>('none')
const kbList = ref<KnowledgeBaseResponse[]>([])
const kbDashboardStats = ref<KnowledgeWorkspaceDashboardStats | null>(null)
/** 看板加载失败时在页内提示 */
const dashboardLoadError = ref('')
const kbLoading = ref(false)
const banner = ref<{ tone: 'error' | 'success'; text: string } | null>(null)
const modalError = ref('')
const submitting = ref(false)

const knowledgeQuery = ref('')
/** 业务分类（category 字段），空表示不限 */
const categoryFilter = ref('')

const createKbForm = ref({
  name: '',
  scope: 'GLOBAL',
  projectId: '',
  description: '',
  category: '',
  embeddingModel: '',
  injectMode: 'ON_DEMAND',
})

const editKbForm = ref<CreateKnowledgeBaseRequest & { id: number; projectIdStr: string }>({
  id: 0,
  name: '',
  scope: 'GLOBAL',
  projectId: undefined,
  projectIdStr: '',
  description: '',
  category: '',
  embeddingModel: '',
  injectMode: 'ON_DEMAND',
})

const editProjectSelectOptions = computed(() => optionsWithFallback(editKbForm.value.projectIdStr))

const editCategorySelectOptions = computed(() => {
  const c = (editKbForm.value.category ?? '').trim()
  if (!c || KNOWLEDGE_CATEGORY_VALUES.includes(c)) {
    return KNOWLEDGE_CATEGORY_OPTIONS
  }
  return [{ value: c, label: `${c}（原值）` }, ...KNOWLEDGE_CATEGORY_OPTIONS]
})

const editEmbeddingSelectOptions = computed(() => {
  const m = (editKbForm.value.embeddingModel ?? '').trim()
  if (!m || KNOWLEDGE_EMBEDDING_MODEL_VALUES.includes(m)) {
    return KNOWLEDGE_EMBEDDING_MODEL_OPTIONS
  }
  return [{ value: m, label: `${m}（原值）` }, ...KNOWLEDGE_EMBEDDING_MODEL_OPTIONS]
})

const editInjectSelectOptions = computed(() => {
  const im = (editKbForm.value.injectMode ?? 'ON_DEMAND').trim() || 'ON_DEMAND'
  if (KNOWLEDGE_INJECT_MODE_VALUES.includes(im)) {
    return KNOWLEDGE_INJECT_MODE_OPTIONS
  }
  return [{ value: im, label: `${im}（原值）` }, ...KNOWLEDGE_INJECT_MODE_OPTIONS]
})

function showBanner(tone: 'error' | 'success', text: string) {
  banner.value = { tone, text }
  window.setTimeout(() => {
    if (banner.value?.text === text) banner.value = null
  }, 6000)
}

function formatDt(raw: string | null | undefined) {
  if (!raw) return '—'
  return String(raw).slice(0, 19).replace('T', ' ')
}

function statusTone(status: string | null | undefined): 'success' | 'warning' | 'danger' | 'muted' {
  const s = (status ?? '').toUpperCase()
  if (s.includes('READY') || s.includes('DONE') || s.includes('SUCCESS') || s === 'ACTIVE') return 'success'
  if (s.includes('FAIL') || s.includes('ERROR')) return 'danger'
  if (s.includes('PEND') || s.includes('PROC') || s.includes('ING')) return 'warning'
  return 'muted'
}

/** 当前 Tab 对应的后端 scope：全局 = GLOBAL，项目 = PROJECT */
const scopeForTab = computed(() => {
  if (mainTab.value === 'bases') return 'GLOBAL' as const
  if (mainTab.value === 'project') return 'PROJECT' as const
  return null
})

const kbsInCurrentTab = computed(() => {
  const want = scopeForTab.value
  if (!want) return kbList.value
  return kbList.value.filter((k) => (k.scope ?? '').toUpperCase() === want)
})

const distinctCategories = computed(() => {
  const set = new Set<string>()
  for (const k of kbsInCurrentTab.value) {
    if (k.category?.trim()) set.add(k.category.trim())
  }
  return [...set].sort()
})

/** 列表筛选：固定三项在前，其余为历史数据中的其它分类 */
const categoryFilterSelectOptions = computed(() => {
  const extra = distinctCategories.value.filter((c) => !KNOWLEDGE_CATEGORY_VALUES.includes(c))
  return [...KNOWLEDGE_CATEGORY_VALUES, ...extra]
})

const filteredKbs = computed(() => {
  const want = scopeForTab.value
  if (!want) return []
  let rows = kbList.value.filter((k) => (k.scope ?? '').toUpperCase() === want)
  const q = knowledgeQuery.value.trim()
  if (q) {
    rows = rows.filter((k) => {
      const scopeZh = knowledgeScopeLabel(k.scope)
      return (
        (k.name ?? '').includes(q) ||
        (k.description ?? '').includes(q) ||
        (k.category ?? '').includes(q) ||
        (k.scope ?? '').includes(q) ||
        scopeZh.includes(q)
      )
    })
  }
  if (categoryFilter.value) {
    rows = rows.filter((k) => k.category === categoryFilter.value)
  }
  return rows
})

function formatStatInt(n: number) {
  return n.toLocaleString('zh-CN')
}

function currentMonthStartMs() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime()
}

/** 兼容后端在列表项上扩展的统计字段（OpenAPI 未声明时仍可累加） */
function pickKbMetricNumber(k: KnowledgeBaseResponse, keys: string[]): number | null {
  const raw = k as unknown as Record<string, unknown>
  for (const key of keys) {
    const v = raw[key]
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string' && v.trim()) {
      const n = Number(String(v).replace(/%/g, '').replace(/,/g, ''))
      if (Number.isFinite(n)) return n
    }
  }
  return null
}

/** 与原型一致：检索卡副文案「↑ x% 较上月」等，不用接口路径 */
function formatSearchSubtext(
  dash: KnowledgeWorkspaceDashboardStats | null,
  hasSearchMetric: boolean,
): string {
  if (dash?.monthlySearchCount != null) {
    const apiPct = dash.searchMonthOverMonthPercent
    if (apiPct != null && Number.isFinite(apiPct)) {
      if (apiPct > 0) return `↑ ${apiPct}% 较上月`
      if (apiPct < 0) return `↓ ${Math.abs(apiPct)}% 较上月`
      return '与上月持平'
    }
    const cur = dash.monthlySearchCount
    const last = dash.searchCountLastMonth
    if (last != null && Number.isFinite(last)) {
      if (last === 0 && cur === 0) return '与上月持平'
      if (last === 0) return '↑ 较上月新增'
      const rawPct = ((cur - last) / last) * 100
      const p = Math.round(rawPct * 10) / 10
      if (p > 0) return `↑ ${p}% 较上月`
      if (p < 0) return `↓ ${Math.abs(p)}% 较上月`
      return '与上月持平'
    }
    return '本月检索统计'
  }
  if (hasSearchMetric) return '各库汇总（估算）'
  return '暂无检索数据'
}

const metrics = computed(() => {
  const dash = kbDashboardStats.value
  const kbs =
    mainTab.value === 'rag'
      ? kbList.value
      : kbList.value.filter((k) => (k.scope ?? '').toUpperCase() === (mainTab.value === 'bases' ? 'GLOBAL' : 'PROJECT'))

  const totalDocs = kbs.reduce((s, k) => s + (k.docCount ?? 0), 0)
  const ms0 = currentMonthStartMs()
  const newKbsThisMonth = kbs.filter((k) => {
    if (!k.createdAt) return false
    const t = new Date(k.createdAt).getTime()
    return Number.isFinite(t) && t >= ms0
  }).length

  let monthlySearchSum = 0
  let hasSearchMetric = false
  for (const k of kbs) {
    const n = pickKbMetricNumber(k, [
      'monthlySearchCount',
      'searchCountThisMonth',
      'monthlyQueryCount',
      'searchCount',
    ])
    if (n != null) {
      hasSearchMetric = true
      monthlySearchSum += n
    }
  }

  const avgHitRate =
    kbs.length > 0
      ? Math.round(
          kbs.reduce((s, k) => {
            const rate =
              typeof k.hitRate === 'string' ? Number(String(k.hitRate).replace('%', '')) : Number(k.hitRate ?? 0)
            return s + (Number.isFinite(rate) ? rate : 0)
          }, 0) / kbs.length,
        )
      : 0
  const hitPct = Math.max(0, Math.min(100, avgHitRate || 0))

  const queueLike = /^(PENDING|PROCESSING|QUEUED|INDEXING|EMBEDDING|RUNNING|SYNCING|IN_PROGRESS)/i
  const queueCount = kbs.filter((k) => queueLike.test(String(k.status ?? '').trim())).length

  const newKbDelta = dash?.newKnowledgeBasesThisMonth ?? newKbsThisMonth
  const docListValue = formatStatInt(totalDocs)
  const docValue = dash?.globalDocTotal != null ? formatStatInt(dash.globalDocTotal) : docListValue
  const docDelta =
    dash?.newDocumentsThisMonth != null
      ? `↑ ${dash.newDocumentsThisMonth} 本月新增`
      : dash?.globalDocTotal != null || dash?.newKnowledgeBasesThisMonth != null
        ? `↑ ${newKbDelta} 本月新建库`
        : `↑ ${newKbsThisMonth} 本月新建库`

  const searchValue =
    dash?.monthlySearchCount != null
      ? formatStatInt(dash.monthlySearchCount)
      : hasSearchMetric
        ? formatStatInt(monthlySearchSum)
        : '—'
  const searchDelta = formatSearchSubtext(dash, hasSearchMetric)

  const hitTarget = dash?.hitRateTargetPercent ?? 70
  const hitValue =
    dash?.knowledgeHitRatePercent != null ? `${dash.knowledgeHitRatePercent}%` : kbs.length ? `${hitPct}%` : '—'
  const hitMeets =
    dash?.hitRateMeetsTarget != null
      ? dash.hitRateMeetsTarget
      : dash?.knowledgeHitRatePercent != null
        ? dash.knowledgeHitRatePercent >= hitTarget
        : hitPct >= hitTarget
  const hitDelta =
    dash?.knowledgeHitRatePercent != null || kbs.length
      ? `目标 ≥ ${hitTarget}% ${hitMeets ? '✓' : '○'}`
      : `目标 ≥ ${hitTarget}%`

  const queueValue = dash?.vectorQueueCount != null ? String(dash.vectorQueueCount) : String(queueCount)
  const queueDelta =
    dash?.vectorQueueCount != null
      ? Number(dash.vectorQueueCount) > 0
        ? '处理中'
        : '暂无排队'
      : queueCount > 0
        ? '处理中'
        : '暂无排队'

  return [
    {
      id: 'docs',
      icon: '📚',
      label: '全局文档总数',
      value: docValue,
      delta: docDelta,
      tone: 'primary' as const,
      deltaTone: 'success' as const,
    },
    {
      id: 'searches',
      icon: '🔎',
      label: '本月检索次数',
      value: searchValue,
      delta: searchDelta,
      tone: 'primary' as const,
      deltaTone: 'success' as const,
    },
    {
      id: 'hit',
      icon: '🎯',
      label: '知识库命中率',
      value: hitValue,
      delta: hitDelta,
      tone: 'success' as const,
      deltaTone: 'success' as const,
    },
    {
      id: 'queue',
      icon: '🔄',
      label: '向量化队列',
      value: queueValue,
      delta: queueDelta,
      tone: 'warning' as const,
      deltaTone: 'success' as const,
    },
  ]
})

async function loadKbs() {
  kbLoading.value = true
  banner.value = null
  dashboardLoadError.value = ''
  try {
    const [listOutcome, dashOutcome] = await Promise.allSettled([
      listKnowledgeBases(),
      getKnowledgeBasesDashboard(),
    ])
    if (listOutcome.status === 'fulfilled') {
      kbList.value = listOutcome.value
    } else {
      kbList.value = []
      showBanner(
        'error',
        listOutcome.reason instanceof Error ? listOutcome.reason.message : '加载知识库列表失败',
      )
    }
    if (dashOutcome.status === 'fulfilled') {
      kbDashboardStats.value = normalizeKnowledgeWorkspaceDashboard(dashOutcome.value)
      dashboardLoadError.value = ''
    } else {
      kbDashboardStats.value = null
      const msg =
        dashOutcome.reason instanceof Error ? dashOutcome.reason.message : '加载知识库看板失败'
      dashboardLoadError.value = `顶部统计已回退为列表估算。知识库看板：${msg}`
    }
  } finally {
    kbLoading.value = false
  }
}

function goToDocuments(k: KnowledgeBaseResponse, ev?: Event) {
  ev?.stopPropagation?.()
  void router.push(`/placeholder/knowledge/${k.id}`)
}

const ragPipelineSteps = [
  { key: 'parse', title: '文档解析', desc: 'PDF/Markdown 等抽取正文' },
  { key: 'chunk', title: '语义分块', desc: '固定窗口或语义切分' },
  { key: 'embed', title: '向量化', desc: 'Embedding 写入向量库' },
  { key: 'index', title: '索引存储', desc: 'pgvector / 相似检索' },
  { key: 'rerank', title: '重排序', desc: '可选，提升 TopK 质量' },
  { key: 'query', title: '检索 API', desc: 'POST .../search 联调' },
] as const

/** RAG Tab：全量知识库一览（不按 Tab 过滤 scope） */
const ragKbRows = computed(() =>
  [...kbList.value].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'zh-Hans-CN')),
)

const ragAggregates = computed(() => {
  const kbs = kbList.value
  const totalDocs = kbs.reduce((s, k) => s + (k.docCount ?? 0), 0)
  const totalChunks = kbs.reduce((s, k) => s + Number(k.totalChunks ?? 0), 0)
  const globalN = kbs.filter((k) => k.scope?.toUpperCase() === 'GLOBAL').length
  const projectN = kbs.filter((k) => k.scope?.toUpperCase() === 'PROJECT').length
  return { totalDocs, totalChunks, globalN, projectN, kbCount: kbs.length }
})

function closeModal() {
  modalKind.value = 'none'
  modalError.value = ''
  submitting.value = false
}

function openCreateKb() {
  modalKind.value = 'create-kb'
  modalError.value = ''
  const defaultScope = mainTab.value === 'project' ? 'PROJECT' : 'GLOBAL'
  createKbForm.value = {
    name: '',
    scope: defaultScope,
    projectId: '',
    description: '',
    category: '',
    embeddingModel: '',
    injectMode: 'ON_DEMAND',
  }
}

async function openEditKb(k: KnowledgeBaseResponse, ev?: Event) {
  ev?.stopPropagation?.()
  modalKind.value = 'edit-kb'
  modalError.value = ''
  try {
    const full = await getKnowledgeBase(k.id)
    editKbForm.value = {
      id: full.id,
      name: full.name,
      scope: (full.scope ?? 'GLOBAL').toUpperCase(),
      projectId: full.projectId ?? undefined,
      projectIdStr: full.projectId != null ? String(full.projectId) : '',
      description: full.description ?? '',
      category: full.category ?? '',
      embeddingModel: full.embeddingModel ?? '',
      injectMode: full.injectMode ?? 'ON_DEMAND',
    }
  } catch (e) {
    modalError.value = e instanceof Error ? e.message : '加载知识库详情失败'
    editKbForm.value = {
      id: k.id,
      name: k.name,
      scope: (k.scope ?? 'GLOBAL').toUpperCase(),
      projectId: k.projectId ?? undefined,
      projectIdStr: k.projectId != null ? String(k.projectId) : '',
      description: k.description ?? '',
      category: k.category ?? '',
      embeddingModel: k.embeddingModel ?? '',
      injectMode: k.injectMode ?? 'ON_DEMAND',
    }
  }
}

async function submitCreateKb() {
  const name = createKbForm.value.name.trim()
  if (!name) {
    modalError.value = '请填写知识库名称。'
    return
  }
  const scope = createKbForm.value.scope.trim().toUpperCase()
  if (!scope) {
    modalError.value = '请选择作用域。'
    return
  }
  const body: CreateKnowledgeBaseRequest = {
    name,
    scope,
    injectMode: createKbForm.value.injectMode.trim() || 'ON_DEMAND',
  }
  const desc = createKbForm.value.description.trim()
  if (desc) body.description = desc
  const cat = createKbForm.value.category.trim()
  if (cat) body.category = cat
  const em = createKbForm.value.embeddingModel.trim()
  if (em) body.embeddingModel = em
  if (scope === 'PROJECT') {
    const raw = createKbForm.value.projectId.trim()
    const pid = Number(raw)
    if (!raw || !Number.isFinite(pid)) {
      modalError.value = '请选择所属项目。'
      return
    }
    body.projectId = pid
  }
  submitting.value = true
  modalError.value = ''
  try {
    await createKnowledgeBase(body)
    showBanner('success', '知识库已创建。')
    closeModal()
    await loadKbs()
  } catch (e) {
    modalError.value = e instanceof Error ? e.message : '创建失败'
  } finally {
    submitting.value = false
  }
}

async function submitEditKb() {
  const id = editKbForm.value.id
  const name = editKbForm.value.name.trim()
  if (!name) {
    modalError.value = '请填写知识库名称。'
    return
  }
  const scope = editKbForm.value.scope.trim().toUpperCase()
  const body: CreateKnowledgeBaseRequest = {
    name,
    scope,
    injectMode: (editKbForm.value.injectMode ?? 'ON_DEMAND').trim() || 'ON_DEMAND',
  }
  const desc = (editKbForm.value.description ?? '').trim()
  if (desc) body.description = desc
  const cat = (editKbForm.value.category ?? '').trim()
  if (cat) body.category = cat
  const em = (editKbForm.value.embeddingModel ?? '').trim()
  if (em) body.embeddingModel = em
  if (scope === 'PROJECT') {
    const raw = editKbForm.value.projectIdStr.trim()
    const pid = Number(raw)
    if (!raw || !Number.isFinite(pid)) {
      modalError.value = '请选择所属项目。'
      return
    }
    body.projectId = pid
  }
  submitting.value = true
  modalError.value = ''
  try {
    await updateKnowledgeBase(id, body)
    showBanner('success', '知识库已更新。')
    closeModal()
    await loadKbs()
  } catch (e) {
    modalError.value = e instanceof Error ? e.message : '更新失败'
  } finally {
    submitting.value = false
  }
}

async function onArchiveKb(k: KnowledgeBaseResponse, ev?: Event) {
  ev?.stopPropagation?.()
  if (!window.confirm(`确定归档知识库「${k.name}」？`)) return
  try {
    await archiveKnowledgeBase(k.id)
    showBanner('success', '已归档。')
    await loadKbs()
  } catch (e) {
    showBanner('error', e instanceof Error ? e.message : '归档失败')
  }
}

function onKeydown(ev: KeyboardEvent) {
  if (ev.key === 'Escape' && modalKind.value !== 'none') {
    ev.preventDefault()
    closeModal()
  }
}

watch(mainTab, () => {
  categoryFilter.value = ''
})

watch(
  () => ({ m: modalKind.value, scope: createKbForm.value.scope }),
  ({ m, scope }) => {
    if (m === 'create-kb' && scope === 'PROJECT') void loadProjectOptions()
  },
)

watch(
  () => ({ m: modalKind.value, scope: editKbForm.value.scope }),
  ({ m, scope }) => {
    if (m === 'edit-kb' && scope === 'PROJECT') void loadProjectOptions()
  },
)

onMounted(() => {
  void loadKbs()
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="gk-root" data-testid="global-knowledge-workspace">
    <header class="gk-head">
      <h1 class="gk-title">全局知识库</h1>
      <p class="gk-sub">
        <strong>全局知识库</strong> 页签只列出<strong>平台级</strong>知识库；<strong>项目知识库</strong> 页签只列出<strong>绑定在具体项目下</strong>的知识库，两类互不混排。顶部四块为全平台汇总；表格中点击一行可进入该库，维护文档、检索与
        RAG 相关设置。<strong>RAG 流水线</strong> 页签用于理解处理链路，并提供跨库入口。
      </p>
    </header>

    <div v-if="banner" class="gk-banner" :class="`gk-banner--${banner.tone}`">
      {{ banner.text }}
    </div>
    <p v-if="dashboardLoadError" class="gk-dash-err" role="status">{{ dashboardLoadError }}</p>

    <section class="gk-metrics">
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

    <!-- 与原型一致：左搜索+分类+刷新+新建 | 中撑开（文档相关操作在文档页） -->
    <div class="gk-toolbar-bar">
      <input
        v-model="knowledgeQuery"
        class="gk-knowledge-search"
        type="text"
        placeholder="搜索知识库..."
      />
      <select v-model="categoryFilter" class="gk-knowledge-select gk-knowledge-select--fixed" aria-label="分类">
        <option value="">全部分类</option>
        <option v-for="c in categoryFilterSelectOptions" :key="c" :value="c">{{ c }}</option>
      </select>
      <button class="gk-toolbar-mini" type="button" :disabled="kbLoading" @click="loadKbs">刷新</button>
      <button class="gk-toolbar-mini" type="button" @click="openCreateKb">+ 新建知识库</button>
      <div class="gk-toolbar-spacer" aria-hidden="true" />
    </div>

    <div class="gk-knowledge-tabs" role="tablist" aria-label="知识库视图">
      <button
        class="gk-knowledge-tab"
        :class="{ active: mainTab === 'bases' }"
        role="tab"
        :aria-selected="mainTab === 'bases'"
        type="button"
        @click="mainTab = 'bases'"
      >
        🌐 全局知识库
      </button>
      <button
        class="gk-knowledge-tab"
        :class="{ active: mainTab === 'project' }"
        role="tab"
        :aria-selected="mainTab === 'project'"
        type="button"
        @click="mainTab = 'project'"
      >
        📁 项目知识库
      </button>
      <button
        class="gk-knowledge-tab"
        :class="{ active: mainTab === 'rag' }"
        role="tab"
        :aria-selected="mainTab === 'rag'"
        type="button"
        @click="mainTab = 'rag'"
      >
        ⚙️ RAG 流水线
      </button>
    </div>

    <template v-if="mainTab === 'bases' || mainTab === 'project'">
      <CardPanel
        class="gk-panel"
        :title="mainTab === 'bases' ? '平台级知识库' : '项目级知识库'"
      >
        <div v-if="kbLoading" class="gk-muted">加载中…</div>
        <div v-else class="gk-table-wrap">
          <table class="gk-table">
            <thead>
              <tr>
                <th>知识库名称</th>
                <th>分类</th>
                <th>文档数</th>
                <th>分块数</th>
                <th>注入模式</th>
                <th>状态</th>
                <th>更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="k in filteredKbs" :key="k.id" class="gk-row" @click="goToDocuments(k)">
                <td class="gk-strong">{{ k.name }}</td>
                <td>{{ k.category ?? '—' }}</td>
                <td>{{ k.docCount ?? '—' }}</td>
                <td>{{ k.totalChunks ?? '—' }}</td>
                <td>{{ k.injectMode ?? '—' }}</td>
                <td>
                  <span class="gk-pill" :class="`gk-pill--${statusTone(k.status)}`">{{ k.status ?? '—' }}</span>
                </td>
                <td>{{ formatDt(k.createdAt) }}</td>
                <td class="gk-actions" @click.stop>
                  <button class="gk-linkbtn" type="button" @click="goToDocuments(k, $event)">进入知识库</button>
                  <button class="gk-linkbtn" type="button" @click="openEditKb(k, $event)">编辑</button>
                  <button class="gk-linkbtn gk-linkbtn--danger" type="button" @click="onArchiveKb(k, $event)">
                    归档
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-if="!filteredKbs.length" class="gk-muted">
            暂无{{ mainTab === 'bases' ? '平台级' : '项目级' }}知识库，可点击「新建知识库」创建。
          </p>
        </div>
      </CardPanel>
      <CardPanel v-if="mainTab === 'project'" class="gk-panel" title="说明">
        <p class="gk-muted">
          若要让本项目使用平台上的<strong>共享知识库</strong>，请在对应<strong>项目空间</strong>的知识或接入配置中开启继承，此处仅展示已归属本项目的知识库。
        </p>
      </CardPanel>
    </template>

    <section v-else class="gk-rag" data-testid="gk-rag-workspace">
      <CardPanel badge="说明" title="流水线拓扑（只读）">
        <p class="gk-muted gk-rag-lead">
          以下为常见的检索增强生成（RAG）处理顺序，便于对照实际环境里的解析、向量化与检索环节。
        </p>
        <div class="gk-rag-pipeline" role="list">
          <template v-for="(step, i) in ragPipelineSteps" :key="step.key">
            <div class="gk-rag-step" role="listitem">
              <div class="gk-rag-step-index">{{ i + 1 }}</div>
              <div class="gk-rag-step-body">
                <div class="gk-rag-step-title">{{ step.title }}</div>
                <div class="gk-rag-step-desc">{{ step.desc }}</div>
              </div>
            </div>
            <div v-if="i < ragPipelineSteps.length - 1" class="gk-rag-arrow" aria-hidden="true">→</div>
          </template>
        </div>
      </CardPanel>

      <div class="gk-rag-metrics">
        <CardPanel title="平台聚合（当前列表汇总）">
          <div class="gk-rag-metric-grid">
            <div class="gk-rag-metric">
              <span class="gk-rag-metric-label">知识库总数</span>
              <strong class="gk-rag-metric-value">{{ ragAggregates.kbCount }}</strong>
              <span class="gk-rag-metric-delta">平台级 {{ ragAggregates.globalN }} · 项目级 {{ ragAggregates.projectN }}</span>
            </div>
            <div class="gk-rag-metric">
              <span class="gk-rag-metric-label">文档合计</span>
              <strong class="gk-rag-metric-value">{{ ragAggregates.totalDocs }}</strong>
              <span class="gk-rag-metric-delta">各知识库文档数相加</span>
            </div>
            <div class="gk-rag-metric">
              <span class="gk-rag-metric-label">分块合计</span>
              <strong class="gk-rag-metric-value">{{ ragAggregates.totalChunks || '—' }}</strong>
              <span class="gk-rag-metric-delta">各知识库分块数相加</span>
            </div>
          </div>
        </CardPanel>
        <CardPanel badge="规划中" title="运行观测">
          <div class="gk-rag-metric-grid">
            <div class="gk-rag-metric gk-rag-metric--placeholder">
              <span class="gk-rag-metric-label">处理中队列</span>
              <strong class="gk-rag-metric-value">—</strong>
              <span class="gk-rag-metric-delta">接入任务队列后可在此查看积压</span>
            </div>
            <div class="gk-rag-metric gk-rag-metric--placeholder">
              <span class="gk-rag-metric-label">向量化失败</span>
              <strong class="gk-rag-metric-value">—</strong>
              <span class="gk-rag-metric-delta">可按文档状态汇总失败原因</span>
            </div>
            <div class="gk-rag-metric gk-rag-metric--placeholder">
              <span class="gk-rag-metric-label">近 24h 检索次数</span>
              <strong class="gk-rag-metric-value">—</strong>
              <span class="gk-rag-metric-delta">需检索审计或埋点后展示</span>
            </div>
            <div class="gk-rag-metric gk-rag-metric--placeholder">
              <span class="gk-rag-metric-label">检索 P99 延迟</span>
              <strong class="gk-rag-metric-value">—</strong>
              <span class="gk-rag-metric-delta">需性能监控接入后展示</span>
            </div>
          </div>
        </CardPanel>
      </div>

      <CardPanel title="按知识库下钻">
        <p class="gk-muted gk-rag-lead">
          每个库的<strong>检索试用、RAG 参数与向量化相关设置</strong>请在进入该库的<strong>文档页</strong>后操作；此处仅提供跨库列表与快捷入口。
        </p>
        <div class="gk-rag-actions-bar">
          <button class="gk-toolbar-mini" type="button" @click="mainTab = 'bases'">去全局知识库</button>
          <button class="gk-toolbar-mini" type="button" @click="mainTab = 'project'">去项目知识库</button>
          <button class="gk-toolbar-mini" type="button" :disabled="kbLoading" @click="loadKbs">刷新列表</button>
        </div>
        <div v-if="kbLoading" class="gk-muted">加载中…</div>
        <div v-else class="gk-table-wrap">
          <table class="gk-table">
            <thead>
              <tr>
                <th>知识库</th>
                <th>作用域</th>
                <th>文档数</th>
                <th>分块数</th>
                <th>向量模型</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="k in ragKbRows" :key="k.id" class="gk-rag-kb-row">
                <td class="gk-strong">{{ k.name }}</td>
                <td>
                  <span
                    class="gk-pill"
                    :class="`gk-pill--${knowledgeScopeTone(k.scope)}`"
                  >
                    {{ knowledgeScopeLabel(k.scope) }}
                  </span>
                </td>
                <td>{{ k.docCount ?? '—' }}</td>
                <td>{{ k.totalChunks ?? '—' }}</td>
                <td class="gk-cell-mono">{{ k.embeddingModel ?? '—' }}</td>
                <td>
                  <span class="gk-pill" :class="`gk-pill--${statusTone(k.status)}`">{{ k.status ?? '—' }}</span>
                </td>
                <td class="gk-actions">
                  <button class="gk-linkbtn" type="button" @click="goToDocuments(k)">RAG 配置与检索</button>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-if="!ragKbRows.length" class="gk-muted">暂无知识库，请先在「全局/项目知识库」Tab 创建。</p>
        </div>
      </CardPanel>
    </section>

    <!-- modals -->
    <div
      v-if="modalKind !== 'none'"
      class="gk-modal-backdrop"
      data-testid="gk-modal-backdrop"
      @click.self="closeModal"
    >
      <div class="gk-modal" role="dialog" aria-modal="true">
        <header class="gk-modal-head">
          <div>
            <div class="gk-modal-title">
              {{ modalKind === 'create-kb' ? '新建知识库' : '编辑知识库' }}
            </div>
          </div>
          <button class="gk-modal-close" type="button" aria-label="关闭" @click="closeModal">✕</button>
        </header>

        <div v-if="modalError" class="gk-modal-error">{{ modalError }}</div>

        <div v-if="modalKind === 'create-kb'" class="gk-form">
          <label class="gk-field">
            <span>名称 *</span>
            <input v-model="createKbForm.name" class="gk-input" type="text" />
          </label>
          <label class="gk-field">
            <span>作用域 *</span>
            <select v-model="createKbForm.scope" class="gk-select">
              <option value="GLOBAL">GLOBAL · 全局知识库</option>
              <option value="PROJECT">PROJECT · 项目知识库</option>
            </select>
            <span class="gk-field-hint"
              ><code>GLOBAL</code> 归入「全局知识库」Tab；<code>PROJECT</code> 归入「项目知识库」Tab。</span
            >
          </label>
          <label v-if="createKbForm.scope === 'PROJECT'" class="gk-field">
            <span>所属项目 *</span>
            <select v-model="createKbForm.projectId" class="gk-select" :disabled="projectsLoading">
              <option value="">{{ projectsLoading ? '加载中…' : '请选择项目' }}</option>
              <option v-for="p in projectOptions" :key="p.id" :value="String(p.id)">
                {{ p.name }}（ID {{ p.id }}）
              </option>
            </select>
            <span v-if="projectsLoadError" class="gk-field-hint gk-field-hint--danger">{{ projectsLoadError }}</span>
          </label>
          <label class="gk-field">
            <span>描述</span>
            <textarea v-model="createKbForm.description" class="gk-textarea" rows="2" />
          </label>
          <label class="gk-field">
            <span>分类</span>
            <select v-model="createKbForm.category" class="gk-select">
              <option value="">未分类</option>
              <option v-for="o in KNOWLEDGE_CATEGORY_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </label>
          <label class="gk-field">
            <span>向量模型</span>
            <select v-model="createKbForm.embeddingModel" class="gk-select">
              <option value="">不指定（由后端默认）</option>
              <option v-for="o in KNOWLEDGE_EMBEDDING_MODEL_OPTIONS" :key="o.value" :value="o.value">
                {{ o.label }}
              </option>
            </select>
          </label>
          <label class="gk-field">
            <span>注入模式</span>
            <select v-model="createKbForm.injectMode" class="gk-select">
              <option v-for="o in KNOWLEDGE_INJECT_MODE_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
            <span class="gk-field-hint">控制知识何时进入模型上下文，选项需与平台当前支持的策略一致。</span>
          </label>
          <footer class="gk-modal-footer">
            <button class="gk-btn" type="button" @click="closeModal">取消</button>
            <button class="gk-btn gk-btn--primary" type="button" :disabled="submitting" @click="submitCreateKb">
              {{ submitting ? '提交中…' : '创建' }}
            </button>
          </footer>
        </div>

        <div v-else-if="modalKind === 'edit-kb'" class="gk-form">
          <label class="gk-field">
            <span>名称 *</span>
            <input v-model="editKbForm.name" class="gk-input" type="text" />
          </label>
          <label class="gk-field">
            <span>作用域 *</span>
            <select v-model="editKbForm.scope" class="gk-select">
              <option value="GLOBAL">GLOBAL · 全局知识库</option>
              <option value="PROJECT">PROJECT · 项目知识库</option>
            </select>
            <span class="gk-field-hint"
              ><code>PROJECT</code> 须选择所属项目；列表会出现在「项目知识库」Tab。</span
            >
          </label>
          <label v-if="editKbForm.scope === 'PROJECT'" class="gk-field">
            <span>所属项目 *</span>
            <select v-model="editKbForm.projectIdStr" class="gk-select" :disabled="projectsLoading">
              <option value="">{{ projectsLoading ? '加载中…' : '请选择项目' }}</option>
              <option v-for="p in editProjectSelectOptions" :key="p.id" :value="String(p.id)">
                {{ p.name }}（ID {{ p.id }}）
              </option>
            </select>
            <span v-if="projectsLoadError" class="gk-field-hint gk-field-hint--danger">{{ projectsLoadError }}</span>
          </label>
          <label class="gk-field">
            <span>描述</span>
            <textarea v-model="editKbForm.description" class="gk-textarea" rows="2" />
          </label>
          <label class="gk-field">
            <span>分类</span>
            <select v-model="editKbForm.category" class="gk-select">
              <option value="">未分类</option>
              <option v-for="o in editCategorySelectOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </label>
          <label class="gk-field">
            <span>向量模型</span>
            <select v-model="editKbForm.embeddingModel" class="gk-select">
              <option value="">不指定（由后端默认）</option>
              <option v-for="o in editEmbeddingSelectOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </label>
          <label class="gk-field">
            <span>注入模式</span>
            <select v-model="editKbForm.injectMode" class="gk-select">
              <option v-for="o in editInjectSelectOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
            <span class="gk-field-hint">控制知识何时进入模型上下文，选项需与平台当前支持的策略一致。</span>
          </label>
          <footer class="gk-modal-footer">
            <button class="gk-btn" type="button" @click="closeModal">取消</button>
            <button class="gk-btn gk-btn--primary" type="button" :disabled="submitting" @click="submitEditKb">
              {{ submitting ? '保存中…' : '保存' }}
            </button>
          </footer>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gk-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.gk-head {
  padding: 4px 0 0;
}

.gk-title {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
}

.gk-sub {
  margin: 8px 0 0;
  color: var(--text-subtle);
  line-height: 1.6;
  font-size: 13px;
}

.gk-sub code {
  font-size: 12px;
  padding: 1px 6px;
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.06);
}

.gk-sub a {
  color: var(--primary);
  font-weight: 600;
}

.gk-banner {
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 13px;
}
.gk-banner--error {
  background: rgba(239, 68, 68, 0.12);
  color: #b91c1c;
}
.gk-banner--success {
  background: rgba(34, 197, 94, 0.12);
  color: #15803d;
}

.gk-dash-err {
  margin: 0;
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 12px;
  color: #b45309;
  background: rgba(245, 158, 11, 0.14);
  line-height: 1.5;
}

.gk-metrics {
  display: grid;
  width: 100%;
  /* auto-fit 会收拢空轨道，避免右侧大块留白；与 metrics 条数（4）一致时等分整行 */
  grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
  gap: 12px;
}

.gk-metrics :deep(.stat-card) {
  min-width: 0;
}

@media (max-width: 720px) {
  .gk-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 420px) {
  .gk-metrics {
    grid-template-columns: 1fr;
  }
}

.gk-toolbar-bar {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 12px;
  margin-bottom: 16px;
  padding: 0;
  min-width: 0;
}

.gk-toolbar-spacer {
  flex: 1 1 auto;
  min-width: 16px;
  height: 1px;
}

.gk-knowledge-search,
.gk-knowledge-select,
.gk-toolbar-mini {
  border: 1px solid rgba(17, 24, 39, 0.1);
  border-radius: 8px;
  background: white;
  color: var(--text-main);
  font: inherit;
  font-size: 13px;
}

.gk-knowledge-search {
  width: 280px;
  max-width: 280px;
  min-width: 0;
  padding: 8px 12px;
  flex: 0 0 280px;
}

.gk-knowledge-select {
  padding: 8px 12px;
  flex: 0 0 auto;
}

.gk-knowledge-select--fixed {
  width: auto;
  min-width: 120px;
  max-width: 200px;
}

.gk-toolbar-mini {
  padding: 7px 14px;
  flex: 0 0 auto;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.15s;
}

.gk-toolbar-mini:hover:not(:disabled) {
  background: #f8fafc;
}

.gk-toolbar-mini:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.gk-rag-config-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  padding: 7px 14px;
  border-radius: 8px;
  border: 1px solid rgba(17, 24, 39, 0.12);
  background: white;
  color: var(--text-main);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s;
}

.gk-rag-config-btn:hover {
  background: #f8fafc;
}

.gk-rag-config-icon {
  color: #6941c6;
  font-size: 15px;
  line-height: 1;
}

.gk-knowledge-btn {
  padding: 7px 14px;
  border-radius: 8px;
  border: 1px solid rgba(17, 24, 39, 0.12);
  background: white;
  color: var(--text-main);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}

.gk-knowledge-btn:hover {
  background: #f8fafc;
}

.gk-knowledge-btn.primary {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.gk-knowledge-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 20px;
  padding: 4px;
  border-radius: 8px;
  background: var(--bg);
}

.gk-knowledge-tab {
  flex: 1;
  border: none;
  border-radius: 6px;
  padding: 7px 8px;
  background: transparent;
  color: var(--text-subtle);
  font-size: 13px;
  font-weight: 500;
  text-align: center;
  cursor: pointer;
  transition: all 0.15s;
}

.gk-knowledge-tab.active {
  background: #fff;
  color: var(--primary);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.gk-input,
.gk-select,
.gk-textarea {
  font: inherit;
  border: 1px solid rgba(17, 24, 39, 0.12);
  border-radius: 10px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.95);
  min-width: 0;
}

.gk-select {
  min-width: 120px;
}

.gk-btn {
  border: 1px solid rgba(17, 24, 39, 0.12);
  border-radius: 999px;
  padding: 8px 14px;
  background: rgba(255, 255, 255, 0.9);
  cursor: pointer;
}
.gk-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.gk-btn--primary {
  background: var(--primary);
  color: #fff;
  border-color: transparent;
}

.gk-panel {
  min-width: 0;
}

.gk-table-wrap {
  overflow: auto;
}

.gk-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.gk-table th,
.gk-table td {
  text-align: left;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(17, 24, 39, 0.08);
  vertical-align: middle;
}
.gk-table th {
  color: var(--text-subtle);
  font-weight: 600;
  white-space: nowrap;
}

.gk-row {
  cursor: pointer;
}
.gk-row:hover {
  background: rgba(79, 110, 247, 0.04);
}

.gk-strong {
  font-weight: 600;
}

.gk-pill {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  background: rgba(15, 23, 42, 0.06);
}
.gk-pill--primary {
  background: rgba(79, 110, 247, 0.15);
  color: var(--primary);
}
.gk-pill--success {
  background: rgba(34, 197, 94, 0.15);
  color: #15803d;
}
.gk-pill--muted {
  color: var(--text-subtle);
}
.gk-pill--warning {
  background: rgba(245, 158, 11, 0.18);
  color: #b45309;
}
.gk-pill--danger {
  background: rgba(239, 68, 68, 0.15);
  color: #b91c1c;
}

.gk-actions {
  white-space: nowrap;
}
.gk-linkbtn {
  border: none;
  background: none;
  color: var(--primary);
  cursor: pointer;
  padding: 0 6px;
  font: inherit;
}
.gk-linkbtn--danger {
  color: #b91c1c;
}

.gk-muted {
  color: var(--text-subtle);
  font-size: 13px;
  margin: 0;
}
.gk-doc-hint {
  font-size: 12px;
}

.gk-note code {
  font-size: 12px;
}

.gk-rag-lead {
  margin: 0 0 14px;
  line-height: 1.65;
}

.gk-rag-lead code {
  font-size: 12px;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(15, 23, 42, 0.06);
}

.gk-rag-pipeline {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 8px 6px;
}

.gk-rag-step {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(17, 24, 39, 0.08);
  background: rgba(248, 250, 252, 0.95);
  flex: 1 1 140px;
  min-width: 120px;
  max-width: 200px;
}

.gk-rag-step-index {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  background: rgba(79, 110, 247, 0.15);
  color: var(--primary);
  font-size: 13px;
  font-weight: 700;
  display: grid;
  place-items: center;
}

.gk-rag-step-title {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 4px;
}

.gk-rag-step-desc {
  font-size: 12px;
  color: var(--text-subtle);
  line-height: 1.45;
}

.gk-rag-arrow {
  display: flex;
  align-items: center;
  color: var(--text-subtle);
  font-size: 14px;
  padding: 0 2px;
  user-select: none;
}

.gk-rag-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 14px;
}

.gk-rag-metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}

.gk-rag-metric {
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(17, 24, 39, 0.08);
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.gk-rag-metric--placeholder {
  border-style: dashed;
  opacity: 0.92;
}

.gk-rag-metric-label {
  font-size: 12px;
  color: var(--text-subtle);
}

.gk-rag-metric-value {
  font-size: 20px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.gk-rag-metric-delta {
  font-size: 11px;
  color: var(--text-subtle);
  line-height: 1.4;
}

.gk-rag-actions-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.gk-rag-link {
  font-size: 13px;
  font-weight: 600;
  color: var(--primary);
  text-decoration: none;
}

.gk-rag-link:hover {
  text-decoration: underline;
}

.gk-cell-mono {
  font-family: ui-monospace, monospace;
  font-size: 12px;
}

.gk-rag-kb-row td {
  vertical-align: middle;
}

.gk-rag-kb-row:hover {
  background: rgba(79, 110, 247, 0.04);
}

.gk-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.42);
  backdrop-filter: blur(6px);
}

.gk-modal {
  width: min(640px, 100%);
  max-height: calc(100vh - 48px);
  overflow: auto;
  border-radius: 24px;
  border: 1px solid rgba(79, 110, 247, 0.12);
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 24px 80px rgba(15, 23, 42, 0.22);
}

.gk-modal-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 20px 22px 0;
}

.gk-modal-title {
  font-size: 20px;
  font-weight: 700;
}
.gk-modal-desc {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-subtle);
  line-height: 1.5;
}
.gk-modal-desc code {
  font-size: 11px;
}

.gk-modal-close {
  border: none;
  border-radius: 999px;
  padding: 6px 10px;
  background: rgba(15, 23, 42, 0.06);
  cursor: pointer;
}

.gk-modal-error {
  margin: 12px 22px 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(239, 68, 68, 0.1);
  color: #b91c1c;
  font-size: 13px;
}

.gk-form {
  padding: 16px 22px 22px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.gk-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
}
.gk-field--row {
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.gk-field-hint {
  font-size: 12px;
  color: var(--text-subtle);
  line-height: 1.5;
}

.gk-field-hint code {
  font-size: 11px;
  padding: 0 4px;
  border-radius: 4px;
  background: rgba(15, 23, 42, 0.06);
}

.gk-field-hint--danger {
  color: #b91c1c;
}

.gk-textarea {
  resize: vertical;
  min-height: 64px;
}
.gk-textarea--code {
  font-family: ui-monospace, monospace;
  font-size: 12px;
}

.gk-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 8px;
}
</style>
