<script setup lang="ts">
defineProps<{
  title: string
  badge?: string
  subtitle?: string
  panelTone?: 'default' | 'success'
}>()
</script>

<template>
  <section class="card-panel" :class="panelTone === 'success' ? 'card-panel--success' : ''">
    <header class="card-panel-header">
      <div class="card-panel-title-block">
        <h2 class="card-panel-title">{{ title }}</h2>
        <p v-if="subtitle" class="card-panel-subtitle">{{ subtitle }}</p>
      </div>
      <slot name="header-extra" />
      <span v-if="badge" class="card-panel-badge">{{ badge }}</span>
    </header>

    <div class="card-panel-body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.card-panel {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid var(--card-border);
  border-radius: 24px;
  box-shadow: var(--shadow-soft);
}

.card-panel--success {
  border-color: var(--success);
}

.card-panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px 0;
}

.card-panel--success .card-panel-header {
  margin: -1px -1px 0;
  padding: 16px 20px 14px;
  background: #ecfdf3;
  border-radius: 23px 23px 0 0;
}

.card-panel-title-block {
  min-width: 0;
  flex: 1;
}

.card-panel-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}

.card-panel-subtitle {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-muted, #667085);
  line-height: 1.4;
}

.card-panel-badge {
  border-radius: 999px;
  padding: 4px 10px;
  background: var(--primary-soft);
  color: var(--primary);
  font-size: 12px;
  font-weight: 600;
}

.card-panel-body {
  padding: 18px 20px 20px;
}
</style>
