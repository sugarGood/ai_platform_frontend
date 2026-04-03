<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useOverlay } from '../../composables/useOverlay'
import { useProjects } from '../../composables/useProjects'
import { listUsers } from '../../services/users'
import { listUsageEvents } from '../../services/usage-events'

const router = useRouter()
const { openNewProjectModal } = useOverlay()
const { loadProjects, projectSummaries, projectState } = useProjects()

const userCount = ref<number | null>(null)
const activeUserCount = ref<number | null>(null)
const monthlyTokens = ref<number | null>(null)

onMounted(async () => {
  void loadProjects()
  try {
    const users = await listUsers()
    userCount.value = users.length
    activeUserCount.value = users.filter((u) => u.status === 'ACTIVE').length
  } catch {
    // non-critical
  }
  try {
    const page = await listUsageEvents({ page: 1, size: 100 })
    monthlyTokens.value = (page.data ?? []).reduce((sum, e) => sum + (Number(e.totalTokens) || 0), 0)
  } catch {
    // non-critical
  }
})

const projectCount = computed(() => (projectState.loading ? null : projectSummaries.value.length))
const activeProjectCount = computed(() =>
  projectState.loading ? null : projectSummaries.value.filter((p) => p.statusLabel === 'ACTIVE').length,
)

const recentProjects = computed(() => projectSummaries.value.slice(0, 3))

function fmt(n: number | null, fallback = '—') {
  if (n === null) return fallback
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function goPage(pageKey: string) {
  void router.push(`/placeholder/${pageKey}`)
}

function openProject(projectId: string) {
  void router.push(`/projects/${projectId}/overview`)
}
</script>

<template>
  <section class="dashboard-proto" data-testid="dashboard-page">
    <div class="grid-2 dashboard-workbench-grid" data-testid="dashboard-workbench-grid">
      <div class="card" data-testid="dashboard-todo-card">
        <div class="card-header">
          <span class="card-title">待处理事项</span>
          <span class="badge badge-yellow">优先处理</span>
        </div>
        <div class="card-body dashboard-list-body">
          <div class="skill-item" role="button" tabindex="0" @click="goPage('keys')">
            <div class="skill-icon" style="background: #fef3f2">⚠️</div>
            <div style="flex: 1">
              <div class="skill-name">凭证管理</div>
              <div class="skill-desc">查看成员平台凭证状态、上游 API Key 和配额策略。</div>
            </div>
            <span class="badge badge-blue">管理</span>
          </div>
          <div class="skill-item" role="button" tabindex="0" @click="goPage('staff')">
            <div class="skill-icon" style="background: #f0f4ff">👥</div>
            <div style="flex: 1">
              <div class="skill-name">员工管理</div>
              <div class="skill-desc">查看、新增或停用平台用户账号。</div>
            </div>
            <span class="badge badge-blue">管理</span>
          </div>
          <div class="skill-item" role="button" tabindex="0" @click="router.push('/projects')">
            <div class="skill-icon" style="background: #eef1ff">📁</div>
            <div style="flex: 1">
              <div class="skill-name">全部项目</div>
              <div class="skill-desc">统一查看项目空间，快速进入当前正在推进的项目。</div>
            </div>
            <span class="badge badge-green">{{ fmt(projectCount) }} 个</span>
          </div>
        </div>
      </div>

      <div class="card" data-testid="dashboard-recent-projects">
        <div class="card-header">
          <span class="card-title">最近项目</span>
          <button class="btn" type="button" @click="router.push('/projects')">查看全部</button>
        </div>
        <div class="card-body dashboard-list-body">
          <div
            v-if="projectState.loading"
            class="dashboard-empty"
          >
            正在加载项目...
          </div>
          <div
            v-else-if="projectState.error"
            class="dashboard-empty dashboard-empty-error"
          >
            {{ projectState.error }}
          </div>
          <div
            v-else-if="recentProjects.length === 0"
            class="dashboard-empty"
          >
            还没有项目，先创建第一个项目空间。
          </div>
          <article
            v-for="project in recentProjects"
            v-else
            :key="project.id"
            class="dashboard-project-row"
            role="button"
            tabindex="0"
            @click="openProject(project.id)"
            @keydown.enter="openProject(project.id)"
          >
            <div class="dashboard-project-main">
              <span class="dashboard-project-icon">{{ project.icon }}</span>
              <div>
                <div class="dashboard-project-name">{{ project.name }}</div>
                <div class="dashboard-project-desc">
                  {{ project.typeLabel }} · {{ project.description || '暂无描述' }}
                </div>
              </div>
            </div>
            <span class="badge" :class="project.statusTone === 'success' ? 'badge-green' : 'badge-yellow'">
              {{ project.statusLabel === 'ACTIVE' ? '进行中' : project.statusLabel }}
            </span>
          </article>
        </div>
      </div>
    </div>

    <div class="stats-grid" data-testid="dashboard-platform-metrics">
      <div class="stat-card">
        <div class="stat-icon">🤖</div>
        <div class="stat-label">本月 Token 消耗（样本）</div>
        <div class="stat-value" style="color: var(--primary)">{{ fmt(monthlyTokens) }}</div>
        <div class="stat-delta">按最近 100 条用量记录估算</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📁</div>
        <div class="stat-label">项目总数</div>
        <div class="stat-value">{{ fmt(projectCount) }}</div>
        <div class="stat-delta">{{ activeProjectCount !== null ? `${activeProjectCount} 个进行中` : '—' }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">👥</div>
        <div class="stat-label">平台用户数</div>
        <div class="stat-value" style="color: var(--success)">{{ fmt(userCount) }}</div>
        <div class="stat-delta">{{ activeUserCount !== null ? `${activeUserCount} 人活跃` : '—' }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">⚠️</div>
        <div class="stat-label">凭证即将过期</div>
        <div class="stat-value" style="color: var(--warning)">—</div>
        <div class="stat-delta">前往凭证管理查看详情</div>
      </div>
    </div>

    <div class="grid-2" style="margin-bottom: 20px">
      <div class="card">
        <div class="card-header">
          <span class="card-title">平台成功指标</span>
          <span style="font-size: 12px; color: var(--sub)">PRD 定义 · 实时追踪</span>
        </div>
        <div class="card-body">
          <div class="dashboard-metric-row">
            <div>
              <div class="dashboard-metric-label">成员接入耗时</div>
              <div class="dashboard-metric-value">平均 2.1 分钟</div>
            </div>
            <div style="text-align: right">
              <span class="badge badge-green">达标</span>
              <div class="dashboard-metric-target">目标 ≤ 3 分钟</div>
            </div>
          </div>
          <div class="progress-wrap"><div class="progress-bar" style="width: 70%" /></div>

          <div class="dashboard-metric-row">
            <div>
              <div class="dashboard-metric-label">知识库命中率</div>
              <div class="dashboard-metric-value">78%</div>
            </div>
            <div style="text-align: right">
              <span class="badge badge-green">达标</span>
              <div class="dashboard-metric-target">目标 ≥ 70%</div>
            </div>
          </div>
          <div class="progress-wrap"><div class="progress-bar" style="width: 78%" /></div>

          <div class="dashboard-metric-row">
            <div>
              <div class="dashboard-metric-label">凭证安全事件</div>
              <div class="dashboard-metric-value">0 起</div>
            </div>
            <div style="text-align: right">
              <span class="badge badge-green">安全</span>
              <div class="dashboard-metric-target">目标 0 起泄露</div>
            </div>
          </div>
        </div>
      </div>

      <div class="card" data-testid="dashboard-quick-actions">
        <div class="card-header">
          <span class="card-title">快捷入口</span>
          <button class="btn btn-primary" type="button" @click="openNewProjectModal">+ 新建项目</button>
        </div>
        <div class="card-body dashboard-actions-grid">
          <button class="btn" type="button" @click="goPage('keys')">🔑 凭证管理</button>
          <button class="btn" type="button" @click="goPage('staff')">👥 员工管理</button>
          <button class="btn" type="button" @click="goPage('knowledge')">📚 全局知识库</button>
          <button class="btn" type="button" @click="goPage('skills')">🧠 全局技能库</button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.dashboard-proto {
  display: flex;
  flex-direction: column;
}

.dashboard-workbench-grid {
  margin-bottom: 20px;
}

.dashboard-list-body {
  padding-block: 6px;
}

.dashboard-empty {
  color: var(--sub);
  font-size: 13px;
  line-height: 1.7;
}

.dashboard-empty-error {
  color: var(--danger);
}

.dashboard-project-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
}

.dashboard-project-row:last-child {
  border-bottom: none;
}

.dashboard-project-main {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
}

.dashboard-project-icon {
  font-size: 18px;
  line-height: 1.2;
}

.dashboard-project-name {
  font-size: 14px;
  font-weight: 600;
}

.dashboard-project-desc,
.dashboard-metric-label,
.dashboard-metric-target {
  font-size: 12px;
  color: var(--sub);
}

.dashboard-project-desc {
  margin-top: 4px;
  line-height: 1.6;
}

.dashboard-metric-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
}

.dashboard-metric-row:not(:first-child) {
  margin-top: 16px;
}

.dashboard-metric-value {
  margin-top: 4px;
  font-weight: 700;
}

.dashboard-actions-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

@media (max-width: 900px) {
  .dashboard-actions-grid {
    grid-template-columns: 1fr;
  }
}
</style>
