<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    /** 省略时不在壳层渲染标题，由插槽内提供带 titleId 的标题（无障碍） */
    title?: string
    description?: string
    maxWidth?: string
    /** 用于 aria-labelledby，无描述时与 title 同 id */
    titleId?: string
  }>(),
  {
    title: undefined,
    maxWidth: '680px',
    titleId: 'prototype-modal-title',
  },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

function close() {
  emit('update:open', false)
}

function onKeydown(ev: KeyboardEvent) {
  if (ev.key === 'Escape' && props.open) close()
}

watch(
  () => props.open,
  (v) => {
    if (typeof document === 'undefined') return
    document.body.style.overflow = v ? 'hidden' : ''
  },
)

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="pm-backdrop"
      data-testid="prototype-modal-backdrop"
      @click.self="close"
    >
      <div
        class="pm-dialog"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        :style="{ maxWidth }"
      >
        <button class="pm-close" type="button" aria-label="关闭" @click="close">×</button>
        <h2 v-if="title" :id="titleId" class="pm-title">{{ title }}</h2>
        <p v-if="description" class="pm-desc">{{ description }}</p>
        <div class="pm-body">
          <slot />
        </div>
        <div v-if="$slots.footer" class="pm-footer">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.pm-backdrop {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.48);
}

.pm-dialog {
  position: relative;
  width: 100%;
  max-height: min(92vh, 900px);
  overflow: auto;
  border-radius: 14px;
  border: 1px solid var(--card-border);
  background: #fff;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.2);
  padding: 20px 22px 16px;
}

.pm-close {
  position: absolute;
  top: 10px;
  right: 12px;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  font-size: 22px;
  line-height: 1;
  color: var(--text-subtle);
  cursor: pointer;
}

.pm-close:hover {
  background: rgba(15, 23, 42, 0.06);
  color: var(--text-main);
}

.pm-title {
  margin: 0 36px 8px 0;
  font-size: 17px;
  font-weight: 700;
}

.pm-desc {
  margin: 0 0 16px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--text-subtle);
}

.pm-body {
  font-size: 13px;
}

.pm-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
  padding-top: 4px;
}

:deep(.pm-section) {
  margin: 14px 0 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-subtle);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

:deep(.pm-grid2) {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

:deep(.pm-field) {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

:deep(.pm-label) {
  font-size: 12px;
  font-weight: 500;
}

:deep(.pm-input),
:deep(.pm-select),
:deep(.pm-textarea) {
  font: inherit;
  border: 1px solid rgba(17, 24, 39, 0.12);
  border-radius: 8px;
  padding: 8px 10px;
  background: #fff;
  min-width: 0;
}

:deep(.pm-textarea) {
  resize: vertical;
  line-height: 1.5;
}

:deep(.pm-btn) {
  border: 1px solid rgba(17, 24, 39, 0.12);
  border-radius: 999px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  background: #fff;
  cursor: pointer;
}

:deep(.pm-btn--primary) {
  background: linear-gradient(135deg, #4f6ef7 0%, #5d7bff 100%);
  color: #fff;
  border-color: transparent;
}

:deep(.pm-mono) {
  font-family: ui-monospace, Menlo, Monaco, monospace;
  font-size: 12px;
}

:deep(.pm-codeblock) {
  background: #0d1117;
  color: #c9d1d9;
  border-radius: 8px;
  padding: 12px 14px;
  font-family: ui-monospace, Menlo, Monaco, monospace;
  font-size: 11px;
  line-height: 1.65;
  overflow-x: auto;
  margin: 8px 0;
}

:deep(.pm-kv) {
  width: 100%;
  font-size: 12px;
}

:deep(.pm-kv td) {
  padding: 4px 0;
  vertical-align: top;
}

:deep(.pm-kv td:first-child) {
  width: 120px;
  color: var(--text-subtle);
}

@media (max-width: 560px) {
  :deep(.pm-grid2) {
    grid-template-columns: 1fr;
  }
}
</style>
