<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { loadProjectKnowledgeFromApi } from '../../composables/useProjects'
import {
  PROJECT_KB_INJECT_MODE_DEFAULT,
  PROJECT_KB_INJECT_MODE_OPTIONS,
} from '../../lib/project-knowledge-inject-mode-options'
import type { ProjectInheritedGlobalKbItem, TableCell, TableData } from '../../types/module-page'
import type { KnowledgeBaseResponse } from '../../types/knowledge'
import { KNOWLEDGE_EMBEDDING_MODEL_OPTIONS } from '../../lib/knowledge-embedding-model-options'
import { KNOWLEDGE_INJECT_MODE_OPTIONS } from '../../lib/knowledge-inject-mode-options'
import {
  createProjectDedicatedKnowledgeBase,
  deleteProjectKnowledgeConfig,
  enableProjectKnowledgeBase,
  listKnowledgeBases,
  updateProjectKnowledgeConfig,
} from '../../services/knowledge'
import CardPanel from './CardPanel.vue'

const props = defineProps<{
  projectName: string
  projectId?: string
  /** 数字 id 项目：后端同步的继承列表；`undefined` 表示尚未写入缓存（加载中） */
  inheritedGlobalKbs?: ProjectInheritedGlobalKbItem[]
  knowledgeTable?: TableData
  skillTable?: TableData
  toolTable?: TableData
}>()

const tab = ref<'kb' | 'skills' | 'tools' | 'integrations'>('kb')

const isNumericProject = computed(() => /^\d+$/.test(props.projectId ?? ''))

function enterKbTo(kbId: number): string {
  return `/projects/${props.projectId}/knowledge/${kbId}`
}

/** 非后端项目：保留原型文案；演示用 kbId 仅用于可点的「进入知识库」占位 */
const staticInheritedRows = [
  {
    name: '公司代码规范 v3.0',
    description: '适用范围：全企业 · 18 个项目引用 · 每次请求自动注入摘要',
    tailAction: 'inject' as const,
    icon: 'doc' as const,
    demoKbId: 101,
  },
  {
    name: '安全开发手册',
    description: '适用范围：全企业 · OWASP Top 10 规范 · 安全审查时自动调用',
    tailAction: 'inject' as const,
    icon: 'lock' as const,
    demoKbId: 102,
  },
  {
    name: '微服务架构指南',
    description: '适用范围：全企业 · 包含领域划分、接口规范、部署模式',
    tailAction: 'disable' as const,
    icon: 'arch' as const,
    demoKbId: 103,
  },
]

function inheritedEmoji(icon: 'doc' | 'lock' | 'arch') {
  if (icon === 'lock') return '🔒'
  if (icon === 'arch') return '🏗️'
  return '📄'
}

function cellClass(cell: TableCell) {
  return [cell.tone ? `tone-${cell.tone}` : 'tone-default', cell.mono ? 'cell-mono' : '']
}

const knowledgeDisplay = computed(() => {
  const t = props.knowledgeTable
  if (t && t.rows.length > 0) return t
  return {
    columns: ['文档名称', '状态', '分块数', '上传者', '更新时间', '操作'],
    rows: [
      [
        { text: '📄 商城需求文档 v2.3' },
        { text: '✓ 已向量化', tone: 'success', display: 'tag' },
        { text: '248 块' },
        { text: '张三' },
        { text: '2026-03-06' },
        { text: '查看 · 删除' },
      ],
      [
        { text: '📋 接口文档 - 商品模块' },
        { text: '✓ 已向量化', tone: 'success', display: 'tag' },
        { text: '87 块' },
        { text: 'AI生成' },
        { text: '2026-03-04' },
        { text: '查看 · 删除' },
      ],
      [
        { text: '📋 系统架构设计文档' },
        { text: '⟳ 向量化中', tone: 'primary', display: 'tag' },
        { text: '—' },
        { text: '王五' },
        { text: '2026-03-19' },
        { text: '处理中…', tone: 'muted' },
      ],
    ],
  } satisfies TableData
})

const pickGlobalOpen = ref(false)
const pickGlobalLoading = ref(false)
const pickGlobalSubmitting = ref(false)
const pickGlobalError = ref('')
const globalKbCandidates = ref<KnowledgeBaseResponse[]>([])
/** 待启用（多选） */
const selectedKbIds = ref<number[]>([])
/** 每条待启用库的注入方式（取消勾选时删除对应键） */
const injectModes = reactive<Record<number, string>>({})

const enabledKbIdSet = computed(
  () => new Set(props.inheritedGlobalKbs?.map((x) => x.kbId) ?? []),
)

function clearInjectModes() {
  for (const k of Object.keys(injectModes)) {
    delete injectModes[Number(k)]
  }
}

function closePickGlobalModal() {
  pickGlobalOpen.value = false
  pickGlobalError.value = ''
  selectedKbIds.value = []
  clearInjectModes()
}

function togglePickKb(id: number) {
  if (enabledKbIdSet.value.has(id)) return
  const cur = selectedKbIds.value
  const i = cur.indexOf(id)
  if (i >= 0) {
    selectedKbIds.value = cur.filter((x) => x !== id)
    delete injectModes[id]
  } else {
    selectedKbIds.value = [...cur, id]
    if (!(id in injectModes)) injectModes[id] = PROJECT_KB_INJECT_MODE_DEFAULT
  }
}

function setPickInjectMode(kbId: number, value: string) {
  injectModes[kbId] = value
}

function onPickInjectChange(kbId: number, ev: Event) {
  const t = ev.target as HTMLSelectElement
  setPickInjectMode(kbId, t.value)
}

function isPickKbChecked(id: number) {
  return selectedKbIds.value.includes(id)
}

async function openPickGlobalModal() {
  if (!isNumericProject.value || !props.projectId) return
  pickGlobalOpen.value = true
  pickGlobalLoading.value = true
  pickGlobalError.value = ''
  selectedKbIds.value = []
  clearInjectModes()
  try {
    const list = await listKnowledgeBases('GLOBAL')
    globalKbCandidates.value = list
      .filter((k) => (k.scope ?? '').toUpperCase() === 'GLOBAL')
      .slice()
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'zh-Hans-CN'))
  } catch (e) {
    globalKbCandidates.value = []
    pickGlobalError.value = e instanceof Error ? e.message : '加载全局知识库失败'
  } finally {
    pickGlobalLoading.value = false
  }
}

async function submitPickGlobalEnable() {
  if (!props.projectId) return
  const pid = Number(props.projectId)
  const toEnable = selectedKbIds.value.filter((id) => !enabledKbIdSet.value.has(id))
  if (toEnable.length === 0) {
    pickGlobalError.value = '请至少勾选一条尚未接入的全局知识库。'
    return
  }
  pickGlobalSubmitting.value = true
  pickGlobalError.value = ''
  try {
    for (const kbId of toEnable) {
      const injectMode = injectModes[kbId] ?? PROJECT_KB_INJECT_MODE_DEFAULT
      await enableProjectKnowledgeBase(pid, kbId, { injectMode })
    }
    await loadProjectKnowledgeFromApi(props.projectId)
    closePickGlobalModal()
  } catch (e) {
    pickGlobalError.value = e instanceof Error ? e.message : '启用失败'
  } finally {
    pickGlobalSubmitting.value = false
  }
}

const createDedicatedOpen = ref(false)
const createDedicatedSubmitting = ref(false)
const createDedicatedError = ref('')
const createDedicatedForm = ref({
  name: '',
  description: '',
  embeddingModel: '',
  injectMode: 'ON_DEMAND',
})

function closeCreateDedicatedModal() {
  createDedicatedOpen.value = false
  createDedicatedError.value = ''
  createDedicatedForm.value = {
    name: '',
    description: '',
    embeddingModel: '',
    injectMode: 'ON_DEMAND',
  }
}

function openCreateDedicatedModal() {
  if (!isNumericProject.value || !props.projectId) return
  createDedicatedError.value = ''
  createDedicatedForm.value = {
    name: '',
    description: '',
    embeddingModel: '',
    injectMode: 'ON_DEMAND',
  }
  createDedicatedOpen.value = true
}

async function submitCreateDedicatedKb() {
  if (!props.projectId) return
  const name = createDedicatedForm.value.name.trim()
  if (!name) {
    createDedicatedError.value = '请填写知识库名称。'
    return
  }
  const pid = Number(props.projectId)
  createDedicatedSubmitting.value = true
  createDedicatedError.value = ''
  try {
    const desc = createDedicatedForm.value.description.trim()
    const em = createDedicatedForm.value.embeddingModel.trim()
    const im = createDedicatedForm.value.injectMode.trim() || 'ON_DEMAND'
    await createProjectDedicatedKnowledgeBase(pid, {
      name,
      injectMode: im,
      ...(desc ? { description: desc } : {}),
      ...(em ? { embeddingModel: em } : {}),
    })
    await loadProjectKnowledgeFromApi(props.projectId)
    closeCreateDedicatedModal()
  } catch (e) {
    createDedicatedError.value = e instanceof Error ? e.message : '创建失败'
  } finally {
    createDedicatedSubmitting.value = false
  }
}

function onKbOverlayKeydown(ev: KeyboardEvent) {
  if (ev.key !== 'Escape') return
  if (pickGlobalOpen.value) {
    ev.preventDefault()
    closePickGlobalModal()
  }
  if (createDedicatedOpen.value) {
    ev.preventDefault()
    closeCreateDedicatedModal()
  }
}

onMounted(() => document.addEventListener('keydown', onKbOverlayKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKbOverlayKeydown))

const inheritSavingKbId = ref<number | null>(null)
const inheritDeletingConfigId = ref<number | null>(null)

function normalizeInheritedInjectMode(raw: string | null | undefined): string {
  const s = (raw ?? '').trim().toUpperCase()
  if (PROJECT_KB_INJECT_MODE_OPTIONS.some((o) => o.value === s)) return s
  return PROJECT_KB_INJECT_MODE_DEFAULT
}

function inheritedInjectModeLabel(raw: string | null | undefined): string {
  const v = normalizeInheritedInjectMode(raw)
  return PROJECT_KB_INJECT_MODE_OPTIONS.find((o) => o.value === v)?.label ?? '自动注入'
}

function canManageInheritedItem(item: ProjectInheritedGlobalKbItem): boolean {
  const id = item.projectKnowledgeConfigId
  return isNumericProject.value && id != null && id > 0
}

async function onInheritedInjectChange(item: ProjectInheritedGlobalKbItem, ev: Event) {
  if (!props.projectId || !canManageInheritedItem(item)) return
  const cfgId = item.projectKnowledgeConfigId
  if (cfgId == null || cfgId <= 0) return
  const value = (ev.target as HTMLSelectElement).value
  inheritSavingKbId.value = item.kbId
  try {
    await updateProjectKnowledgeConfig(Number(props.projectId), cfgId, { injectMode: value })
    await loadProjectKnowledgeFromApi(props.projectId)
  } catch (e) {
    window.alert(e instanceof Error ? e.message : '更新注入方式失败')
  } finally {
    inheritSavingKbId.value = null
  }
}

async function cancelInheritedKb(item: ProjectInheritedGlobalKbItem) {
  const cfgId = item.projectKnowledgeConfigId
  if (!props.projectId || cfgId == null || cfgId <= 0) return
  if (!window.confirm(`确定取消本项目对「${item.name}」的全局知识库继承？`)) return
  inheritDeletingConfigId.value = cfgId
  try {
    await deleteProjectKnowledgeConfig(Number(props.projectId), cfgId)
    await loadProjectKnowledgeFromApi(props.projectId)
  } catch (e) {
    window.alert(e instanceof Error ? e.message : '取消继承失败')
  } finally {
    inheritDeletingConfigId.value = null
  }
}

function inheritCardEmoji(i: number) {
  if (i % 3 === 1) return '🔒'
  if (i % 3 === 2) return '🏗️'
  return '📄'
}

function inheritCardIconTone(i: number): 'default' | 'rose' | 'mint' {
  if (i % 3 === 1) return 'rose'
  if (i % 3 === 2) return 'mint'
  return 'default'
}

const toolDisplay = computed(() => {
  const t = props.toolTable
  if (t && t.rows.length > 0) return t
  return {
    columns: ['工具名称', '来源', '分类', '所需权限', '审计级别', '状态', '操作'],
    rows: [
      [
        { text: 'search_knowledge', mono: true },
        { text: '平台内置', tone: 'success', display: 'tag' },
        { text: '知识库' },
        { text: 'knowledge.read', mono: true },
        { text: '普通', tone: 'muted', display: 'tag' },
        { text: '● 启用', tone: 'success', display: 'tag' },
        { text: '详情' },
      ],
      [
        { text: 'list_skills', mono: true },
        { text: '平台内置', tone: 'success', display: 'tag' },
        { text: '平台' },
        { text: '—' },
        { text: '普通', tone: 'muted', display: 'tag' },
        { text: '● 启用', tone: 'success', display: 'tag' },
        { text: '详情' },
      ],
      [
        { text: 'query_jira', mono: true },
        { text: '企业级', tone: 'primary', display: 'tag' },
        { text: '项目管理' },
        { text: 'jira.read', mono: true },
        { text: '普通', tone: 'muted', display: 'tag' },
        { text: '● 启用', tone: 'success', display: 'tag' },
        { text: '详情' },
      ],
      [
        { text: 'create_jira', mono: true },
        { text: '企业级', tone: 'primary', display: 'tag' },
        { text: '项目管理' },
        { text: 'jira.write', mono: true },
        { text: '敏感', tone: 'warning', display: 'tag' },
        { text: '● 启用', tone: 'success', display: 'tag' },
        { text: '详情' },
      ],
      [
        { text: 'query_order_db', mono: true },
        { text: '项目级', tone: 'warning', display: 'tag' },
        { text: '数据' },
        { text: 'db.read', mono: true },
        { text: '关键', tone: 'danger', display: 'tag' },
        { text: '● 启用', tone: 'success', display: 'tag' },
        { text: '详情' },
      ],
      [
        { text: 'trigger_deploy', mono: true },
        { text: '企业级', tone: 'primary', display: 'tag' },
        { text: '部署' },
        { text: 'deploy.write', mono: true },
        { text: '关键', tone: 'danger', display: 'tag' },
        { text: '● 禁用', tone: 'muted', display: 'tag' },
        { text: '启用' },
      ],
    ],
  } satisfies TableData
})
</script>

<template>
  <div class="ai-cap-root">
    <div class="proto-tabs" role="tablist" aria-label="AI 能力配置">
      <button
        type="button"
        class="proto-tab"
        :class="{ active: tab === 'kb' }"
        @click="tab = 'kb'"
      >
        📚 知识库
      </button>
      <button
        type="button"
        class="proto-tab"
        :class="{ active: tab === 'skills' }"
        @click="tab = 'skills'"
      >
        ⚡ 技能库
      </button>
      <button
        type="button"
        class="proto-tab"
        :class="{ active: tab === 'tools' }"
        @click="tab = 'tools'"
      >
        🔩 工具集
      </button>
      <button
        type="button"
        class="proto-tab"
        :class="{ active: tab === 'integrations' }"
        @click="tab = 'integrations'"
      >
        🔌 集成
      </button>
    </div>

    <div v-show="tab === 'kb'" class="ai-cap-panel">
      <div class="ai-cap-toolbar ai-cap-toolbar--kb">
        <div class="ai-cap-toolbar-text">
          <span class="ai-cap-hint">项目知识库</span>
          <span class="ai-cap-subhint">继承的平台全局库将参与本项目检索；可在下方单独调整注入策略。</span>
        </div>
        <button
          type="button"
          class="btn-kb-add"
          :disabled="!isNumericProject"
          :title="!isNumericProject ? '仅在后端数字 ID 项目中可用' : undefined"
          @click="openPickGlobalModal"
        >
          <span class="btn-kb-add__ico" aria-hidden="true">＋</span>
          添加全局知识库
        </button>
      </div>

      <CardPanel title="🌐 继承自企业全局知识库">
        <template #header-extra>
          <span class="inherit-panel-badge">已接入</span>
        </template>
        <p v-if="isNumericProject && inheritedGlobalKbs === undefined" class="inherit-empty inherit-empty--loading">
          正在同步继承列表…
        </p>
        <div
          v-else-if="isNumericProject && inheritedGlobalKbs?.length === 0"
          class="inherit-empty"
        >
          <p class="inherit-empty__title">尚未接入全局知识库</p>
          <p class="inherit-empty__desc">
            点击上方「添加全局知识库」，从平台目录中勾选需要在本项目启用的库，并设置注入方式。
          </p>
        </div>
        <div v-else-if="isNumericProject && inheritedGlobalKbs?.length" class="inherit-kb-list">
          <article
            v-for="(item, i) in inheritedGlobalKbs"
            :key="item.kbId"
            class="inherit-kb-card"
          >
            <div class="inherit-kb-card__top">
              <div
                class="inherit-kb-card__icon"
                :class="{
                  'inherit-kb-card__icon--rose': inheritCardIconTone(i) === 'rose',
                  'inherit-kb-card__icon--mint': inheritCardIconTone(i) === 'mint',
                }"
              >
                {{ inheritCardEmoji(i) }}
              </div>
              <div class="inherit-kb-card__body">
                <div class="inherit-kb-card__headline">
                  <h3 class="inherit-kb-card__title">{{ item.name }}</h3>
                  <RouterLink
                    v-if="projectId"
                    class="inherit-kb-card__link-enter"
                    :to="enterKbTo(item.kbId)"
                  >
                    查看文档
                    <span class="inherit-kb-card__link-arrow" aria-hidden="true">→</span>
                  </RouterLink>
                </div>
                <p class="inherit-kb-card__desc">{{ item.description }}</p>
              </div>
            </div>
            <footer v-if="canManageInheritedItem(item)" class="inherit-kb-card__footer">
              <div class="inherit-kb-card__field">
                <span :id="'inj-label-' + item.kbId" class="inherit-kb-card__field-label">注入策略</span>
                <div class="inherit-kb-card__select-shell">
                  <select
                    :id="'inherit-inject-' + item.kbId"
                    class="inherit-kb-card__select"
                    :aria-labelledby="'inj-label-' + item.kbId"
                    :value="normalizeInheritedInjectMode(item.injectMode ?? undefined)"
                    :disabled="inheritSavingKbId === item.kbId"
                    @change="onInheritedInjectChange(item, $event)"
                  >
                    <option
                      v-for="o in PROJECT_KB_INJECT_MODE_OPTIONS"
                      :key="o.value"
                      :value="o.value"
                    >
                      {{ o.label }}
                    </option>
                  </select>
                </div>
                <span v-if="inheritSavingKbId === item.kbId" class="inherit-kb-card__saving">保存中…</span>
              </div>
              <button
                type="button"
                class="inherit-kb-card__btn-unlink"
                :disabled="inheritDeletingConfigId === item.projectKnowledgeConfigId"
                @click="cancelInheritedKb(item)"
              >
                {{ inheritDeletingConfigId === item.projectKnowledgeConfigId ? '移除中…' : '取消继承' }}
              </button>
            </footer>
            <footer v-else class="inherit-kb-card__footer inherit-kb-card__footer--readonly">
              <span class="inherit-kb-card__pill">{{ inheritedInjectModeLabel(item.injectMode ?? undefined) }}</span>
              <span class="inherit-kb-card__hint-muted">配置 ID 未返回时仅可浏览</span>
            </footer>
          </article>
        </div>
        <div v-else class="inherit-kb-list">
          <article v-for="row in staticInheritedRows" :key="row.name" class="inherit-kb-card inherit-kb-card--demo">
            <div class="inherit-kb-card__top">
              <div
                class="inherit-kb-card__icon"
                :class="{
                  'inherit-kb-card__icon--rose': row.icon === 'lock',
                  'inherit-kb-card__icon--mint': row.icon === 'arch',
                }"
              >
                {{ inheritedEmoji(row.icon) }}
              </div>
              <div class="inherit-kb-card__body">
                <div class="inherit-kb-card__headline">
                  <h3 class="inherit-kb-card__title">{{ row.name }}</h3>
                  <RouterLink
                    v-if="projectId"
                    class="inherit-kb-card__link-enter"
                    :to="enterKbTo(row.demoKbId)"
                  >
                    查看文档
                    <span class="inherit-kb-card__link-arrow" aria-hidden="true">→</span>
                  </RouterLink>
                </div>
                <p class="inherit-kb-card__desc">{{ row.description }}</p>
              </div>
            </div>
            <footer class="inherit-kb-card__footer inherit-kb-card__footer--demo">
              <span v-if="row.tailAction === 'inject'" class="inherit-kb-card__pill">自动注入</span>
              <button v-else type="button" class="inherit-kb-card__btn-unlink">关闭继承</button>
              <span class="inherit-kb-card__hint-muted">演示数据</span>
            </footer>
          </article>
        </div>
      </CardPanel>

      <CardPanel title="📁 项目专属知识库">
        <template #header-extra>
          <div class="kb-head-tools">
            <button
              type="button"
              class="btn-kb-add btn-kb-add--compact"
              :disabled="!isNumericProject"
              :title="!isNumericProject ? '仅在后端数字 ID 项目中可用' : undefined"
              data-testid="project-add-dedicated-kb"
              @click="openCreateDedicatedModal"
            >
              <span class="btn-kb-add__ico" aria-hidden="true">＋</span>
              添加知识库
            </button>
            <input class="kb-input" type="text" placeholder="测试检索效果…" />
            <button type="button" class="btn-primary-xs">🔍 检索测试</button>
          </div>
        </template>
        <div class="table-shell">
          <table class="proto-table">
            <thead>
              <tr>
                <th v-for="col in knowledgeDisplay.columns" :key="col">{{ col }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, ri) in knowledgeDisplay.rows" :key="ri">
                <td v-for="(cell, ci) in row" :key="ci" :class="{ 'td-tag': cell.display === 'tag' }">
                  <span
                    v-if="cell.display === 'tag'"
                    class="badge-pill-tag"
                    :class="cellClass(cell)"
                  >{{ cell.text }}</span>
                  <RouterLink
                    v-else-if="cell.to"
                    :to="cell.to"
                    class="proto-table-link"
                    :class="[
                      cellClass(cell),
                      cell.text === '进入知识库' ? 'proto-table-link--enter-kb' : '',
                    ]"
                  >{{ cell.text }}</RouterLink>
                  <span v-else :class="cellClass(cell)">{{ cell.text }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardPanel>
    </div>

    <div v-show="tab === 'skills'" class="ai-cap-panel">
      <div class="ai-cap-toolbar">
        <span class="ai-cap-hint">项目技能 + 继承全局技能</span>
        <button type="button" class="btn-primary-sm">+ 新建技能</button>
      </div>

      <CardPanel title="🌐 继承自企业全局技能库">
        <div class="skill-stack">
          <div class="skill-row">
            <div class="skill-ico">🔍</div>
            <div class="skill-main">
              <div class="skill-name-row">
                <span class="skill-name">代码审查</span>
                <code class="skill-cmd">/code-review</code>
              </div>
              <div class="skill-desc">规范 · 安全 · 性能三维度全面审查 · 本月全企业使用 312 次</div>
            </div>
            <div class="skill-actions">
              <span class="badge-green">已订阅</span>
              <button type="button" class="btn-ghost-xs">克隆定制</button>
            </div>
          </div>
          <div class="skill-row">
            <div class="skill-ico skill-ico--red">🐛</div>
            <div class="skill-main">
              <div class="skill-name-row">
                <span class="skill-name">Bug 分析</span>
                <code class="skill-cmd">/bug-analysis</code>
              </div>
              <div class="skill-desc">日志分析 + 根因定位 + 修复建议 · 本月使用 89 次</div>
            </div>
            <div class="skill-actions">
              <span class="badge-green">已订阅</span>
              <button type="button" class="btn-ghost-xs">克隆定制</button>
            </div>
          </div>
          <div class="skill-row">
            <div class="skill-ico skill-ico--green">📝</div>
            <div class="skill-main">
              <div class="skill-name-row">
                <span class="skill-name">文档生成</span>
                <code class="skill-cmd">/doc-gen</code>
              </div>
              <div class="skill-desc">代码 → OpenAPI 文档 / README 自动生成</div>
            </div>
            <div class="skill-actions">
              <span class="badge-gray">未订阅</span>
              <button type="button" class="btn-primary-xs">订阅</button>
            </div>
          </div>
        </div>
      </CardPanel>

      <CardPanel :title="`🛒 项目专属技能（${projectName}）`">
        <div class="skill-stack">
          <div class="skill-row">
            <div class="skill-ico skill-ico--purple">🛒</div>
            <div class="skill-main">
              <div class="skill-name-row">
                <span class="skill-name">商城代码审查（项目定制版）</span>
                <code class="skill-cmd">/mall-review</code>
                <span class="badge-green">已发布</span>
              </div>
              <div class="skill-desc">基于企业 code-review 克隆 · 额外注入商城业务规范 + 支付安全规则</div>
            </div>
            <div class="skill-actions">
              <button type="button" class="btn-ghost-xs">▶ 测试</button>
              <button type="button" class="btn-ghost-xs">✏️ 编辑</button>
            </div>
          </div>
          <div class="skill-row">
            <div class="skill-ico skill-ico--amber">📊</div>
            <div class="skill-main">
              <div class="skill-name-row">
                <span class="skill-name">订单业务分析</span>
                <code class="skill-cmd">/order-analysis</code>
                <span class="badge-yellow">草稿</span>
              </div>
              <div class="skill-desc">结合订单状态机文档，分析业务逻辑与异常流</div>
            </div>
            <div class="skill-actions">
              <button type="button" class="btn-ghost-xs">▶ 测试</button>
              <button type="button" class="btn-primary-xs">发布</button>
            </div>
          </div>
        </div>
      </CardPanel>

      <CardPanel v-if="skillTable && skillTable.rows.length" title="后端已同步的 Skill" class="mt-card">
        <div class="table-shell">
          <table class="proto-table">
            <thead>
              <tr>
                <th v-for="col in skillTable.columns" :key="col">{{ col }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, ri) in skillTable.rows" :key="ri">
                <td v-for="(cell, ci) in row" :key="ci" :class="{ 'td-tag': cell.display === 'tag' }">
                  <span
                    v-if="cell.display === 'tag'"
                    class="badge-pill-tag"
                    :class="cellClass(cell)"
                  >{{ cell.text }}</span>
                  <span v-else :class="cellClass(cell)">{{ cell.text }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardPanel>
    </div>

    <div v-show="tab === 'tools'" class="ai-cap-panel">
      <div class="ai-cap-toolbar">
        <span class="ai-cap-hint">平台内置 + 企业级 + 项目级工具，按权限自动注入</span>
        <button type="button" class="btn-primary-sm">+ 注册项目工具</button>
      </div>
      <CardPanel title="工具列表">
        <div class="table-shell">
          <table class="proto-table">
            <thead>
              <tr>
                <th v-for="col in toolDisplay.columns" :key="col">{{ col }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, ri) in toolDisplay.rows" :key="ri">
                <td v-for="(cell, ci) in row" :key="ci" :class="{ 'td-tag': cell.display === 'tag' }">
                  <span
                    v-if="cell.display === 'tag'"
                    class="badge-pill-tag"
                    :class="cellClass(cell)"
                  >{{ cell.text }}</span>
                  <span v-else :class="cellClass(cell)">{{ cell.text }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardPanel>
    </div>

    <div v-show="tab === 'integrations'" class="ai-cap-panel">
      <div class="ai-cap-toolbar">
        <span class="ai-cap-hint">已接入的 MCP 集成服务</span>
        <RouterLink class="btn-primary-sm link-btn" to="/placeholder/integrations">浏览集成市场</RouterLink>
      </div>
      <div class="int-grid">
        <div class="int-box">
          <div class="int-card-inner">
            <div class="int-head">
              <span class="int-emoji">🐙</span>
              <div>
                <div class="int-title">GitHub</div>
                <div class="int-sub">官方精选 · OAuth 授权</div>
              </div>
              <span class="badge-green">● 运行中</span>
            </div>
            <p class="int-desc">提供：查 Issue / PR / 代码 / 提交记录</p>
            <div class="int-meta">
              <div>Tools: 6 个 · Resources: 2 个</div>
              <div>今日调用: 34 次</div>
            </div>
            <div class="int-actions">
              <button type="button" class="btn-ghost-xs wide">⚙️ 配置</button>
              <button type="button" class="btn-ghost-xs wide">🔍 测试</button>
            </div>
          </div>
        </div>
        <div class="int-box">
          <div class="int-card-inner">
            <div class="int-head">
              <span class="int-emoji">📋</span>
              <div>
                <div class="int-title">Jira</div>
                <div class="int-sub">企业自建 · Token 授权</div>
              </div>
              <span class="badge-green">● 运行中</span>
            </div>
            <p class="int-desc">提供：查/创建 Issue · Sprint 管理</p>
            <div class="int-meta">
              <div>Tools: 4 个 · Resources: 1 个</div>
              <div>今日调用: 21 次</div>
            </div>
            <div class="int-actions">
              <button type="button" class="btn-ghost-xs wide">⚙️ 配置</button>
              <button type="button" class="btn-ghost-xs wide">🔍 测试</button>
            </div>
          </div>
        </div>
        <RouterLink class="mcp-add-card" to="/placeholder/integrations">
          <div class="mcp-plus">➕</div>
          <div class="mcp-add-title">接入新集成</div>
          <div class="mcp-add-sub">浏览集成市场，一键启用</div>
        </RouterLink>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="pickGlobalOpen"
        class="pick-kb-backdrop"
        role="presentation"
        @click.self="closePickGlobalModal"
      >
        <div class="pick-kb-modal" role="dialog" aria-modal="true" aria-labelledby="pick-kb-title">
          <header class="pick-kb-head">
            <div>
              <h2 id="pick-kb-title" class="pick-kb-title">添加全局知识库</h2>
              <p class="pick-kb-sub">
                勾选要接入本项目的平台库；勾选后可设置注入策略。已接入的条目会置灰。可随时取消勾选。
              </p>
            </div>
            <button type="button" class="pick-kb-close" aria-label="关闭" @click="closePickGlobalModal">✕</button>
          </header>
          <p v-if="pickGlobalError" class="pick-kb-error">{{ pickGlobalError }}</p>
          <div class="pick-kb-body">
            <p v-if="pickGlobalLoading" class="pick-kb-muted">加载中…</p>
            <p v-else-if="!globalKbCandidates.length" class="pick-kb-muted">暂无可选的全局知识库。</p>
            <div v-else class="pick-kb-cards" role="list">
              <div
                v-for="kb in globalKbCandidates"
                :key="kb.id"
                class="pick-kb-card"
                :class="{ 'pick-kb-card--disabled': enabledKbIdSet.has(kb.id) }"
                role="listitem"
              >
                <label class="pick-kb-card__pick">
                  <input
                    type="checkbox"
                    class="pick-kb-card__check"
                    :disabled="enabledKbIdSet.has(kb.id)"
                    :checked="isPickKbChecked(kb.id)"
                    @change="togglePickKb(kb.id)"
                  />
                  <span class="pick-kb-card__info">
                    <span class="pick-kb-card__name">{{ kb.name ?? '知识库 #' + kb.id }}</span>
                    <span class="pick-kb-card__meta"
                      >文档 {{ kb.docCount ?? '—' }} · 状态 {{ kb.status ?? '—' }}</span
                    >
                  </span>
                </label>
                <div v-if="enabledKbIdSet.has(kb.id)" class="pick-kb-card__tag">已接入</div>
                <div
                  v-else-if="isPickKbChecked(kb.id)"
                  class="pick-kb-card__inject"
                >
                  <span class="pick-kb-card__inject-label">注入策略</span>
                  <select
                    :id="'pick-inject-' + kb.id"
                    class="pick-kb-card__select"
                    :value="injectModes[kb.id] ?? PROJECT_KB_INJECT_MODE_DEFAULT"
                    @change="onPickInjectChange(kb.id, $event)"
                  >
                    <option
                      v-for="o in PROJECT_KB_INJECT_MODE_OPTIONS"
                      :key="o.value"
                      :value="o.value"
                    >
                      {{ o.label }}
                    </option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          <footer class="pick-kb-foot">
            <button
              type="button"
              class="pick-kb-btn pick-kb-btn--ghost"
              :disabled="pickGlobalSubmitting"
              @click="closePickGlobalModal"
            >
              取消
            </button>
            <button
              type="button"
              class="pick-kb-btn pick-kb-btn--primary"
              :disabled="pickGlobalLoading || pickGlobalSubmitting || !selectedKbIds.length"
              @click="submitPickGlobalEnable"
            >
              {{ pickGlobalSubmitting ? '接入中…' : '确认接入' }}
            </button>
          </footer>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="createDedicatedOpen"
        class="pick-kb-backdrop"
        role="presentation"
        @click.self="closeCreateDedicatedModal"
      >
        <div class="pick-kb-modal" role="dialog" aria-modal="true" aria-labelledby="create-dedicated-kb-title">
          <header class="pick-kb-head">
            <div>
              <h2 id="create-dedicated-kb-title" class="pick-kb-title">添加项目专属知识库</h2>
              <p class="pick-kb-sub">
                将调用 <code class="pick-kb-code">POST /knowledge-bases</code>，固定
                <code class="pick-kb-code">scope=PROJECT</code> 并绑定当前项目 ID。
              </p>
            </div>
            <button type="button" class="pick-kb-close" aria-label="关闭" @click="closeCreateDedicatedModal">✕</button>
          </header>
          <p v-if="createDedicatedError" class="pick-kb-error">{{ createDedicatedError }}</p>
          <div class="pick-kb-body create-dedicated-kb-form">
            <label class="create-dedicated-kb-field">
              <span class="create-dedicated-kb-label">知识库名称 <span class="req">*</span></span>
              <input
                v-model="createDedicatedForm.name"
                class="create-dedicated-kb-input"
                type="text"
                autocomplete="off"
                placeholder="例如：产品私有库"
              />
            </label>
            <label class="create-dedicated-kb-field">
              <span class="create-dedicated-kb-label">备注 / 说明（可选）</span>
              <input
                v-model="createDedicatedForm.description"
                class="create-dedicated-kb-input"
                type="text"
                autocomplete="off"
                placeholder="写入 description 字段"
              />
            </label>
            <label class="create-dedicated-kb-field">
              <span class="create-dedicated-kb-label">向量模型（可选）</span>
              <select v-model="createDedicatedForm.embeddingModel" class="create-dedicated-kb-select">
                <option value="">（不指定，由平台默认）</option>
                <option v-for="o in KNOWLEDGE_EMBEDDING_MODEL_OPTIONS" :key="o.value" :value="o.value">
                  {{ o.label }}
                </option>
              </select>
            </label>
            <label class="create-dedicated-kb-field">
              <span class="create-dedicated-kb-label">注入方式</span>
              <select v-model="createDedicatedForm.injectMode" class="create-dedicated-kb-select">
                <option v-for="o in KNOWLEDGE_INJECT_MODE_OPTIONS" :key="o.value" :value="o.value">
                  {{ o.label }}
                </option>
              </select>
            </label>
          </div>
          <footer class="pick-kb-foot">
            <button
              type="button"
              class="pick-kb-btn pick-kb-btn--ghost"
              :disabled="createDedicatedSubmitting"
              @click="closeCreateDedicatedModal"
            >
              取消
            </button>
            <button
              type="button"
              class="pick-kb-btn pick-kb-btn--primary"
              :disabled="createDedicatedSubmitting"
              @click="submitCreateDedicatedKb"
            >
              {{ createDedicatedSubmitting ? '创建中…' : '创建' }}
            </button>
          </footer>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.ai-cap-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.proto-tabs {
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: 8px;
  background: var(--bg, #f4f6fc);
}

.proto-tab {
  flex: 1;
  border: none;
  border-radius: 6px;
  padding: 8px 6px;
  background: transparent;
  color: var(--text-subtle, #667085);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.proto-tab.active {
  background: #fff;
  color: var(--primary, #4f6ef7);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.ai-cap-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ai-cap-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.ai-cap-toolbar--kb {
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(79, 110, 247, 0.07), rgba(99, 102, 241, 0.03));
  border: 1px solid rgba(79, 110, 247, 0.14);
}

.ai-cap-toolbar-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.ai-cap-toolbar-text .ai-cap-hint {
  margin-right: 0;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.ai-cap-subhint {
  font-size: 12px;
  color: var(--text-subtle, #667085);
  line-height: 1.5;
}

.btn-kb-add {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: 9px 16px;
  border: none;
  border-radius: 10px;
  background: var(--primary, #4f6ef7);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(79, 110, 247, 0.32);
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}

.btn-kb-add:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(79, 110, 247, 0.38);
}

.btn-kb-add:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

.btn-kb-add__ico {
  font-size: 15px;
  line-height: 1;
  opacity: 0.95;
}

.btn-kb-add--compact {
  padding: 6px 12px;
  font-size: 12px;
  box-shadow: 0 1px 6px rgba(79, 110, 247, 0.22);
}

.btn-kb-add--compact .btn-kb-add__ico {
  font-size: 13px;
}

.inherit-panel-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(18, 183, 106, 0.12);
  color: var(--success, #12b76a);
}

.inherit-empty {
  text-align: center;
  padding: 28px 20px;
  border-radius: 14px;
  border: 1px dashed rgba(17, 24, 39, 0.12);
  background: rgba(248, 250, 252, 0.85);
}

.inherit-empty--loading {
  border-style: solid;
  font-size: 13px;
  color: var(--text-subtle);
}

.inherit-empty__title {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}

.inherit-empty__desc {
  margin: 0;
  font-size: 13px;
  color: var(--text-subtle);
  line-height: 1.55;
  max-width: 440px;
  margin-inline: auto;
}

.inherit-kb-list {
  display: grid;
  gap: 12px;
}

@media (min-width: 640px) {
  .inherit-kb-list {
    grid-template-columns: repeat(auto-fill, minmax(288px, 1fr));
  }
}

.inherit-kb-card {
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  border: 1px solid rgba(17, 24, 39, 0.08);
  background: #fff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  overflow: hidden;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.inherit-kb-card:hover {
  border-color: rgba(79, 110, 247, 0.22);
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.07);
}

.inherit-kb-card--demo {
  opacity: 0.94;
}

.inherit-kb-card__top {
  display: flex;
  gap: 12px;
  padding: 14px 14px 10px;
}

.inherit-kb-card__icon {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  font-size: 18px;
  flex-shrink: 0;
  background: rgba(79, 110, 247, 0.1);
}

.inherit-kb-card__icon--rose {
  background: rgba(244, 63, 94, 0.1);
}

.inherit-kb-card__icon--mint {
  background: rgba(16, 185, 129, 0.12);
}

.inherit-kb-card__body {
  min-width: 0;
  flex: 1;
}

.inherit-kb-card__headline {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.inherit-kb-card__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #111827;
  line-height: 1.3;
}

.inherit-kb-card__link-enter {
  font-size: 12px;
  font-weight: 600;
  color: var(--primary, #4f6ef7);
  text-decoration: none;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.inherit-kb-card__link-enter:hover {
  text-decoration: underline;
}

.inherit-kb-card__link-arrow {
  opacity: 0.85;
}

.inherit-kb-card__desc {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--text-subtle);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.inherit-kb-card__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 14px 12px;
  border-top: 1px solid rgba(229, 231, 235, 0.9);
  background: rgba(248, 250, 252, 0.72);
}

.inherit-kb-card__footer--readonly,
.inherit-kb-card__footer--demo {
  justify-content: flex-start;
  gap: 10px;
}

.inherit-kb-card__field {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.inherit-kb-card__field-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-subtle);
  letter-spacing: 0.02em;
}

.inherit-kb-card__select {
  min-width: 128px;
  padding: 6px 10px;
  font-size: 12px;
  border-radius: 8px;
  border: 1px solid rgba(17, 24, 39, 0.12);
  background: #fff;
  font: inherit;
  cursor: pointer;
}

.inherit-kb-card__select:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.inherit-kb-card__saving {
  font-size: 11px;
  color: var(--primary, #4f6ef7);
}

.inherit-kb-card__btn-unlink {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 8px;
  border: 1px solid rgba(239, 68, 68, 0.35);
  background: #fff;
  color: #dc2626;
  cursor: pointer;
}

.inherit-kb-card__btn-unlink:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.06);
}

.inherit-kb-card__btn-unlink:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.inherit-kb-card__pill {
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(79, 110, 247, 0.1);
  color: var(--primary, #4f6ef7);
}

.inherit-kb-card__hint-muted {
  font-size: 11px;
  color: var(--text-subtle);
}

.inherit-kb-card__footer--readonly .inherit-kb-card__hint-muted,
.inherit-kb-card__footer--demo .inherit-kb-card__hint-muted {
  margin-left: auto;
}

.ai-cap-hint {
  font-size: 13px;
  color: var(--text-subtle, #667085);
  margin-right: auto;
}

.btn-primary-sm,
.btn-ghost-sm {
  border-radius: 8px;
  padding: 7px 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
}

.btn-primary-sm {
  background: var(--primary, #4f6ef7);
  color: #fff;
}

.btn-ghost-sm {
  background: #fff;
  border-color: rgba(17, 24, 39, 0.12);
  color: var(--text-main);
}

.link-btn {
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.btn-primary-xs,
.btn-ghost-xs,
.btn-danger-xs {
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid rgba(17, 24, 39, 0.12);
  background: #fff;
}

.btn-primary-xs {
  background: var(--primary, #4f6ef7);
  color: #fff;
  border-color: transparent;
}

.btn-danger-xs {
  background: #fef3f2;
  color: #b42318;
  border-color: #fecdca;
}

.skill-stack {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0 4px 8px;
}

.skill-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid rgba(229, 231, 235, 0.9);
}

.skill-row:last-child {
  border-bottom: none;
}

.skill-ico {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: #eef1ff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
}

.skill-ico--red {
  background: #fef3f2;
}
.skill-ico--green {
  background: #ecfdf3;
}
.skill-ico--purple {
  background: #f9f5ff;
}
.skill-ico--amber {
  background: #fffaeb;
}

.skill-main {
  flex: 1;
  min-width: 0;
}

.skill-name {
  font-weight: 600;
  font-size: 14px;
}

.skill-name-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.skill-cmd {
  font-size: 11px;
  background: var(--bg, #f4f6fc);
  padding: 2px 6px;
  border-radius: 4px;
}

.skill-desc {
  font-size: 12px;
  color: var(--text-subtle);
  margin-top: 4px;
  line-height: 1.5;
}

.skill-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.badge-green,
.badge-blue,
.badge-gray,
.badge-yellow {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 6px;
  white-space: nowrap;
}

.badge-green {
  background: rgba(18, 183, 106, 0.12);
  color: var(--success, #12b76a);
}
.badge-blue {
  background: rgba(79, 110, 247, 0.12);
  color: var(--primary);
}
.badge-gray {
  background: rgba(17, 24, 39, 0.08);
  color: var(--text-subtle);
}
.badge-yellow {
  background: rgba(247, 144, 9, 0.15);
  color: #b54708;
}

.kb-head-tools {
  display: flex;
  gap: 8px;
  align-items: center;
}

.kb-input {
  width: 200px;
  max-width: 46vw;
  padding: 5px 10px;
  font-size: 12px;
  border-radius: 6px;
  border: 1px solid rgba(17, 24, 39, 0.12);
}

.table-shell {
  overflow-x: auto;
}

.proto-table {
  width: 100%;
  border-collapse: collapse;
}

.proto-table th,
.proto-table td {
  padding: 11px 10px;
  border-bottom: 1px solid rgba(229, 231, 235, 0.9);
  text-align: left;
  font-size: 12px;
}

.proto-table th {
  color: var(--text-subtle);
  font-size: 11px;
  font-weight: 600;
}

.proto-table-link {
  color: var(--primary);
  font-weight: 600;
  text-decoration: none;
}

.proto-table-link:hover {
  text-decoration: underline;
}

.proto-table-link--enter-kb {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 8px;
  border: 1px solid rgba(79, 110, 247, 0.45);
  background: rgba(79, 110, 247, 0.08);
  font-weight: 600;
  text-decoration: none;
}

.proto-table-link--enter-kb:hover {
  background: rgba(79, 110, 247, 0.14);
  text-decoration: none;
}

.badge-pill-tag {
  display: inline-flex;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
}

.tone-success {
  color: var(--success);
}
.tone-primary {
  color: var(--primary);
}
.tone-warning {
  color: var(--warning);
}
.tone-danger {
  color: var(--danger);
}
.tone-muted {
  color: var(--text-subtle);
}
.cell-mono {
  font-family: ui-monospace, monospace;
  font-size: 11px;
}

.int-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.int-box {
  padding: 18px 20px;
  border: 1px solid var(--card-border, #e5e7eb);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: var(--shadow-soft, 0 4px 24px rgba(15, 23, 42, 0.06));
}

.int-card-inner {
  padding: 4px 0 8px;
}

.int-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 10px;
}

.int-emoji {
  font-size: 28px;
  line-height: 1;
}

.int-title {
  font-weight: 600;
  font-size: 14px;
}

.int-sub {
  font-size: 12px;
  color: var(--text-subtle);
}

.int-desc {
  font-size: 12px;
  color: var(--text-subtle);
  margin: 0 0 10px;
}

.int-meta {
  font-size: 11px;
  background: var(--bg, #f4f6fc);
  border-radius: 6px;
  padding: 8px;
  margin-bottom: 10px;
  color: var(--text-subtle);
}

.int-actions {
  display: flex;
  gap: 6px;
}

.wide {
  flex: 1;
  text-align: center;
}

.mcp-add-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 160px;
  border: 2px dashed rgba(79, 110, 247, 0.35);
  border-radius: 16px;
  background: rgba(79, 110, 247, 0.04);
  text-decoration: none;
  color: inherit;
  transition: background 0.15s;
}

.mcp-add-card:hover {
  background: rgba(79, 110, 247, 0.08);
}

.mcp-plus {
  font-size: 32px;
  margin-bottom: 8px;
}

.mcp-add-title {
  font-weight: 600;
  font-size: 14px;
}

.mcp-add-sub {
  font-size: 12px;
  color: var(--text-subtle);
  margin-top: 4px;
}

.mt-card {
  margin-top: 4px;
}

:deep(.card-panel-title) {
  font-size: 15px;
}

@media (max-width: 1024px) {
  .int-grid {
    grid-template-columns: 1fr;
  }
}
</style>

<!-- Teleport 到 body，scoped 无法命中，单独一块 -->
<style>
.pick-kb-backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.42);
  backdrop-filter: blur(6px);
}

.pick-kb-modal {
  width: min(560px, 100%);
  max-height: min(72vh, 640px);
  display: flex;
  flex-direction: column;
  border-radius: 20px;
  border: 1px solid rgba(79, 110, 247, 0.12);
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 24px 80px rgba(15, 23, 42, 0.22);
}

.pick-kb-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 18px 20px 0;
}

.pick-kb-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.pick-kb-sub {
  margin: 6px 0 0;
  font-size: 12px;
  color: #667085;
  line-height: 1.5;
}

.pick-kb-close {
  border: none;
  border-radius: 999px;
  padding: 6px 10px;
  background: rgba(15, 23, 42, 0.06);
  cursor: pointer;
  flex-shrink: 0;
}

.pick-kb-error {
  margin: 10px 20px 0;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(239, 68, 68, 0.1);
  color: #b91c1c;
  font-size: 13px;
}

.pick-kb-body {
  padding: 12px 20px;
  overflow: auto;
  flex: 1;
  min-height: 0;
}

.pick-kb-muted {
  margin: 0;
  font-size: 13px;
  color: #667085;
}

.pick-kb-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pick-kb-card {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px 12px;
  align-items: start;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(229, 231, 235, 0.95);
  background: #fafbfc;
  transition: border-color 0.12s ease, background 0.12s ease;
}

.pick-kb-card:hover:not(.pick-kb-card--disabled) {
  border-color: rgba(79, 110, 247, 0.22);
  background: #fff;
}

.pick-kb-card--disabled {
  opacity: 0.75;
  background: rgba(248, 250, 252, 0.95);
}

.pick-kb-card__pick {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  cursor: pointer;
  margin: 0;
  min-width: 0;
  grid-column: 1;
}

.pick-kb-card--disabled .pick-kb-card__pick {
  cursor: default;
}

.pick-kb-card__check {
  margin-top: 3px;
  flex-shrink: 0;
}

.pick-kb-card__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.pick-kb-card__name {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.pick-kb-card__meta {
  font-size: 12px;
  color: #667085;
}

.pick-kb-card__tag {
  grid-column: 2;
  justify-self: end;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(18, 183, 106, 0.12);
  color: #12b76a;
  white-space: nowrap;
}

.pick-kb-card__inject {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding-top: 4px;
  margin-top: 2px;
  border-top: 1px solid rgba(229, 231, 235, 0.85);
}

.pick-kb-card__inject-label {
  font-size: 12px;
  font-weight: 600;
  color: #667085;
}

.pick-kb-card__select {
  min-width: 140px;
  padding: 6px 10px;
  font-size: 13px;
  border-radius: 8px;
  border: 1px solid rgba(17, 24, 39, 0.12);
  background: #fff;
  color: #111827;
  font: inherit;
  cursor: pointer;
}

.pick-kb-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px 18px;
  border-top: 1px solid rgba(229, 231, 235, 0.9);
}

.pick-kb-btn {
  border-radius: 8px;
  padding: 7px 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid rgba(17, 24, 39, 0.12);
  background: #fff;
  color: #111827;
  font: inherit;
}

.pick-kb-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.pick-kb-btn--primary {
  background: var(--primary, #4f6ef7);
  color: #fff;
  border-color: transparent;
}

.pick-kb-btn--ghost:hover:not(:disabled) {
  background: #f8fafc;
}

.pick-kb-code {
  font-size: 11px;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(15, 23, 42, 0.06);
  font-family: ui-monospace, monospace;
}

.create-dedicated-kb-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.create-dedicated-kb-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
}

.create-dedicated-kb-label {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
}

.create-dedicated-kb-label .req {
  color: #dc2626;
}

.create-dedicated-kb-input,
.create-dedicated-kb-select {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  font-size: 13px;
  border-radius: 8px;
  border: 1px solid rgba(17, 24, 39, 0.12);
  background: #fff;
  font: inherit;
}

.create-dedicated-kb-select {
  cursor: pointer;
}
</style>
