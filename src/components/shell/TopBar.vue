<script setup lang="ts">
import { useOverlay } from '../../composables/useOverlay'

defineProps<{
  title: string
  projectScoped: boolean
}>()

const { openNotifications } = useOverlay()
</script>

<template>
  <header class="topbar">
    <div class="topbar-title" data-testid="topbar-title">{{ title }}</div>

    <div class="topbar-actions">
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
    </div>
  </header>
</template>
