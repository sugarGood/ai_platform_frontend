<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'

import type {
  CatalogItem,
  KnowledgeOverviewRow,
  ModuleSection,
  PageAction,
  TableCell,
  Tone,
} from '../../types/module-page'
import CardPanel from './CardPanel.vue'
import StatCard from './StatCard.vue'
import { useOverlay } from '../../composables/useOverlay'

const props = defineProps<{
  sections: ModuleSection[]
}>()

const { triggerModuleAction } = useOverlay()

function toneClass(tone?: Tone) {
  return tone ? `tone-${tone}` : 'tone-default'
}

function actionClass(action?: PageAction) {
  return action?.variant === 'primary' ? 'module-action primary' : 'module-action'
}

function gridClass(columns?: 1 | 2 | 3) {
  if (columns === 1) {
    return 'grid-one'
  }

  if (columns === 3) {
    return 'grid-three'
  }

  return 'grid-two'
}

function cardTag(item: CatalogItem) {
  return item.to ? RouterLink : 'article'
}

function tableCellClass(cell: TableCell) {
  return [toneClass(cell.tone), cell.mono ? 'cell-mono' : '']
}

function actionTestId(label: string) {
  return `module-action-${label}`
}

function knowledgeActionTestId(row: KnowledgeOverviewRow, action: string) {
  return `knowledge-row-action-${row.name}-${action}`
}

const knowledgeView = ref<'global' | 'project' | 'rag'>('global')
const knowledgeQuery = ref('')
const knowledgeCategory = ref('全部分类')
const knowledgeScope = ref('全局 + 项目（商城系统）')

function knowledgeActionLabel(label: string) {
  if (label === '上传文档') return '+ 上传文档'
  if (label === '检索测试') return '🔍 检索测试'
  return label
}

function filterGlobalKnowledgeRows(rows: KnowledgeOverviewRow[], query: string, category: string) {
  let out = rows
  const q = query.trim()
  if (q) {
    out = out.filter((r) => {
      return (
        r.name?.includes(q) ||
        r.category?.text?.includes(q) ||
        r.injectMode?.text?.includes(q) ||
        r.updatedAt?.includes(q)
      )
    })
  }
  if (category && category !== '全部分类') {
    out = out.filter((r) => r.category?.text === category)
  }
  return out
}

const projectKnowledgeRows = [
  {
    name: '商城需求文档 v2.3',
    type: { text: '需求', tone: 'primary' as const },
    chunks: '248 块',
    status: { text: '已向量化', tone: 'success' as const },
    uploader: '张三',
    updatedAt: '2026-03-06',
    actions: ['查看', '删除'],
  },
  {
    name: '原型图 v1.5',
    type: { text: '原型', tone: 'warning' as const },
    chunks: '62 块',
    status: { text: '已向量化', tone: 'success' as const },
    uploader: '产品部',
    updatedAt: '2026-03-05',
    actions: ['查看', '删除'],
  },
  {
    name: '系统架构设计文档',
    type: { text: '技术', tone: 'success' as const },
    chunks: '—',
    status: { text: '向量化中', tone: 'warning' as const },
    uploader: '王五',
    updatedAt: '2026-03-19',
    actions: ['处理中...'],
  },
]

const ragPipelineNodes = [
  '文档解析（Apache Tika）',
  '智能分块（语义分块）',
  'Embedding（BGE-M3）',
  '向量存储（pgvector）',
  'Reranking（BGE-Reranker）',
]

const activeKnowledgeRows = computed(() => {
  let rows = sectionRowsFilter(
    projectKnowledgeRows,
    (row) => row.name.includes(knowledgeQuery.value) || row.type.text.includes(knowledgeQuery.value),
  )
  const cat = knowledgeCategory.value
  if (cat && cat !== '全部分类') {
    rows = rows.filter((row) => row.type.text === cat)
  }
  return rows
})

function sectionRowsFilter<T>(rows: T[], checker: (row: T) => boolean) {
  if (!knowledgeQuery.value.trim()) {
    return rows
  }

  return rows.filter((row) => checker(row))
}

function resolveActionContext(section: ModuleSection, itemTitle?: string) {
  if (itemTitle) {
    return itemTitle
  }
  if ('title' in section && typeof section.title === 'string' && section.title) {
    return section.title
  }

  if (section.type === 'hero' && section.title) {
    return section.title
  }

  return undefined
}

function handleActionClick(action: PageAction, section: ModuleSection, itemTitle?: string) {
  triggerModuleAction(action.label, resolveActionContext(section, itemTitle))
}

function handleKnowledgeRagConfig(section: ModuleSection) {
  if (section.type !== 'knowledge-overview') return
  triggerModuleAction(section.quickActionLabel, resolveActionContext(section))
}
</script>

<template>
  <div class="module-content">
    <template v-for="(section, index) in sections" :key="`${section.type}-${index}`">
      <section v-if="section.type === 'callout'" class="module-callout">
        <span class="module-callout-icon" aria-hidden="true">💡</span>
        <p class="module-callout-text">
          <strong>{{ section.emphasis }}</strong>
          {{ section.body }}
        </p>
      </section>

      <section v-else-if="section.type === 'hero'" class="module-hero">
        <div>
          <div v-if="section.eyebrow" class="module-eyebrow">{{ section.eyebrow }}</div>
          <h1 v-if="section.title" class="module-title">{{ section.title }}</h1>
          <p class="module-description">{{ section.description }}</p>
        </div>

        <div v-if="section.actions?.length" class="module-actions">
          <button
            v-for="action in section.actions"
            :key="action.label"
            :class="actionClass(action)"
            :data-testid="actionTestId(action.label)"
            type="button"
            @click="handleActionClick(action, section)"
          >
            {{ action.label }}
          </button>
        </div>
      </section>

      <section v-else-if="section.type === 'metrics'" class="module-metrics">
        <StatCard
          v-for="metric in section.items"
          :key="metric.id"
          :delta="metric.delta"
          :icon="metric.icon"
          :label="metric.label"
          :tone="metric.tone"
          :value="metric.value"
        />
      </section>

      <section v-else-if="section.type === 'catalog-grid'" class="module-block">
        <div v-if="section.title" class="section-kicker">{{ section.title }}</div>
        <div class="catalog-grid" :class="gridClass(section.columns)">
          <component
            :is="cardTag(item)"
            v-for="item in section.items"
            :key="item.title"
            :to="item.to"
            class="catalog-card"
          >
            <div class="catalog-head">
              <span v-if="item.icon" class="catalog-icon">{{ item.icon }}</span>
              <span v-if="item.badge" class="badge-pill" :class="toneClass(item.tone)">{{ item.badge }}</span>
            </div>
            <div class="catalog-title">{{ item.title }}</div>
            <div v-if="item.subtitle" class="catalog-subtitle">{{ item.subtitle }}</div>
            <div v-if="item.description" class="catalog-description">{{ item.description }}</div>
            <div v-if="item.lines?.length" class="catalog-lines">
              <div v-for="line in item.lines" :key="`${item.title}-${line.label}`" class="info-row">
                <span class="info-label">{{ line.label }}</span>
                <span :class="[toneClass(line.tone), line.mono ? 'mono-text' : '']">{{ line.value }}</span>
              </div>
            </div>
            <div v-if="item.cta" class="catalog-cta">{{ item.cta }}</div>
          </component>
        </div>
      </section>

      <section v-else-if="section.type === 'list-grid'" class="module-grid" :class="gridClass(section.columns)">
        <CardPanel v-for="card in section.cards" :key="card.title" :badge="card.badge" :title="card.title">
          <div class="list-stack">
            <article v-for="item in card.items" :key="`${card.title}-${item.title}`" class="list-item">
              <div class="list-main">
                <div class="list-title-row">
                  <div class="list-title">{{ item.title }}</div>
                  <span v-if="item.badge" class="badge-pill" :class="toneClass(item.tone)">
                    {{ item.badge }}
                  </span>
                </div>
                <div v-if="item.meta" class="list-meta">{{ item.meta }}</div>
                <div v-if="item.description" class="list-description">{{ item.description }}</div>
                <div v-if="typeof item.progress === 'number'" class="progress-wrap slim">
                  <div class="progress-bar" :class="toneClass(item.tone)" :style="{ width: `${item.progress}%` }" />
                </div>
              </div>
            </article>
          </div>

          <div v-if="card.note" class="note-bubble" :class="toneClass(card.note.tone)">
            <strong v-if="card.note.label">{{ card.note.label }}?</strong>
            {{ card.note.content }}
          </div>
        </CardPanel>
      </section>

      <CardPanel v-else-if="section.type === 'table'" :badge="section.badge" :title="section.title">
        <template v-if="section.actions?.length" #header-extra>
          <div class="table-header-actions">
            <button
              v-for="action in section.actions"
              :key="action.label"
              :class="actionClass(action)"
              type="button"
              @click="handleActionClick(action, section)"
            >
              {{ action.label }}
            </button>
          </div>
        </template>
        <div class="table-shell">
          <table class="module-table">
            <thead>
              <tr>
                <th v-for="column in section.table.columns" :key="column">{{ column }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, rowIndex) in section.table.rows" :key="`${section.title}-${rowIndex}`">
                <td v-for="(cell, cellIndex) in row" :key="`${section.title}-${rowIndex}-${cellIndex}`">
                  <span :class="tableCellClass(cell)">{{ cell.text }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="section.note" class="table-note">{{ section.note }}</div>
      </CardPanel>

      <section v-else-if="section.type === 'knowledge-overview'" class="knowledge-overview">
        <header class="knowledge-overview-head">
          <h1 class="knowledge-title">{{ section.title }}</h1>
        </header>

        <section class="module-metrics">
          <StatCard
            v-for="metric in section.metrics"
            :key="metric.id"
            :delta="metric.delta"
            :icon="metric.icon"
            :label="metric.label"
            :tone="metric.tone"
            :value="metric.value"
          />
        </section>

        <!-- 效果图：单行工具栏 — 左：搜索+分类 | 中：弹性空白 | 右：RAG 配置 + 上传 + 检索测试 -->
        <div class="knowledge-toolbar-bar">
          <input
            v-model="knowledgeQuery"
            class="knowledge-search"
            :placeholder="section.searchPlaceholder"
            type="text"
          />
          <select v-model="knowledgeCategory" class="knowledge-select knowledge-select--fixed">
            <option v-for="option in section.categoryOptions" :key="option" :value="option">{{ option }}</option>
          </select>
          <div class="knowledge-toolbar-spacer" aria-hidden="true" />
          <button class="knowledge-rag-config-btn" type="button" @click="handleKnowledgeRagConfig(section)">
            <span class="knowledge-rag-config-icon" aria-hidden="true">⚙️</span>
            {{ section.quickActionLabel }}
          </button>
          <template v-if="section.actions?.length">
            <button
              v-for="action in section.actions"
              :key="action.label"
              :class="['knowledge-btn', action.variant === 'primary' ? 'primary' : '']"
              :data-testid="actionTestId(action.label)"
              type="button"
              @click="handleActionClick(action, section)"
            >
              {{ knowledgeActionLabel(action.label) }}
            </button>
          </template>
        </div>

        <!-- 效果图：三个等宽 Tab（全局 / 项目 / RAG） -->
        <div class="knowledge-tabs" role="tablist" aria-label="知识库视图">
          <button
            class="knowledge-tab"
            :class="{ active: knowledgeView === 'global' }"
            role="tab"
            :aria-selected="knowledgeView === 'global'"
            type="button"
            @click="knowledgeView = 'global'"
          >
            🌐 全局知识库
          </button>
          <button
            class="knowledge-tab"
            :class="{ active: knowledgeView === 'project' }"
            role="tab"
            :aria-selected="knowledgeView === 'project'"
            type="button"
            @click="knowledgeView = 'project'"
          >
            📁 项目知识库
          </button>
          <button
            class="knowledge-tab"
            :class="{ active: knowledgeView === 'rag' }"
            role="tab"
            :aria-selected="knowledgeView === 'rag'"
            type="button"
            @click="knowledgeView = 'rag'"
          >
            ⚙️ RAG 流水线
          </button>
        </div>

        <CardPanel v-if="knowledgeView === 'global'" class="knowledge-table-panel" title="">
          <div class="table-shell">
            <table class="module-table">
              <thead>
                <tr>
                  <th v-for="column in section.table.columns" :key="column">{{ column }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in filterGlobalKnowledgeRows(section.table.rows, knowledgeQuery, knowledgeCategory)"
                  :key="row.name"
                >
                  <td>{{ row.name }}</td>
                  <td><span :class="tableCellClass(row.category)">{{ row.category.text }}</span></td>
                  <td>{{ row.chunks }}</td>
                  <td>{{ row.hitCount }}</td>
                  <td>{{ row.linkedProjects }}</td>
                  <td><span :class="tableCellClass(row.injectMode)">{{ row.injectMode.text }}</span></td>
                  <td>{{ row.updatedAt }}</td>
                  <td class="knowledge-actions-cell">
                    <button
                      v-for="action in row.actions ?? []"
                      :key="action"
                      class="table-inline-action"
                      :data-testid="knowledgeActionTestId(row, action)"
                      type="button"
                    >
                      {{ action }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardPanel>

        <CardPanel v-else-if="knowledgeView === 'project'" class="knowledge-table-panel" title="商城系统">
          <template #header-extra>
            <button class="module-action primary knowledge-project-upload" type="button">+ 上传文档</button>
          </template>
          <div class="table-shell">
            <table class="module-table">
              <thead>
                <tr>
                  <th>文档名称</th>
                  <th>类型</th>
                  <th>分块数</th>
                  <th>状态</th>
                  <th>上传者</th>
                  <th>更新时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in activeKnowledgeRows" :key="row.name">
                  <td>{{ row.name }}</td>
                  <td><span :class="tableCellClass(row.type)">{{ row.type.text }}</span></td>
                  <td>{{ row.chunks }}</td>
                  <td><span :class="tableCellClass(row.status)">{{ row.status.text }}</span></td>
                  <td>{{ row.uploader }}</td>
                  <td>{{ row.updatedAt }}</td>
                  <td class="knowledge-actions-cell">
                    <button v-for="action in row.actions" :key="action" class="table-inline-action" type="button">
                      {{ action }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardPanel>

        <section v-else class="rag-grid">
          <CardPanel class="knowledge-table-panel" title="RAG Pipeline 状态">
            <div class="rag-status-head">
              <span>运行中</span>
            </div>
            <div class="rag-status-list">
              <div v-for="node in ragPipelineNodes" :key="node" class="rag-status-row">
                <span>{{ node }}</span>
                <span class="tone-success">正常</span>
              </div>
            </div>
            <div class="rag-metrics">
              <div class="rag-metric-row"><span>今日处理文档</span><strong>12 个</strong></div>
              <div class="rag-metric-row"><span>平均检索耗时</span><strong>8.3 s / 次</strong></div>
              <div class="rag-metric-row"><span>队列等待处理</span><strong>2 个</strong></div>
            </div>
          </CardPanel>

          <CardPanel class="knowledge-table-panel" title="检索测试">
            <div class="rag-form">
              <label class="rag-label" for="rag-query-input">输入测试 Query</label>
              <input
                id="rag-query-input"
                v-model="knowledgeQuery"
                class="knowledge-search rag-query-input"
                placeholder="例：如何处理支付回调异常？"
                type="text"
              />
              <label class="rag-label" for="rag-scope-select">检索范围</label>
              <select id="rag-scope-select" v-model="knowledgeScope" class="knowledge-select">
                <option>全局 + 项目（商城系统）</option>
                <option>仅全局知识库</option>
                <option>仅项目知识库</option>
              </select>
              <button class="module-action primary rag-submit-btn" type="button">执行检索</button>
            </div>
            <div class="rag-result-wrap">
              <div class="rag-result-title">检索结果预览：</div>
              <div class="rag-result-item">
                <div class="rag-result-name">《全局开发手册 · 第 4.2 节》</div>
                <div class="rag-result-desc">支付回调需验签名，防止重放攻击。建议使用幂等 Key。</div>
                <div class="rag-result-score">相关度 0.92</div>
              </div>
              <div class="rag-result-item">
                <div class="rag-result-name">《商城需求文档 v2.3 · 支付模块》</div>
                <div class="rag-result-desc">支付回调接口需在 30 秒内完成，超时自动重试 3 次。</div>
                <div class="rag-result-score">相关度 0.87</div>
              </div>
            </div>
          </CardPanel>
        </section>
      </section>

      <CardPanel v-else-if="section.type === 'progress'" :badge="section.badge" :title="section.title">
        <div class="progress-list">
          <div v-for="item in section.items" :key="item.label" class="progress-item">
            <div class="progress-label-row">
              <span class="progress-label">{{ item.label }}</span>
              <span class="progress-value" :class="toneClass(item.tone)">{{ item.value }}</span>
            </div>
            <div class="progress-wrap">
              <div class="progress-bar" :class="toneClass(item.tone)" :style="{ width: `${item.progress}%` }" />
            </div>
            <div v-if="item.hint" class="progress-hint">{{ item.hint }}</div>
          </div>
        </div>
        <div v-if="section.note" class="note-bubble" :class="toneClass(section.note.tone)">
          <strong v-if="section.note.label">{{ section.note.label }}?</strong>
          {{ section.note.content }}
        </div>
      </CardPanel>

      <CardPanel v-else-if="section.type === 'notes'" :badge="section.badge" :title="section.title">
        <div class="note-stack">
          <div
            v-for="note in section.notes"
            :key="`${section.title}-${note.label ?? note.content}`"
            class="note-bubble"
            :class="toneClass(note.tone)"
          >
            <strong v-if="note.label">{{ note.label }}?</strong>
            {{ note.content }}
          </div>
        </div>
      </CardPanel>

      <CardPanel v-else-if="section.type === 'code'" :badge="section.badge" :title="section.title">
        <p v-if="section.description" class="code-description">{{ section.description }}</p>
        <pre class="code-block"><code>{{ section.code }}</code></pre>
        <div v-if="section.actions?.length" class="module-actions inside">
          <button
            v-for="action in section.actions"
            :key="action.label"
            :class="actionClass(action)"
            :data-testid="actionTestId(action.label)"
            type="button"
            @click="handleActionClick(action, section)"
          >
            {{ action.label }}
          </button>
        </div>
        <div
          v-if="section.footerNote"
          class="note-bubble code-footer-note"
          :class="toneClass(section.footerNote.tone)"
        >
          <strong v-if="section.footerNote.label">{{ section.footerNote.label }}</strong>
          {{ section.footerNote.content }}
        </div>
      </CardPanel>

      <CardPanel v-else-if="section.type === 'kanban'" :title="section.title">
        <div class="kanban-grid">
          <section v-for="column in section.columns" :key="column.title" class="kanban-column">
            <div class="kanban-head">
              <div class="kanban-title">{{ column.title }}</div>
              <span v-if="column.badge" class="badge-pill" :class="toneClass(column.tone)">
                {{ column.badge }}
              </span>
            </div>
            <article v-for="item in column.items" :key="item.title" class="kanban-card">
              <div class="list-title-row">
                <div class="list-title">{{ item.title }}</div>
                <span v-if="item.badge" class="badge-pill" :class="toneClass(item.tone)">
                  {{ item.badge }}
                </span>
              </div>
              <div v-if="item.meta" class="list-meta">{{ item.meta }}</div>
              <div v-if="item.description" class="list-description">{{ item.description }}</div>
            </article>
          </section>
        </div>
      </CardPanel>

      <section v-else-if="section.type === 'split'" class="module-grid" :class="gridClass(section.columns)">
        <CardPanel
          v-for="item in section.items"
          :key="item.title"
          :badge="item.badge"
          :panel-tone="item.panelTone"
          :subtitle="item.subtitle"
          :title="item.title"
        >
          <template v-if="item.headerActions?.length" #header-extra>
            <div class="split-header-actions">
              <button
                v-for="action in item.headerActions"
                :key="action.label"
                :class="actionClass(action)"
                type="button"
                @click="handleActionClick(action, section, item.title)"
              >
                {{ action.label }}
              </button>
            </div>
          </template>
          <div v-if="item.lines?.length" class="catalog-lines">
            <div v-for="line in item.lines" :key="`${item.title}-${line.label}`" class="info-row">
              <span class="info-label">{{ line.label }}</span>
              <span :class="[toneClass(line.tone), line.mono ? 'mono-text' : '']">{{ line.value }}</span>
            </div>
          </div>

          <div v-if="item.list?.length" class="list-stack">
            <article v-for="entry in item.list" :key="`${item.title}-${entry.title}`" class="list-item compact">
              <div class="list-main">
                <div class="list-title-row">
                  <div class="list-title">{{ entry.title }}</div>
                  <span v-if="entry.badge" class="badge-pill" :class="toneClass(entry.tone)">
                    {{ entry.badge }}
                  </span>
                </div>
                <div v-if="entry.meta" class="list-meta">{{ entry.meta }}</div>
                <div v-if="entry.description" class="list-description">{{ entry.description }}</div>
              </div>
            </article>
          </div>

          <div v-if="item.notes?.length" class="note-stack">
            <div
              v-for="note in item.notes"
              :key="`${item.title}-${note.label ?? note.content}`"
              class="note-bubble"
              :class="toneClass(note.tone)"
            >
              <strong v-if="note.label">{{ note.label }}?</strong>
              {{ note.content }}
            </div>
          </div>

          <div v-if="item.code && item.codeActions?.length" class="credential-code-row">
            <pre class="code-block compact credential-snippet"><code>{{ item.code }}</code></pre>
            <div class="credential-code-actions">
              <button
                v-for="action in item.codeActions"
                :key="action.label"
                :class="actionClass(action)"
                type="button"
                @click="handleActionClick(action, section, item.title)"
              >
                {{ action.label }}
              </button>
            </div>
          </div>
          <pre v-else-if="item.code" class="code-block compact"><code>{{ item.code }}</code></pre>

          <p v-if="item.tagsLabel" class="workspace-tags-label">{{ item.tagsLabel }}</p>
          <div v-if="item.tags?.length" class="workspace-tag-row">
            <span
              v-for="(tag, ti) in item.tags"
              :key="`${item.title}-tag-${ti}`"
              class="badge-pill"
              :class="toneClass(tag.tone)"
            >
              {{ tag.text }}
            </span>
          </div>

          <div v-if="item.actions?.length" class="module-actions inside">
            <button
              v-for="action in item.actions"
              :key="action.label"
              :class="actionClass(action)"
              type="button"
              @click="handleActionClick(action, section, item.title)"
            >
              {{ action.label }}
            </button>
          </div>
        </CardPanel>
      </section>
    </template>
  </div>
</template>

<style scoped>
.module-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.module-callout {
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

.module-callout-icon {
  flex-shrink: 0;
  font-size: 18px;
  line-height: 1.2;
}

.module-callout-text {
  margin: 0;
}

.table-header-actions,
.split-header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.credential-code-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  padding: 12px;
  background: var(--bg);
  border-radius: 8px;
}

.credential-snippet {
  flex: 1;
  min-width: 0;
  margin: 0 !important;
}

.credential-code-actions {
  flex-shrink: 0;
}

.workspace-tags-label {
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--text-muted, #667085);
}

.workspace-tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 4px;
}

.code-footer-note {
  margin-top: 14px;
}

.module-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  padding: 28px;
  border: 1px solid rgba(79, 110, 247, 0.14);
  border-radius: 28px;
  background:
    radial-gradient(circle at top right, rgba(79, 110, 247, 0.22), transparent 28%),
    linear-gradient(135deg, rgba(255, 255, 255, 0.96) 0%, rgba(238, 241, 255, 0.92) 100%);
  box-shadow: var(--shadow-soft);
}

.module-eyebrow,
.section-kicker {
  color: var(--primary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.section-kicker {
  margin-bottom: 12px;
}

.module-title {
  margin: 12px 0 10px;
  font-size: 34px;
  line-height: 1.1;
}

.knowledge-overview {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.knowledge-overview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.knowledge-title {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
  line-height: 1.2;
}

/* 效果图单行工具栏：左固定控件 + 中间撑开 + 右侧操作成组 */
.knowledge-toolbar-bar {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 12px;
  margin-bottom: 16px;
  padding: 0;
  min-width: 0;
}

.knowledge-toolbar-spacer {
  flex: 1 1 auto;
  min-width: 16px;
  height: 1px;
}

.knowledge-rag-config-btn {
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
  transition: background 0.15s, border-color 0.15s;
}

.knowledge-rag-config-btn:hover {
  background: #f8fafc;
}

.knowledge-rag-config-icon {
  color: #6941c6;
  font-size: 15px;
  line-height: 1;
}

/* 三个等宽 Tab，对齐原型 .tabs / .tab */
.knowledge-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 20px;
  padding: 4px;
  border-radius: 8px;
  background: var(--bg);
}

.knowledge-tab {
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

.knowledge-tab.active {
  background: #fff;
  color: var(--primary);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.knowledge-select--fixed {
  width: auto;
  min-width: 120px;
  max-width: 200px;
  flex: 0 0 auto;
}

.knowledge-search,
.knowledge-select,
.knowledge-mini-btn,
.table-inline-action {
  border: 1px solid rgba(17, 24, 39, 0.1);
  border-radius: 8px;
  background: white;
  color: var(--text-main);
  font: inherit;
  font-size: 13px;
}

.knowledge-search {
  width: 320px;
  max-width: 100%;
  min-width: 0;
  padding: 8px 12px;
  flex: 0 1 auto;
}

.knowledge-select {
  padding: 8px 12px;
  flex: 0 0 auto;
}

.knowledge-mini-btn {
  padding: 7px 14px;
  flex: 0 0 auto;
  cursor: pointer;
  background: white;
  font-weight: 500;
  transition: all 0.15s;
}

.knowledge-mini-btn:hover {
  background: #f8fafc;
}

.knowledge-btn {
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
}

.knowledge-btn:hover {
  background: #f8fafc;
}

.knowledge-btn.primary {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}


.knowledge-table-panel :deep(.card-panel-header) {
  display: none;
}

.knowledge-table-panel :deep(.card-panel-title) {
  font-size: 20px;
}

.knowledge-table-panel :deep(.card-panel) {
  border-radius: 14px;
}

.knowledge-project-upload {
  border-radius: 10px;
  padding: 8px 12px;
  box-shadow: none;
  font-size: 12px;
}

.rag-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 14px;
}

.rag-status-head {
  margin-bottom: 10px;
  color: var(--success);
  font-size: 12px;
  font-weight: 700;
}

.rag-status-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.rag-status-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid rgba(229, 231, 235, 0.75);
  padding-bottom: 8px;
  font-size: 13px;
}

.rag-metrics {
  margin-top: 14px;
  border: 1px solid rgba(229, 231, 235, 0.85);
  border-radius: 10px;
  padding: 10px 12px;
  background: rgba(248, 250, 252, 0.7);
}

.rag-metric-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
  color: var(--text-subtle);
}

.rag-metric-row + .rag-metric-row {
  margin-top: 8px;
}

.rag-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rag-label {
  font-size: 12px;
  color: var(--text-subtle);
}

.rag-query-input {
  width: 100%;
}

.rag-submit-btn {
  border-radius: 10px;
  justify-content: center;
  box-shadow: none;
}

.rag-result-wrap {
  margin-top: 14px;
}

.rag-result-title {
  margin-bottom: 10px;
  font-size: 12px;
  color: var(--text-subtle);
}

.rag-result-item {
  border: 1px solid rgba(229, 231, 235, 0.85);
  border-left: 3px solid rgba(91, 109, 245, 0.65);
  border-radius: 8px;
  padding: 8px 10px;
  background: #fff;
}

.rag-result-item + .rag-result-item {
  margin-top: 8px;
}

.rag-result-name {
  font-size: 12px;
  font-weight: 600;
}

.rag-result-desc {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-subtle);
}

.rag-result-score {
  margin-top: 2px;
  font-size: 11px;
  color: var(--success);
}

.table-inline-action {
  margin-right: 8px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  background: #fff;
  font-weight: 500;
}

.table-inline-action:last-child {
  margin-right: 0;
}

.knowledge-actions-cell {
  white-space: nowrap;
  text-align: right;
}

.module-description,
.code-description,
.table-note,
.progress-hint,
.list-description,
.catalog-description {
  color: var(--text-subtle);
  line-height: 1.7;
}

.module-description {
  max-width: 760px;
  margin: 0;
}

.module-actions {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 12px;
}

.module-actions.inside {
  margin-top: 16px;
}

.module-action {
  border: 1px solid rgba(17, 24, 39, 0.08);
  border-radius: 999px;
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.75);
  box-shadow: var(--shadow-soft);
  cursor: pointer;
}

.module-action.primary {
  border-color: transparent;
  background: linear-gradient(135deg, #4f6ef7 0%, #5d7bff 100%);
  color: white;
}

.module-metrics,
.module-grid.grid-two,
.module-grid.grid-three,
.catalog-grid.grid-two,
.catalog-grid.grid-three {
  display: grid;
  gap: 16px;
}

.module-metrics {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.grid-one {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.grid-two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.grid-three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.catalog-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 20px;
  border: 1px solid var(--card-border);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: var(--shadow-soft);
}

.catalog-head,
.list-title-row,
.info-row,
.progress-label-row,
.kanban-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.catalog-icon {
  font-size: 28px;
}

.catalog-title,
.list-title,
.kanban-title {
  font-size: 15px;
  font-weight: 700;
}

.catalog-subtitle,
.list-meta,
.info-label {
  color: var(--text-subtle);
  font-size: 12px;
}

.catalog-subtitle {
  margin-top: 8px;
}

.catalog-description,
.catalog-lines,
.catalog-cta {
  margin-top: 12px;
}

.catalog-lines,
.list-stack,
.note-stack,
.progress-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.catalog-cta {
  color: var(--primary);
  font-size: 12px;
  font-weight: 600;
}

.list-item {
  display: flex;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(229, 231, 235, 0.9);
}

.list-item:last-child {
  padding-bottom: 0;
  border-bottom: none;
}

.list-item.compact {
  padding-bottom: 10px;
}

.list-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
}

.badge-pill {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  border-radius: 999px;
  padding: 4px 10px;
  background: rgba(17, 24, 39, 0.08);
  color: var(--text-main);
  font-size: 12px;
  font-weight: 600;
}

.note-bubble {
  margin-top: 14px;
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(79, 110, 247, 0.08);
  color: var(--text-main);
  line-height: 1.7;
  white-space: pre-line;
}

.table-shell {
  overflow-x: auto;
}

.module-table {
  width: 100%;
  border-collapse: collapse;
}

.module-table th,
.module-table td {
  padding: 11px 10px;
  border-bottom: 1px solid rgba(229, 231, 235, 0.9);
  text-align: left;
  font-size: 12px;
}

.module-table th {
  color: var(--text-subtle);
  font-size: 11px;
  font-weight: 600;
}

.progress-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.progress-label,
.progress-value {
  font-size: 13px;
  font-weight: 600;
}

.progress-wrap {
  width: 100%;
  height: 8px;
  border-radius: 999px;
  background: rgba(229, 231, 235, 0.9);
  overflow: hidden;
}

.progress-wrap.slim {
  height: 6px;
  margin-top: 6px;
}

.progress-bar {
  height: 100%;
  border-radius: inherit;
  background: var(--primary);
}

.kanban-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.kanban-column {
  padding: 16px;
  border-radius: 20px;
  background: rgba(244, 246, 252, 0.9);
}

.kanban-card {
  margin-top: 12px;
  padding: 14px;
  border: 1px solid rgba(229, 231, 235, 0.9);
  border-radius: 16px;
  background: white;
}

.code-block {
  margin: 0;
  overflow-x: auto;
  padding: 16px;
  border-radius: 18px;
  background: #0f172a;
  color: #d6e2ff;
  font-family: 'Cascadia Code', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.7;
}

.code-block.compact {
  margin-top: 12px;
}

.mono-text,
.cell-mono {
  font-family: 'Cascadia Code', 'Consolas', monospace;
}

.tone-default {
  color: inherit;
}

.tone-muted {
  color: var(--text-subtle);
}

.tone-primary {
  color: var(--primary);
}

.tone-success {
  color: var(--success);
}

.tone-warning {
  color: var(--warning);
}

.tone-danger {
  color: var(--danger);
}

.badge-pill.tone-primary {
  background: var(--primary-soft);
}

.badge-pill.tone-success {
  background: rgba(18, 183, 106, 0.12);
}

.badge-pill.tone-warning {
  background: rgba(247, 144, 9, 0.12);
}

.badge-pill.tone-danger {
  background: rgba(240, 68, 56, 0.12);
}

.note-bubble.tone-success {
  background: rgba(18, 183, 106, 0.1);
}

.note-bubble.tone-warning {
  background: rgba(247, 144, 9, 0.12);
}

.note-bubble.tone-danger {
  background: rgba(240, 68, 56, 0.1);
}

@media (max-width: 1180px) {
  .module-hero {
    align-items: flex-start;
    flex-direction: column;
  }

  .module-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .grid-two,
  .grid-three,
  .kanban-grid {
    grid-template-columns: 1fr;
  }

  .rag-grid {
    grid-template-columns: 1fr;
  }

  .knowledge-search {
    width: 100%;
  }
}

@media (max-width: 720px) {
  .module-metrics {
    grid-template-columns: 1fr;
  }
}
</style>
