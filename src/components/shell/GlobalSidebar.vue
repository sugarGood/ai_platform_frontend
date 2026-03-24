<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { useAuth } from '../../composables/useAuth'
import { globalNavGroups } from '../../mocks/navigation'

const route = useRoute()
const { displayName, avatarChar, user } = useAuth()

const roleLabel = computed(() => {
  const r = user.value?.platformRole
  if (r === 'ADMIN') return '超级管理员'
  return r?.trim() || '成员'
})

function isActive(path: string) {
  if (route.path === path) return true
  // e.g. /placeholder/keys vs /placeholder/keys/extra
  if (path.startsWith('/placeholder/') && route.path.startsWith(path)) return true
  return false
}
</script>

<template>
  <aside class="sidebar" data-testid="global-sidebar">
    <div class="sidebar-logo">
      <div class="logo-icon">AI</div>
      <div>
        <div class="logo-text">AI 中台</div>
        <div class="logo-sub">Enterprise AI Platform</div>
      </div>
    </div>

    <div v-for="group in globalNavGroups" :key="group.label" class="nav-section">
      <div class="nav-label">{{ group.label }}</div>
      <RouterLink
        v-for="item in group.items"
        :key="item.key"
        :to="item.to"
        class="nav-item"
        :class="{ active: isActive(item.to) }"
      >
        <span class="icon">{{ item.icon }}</span>
        <span class="label">{{ item.label }}</span>
        <span v-if="item.badge" class="badge">{{ item.badge }}</span>
      </RouterLink>
    </div>

    <div class="sidebar-footer">
      <div class="avatar">{{ avatarChar }}</div>
      <div class="user-info">
        <div class="name">{{ displayName }}</div>
        <div class="role">{{ roleLabel }}</div>
      </div>
    </div>
  </aside>
</template>
