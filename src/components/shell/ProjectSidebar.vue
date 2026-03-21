<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { getProjectById } from '../../composables/useProjects'
import { projectNavGroups } from '../../mocks/navigation'

const route = useRoute()

const project = computed(() =>
  typeof route.params.projectId === 'string' ? getProjectById(route.params.projectId) : undefined,
)

const projectId = computed(() => {
  return typeof route.params.projectId === 'string' ? route.params.projectId : ''
})

function buildPath(section: string) {
  return `/projects/${projectId.value}/${section}`
}

function isActive(section: string) {
  if (section === 'services') {
    return route.path.startsWith(buildPath('services'))
  }

  return route.path === buildPath(section)
}
</script>

<template>
  <aside class="sidebar" data-testid="project-sidebar">
    <RouterLink class="sidebar-back" to="/projects">
      <span style="font-size: 16px">←</span>
      <span>返回项目列表</span>
    </RouterLink>

    <div class="proj-info-block">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px">
        <span style="font-size: 20px">{{ project?.icon ?? '📁' }}</span>
        <span class="proj-info-name">{{ project?.name ?? '未知项目' }}</span>
      </div>
      <div class="proj-info-sprint">
        <span class="proj-status-dot" />
        <span>{{ project?.currentSprint ?? '项目上下文' }}</span>
      </div>
    </div>

    <div v-for="group in projectNavGroups" :key="group.label" class="nav-section">
      <div class="nav-label">{{ group.label }}</div>
      <RouterLink
        v-for="item in group.items"
        :key="item.key"
        :to="buildPath(item.to)"
        class="nav-item"
        :class="{ active: isActive(item.to) }"
      >
        <span class="icon">{{ item.icon }}</span>
        <span class="label">{{ item.label }}</span>
        <span v-if="item.badge" class="badge">{{ item.badge }}</span>
      </RouterLink>
    </div>

    <div class="sidebar-footer">
      <div class="avatar">张</div>
      <div class="user-info">
        <div class="name">张三</div>
        <div class="role">项目负责人</div>
      </div>
    </div>
  </aside>
</template>
