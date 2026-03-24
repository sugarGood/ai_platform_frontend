<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import CardPanel from '../../components/ui/CardPanel.vue'
import { useKbProjectPicker } from '../../composables/useKbProjectPicker'
import {
  deleteKbDocument,
  reingestKbDocument,
  uploadKbDocument,
  getKbDocument,
  getKbRagConfig,
  getKnowledgeBase,
  listKbDocuments,
  searchKnowledgeBase,
  updateKbRagConfig,
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
import type {
  CreateKnowledgeBaseRequest,
  KbDocumentResponse,
  KnowledgeBaseResponse,
} from '../../types/knowledge'

type ModalKind = 'none' | 'create-doc' | 'rag' | 'search' | 'edit-kb' | 'doc-detail'

const route = useRoute()
const router = useRouter()
const { projectsLoading, projectsLoadError, loadProjectOptions, optionsWithFallback } = useKbProjectPicker()

const kbId = computed(() => {
  const raw = route.params.kbId
  const n = typeof raw === 'string' ? Number(raw) : NaN
  return Number.isFinite(n) ? n : NaN
})

const kb = ref<KnowledgeBaseResponse | null>(null)
const docList = ref<KbDocumentResponse[]>([])
const kbLoading = ref(false)
const docsLoading = ref(false)
const banner = ref<{ tone: 'error' | 'success'; text: string } | null>(null)

const modalKind = ref<ModalKind>('none')
const modalError = ref('')
const submitting = ref(false)

const docForm = ref({
  title: '',
  injectMode: 'ON_DEMAND',
})

const docFileInputRef = ref<HTMLInputElement | null>(null)
const pendingDocFile = ref<File | null>(null)
const createDocFileHint = ref('')

/** 扩展名 → 知识库文档 fileType（与下拉选项一致） */
const DOC_EXT_TO_TYPE: Record<string, string> = {
  md: 'md',
  markdown: 'md',
  mkd: 'md',
  pdf: 'pdf',
  docx: 'docx',
  txt: 'txt',
  text: 'txt',
  log: 'txt',
}

/** 浏览器 MIME → fileType（扩展名缺失或不可靠时兜底） */
const MIME_TO_KB_FILE_TYPE: Record<string, string> = {
  'text/plain': 'txt',
  'text/markdown': 'md',
  'text/x-markdown': 'md',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
}

function docStemAndExt(fileName: string): { stem: string; ext: string } {
  const n = fileName.trim()
  if (!n) return { stem: '', ext: '' }
  const i = n.lastIndexOf('.')
  if (i <= 0 || i === n.length - 1) return { stem: n, ext: '' }
  return { stem: n.slice(0, i).trim() || n, ext: n.slice(i + 1).toLowerCase() }
}

function inferKbFileType(file: File): string | null {
  const { ext } = docStemAndExt(file.name)
  if (ext && DOC_EXT_TO_TYPE[ext]) return DOC_EXT_TO_TYPE[ext]

  const mime = (file.type ?? '').trim().toLowerCase()
  if (mime && MIME_TO_KB_FILE_TYPE[mime]) return MIME_TO_KB_FILE_TYPE[mime]
  if (mime.startsWith('text/')) return 'txt'

  return null
}

function resolvedCreateDocTitle(file: File): string {
  const { stem } = docStemAndExt(file.name)
  const t = stem.trim()
  return t || file.name.trim() || '未命名文档'
}

function applyCreateDocFileMeta(file: File) {
  docForm.value.title = resolvedCreateDocTitle(file)

  const inferred = inferKbFileType(file)
  if (inferred) {
    createDocFileHint.value = ''
    return
  }

  const { ext } = docStemAndExt(file.name)
  if (ext) {
    createDocFileHint.value = `未识别扩展名 .${ext}，仍可上传；具体解析由服务端处理。`
  } else {
    createDocFileHint.value = '无法从文件名或系统类型识别扩展名，仍可上传；具体解析由服务端处理。'
  }
}

const createDocInferredTypeLabel = computed(() => {
  const f = pendingDocFile.value
  if (!f) return ''
  return inferKbFileType(f) ?? '未识别（由服务端处理）'
})

const ragSnapshotJson = ref('')
const ragPutJson = ref('{\n  \n}')
const searchQuery = ref('')
const searchBodyJson = ref('')
const searchUseRawJson = ref(false)
const searchResultJson = ref('')

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

const docDetailJson = ref('')
/** 详情弹窗当前文档（用于重新解析等操作） */
const docDetailDoc = ref<KbDocumentResponse | null>(null)
const reingestingDocId = ref<number | null>(null)

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

const kbIdValid = computed(() => Number.isFinite(kbId.value))

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

function formatBytes(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function statusTone(status: string | null | undefined): 'success' | 'warning' | 'danger' | 'muted' {
  const s = (status ?? '').toUpperCase()
  if (s.includes('READY') || s.includes('DONE') || s.includes('SUCCESS') || s === 'ACTIVE') return 'success'
  if (s.includes('FAIL') || s.includes('ERROR')) return 'danger'
  if (s.includes('PEND') || s.includes('PROC') || s.includes('ING')) return 'warning'
  return 'muted'
}

/** 与后端约定：ERROR / PENDING / READY 可重刷；PROCESSING 时接口 409 */
function canOfferReingest(status: string | null | undefined): boolean {
  const s = (status ?? '').trim().toUpperCase()
  if (!s) return false
  if (s === 'PROCESSING' || s.includes('PROCESSING')) return false
  if (s === 'ERROR' || s === 'PENDING' || s === 'READY') return true
  if (s.includes('ERROR') || s.includes('FAIL')) return true
  if (s.startsWith('PENDING')) return true
  if (s.includes('READY') && !s.includes('NOT_READY')) return true
  return false
}

function goBack() {
  void router.push('/placeholder/knowledge')
}

async function loadKbMeta(id: number) {
  kbLoading.value = true
  try {
    kb.value = await getKnowledgeBase(id)
  } catch (e) {
    kb.value = null
    showBanner('error', e instanceof Error ? e.message : '加载知识库失败')
  } finally {
    kbLoading.value = false
  }
}

async function loadDocs(id: number) {
  docsLoading.value = true
  try {
    docList.value = await listKbDocuments(id)
  } catch (e) {
    docList.value = []
    showBanner('error', e instanceof Error ? e.message : '加载文档列表失败')
  } finally {
    docsLoading.value = false
  }
}

async function refreshAll() {
  const id = kbId.value
  if (!Number.isFinite(id)) return
  banner.value = null
  await Promise.all([loadKbMeta(id), loadDocs(id)])
}

watch(
  kbId,
  (id) => {
    if (!Number.isFinite(id)) {
      kb.value = null
      docList.value = []
      return
    }
    void refreshAll()
  },
  { immediate: true },
)

watch(
  () => ({ m: modalKind.value, scope: editKbForm.value.scope }),
  ({ m, scope }) => {
    if (m === 'edit-kb' && scope === 'PROJECT') void loadProjectOptions()
  },
)

function closeModal() {
  modalKind.value = 'none'
  modalError.value = ''
  submitting.value = false
  docDetailJson.value = ''
  docDetailDoc.value = null
}

async function openEditKbMeta() {
  const id = kbId.value
  if (!Number.isFinite(id)) return
  modalKind.value = 'edit-kb'
  modalError.value = ''
  try {
    const full = await getKnowledgeBase(id)
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
    const k = kb.value
    if (k) {
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
    await loadKbMeta(id)
  } catch (e) {
    modalError.value = e instanceof Error ? e.message : '更新失败'
  } finally {
    submitting.value = false
  }
}

async function openDocDetail(doc: KbDocumentResponse) {
  const id = kbId.value
  if (!Number.isFinite(id)) return
  modalKind.value = 'doc-detail'
  modalError.value = ''
  docDetailJson.value = ''
  docDetailDoc.value = null
  submitting.value = true
  try {
    const full = await getKbDocument(id, doc.id)
    docDetailDoc.value = full
    docDetailJson.value = JSON.stringify(full, null, 2)
  } catch (e) {
    modalError.value = e instanceof Error ? e.message : '加载文档详情失败'
  } finally {
    submitting.value = false
  }
}

function openCreateDoc() {
  modalKind.value = 'create-doc'
  modalError.value = ''
  createDocFileHint.value = ''
  docForm.value = { title: '', injectMode: 'ON_DEMAND' }
  pendingDocFile.value = null
  void nextTick(() => {
    if (docFileInputRef.value) docFileInputRef.value.value = ''
  })
}

function triggerPickCreateDocFile() {
  docFileInputRef.value?.click()
}

function onCreateDocFileSelected(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  createDocFileHint.value = ''
  if (!file) {
    pendingDocFile.value = null
    return
  }
  pendingDocFile.value = file
  applyCreateDocFileMeta(file)
}

async function openRagModal() {
  const id = kbId.value
  if (!Number.isFinite(id)) return
  modalKind.value = 'rag'
  modalError.value = ''
  ragPutJson.value = '{\n  \n}'
  try {
    const snap = await getKbRagConfig(id)
    ragSnapshotJson.value = JSON.stringify(snap, null, 2)
  } catch (e) {
    ragSnapshotJson.value = ''
    modalError.value = e instanceof Error ? e.message : '读取 RAG 配置失败'
  }
}

function openSearchModal() {
  modalKind.value = 'search'
  modalError.value = ''
  searchQuery.value = ''
  searchBodyJson.value = ''
  searchUseRawJson.value = false
  searchResultJson.value = ''
}

async function submitCreateDoc() {
  const id = kbId.value
  if (!Number.isFinite(id)) return
  const file = pendingDocFile.value
  if (!file) {
    modalError.value = '请选择本机文档。'
    return
  }
  submitting.value = true
  modalError.value = ''
  try {
    const titleOpt = docForm.value.title.trim() || undefined
    const im = docForm.value.injectMode.trim() || undefined
    await uploadKbDocument(id, file, { title: titleOpt, injectMode: im })
    showBanner('success', '文档已上传，向量化将异步进行。')
    closeModal()
    await refreshAll()
  } catch (e) {
    modalError.value = e instanceof Error ? e.message : '上传失败'
  } finally {
    submitting.value = false
  }
}

function parseStringRecord(raw: string): Record<string, string> {
  const trimmed = raw.trim()
  if (!trimmed) return {}
  const obj = JSON.parse(trimmed) as Record<string, unknown>
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new Error('配置须为 JSON 对象。')
  }
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') out[k] = v
    else if (v === null || v === undefined) out[k] = ''
    else out[k] = JSON.stringify(v)
  }
  return out
}

async function submitRagPut() {
  const id = kbId.value
  if (!Number.isFinite(id)) return
  submitting.value = true
  modalError.value = ''
  try {
    const body = parseStringRecord(ragPutJson.value)
    await updateKbRagConfig(id, body)
    showBanner('success', 'RAG 配置已保存。')
    const snap = await getKbRagConfig(id)
    ragSnapshotJson.value = JSON.stringify(snap, null, 2)
  } catch (e) {
    modalError.value = e instanceof Error ? e.message : '保存失败'
  } finally {
    submitting.value = false
  }
}

async function submitSearch() {
  const id = kbId.value
  if (!Number.isFinite(id)) return
  submitting.value = true
  modalError.value = ''
  try {
    let body: Record<string, unknown>
    if (searchUseRawJson.value) {
      const raw = searchBodyJson.value.trim()
      if (!raw) {
        modalError.value = '请填写 JSON 请求体。'
        submitting.value = false
        return
      }
      body = JSON.parse(raw) as Record<string, unknown>
      if (body === null || typeof body !== 'object' || Array.isArray(body)) {
        throw new Error('请求体须为 JSON 对象。')
      }
    } else {
      const q = searchQuery.value.trim()
      if (!q) {
        modalError.value = '请输入检索语句，或切换到「自定义 JSON」。'
        submitting.value = false
        return
      }
      body = { query: q }
    }
    const res = await searchKnowledgeBase(id, body)
    searchResultJson.value = JSON.stringify(res, null, 2)
  } catch (e) {
    modalError.value = e instanceof Error ? e.message : '检索失败'
    searchResultJson.value = ''
  } finally {
    submitting.value = false
  }
}

async function onDeleteDoc(doc: KbDocumentResponse) {
  const id = kbId.value
  if (!Number.isFinite(id)) return
  if (!window.confirm(`确定删除文档「${doc.title ?? doc.id}」？`)) return
  try {
    await deleteKbDocument(id, doc.id)
    showBanner('success', '文档已删除。')
    await refreshAll()
  } catch (e) {
    showBanner('error', e instanceof Error ? e.message : '删除失败')
  }
}

async function onReingestDoc(doc: KbDocumentResponse) {
  const id = kbId.value
  if (!Number.isFinite(id)) return
  reingestingDocId.value = doc.id
  try {
    const updated = await reingestKbDocument(id, doc.id)
    showBanner('success', '已提交重新解析，向量化将异步进行。')
    if (modalKind.value === 'doc-detail' && docDetailDoc.value?.id === doc.id) {
      docDetailDoc.value = updated
      docDetailJson.value = JSON.stringify(updated, null, 2)
    }
    await loadDocs(id)
  } catch (e) {
    showBanner('error', e instanceof Error ? e.message : '重新解析失败')
  } finally {
    reingestingDocId.value = null
  }
}

function onKeydown(ev: KeyboardEvent) {
  if (ev.key === 'Escape' && modalKind.value !== 'none') {
    ev.preventDefault()
    closeModal()
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div v-if="!kbIdValid" class="gk-root" data-testid="global-knowledge-docs-page">
    <div class="gk-banner gk-banner--error">知识库 ID 无效。</div>
    <button class="gk-btn" type="button" @click="goBack">← 返回知识库列表</button>
  </div>

  <div v-else class="gk-root" data-testid="global-knowledge-docs-page">
    <header class="gk-doc-head">
      <button class="gk-back-btn" type="button" @click="goBack">← 返回知识库列表</button>
      <div class="gk-doc-head-main">
        <div class="gk-title-row">
          <h1 class="gk-title">
            {{ kbLoading ? '加载中…' : kb?.name ?? '知识库' }}
          </h1>
          <span
            v-if="kb?.scope"
            class="gk-pill"
            :class="`gk-pill--${knowledgeScopeTone(kb.scope)}`"
            :title="`scope=${kb.scope}`"
          >
            {{ knowledgeScopeLabel(kb.scope) }}
          </span>
        </div>
        <p class="gk-sub">
          在此管理当前知识库下的文档：上传、查看、删除；向量化失败或需重刷时可「重新解析」。可配置 RAG 与发起检索试用。
        </p>
      </div>
    </header>

    <div v-if="banner" class="gk-banner" :class="`gk-banner--${banner.tone}`">
      {{ banner.text }}
    </div>

    <div class="gk-toolbar-bar">
      <button class="gk-toolbar-mini" type="button" :disabled="docsLoading || kbLoading" @click="refreshAll">
        刷新
      </button>
      <button class="gk-toolbar-mini" type="button" :disabled="kbLoading" @click="openEditKbMeta">编辑知识库</button>
      <div class="gk-toolbar-spacer" aria-hidden="true" />
      <button class="gk-rag-config-btn" type="button" @click="openRagModal">
        <span class="gk-rag-config-icon" aria-hidden="true">⚙️</span>
        RAG Pipeline 配置
      </button>
      <button class="gk-knowledge-btn primary" type="button" @click="openCreateDoc">+ 上传文档</button>
      <button class="gk-knowledge-btn" type="button" @click="openSearchModal">🔍 检索测试</button>
    </div>

    <CardPanel class="gk-panel" title="文档列表">
      <div v-if="docsLoading" class="gk-muted">加载文档中…</div>
      <div v-else class="gk-table-wrap">
        <table class="gk-table">
          <thead>
            <tr>
              <th>标题</th>
              <th>类型</th>
              <th>分块</th>
              <th>命中</th>
              <th>大小</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in docList" :key="d.id">
              <td class="gk-strong">{{ d.title ?? '—' }}</td>
              <td>{{ d.fileType ?? '—' }}</td>
              <td>{{ d.chunkCount ?? '—' }}</td>
              <td>{{ d.hitCount ?? '—' }}</td>
              <td>{{ formatBytes(d.fileSize ?? undefined) }}</td>
              <td>
                <span class="gk-pill" :class="`gk-pill--${statusTone(d.status)}`">{{ d.status ?? '—' }}</span>
              </td>
              <td>{{ formatDt(d.createdAt) }}</td>
              <td class="gk-actions">
                <button class="gk-linkbtn" type="button" @click="openDocDetail(d)">查看</button>
                <button
                  v-if="canOfferReingest(d.status)"
                  class="gk-linkbtn"
                  type="button"
                  :disabled="reingestingDocId === d.id"
                  @click="onReingestDoc(d)"
                >
                  {{ reingestingDocId === d.id ? '提交中…' : '重新解析' }}
                </button>
                <button class="gk-linkbtn gk-linkbtn--danger" type="button" @click="onDeleteDoc(d)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="!docList.length" class="gk-muted">暂无文档，点击「上传文档」添加。</p>
      </div>
    </CardPanel>

    <div
      v-if="modalKind !== 'none'"
      class="gk-modal-backdrop"
      data-testid="gk-docs-modal-backdrop"
      @click.self="closeModal"
    >
      <div class="gk-modal" role="dialog" aria-modal="true">
        <header class="gk-modal-head">
          <div>
            <div class="gk-modal-title">
              {{
                modalKind === 'create-doc'
                  ? '上传文档'
                  : modalKind === 'rag'
                    ? 'RAG 配置'
                    : modalKind === 'search'
                      ? '检索测试'
                      : modalKind === 'edit-kb'
                        ? '编辑知识库'
                        : modalKind === 'doc-detail'
                          ? '文档详情'
                          : ''
              }}
            </div>
            <div v-if="modalKind === 'doc-detail'" class="gk-modal-desc">
              只读查看该文档的完整信息；向量化失败、未完成或需全量重刷时可重新解析。若需变更文件内容请删除后重新上传。
            </div>
            <div v-if="modalKind === 'search'" class="gk-modal-desc">
              调用 <code>POST /api/knowledge-bases/{{ kbId }}/search</code>（API 根路径可由环境变量覆盖，默认为
              <code>/api</code>）。默认请求体为 <code>{ "query": "..." }</code>；若后端字段不同，请勾选「自定义 JSON」。
            </div>
            <div v-else-if="modalKind === 'rag'" class="gk-modal-desc">
              打开时已载入当前配置快照；保存时将按「键值对」形式的 JSON 写回（具体字段以平台约定为准）。
            </div>
          </div>
          <button class="gk-modal-close" type="button" aria-label="关闭" @click="closeModal">✕</button>
        </header>

        <div v-if="modalError" class="gk-modal-error">{{ modalError }}</div>

        <div v-if="modalKind === 'create-doc'" class="gk-form">
          <p class="gk-muted">
            目标知识库：<strong>{{ kb?.name ?? '—' }}</strong>（ID {{ kbId }}）
          </p>
          <label class="gk-field">
            <span>本机文档 *</span>
            <input
              ref="docFileInputRef"
              class="gk-file-input-hidden"
              type="file"
              accept=".md,.markdown,.pdf,.docx,.txt,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              @change="onCreateDocFileSelected"
            />
            <div class="gk-file-pick-row">
              <button class="gk-btn" type="button" @click="triggerPickCreateDocFile">选择本机文件</button>
              <span class="gk-file-pick-meta" :class="{ 'gk-file-pick-meta--empty': !pendingDocFile }">
                {{ pendingDocFile ? `${pendingDocFile.name}（${formatBytes(pendingDocFile.size)}）` : '未选择文件' }}
              </span>
            </div>
            <span v-if="createDocFileHint" class="gk-field-hint gk-field-hint--danger">{{ createDocFileHint }}</span>
            <span v-else-if="pendingDocFile" class="gk-field-hint">
              文件将上传至对象存储并登记元数据；标题可改，不传标题时由服务端按文件名处理。
            </span>
          </label>
          <p v-if="pendingDocFile" class="gk-muted">
            参考类型：<strong>{{ createDocInferredTypeLabel }}</strong>（实际上传由服务端识别）
          </p>
          <label class="gk-field">
            <span>标题（可选，自动解析可改）</span>
            <input v-model="docForm.title" class="gk-input" type="text" placeholder="留空则交由服务端命名" />
          </label>
          <label class="gk-field">
            <span>注入模式</span>
            <select v-model="docForm.injectMode" class="gk-select">
              <option v-for="o in KNOWLEDGE_INJECT_MODE_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
            <span class="gk-field-hint">与知识库一致；具体以后端支持为准。</span>
          </label>
          <footer class="gk-modal-footer">
            <button class="gk-btn" type="button" @click="closeModal">取消</button>
            <button class="gk-btn gk-btn--primary" type="button" :disabled="submitting" @click="submitCreateDoc">
              {{ submitting ? '提交中…' : '上传' }}
            </button>
          </footer>
        </div>

        <div v-else-if="modalKind === 'rag'" class="gk-form">
          <label class="gk-field">
            <span>当前快照（只读）</span>
            <textarea :value="ragSnapshotJson" class="gk-textarea gk-textarea--code" rows="8" readonly />
          </label>
          <label class="gk-field">
            <span>PUT 请求体（字符串键值 JSON）</span>
            <textarea v-model="ragPutJson" class="gk-textarea gk-textarea--code" rows="6" />
          </label>
          <footer class="gk-modal-footer">
            <button class="gk-btn" type="button" @click="closeModal">关闭</button>
            <button class="gk-btn gk-btn--primary" type="button" :disabled="submitting" @click="submitRagPut">
              {{ submitting ? '保存中…' : '保存配置' }}
            </button>
          </footer>
        </div>

        <div v-else-if="modalKind === 'search'" class="gk-form">
          <label class="gk-field gk-field--row">
            <input v-model="searchUseRawJson" type="checkbox" />
            <span>自定义 JSON 请求体</span>
          </label>
          <template v-if="!searchUseRawJson">
            <label class="gk-field">
              <span>Query</span>
              <input v-model="searchQuery" class="gk-input" type="text" placeholder="例如：如何配置支付回调？" />
            </label>
          </template>
          <template v-else>
            <label class="gk-field">
              <span>JSON</span>
              <textarea v-model="searchBodyJson" class="gk-textarea gk-textarea--code" rows="6" placeholder="{}" />
            </label>
          </template>
          <label class="gk-field">
            <span>响应</span>
            <textarea
              :value="searchResultJson"
              class="gk-textarea gk-textarea--code"
              rows="10"
              readonly
              placeholder="执行后显示…"
            />
          </label>
          <footer class="gk-modal-footer">
            <button class="gk-btn" type="button" @click="closeModal">关闭</button>
            <button class="gk-btn gk-btn--primary" type="button" :disabled="submitting" @click="submitSearch">
              {{ submitting ? '请求中…' : '执行检索' }}
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

        <div v-else-if="modalKind === 'doc-detail'" class="gk-form">
          <p v-if="submitting" class="gk-muted">加载中…</p>
          <label v-else class="gk-field">
            <span>响应 JSON</span>
            <textarea
              :value="docDetailJson"
              class="gk-textarea gk-textarea--code"
              rows="14"
              readonly
              placeholder="（无数据）"
            />
          </label>
          <footer class="gk-modal-footer">
            <button class="gk-btn" type="button" @click="closeModal">关闭</button>
            <button
              v-if="docDetailDoc && canOfferReingest(docDetailDoc.status)"
              class="gk-btn gk-btn--primary"
              type="button"
              :disabled="reingestingDocId === docDetailDoc.id || submitting"
              @click="onReingestDoc(docDetailDoc)"
            >
              {{
                reingestingDocId === docDetailDoc.id ? '提交中…' : '重新解析'
              }}
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

.gk-doc-head {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}

.gk-back-btn {
  border: none;
  background: rgba(15, 23, 42, 0.06);
  border-radius: 999px;
  padding: 6px 14px;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  color: var(--primary);
}

.gk-doc-head-main {
  min-width: 0;
}

.gk-title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.gk-title {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
}

.gk-sub {
  margin: 6px 0 0;
  color: var(--text-subtle);
  line-height: 1.6;
  font-size: 13px;
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

.gk-toolbar-bar {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 12px;
  margin-bottom: 4px;
  padding: 0;
  min-width: 0;
}

.gk-toolbar-spacer {
  flex: 1 1 auto;
  min-width: 16px;
  height: 1px;
}

.gk-toolbar-mini {
  padding: 7px 14px;
  flex: 0 0 auto;
  cursor: pointer;
  font-weight: 500;
  font: inherit;
  font-size: 13px;
  border: 1px solid rgba(17, 24, 39, 0.1);
  border-radius: 8px;
  background: white;
}

.gk-toolbar-mini:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.gk-toolbar-mini:hover:not(:disabled) {
  background: #f8fafc;
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
  font: inherit;
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
  font: inherit;
}

.gk-knowledge-btn:hover {
  background: #f8fafc;
}

.gk-knowledge-btn.primary {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
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

.gk-linkbtn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.gk-muted {
  color: var(--text-subtle);
  font-size: 13px;
  margin: 0;
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
  font: inherit;
}

.gk-btn--primary {
  background: var(--primary);
  color: #fff;
  border-color: transparent;
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

.gk-file-input-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.gk-file-pick-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.gk-file-pick-meta {
  font-size: 13px;
  color: var(--text-main);
  word-break: break-all;
}

.gk-file-pick-meta--empty {
  color: var(--text-subtle);
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
