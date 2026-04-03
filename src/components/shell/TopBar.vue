<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { useAuth } from '../../composables/useAuth'
import { useOverlay } from '../../composables/useOverlay'

const props = defineProps<{
  title: string
  projectScoped: boolean
}>()

const route = useRoute()
const { openNotifications, openNewProjectModal } = useOverlay()
const { logout } = useAuth()

const contextLabel = computed(() => {
  if (props.projectScoped) return '项目空间'
  if (route.name === 'dashboard') return '工作台'
  if (route.name === 'projects') return '项目列表'
  return '平台'
})

const primaryActionLabel = computed(() => {
  if (props.projectScoped) return ''
  if (route.name === 'dashboard' || route.name === 'projects') return '新建项目'
  return ''
})

function onPrimaryAction() {
  if (primaryActionLabel.value) {
    openNewProjectModal()
  }
}
</script>

<template>
  <header class="topbar">
    <div class="topbar-main">
      <span class="topbar-context" data-testid="topbar-context">{{ contextLabel }}</span>
      <div class="topbar-title" data-testid="topbar-title">{{ title }}</div>
    </div>

    <div class="topbar-actions">
      <button
        v-if="primaryActionLabel"
        class="btn btn-primary topbar-primary-action"
        data-testid="topbar-primary-action"
        type="button"
        @click="onPrimaryAction"
      >
        + {{ primaryActionLabel }}
      </button>

      <button class="btn" data-testid="topbar-notifications" type="button" @click="openNotifications">
        🔔 通知
        <span class="topbar-notify-count">6</span>
      </button>
      <RouterLink
        v-if="!projectScoped"
        class="btn"
        data-testid="topbar-my-credential"
        to="/placeholder/my-credential"
      >
        🪪 我的凭证
      </RouterLink>
      <button class="btn" data-testid="topbar-logout" type="button" @click="logout">退出</button>
    </div>
  </header>
</template>
