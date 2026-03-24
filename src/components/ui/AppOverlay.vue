<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

import { useOverlay } from '../../composables/useOverlay'
import EditProjectModalForm from './EditProjectModalForm.vue'
import NewProjectModalForm from './NewProjectModalForm.vue'

const { closeOverlay, overlayState } = useOverlay()

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
})

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && overlayState.open) {
    closeOverlay()
  }
}
</script>

<template>
  <div v-if="overlayState.open" class="overlay-backdrop" data-testid="app-overlay" @click.self="closeOverlay">
    <section
      class="overlay-panel"
      :class="{ 'overlay-panel--wide': overlayState.kind === 'new-project' || overlayState.kind === 'edit-project' }"
    >
      <header class="overlay-header">
        <div>
          <div class="overlay-title">{{ overlayState.title }}</div>
          <div class="overlay-description">{{ overlayState.description }}</div>
        </div>
        <button class="overlay-close" type="button" @click="closeOverlay">✕</button>
      </header>

      <div v-if="overlayState.kind === 'notifications'" data-testid="notifications-panel" class="overlay-body">
        <article v-for="item in overlayState.items" :key="item" class="overlay-list-item">{{ item }}</article>
      </div>

      <div v-else-if="overlayState.kind === 'new-project'" class="overlay-body overlay-body--npm">
        <NewProjectModalForm />
      </div>

      <div v-else-if="overlayState.kind === 'edit-project'" class="overlay-body overlay-body--npm">
        <EditProjectModalForm />
      </div>

      <div v-else data-testid="action-modal" class="overlay-body">
        <article v-for="item in overlayState.items" :key="item" class="overlay-list-item">{{ item }}</article>
        <div v-if="overlayState.shortcuts.length" class="overlay-shortcuts">
          <RouterLink
            v-for="shortcut in overlayState.shortcuts"
            :key="shortcut.label"
            class="shortcut-link"
            :to="shortcut.to ?? '/dashboard'"
            @click="closeOverlay"
          >
            {{ shortcut.label }}
          </RouterLink>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.overlay-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.42);
  backdrop-filter: blur(6px);
}

.overlay-panel {
  width: min(680px, 100%);
  max-height: calc(100vh - 48px);
  overflow: auto;
  border: 1px solid rgba(79, 110, 247, 0.12);
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.97);
  box-shadow: 0 24px 80px rgba(15, 23, 42, 0.22);
}

.overlay-panel--wide {
  width: min(960px, 100%);
}

.overlay-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 24px 24px 0;
}

.overlay-title {
  font-size: 22px;
  font-weight: 700;
}

.overlay-description {
  margin-top: 8px;
  color: var(--text-subtle);
  line-height: 1.7;
}

.overlay-close {
  border: none;
  border-radius: 999px;
  padding: 8px 12px;
  background: rgba(15, 23, 42, 0.06);
  cursor: pointer;
}

.overlay-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px 24px 24px;
}

.overlay-body--npm {
  padding-top: 12px;
}

.overlay-list-item {
  padding: 14px 16px;
  border: 1px solid rgba(229, 231, 235, 0.9);
  border-radius: 18px;
  background: rgba(248, 250, 252, 0.9);
  line-height: 1.7;
}

.overlay-shortcuts {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.shortcut-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  padding: 10px 16px;
  box-shadow: var(--shadow-soft);
  border: 1px solid rgba(17, 24, 39, 0.08);
  background: rgba(255, 255, 255, 0.75);
}
</style>
