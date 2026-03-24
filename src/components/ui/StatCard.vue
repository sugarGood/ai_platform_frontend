<script setup lang="ts">
defineProps<{
  icon: string
  label: string
  value: string
  delta: string
  tone?: 'primary' | 'danger' | 'success' | 'warning' | 'default'
  /** 副标题用成功色（如 ↑ 环比、目标达成） */
  deltaTone?: 'default' | 'success'
}>()
</script>

<template>
  <article class="stat-card">
    <div class="stat-head">
      <div class="stat-label">{{ label }}</div>
      <div class="stat-icon">{{ icon }}</div>
    </div>
    <div class="stat-value" :class="tone ?? 'default'">{{ value }}</div>
    <div class="stat-delta" :class="{ 'stat-delta--success': deltaTone === 'success' }">{{ delta }}</div>
  </article>
</template>

<style scoped>
.stat-card {
  padding: 14px 16px;
  background: #fff;
  border: 1px solid var(--card-border);
  border-radius: 14px;
}

.stat-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.stat-icon {
  font-size: 18px;
  line-height: 1;
  opacity: 0.88;
}

.stat-label {
  color: var(--text-subtle);
  font-size: 12px;
  line-height: 1.45;
}

.stat-value {
  margin-top: 6px;
  font-size: 36px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.stat-value.primary {
  color: var(--primary);
}

.stat-value.danger {
  color: var(--danger);
}

.stat-value.success {
  color: var(--success);
}

.stat-value.warning {
  color: var(--warning);
}

.stat-delta {
  margin-top: 4px;
  color: var(--text-subtle);
  font-size: 12px;
  line-height: 1.4;
}

.stat-delta--success {
  color: var(--success);
}
</style>

