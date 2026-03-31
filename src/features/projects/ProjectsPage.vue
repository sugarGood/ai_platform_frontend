<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import ProjectCard from '../../components/ui/ProjectCard.vue'
import { projectTypeLabelMap, projectTypeOptions, useProjects } from '../../composables/useProjects'
import { useOverlay } from '../../composables/useOverlay'
import type { BackendProjectType, ProjectSummary } from '../../types/project'

const router = useRouter()
const { openNewProjectModal, openEditProjectModal } = useOverlay()
const { loadProjects, projectState, projectSummaries } = useProjects()

type StatusFilter = 'all' | 'running' | 'done' | 'other'

const keywordDraft = ref('')
const statusDraft = ref<StatusFilter>('all')
const typeDraft = ref<'' | BackendProjectType>('')

const keywordQuery = ref('')
const statusQuery = ref<StatusFilter>('all')
const typeQuery = ref<'' | BackendProjectType>('')

onMounted(() => {
  void loadProjects()
})

function applySearch() {
  keywordQuery.value = keywordDraft.value.trim()
  statusQuery.value = statusDraft.value
  typeQuery.value = typeDraft.value
}

function resetFilters() {
  keywordDraft.value = ''
  statusDraft.value = 'all'
  typeDraft.value = ''
  applySearch()
}

function statusBucket(statusLabel: string): 'running' | 'done' | 'other' {
  const s = statusLabel.trim()
  const u = s.toUpperCase()
  if (/\b(ACTIVE|RUNNING|ONLINE|IN_PROGRESS)\b/.test(u) || s.includes('进行中')) return 'running'
  if (/\b(COMPLETED?|ARCHIVED|CLOSED|DONE)\b/.test(u) || s.includes('已完成') || s.includes('已归档')) return 'done'
  return 'other'
}

function matchesStatus(p: ProjectSummary, q: StatusFilter): boolean {
  if (q === 'all') return true
  return statusBucket(p.statusLabel) === q
}

function matchesType(p: ProjectSummary, q: BackendProjectType | ''): boolean {
  if (!q) return true
  if (p.projectType === q) return true
  const label = projectTypeLabelMap[q]
  if (label === p.typeLabel) return true
  if (q === 'PRODUCT' && /产品/.test(p.typeLabel)) return true
  if (q === 'PLATFORM' && /中台|平台/.test(p.typeLabel)) return true
  if (q === 'DATA' && /数据/.test(p.typeLabel)) return true
  if (q === 'OTHER') return p.projectType === 'OTHER' || p.typeLabel === projectTypeLabelMap.OTHER
  return false
}

function matchesKeyword(p: ProjectSummary, q: string): boolean {
  if (!q) return true
  const needle = q.toLowerCase()
  const hay = [p.name, p.description, p.id, p.code ?? '', p.typeLabel, p.statusLabel].join(' ').toLowerCase()
  return hay.includes(needle)
}

const filteredProjects = computed(() => {
  return projectSummaries.value.filter(
    (p) =>
      matchesKeyword(p, keywordQuery.value) &&
      matchesStatus(p, statusQuery.value) &&
      matchesType(p, typeQuery.value),
  )
})

const hasList = computed(() => projectSummaries.value.length > 0)
const filterEmpty = computed(() => hasList.value && filteredProjects.value.length === 0)

const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: '全部状态' },
  { value: 'running', label: '进行中 / 运行中' },
  { value: 'done', label: '已完成 / 已归档' },
  { value: 'other', label: '其他（含待上线等）' },
]

async function enterProject(projectId: string) {
  await router.push(`/projects/${projectId}/overview`)
}

function editProject(projectId: string) {
  void openEditProjectModal(projectId)
}
</script>

<template>
  <section class="projects-page" data-testid="projects-page">
    <div v-if="projectState.error" class="proto-banner proto-banner--error" data-testid="projects-error-banner">
      无法从后端加载项目列表，请检查网络或 API 配置。
      <span class="proto-banner-detail">{{ projectState.error }}</span>
    </div>

    <div
      v-else-if="projectState.loading && !projectState.loadedFromApi"
      class="proto-banner"
      data-testid="projects-loading-banner"
    >
      正在加载后端项目列表...
    </div>

    <div class="projects-toolbar">
      <div class="projects-toolbar-row">
        <label class="projects-field">
          <span class="projects-field-label">关键词</span>
          <input
            v-model="keywordDraft"
            class="projects-input"
            placeholder="名称、编码、ID、描述…"
            type="search"
            @keydown.enter.prevent="applySearch"
          />
        </label>
        <label class="projects-field">
          <span class="projects-field-label">状态</span>
          <select v-model="statusDraft" class="projects-select">
            <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </label>
        <label class="projects-field">
          <span class="projects-field-label">类型</span>
          <select v-model="typeDraft" class="projects-select">
            <option value="">全部类型</option>
            <option v-for="opt in projectTypeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </label>
        <div class="projects-toolbar-actions">
          <button class="btn btn-primary projects-search-btn" type="button" data-testid="projects-search" @click="applySearch">
            搜索
          </button>
          <button class="btn" type="button" data-testid="projects-reset-filters" @click="resetFilters">重置</button>
          <button
            class="btn btn-primary"
            data-testid="new-project-entry"
            style="margin-left: auto"
            type="button"
            @click="openNewProjectModal"
          >
            + 新建项目
          </button>
        </div>
      </div>
      <p v-if="hasList" class="projects-filter-hint">
        共 {{ projectSummaries.length }} 个项目，当前显示 {{ filteredProjects.length }} 个（点击「搜索」应用条件）
      </p>
    </div>

    <template v-if="hasList && !filterEmpty">
      <div class="projects-card-grid">
        <ProjectCard
          v-for="project in filteredProjects"
          :key="project.id"
          :project="project"
          @click="enterProject"
          @edit="editProject"
        />
      </div>
    </template>

    <section v-else-if="filterEmpty" class="proto-empty" data-testid="projects-filter-empty">
      <h2>没有符合条件的项目</h2>
      <p>请调整关键词、状态或类型后再次点击「搜索」，或<button class="linkish" type="button" @click="resetFilters">重置筛选</button>。</p>
    </section>

    <section v-else-if="projectState.error" class="proto-empty" data-testid="projects-empty-state">
      <h2>暂无项目数据</h2>
      <p>请查看上方错误信息后重试，或检查 Vite 代理与 <code>VITE_API_BASE_URL</code> 配置。</p>
    </section>

    <section
      v-else-if="!(projectState.loading && !projectState.loadedFromApi)"
      class="proto-empty"
      data-testid="projects-empty-state"
    >
      <h2>还没有项目</h2>
      <p>后端已返回空列表。点击「+ 新建项目」创建第一个项目。</p>
    </section>
  </section>
</template>

<style scoped>
.projects-page {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.projects-toolbar {
  margin-bottom: 20px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--card);
}

.projects-toolbar-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 16px;
  align-items: flex-end;
}

.projects-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 140px;
  flex: 1 1 160px;
}

.projects-field-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--sub);
  letter-spacing: 0.02em;
}

.projects-input,
.projects-select {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  font-size: 13px;
}

.projects-input:focus,
.projects-select:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 2px var(--primary-light, rgba(79, 110, 247, 0.2));
}

.projects-toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  flex: 1 1 220px;
}

.projects-search-btn {
  min-width: 72px;
}

.projects-filter-hint {
  margin: 12px 0 0;
  font-size: 12px;
  color: var(--sub);
  line-height: 1.5;
}

.projects-card-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
  margin-bottom: 8px;
}

@media (max-width: 1100px) {
  .projects-card-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .projects-card-grid {
    grid-template-columns: 1fr;
  }
}

.proto-banner {
  margin-bottom: 16px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--card);
  color: var(--sub);
  font-size: 13px;
  line-height: 1.6;
}

.proto-banner--error {
  border-color: #fecdca;
  background: #fef3f2;
  color: var(--text);
}

.proto-banner-detail {
  display: block;
  margin-top: 4px;
  word-break: break-word;
}

.proto-empty {
  margin-top: 16px;
  padding: 16px 18px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--card);
}

.proto-empty h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.proto-empty p {
  margin: 10px 0 0;
  color: var(--sub);
  font-size: 13px;
  line-height: 1.7;
}

.linkish {
  margin: 0;
  padding: 0;
  border: none;
  background: none;
  color: var(--primary);
  font: inherit;
  cursor: pointer;
  text-decoration: underline;
}

.linkish:hover {
  opacity: 0.85;
}
</style>
