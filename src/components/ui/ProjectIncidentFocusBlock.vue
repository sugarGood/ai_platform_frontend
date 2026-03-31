<script setup lang="ts">
import type { ProjectIncidentCardModel } from '../../types/module-page'

const props = withDefaults(
  defineProps<{
    /** 有数据时传入卡片模型；`null` 且提供 `emptyHint` 表示接口返回空列表 */
    incident?: ProjectIncidentCardModel | null
    emptyHint?: string
  }>(),
  {
    emptyHint: '',
  },
)

const isApiEmpty = () =>
  props.incident === null && Boolean(props.emptyHint?.trim())

const demo: ProjectIncidentCardModel = {
  title: '支付服务 NullPointerException - mall-backend',
  severityBadge: '🔴 严重',
  severityIsDanger: true,
  statusLabel: '处理中',
  errorStack: `java.lang.NullPointerException
  at PaymentService.processOrder(:142)
Caused by: order.paymentMethod is null`,
  aiBlock:
    '根因：checkout 接口未对 paymentMethod 做非空校验。\n修复：在 OrderController:89 加参数校验。',
  showIdeCta: true,
}

const m = () => props.incident ?? demo
</script>

<template>
  <article v-if="isApiEmpty()" class="incident-empty">
    {{ emptyHint }}
  </article>
  <article v-else class="incident-card">
    <header class="incident-hd">
      <div class="incident-hd-left">
        <span class="badge-sev" :class="{ soft: !m().severityIsDanger }">{{ m().severityBadge }}</span>
        <span class="incident-title">{{ m().title }}</span>
      </div>
      <span class="badge-state">{{ m().statusLabel }}</span>
    </header>
    <div class="incident-body">
      <div class="incident-col">
        <div class="col-label">错误堆栈</div>
        <pre class="code-block">{{ m().errorStack }}</pre>
      </div>
      <div class="incident-col">
        <div class="ai-label">🤖 AI 诊断</div>
        <div class="ai-bubble">
          <span class="ai-text">{{ m().aiBlock }}</span>
          <button v-if="m().showIdeCta" type="button" class="ide-btn">🤖 在 IDE 中修复</button>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
.incident-empty {
  margin: 0;
  padding: 20px;
  border-radius: 12px;
  border: 1px dashed rgba(17, 24, 39, 0.15);
  background: rgba(248, 250, 252, 0.9);
  font-size: 14px;
  color: var(--text-subtle);
  text-align: center;
}

.incident-card {
  border: 1px solid var(--danger, #f04438);
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
  box-shadow: var(--shadow-soft);
}

.incident-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  background: #fef3f2;
  border-radius: 11px 11px 0 0;
}

.incident-hd-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  min-width: 0;
}

.badge-sev {
  font-size: 11px;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 6px;
  background: #fef3f2;
  color: var(--danger);
  border: 1px solid #fecdca;
  flex-shrink: 0;
}

.badge-sev.soft {
  color: #b54708;
  border-color: #fec84b;
  background: #fffaeb;
}

.badge-state {
  font-size: 11px;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 6px;
  background: rgba(247, 144, 9, 0.15);
  color: #b54708;
  flex-shrink: 0;
}

.incident-title {
  font-weight: 600;
  font-size: 14px;
}

.incident-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  padding: 16px 20px 20px;
}

.incident-col {
  min-width: 0;
}

.col-label,
.ai-label {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 8px;
}

.ai-label {
  color: var(--primary);
}

.code-block {
  margin: 0;
  max-height: 200px;
  overflow: auto;
  padding: 10px 12px;
  border-radius: 8px;
  background: #0f172a;
  color: #d6e2ff;
  font-family: ui-monospace, monospace;
  font-size: 11px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.ai-bubble {
  padding: 14px 16px;
  border-radius: 12px;
  background: rgba(79, 110, 247, 0.08);
  font-size: 13px;
  line-height: 1.65;
}

.ai-text {
  white-space: pre-wrap;
}

.ide-btn {
  margin-top: 10px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  border: none;
  border-radius: 8px;
  background: var(--primary, #4f6ef7);
  color: #fff;
  cursor: pointer;
}

@media (max-width: 900px) {
  .incident-body {
    grid-template-columns: 1fr;
  }
}
</style>
