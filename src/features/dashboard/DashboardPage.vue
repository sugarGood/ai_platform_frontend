<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
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

const projectCount = computed(() =>
  projectState.loading ? null : projectSummaries.value.length
)
const activeProjectCount = computed(() =>
  projectState.loading ? null : projectSummaries.value.filter((p) => p.statusLabel === 'ACTIVE').length
)

function fmt(n: number | null, fallback = '…') {
  if (n === null) return fallback
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function goPage(pageKey: string) {
  void router.push(`/placeholder/${pageKey}`)
}

const recentProjects = computed(() => projectSummaries.value.slice(0, 3))
</script>

<template>
  <section class="dashboard-proto" data-testid="dashboard-page">
    <div class="stats-grid">
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
        <div class="stat-delta">{{ activeProjectCount !== null ? `${activeProjectCount} 个进行中` : '…' }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">👥</div>
        <div class="stat-label">平台用户数</div>
        <div class="stat-value" style="color: var(--success)">{{ fmt(userCount) }}</div>
        <div class="stat-delta">{{ activeUserCount !== null ? `${activeUserCount} 人在职活跃` : '…' }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">⚠️</div>
        <div class="stat-label">凭证即将过期</div>
        <div class="stat-value" style="color: var(--warning)">—</div>
        <div class="stat-delta">凭证管理查看详情</div>
      </div>
    </div>

    <div style="font-size: 13px; font-weight: 700; color: var(--sub); margin-bottom: 10px">📁 我参与的项目</div>

    <div v-if="projectState.loading" style="color: var(--sub); font-size: 13px; margin-bottom: 20px">加载项目中…</div>
    <div v-else-if="projectState.error" style="color: var(--danger); font-size: 13px; margin-bottom: 20px">⚠️ {{ projectState.error }}</div>
    <div v-else-if="recentProjects.length === 0" style="color: var(--sub); font-size: 13px; margin-bottom: 20px">暂无项目，点击右下角「新建项目」创建第一个。</div>
    <div v-else class="grid-3" style="margin-bottom: 20px">
      <div
        v-for="proj in recentProjects"
        :key="proj.id"
        class="project-card"
        role="button"
        tabindex="0"
        @click="router.push(`/projects/${proj.id}/overview`)"
        @keydown.enter="router.push(`/projects/${proj.id}/overview`)"
      >
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px">
          <span style="font-size: 18px">{{ proj.icon }}</span>
          <span class="badge" :class="proj.statusTone === 'success' ? 'badge-green' : 'badge-yellow'">
            {{ proj.statusLabel === 'ACTIVE' ? '进行中' : proj.statusLabel }}
          </span>
        </div>
        <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px">{{ proj.name }}</div>
        <div style="font-size: 12px; color: var(--sub)">{{ proj.typeLabel }} · {{ proj.description || '暂无描述' }}</div>
      </div>
      <div
        v-if="projectSummaries.length > 3"
        class="project-card"
        role="button"
        tabindex="0"
        style="display: flex; align-items: center; justify-content: center; color: var(--sub); font-size: 13px"
        @click="router.push('/projects')"
        @keydown.enter="router.push('/projects')"
      >
        查看全部 {{ projectSummaries.length }} 个项目 →
      </div>
    </div>

    <div class="grid-2" style="margin-bottom: 20px">
      <div class="card">
        <div class="card-header">
          <span class="card-title">📋 待处理事项</span>
          <span class="badge badge-yellow">待办</span>
        </div>
        <div class="card-body" style="padding: 0 16px">
          <div class="skill-item" role="button" tabindex="0" @click="goPage('keys')">
            <div class="skill-icon" style="background: #fef3f2">⚠️</div>
            <div style="flex: 1">
              <div class="skill-name">凭证管理</div>
              <div class="skill-desc">查看成员平台凭证状态、上游 API Key 及配额策略</div>
            </div>
            <span class="badge badge-blue" style="font-size: 11px">管理</span>
          </div>
          <div class="skill-item" role="button" tabindex="0" @click="goPage('staff')">
            <div class="skill-icon" style="background: #f0f4ff">👥</div>
            <div style="flex: 1">
              <div class="skill-name">员工管理</div>
              <div class="skill-desc">查看、新增、停用平台用户账号</div>
            </div>
            <span class="badge badge-blue" style="font-size: 11px">管理</span>
          </div>
          <div class="skill-item" role="button" tabindex="0" @click="router.push('/projects')">
            <div class="skill-icon" style="background: #eef1ff">📁</div>
            <div style="flex: 1">
              <div class="skill-name">全部项目</div>
              <div class="skill-desc">查看所有项目，创建或归档</div>
            </div>
            <span class="badge badge-green" style="font-size: 11px">{{ fmt(projectCount) }} 个</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title">🎯 平台成功指标</span>
          <span style="font-size: 12px; color: var(--sub)">PRD 定义 · 实时追踪</span>
        </div>
        <div class="card-body" style="padding: 12px 16px">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px">
            <div>
              <div style="font-size: 12px; color: var(--sub)">成员接入耗时</div>
              <div style="font-weight: 700">平均 2.1 分钟</div>
            </div>
            <div style="text-align: right">
              <span class="badge badge-green">✅ 达标</span>
              <div style="font-size: 11px; color: var(--sub)">目标 ≤ 3 分钟</div>
            </div>
          </div>
          <div style="background: var(--bg); border-radius: 4px; height: 6px; margin-bottom: 16px">
            <div style="background: var(--success); height: 100%; border-radius: 4px; width: 70%" />
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px">
            <div>
              <div style="font-size: 12px; color: var(--sub)">知识库命中率</div>
              <div style="font-weight: 700">78%</div>
            </div>
            <div style="text-align: right">
              <span class="badge badge-green">✅ 达标</span>
              <div style="font-size: 11px; color: var(--sub)">目标 ≥ 70%</div>
            </div>
          </div>
          <div style="background: var(--bg); border-radius: 4px; height: 6px; margin-bottom: 16px">
            <div style="background: var(--success); height: 100%; border-radius: 4px; width: 78%" />
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px">
            <div>
              <div style="font-size: 12px; color: var(--sub)">凭证安全事件</div>
              <div style="font-weight: 700">0 起</div>
            </div>
            <div style="text-align: right">
              <span class="badge badge-green">✅ 安全</span>
              <div style="font-size: 11px; color: var(--sub)">目标 0 起泄露</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div style="display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap">
      <button class="btn" type="button" @click="goPage('keys')">🔑 凭证管理</button>
      <button class="btn" type="button" @click="goPage('staff')">👥 员工管理</button>
      <button class="btn" type="button" @click="goPage('knowledge')">📚 全局知识库</button>
      <button class="btn" type="button" @click="goPage('skills')">⚡ 全局技能库</button>
      <button class="btn btn-primary" type="button" style="margin-left: auto" @click="openNewProjectModal">
        + 新建项目
      </button>
    </div>
  </section>
</template>
