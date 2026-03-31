<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'

import { getProjectById, refreshProjectCoreFromApi } from '../../composables/useProjects'
import ActivityTimeline from '../../components/ui/ActivityTimeline.vue'
import CardPanel from '../../components/ui/CardPanel.vue'
import StatCard from '../../components/ui/StatCard.vue'
import NotFoundProjectState from './NotFoundProjectState.vue'

const route = useRoute()

const project = computed(() => {
  if (typeof route.params.projectId !== 'string') {
    return undefined
  }

  return getProjectById(route.params.projectId)
})

watch(
  () => (typeof route.params.projectId === 'string' ? route.params.projectId : ''),
  (pid) => {
    if (pid) void refreshProjectCoreFromApi(pid)
  },
  { immediate: true },
)

const stats = computed(() => {
  if (!project.value) {
    return []
  }

  return [
    {
      id: 'ai-ready',
      icon: '🤖',
      label: 'AI 能力就绪',
      value: project.value.aiReadyCount,
      delta: project.value.aiReadyDelta,
      tone: 'primary' as const,
    },
    {
      id: 'services',
      icon: '⚙️',
      label: '代码服务',
      value: `${project.value.serviceCount}`,
      delta: `${project.value.serviceCount} 个已关联服务`,
    },
    {
      id: 'incidents',
      icon: '🚨',
      label: '待处理事故',
      value: `${project.value.incidents.length}`,
      delta: project.value.incidentsSummary,
      tone: project.value.incidents.length ? ('danger' as const) : ('success' as const),
    },
    {
      id: 'token',
      icon: '🤖',
      label: '本月 Token',
      value: project.value.tokenLabel,
      delta: project.value.monthlyTokenDelta,
      tone: 'primary' as const,
    },
  ]
})

const aiSummaryParagraphs = computed(() => {
  if (!project.value?.aiSummary) return []
  return project.value.aiSummary.split('\n\n').filter(Boolean)
})
</script>

<template>
  <NotFoundProjectState v-if="!project" />

  <section v-else class="project-overview" data-testid="project-overview-page">
    <div class="stats-grid">
      <StatCard
        v-for="item in stats"
        :key="item.id"
        :delta="item.delta"
        :icon="item.icon"
        :label="item.label"
        :tone="item.tone"
        :value="item.value"
      />
    </div>

    <div class="overview-grid">
      <CardPanel title="⚙️ 代码服务健康状态">
        <div v-if="project.services.length" class="service-list" data-testid="project-overview-services">
          <article v-for="service in project.services" :key="service.id" class="service-item">
            <div>
              <div class="service-name">
                {{ service.name }}
                <span class="service-stack">{{ service.techStack }}</span>
              </div>
              <div class="service-meta">{{ service.deployMeta }}</div>
            </div>
            <span class="service-status" :class="service.statusTone">{{ service.statusLabel }}</span>
          </article>
        </div>
        <p v-else class="empty-state" data-testid="project-overview-services">
          当前项目还没有接入代码服务，可在「代码服务」中新增服务并关联仓库。
        </p>
      </CardPanel>

      <CardPanel title="📋 项目活动">
        <ActivityTimeline v-if="project.activities.length" :items="project.activities" />
        <p v-else class="empty-state">当前项目还没有活动记录，后续可继续接入项目动态接口。</p>
      </CardPanel>
    </div>

    <CardPanel title="🤖 AI 项目摘要">
      <template #header-extra>
        <span class="summary-meta">每日更新 · 由代理层自动生成</span>
      </template>
      <div class="ai-summary-bubble">
        <p class="ai-summary-title">{{ project.name }} · 今日摘要</p>
        <p v-for="(para, i) in aiSummaryParagraphs" :key="i" class="ai-summary-para">{{ para }}</p>
      </div>
    </CardPanel>
  </section>
</template>

<style scoped>
.project-overview {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.service-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.service-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid rgba(229, 231, 235, 0.9);
}

.service-item:last-child {
  border-bottom: none;
}

.service-name {
  font-weight: 700;
}

.service-stack,
.service-meta,
.empty-state {
  color: var(--text-subtle);
  font-size: 12px;
}

.service-stack {
  margin-left: 8px;
}

.service-meta,
.empty-state {
  margin-top: 6px;
}

.empty-state {
  line-height: 1.7;
}

.service-status {
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.service-status.success {
  background: rgba(18, 183, 106, 0.12);
  color: var(--success);
}

.service-status.primary {
  background: var(--primary-soft);
  color: var(--primary);
}

.service-status.warning {
  background: rgba(247, 144, 9, 0.12);
  color: var(--warning);
}

/* AI summary card */
.summary-meta {
  font-size: 12px;
  color: var(--text-subtle);
}

.ai-summary-bubble {
  background: linear-gradient(135deg, #f0f3ff 0%, #f7f8fa 100%);
  border: 1px solid rgba(79, 110, 247, 0.15);
  border-radius: 14px;
  padding: 18px 20px;
  line-height: 1.75;
}

.ai-summary-title {
  font-weight: 700;
  font-size: 14px;
  color: var(--primary);
  margin: 0 0 12px;
}

.ai-summary-para {
  margin: 0 0 10px;
  font-size: 13.5px;
  color: var(--text-main);
}

.ai-summary-para:last-child {
  margin-bottom: 0;
}

@media (max-width: 1180px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .overview-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
