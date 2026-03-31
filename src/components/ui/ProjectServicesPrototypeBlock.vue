<script setup lang="ts">
import { RouterLink } from 'vue-router'

import type { CatalogItem } from '../../types/module-page'

defineProps<{
  serviceCount: number
  items: CatalogItem[]
}>()

function badgeTone(tone?: CatalogItem['tone']) {
  if (tone === 'success') return 'is-success'
  if (tone === 'warning') return 'is-warn'
  return 'is-primary'
}
</script>

<template>
  <div class="svc-root">
    <div class="svc-toolbar">
      <span class="svc-count">共 {{ serviceCount }} 个代码服务</span>
      <button type="button" class="add-svc">+ 添加服务</button>
    </div>

    <div class="svc-grid">
      <component
        :is="item.to ? RouterLink : 'article'"
        v-for="item in items"
        :key="item.title"
        :to="item.to"
        class="service-card"
      >
        <div class="svc-card-head">
          <span v-if="item.icon" class="svc-icon">{{ item.icon }}</span>
          <span v-if="item.badge" class="svc-badge" :class="badgeTone(item.tone)">{{ item.badge }}</span>
        </div>
        <div class="svc-name">{{ item.title }}</div>
        <div v-if="item.subtitle" class="svc-tech">{{ item.subtitle }}</div>
        <div v-if="item.lines?.length" class="svc-lines">
          <div v-for="ln in item.lines" :key="ln.label" class="svc-line">
            <span class="svc-lab">{{ ln.label }}</span>
            <span :class="['svc-val', ln.mono ? 'mono' : '']">{{ ln.value }}</span>
          </div>
        </div>
        <div v-if="item.cta" class="svc-cta">{{ item.cta }}</div>
      </component>
    </div>

    <section class="add-card">
      <div class="add-card-hd">+ 添加新服务</div>
      <div class="add-grid">
        <div class="mcp-card">
          <div class="mcp-icon">🗂️</div>
          <div class="mcp-title">选择模板创建</div>
          <div class="mcp-sub">从公司标准模板快速初始化服务</div>
        </div>
        <div class="mcp-card">
          <div class="mcp-icon">🔗</div>
          <div class="mcp-title">关联已有仓库</div>
          <div class="mcp-sub">填入 Git 地址，自动识别技术栈</div>
        </div>
        <div class="mcp-card">
          <div class="mcp-icon">📥</div>
          <div class="mcp-title">导入 Git 仓库</div>
          <div class="mcp-sub">从 GitHub / GitLab / 自建 Git 导入</div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.svc-root {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.svc-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.svc-count {
  font-size: 13px;
  color: var(--text-subtle);
}

.add-svc {
  margin-left: auto;
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  background: var(--primary, #4f6ef7);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.svc-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.service-card {
  display: flex;
  flex-direction: column;
  padding: 18px;
  border: 1px solid var(--card-border, #e5e7eb);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: var(--shadow-soft, 0 4px 24px rgba(15, 23, 42, 0.06));
  text-decoration: none;
  color: inherit;
  cursor: pointer;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}

.service-card:hover {
  border-color: rgba(79, 110, 247, 0.35);
  box-shadow: 0 8px 28px rgba(79, 110, 247, 0.12);
}

.svc-card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 10px;
}

.svc-icon {
  font-size: 28px;
  line-height: 1;
}

.svc-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 6px;
}

.svc-badge.is-success {
  background: rgba(18, 183, 106, 0.12);
  color: var(--success, #12b76a);
}
.svc-badge.is-warn {
  background: rgba(79, 110, 247, 0.12);
  color: var(--primary);
}
.svc-badge.is-primary {
  background: rgba(17, 24, 39, 0.06);
  color: var(--text-subtle);
}

.svc-name {
  font-weight: 700;
  font-size: 15px;
  margin-bottom: 4px;
}

.svc-tech {
  font-size: 12px;
  color: var(--text-subtle);
  margin-bottom: 12px;
}

.svc-lines {
  font-size: 12px;
  margin-bottom: 12px;
}

.svc-line {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 0;
  border-bottom: 1px solid var(--bg, #f4f6fc);
}

.svc-line:last-child {
  border-bottom: none;
}

.svc-lab {
  color: var(--text-subtle);
}

.svc-val {
  text-align: right;
}

.svc-val.mono {
  font-family: ui-monospace, monospace;
  font-size: 11px;
}

.svc-cta {
  margin-top: auto;
  width: 100%;
  padding: 8px;
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  border-radius: 8px;
  border: 1px solid rgba(17, 24, 39, 0.1);
  background: #fff;
}

.add-card {
  border: 1px solid var(--card-border, #e5e7eb);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: var(--shadow-soft);
  overflow: hidden;
}

.add-card-hd {
  padding: 16px 20px;
  font-size: 16px;
  font-weight: 700;
  border-bottom: 1px solid rgba(229, 231, 235, 0.9);
}

.add-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  padding: 20px;
}

.mcp-card {
  border: 2px dashed rgba(79, 110, 247, 0.25);
  border-radius: 16px;
  padding: 20px;
  text-align: center;
  background: rgba(79, 110, 247, 0.03);
}

.mcp-icon {
  font-size: 28px;
  margin-bottom: 8px;
}

.mcp-title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 6px;
}

.mcp-sub {
  font-size: 12px;
  color: var(--text-subtle);
  line-height: 1.45;
}

@media (max-width: 1024px) {
  .svc-grid,
  .add-grid {
    grid-template-columns: 1fr;
  }
}
</style>
