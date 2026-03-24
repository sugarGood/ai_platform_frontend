<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { useAuth } from '../../composables/useAuth'
import { useOverlay } from '../../composables/useOverlay'
import { getProjectById } from '../../composables/useProjects'
import { projectNavGroups } from '../../mocks/navigation'

const route = useRoute()
const { displayName, avatarChar, user } = useAuth()
const { openEditProjectModal } = useOverlay()

const projectRoleLine = computed(() => user.value?.jobTitle?.trim() || '项目空间')

const project = computed(() =>
  typeof route.params.projectId === 'string' ? getProjectById(route.params.projectId) : undefined,
)

const projectId = computed(() => {
  return typeof route.params.projectId === 'string' ? route.params.projectId : ''
})

const canEditProject = computed(() => /^\d+$/.test(projectId.value))

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
      <div class="proj-info-meta">
        <span class="proj-status-dot" :class="project?.statusTone" />
        <span>{{ project?.statusLabel ?? '—' }}</span>
      </div>
      <button
        v-if="canEditProject"
        type="button"
        class="proj-edit-btn"
        data-testid="project-sidebar-edit"
        @click="void openEditProjectModal(projectId)"
      >
        编辑项目
      </button>
    </div>

    <div v-for="group in projectNavGroups" :key="group.label" class="nav-section">
      <div class="nav-label">{{ group.label }}</div>
      <RouterLink
        v-for="item in group.items"
        :key="item.key"
        :to="buildPath(item.to)"
        class="nav-item"
        :class="{ active: isActive(item.to), 'nav-item--lezhi': item.accent === 'lezhi' }"
      >
        <span class="icon">{{ item.icon }}</span>
        <span class="label">{{ item.label }}</span>
        <span v-if="item.badge" class="badge">{{ item.badge }}</span>
        <span v-if="item.pill" class="nav-pill">{{ item.pill }}</span>
      </RouterLink>
    </div>

    <div class="sidebar-footer">
      <div class="avatar">{{ avatarChar }}</div>
      <div class="user-info">
        <div class="name">{{ displayName }}</div>
        <div class="role">{{ projectRoleLine }}</div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.proj-edit-btn {
  margin-top: 10px;
  width: 100%;
  padding: 7px 12px;
  border-radius: 8px;
  border: 1px solid rgba(152, 162, 179, 0.35);
  background: rgba(255, 255, 255, 0.06);
  color: var(--sidebar-text);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition:
    color 0.15s,
    border-color 0.15s,
    background 0.15s;
}

.proj-edit-btn:hover {
  color: #fff;
  border-color: rgba(79, 110, 247, 0.55);
  background: rgba(79, 110, 247, 0.18);
}
</style>
