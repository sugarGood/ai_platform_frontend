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
  const status = statusLabel.trim()
  const upper = status.toUpperCase()
  if (/\b(ACTIVE|RUNNING|ONLINE|IN_PROGRESS)\b/.test(upper) || status.includes('进行中')) return 'running'
  if (/\b(COMPLETED|ARCHIVED|CLOSED|DONE)\b/.test(upper) || status.includes('已完成') || status.includes('已归档')) {
    return 'done'
  }
  return 'other'
}

function matchesStatus(project: ProjectSummary, statusQueryValue: StatusFilter): boolean {
  if (statusQueryValue === 'all') return true
  return statusBucket(project.statusLabel) === statusQueryValue
}

function matchesType(project: ProjectSummary, typeQueryValue: BackendProjectType | ''): boolean {
  if (!typeQueryValue) return true
  if (project.projectType === typeQueryValue) return true
  const label = projectTypeLabelMap[typeQueryValue]
  if (label === project.typeLabel) return true
  return false
}

function matchesKeyword(project: ProjectSummary, query: string): boolean {
  if (!query) return true
  const needle = query.toLowerCase()
  const haystack = [
    project.name,
    project.description,
    project.id,
    project.code ?? '',
    project.typeLabel,
    project.statusLabel,
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(needle)
}

const filteredProjects = computed(() =>
  projectSummaries.value.filter(
    (project) =>
      matchesKeyword(project, keywordQuery.value) &&
      matchesStatus(project, statusQuery.value) &&
      matchesType(project, typeQuery.value),
  ),
)

const hasList = computed(() => projectSummaries.value.length > 0)
const filterEmpty = computed(() => hasList.value && filteredProjects.value.length === 0)

const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: '全部状态' },
  { value: 'running', label: '进行中 / 运行中' },
  { value: 'done', label: '已完成 / 已归档' },
  { value: 'other', label: '其他' },
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
        <label class="projects-field projects-field-keyword">
          <span class="projects-field-label">搜索项目</span>
          <input
            v-model="keywordDraft"
            class="projects-input"
            placeholder="名称、编码、ID、描述"
            type="search"
            @keydown.enter.prevent="applySearch"
          />
        </label>
        <label class="projects-field projects-field-short">
          <span class="projects-field-label">状态</span>
          <select v-model="statusDraft" class="projects-select">
            <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </label>
        <label class="projects-field projects-field-short">
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
            type="button"
            @click="openNewProjectModal"
          >
            + 新建项目
          </button>
        </div>
      </div>
    </div>

    <div v-if="hasList" class="projects-summary-bar" data-testid="projects-summary-bar">
      <div class="projects-summary-main">
        <span class="projects-summary-title">项目列表</span>
        <span class="projects-summary-count" data-testid="projects-summary-count">
          共 {{ projectSummaries.length }} 个，当前显示 {{ filteredProjects.length }} 个
        </span>
      </div>
      <div class="projects-summary-hint">优先从搜索和状态筛选进入当前正在推进的项目。</div>
    </div>

    <template v-if="hasList && !filterEmpty">
      <div class="projects-card-grid" data-testid="projects-card-grid">
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
      <p>
        请调整关键字、状态或类型后再次点击“搜索”，或
        <button class="linkish" type="button" @click="resetFilters">重置筛选</button>。
      </p>
    </section>

    <section v-else-if="projectState.error" class="proto-empty" data-testid="projects-empty-state">
      <h2>暂无项目数据</h2>
      <p>请查看上方错误信息后重试，或检查 `VITE_API_BASE_URL` 配置。</p>
    </section>

    <section
      v-else-if="!(projectState.loading && !projectState.loadedFromApi)"
      class="proto-empty"
      data-testid="projects-empty-state"
    >
      <h2>还没有项目</h2>
      <p>后端已返回空列表。点击“新建项目”创建第一个项目。</p>
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
  margin-bottom: 14px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--card);
}

.projects-toolbar-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-end;
}

.projects-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.projects-field-keyword {
  flex: 1 1 320px;
  min-width: 220px;
}

.projects-field-short {
  flex: 0 1 160px;
  min-width: 140px;
}

.projects-field-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--sub);
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

.projects-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  flex-wrap: wrap;
}

.projects-search-btn {
  min-width: 72px;
}

.projects-summary-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  padding: 0 2px;
}

.projects-summary-main {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}

.projects-summary-title {
  font-size: 14px;
  font-weight: 600;
}

.projects-summary-count,
.projects-summary-hint {
  font-size: 12px;
  color: var(--sub);
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

@media (max-width: 720px) {
  .projects-toolbar-actions {
    margin-left: 0;
  }

  .projects-summary-bar {
    flex-direction: column;
    align-items: flex-start;
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
