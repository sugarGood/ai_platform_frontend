<script setup lang="ts">
import { RouterLink } from 'vue-router'

defineProps<{
  projectId: string
  name: string
  typeLabel: string
  description: string
  tokenLabel: string
}>()
</script>

<template>
  <div class="ps-grid">
    <section class="ps-card">
      <header class="ps-hd">项目基础信息</header>
      <div class="ps-body">
        <label class="fg">
          <span class="fl">项目名称</span>
          <input class="fin" type="text" :value="name" readonly />
        </label>
        <label class="fg">
          <span class="fl">项目类型</span>
          <select class="fsel" disabled>
            <option>{{ typeLabel }}</option>
          </select>
        </label>
        <label class="fg">
          <span class="fl">项目描述</span>
          <textarea class="fta" rows="3" readonly>{{ description }}</textarea>
        </label>
        <button type="button" class="pbtn primary">保存</button>
      </div>
    </section>

    <section class="ps-card">
      <header class="ps-hd">研发配置</header>
      <div class="ps-body">
        <label class="fg">
          <span class="fl">Sprint 周期</span>
          <select class="fsel">
            <option>2 周</option>
            <option>1 周</option>
          </select>
        </label>
        <label class="fg">
          <span class="fl">Token 月配额（跳转配额管理页设置）</span>
          <div class="tok-row">
            <span class="tok-val">{{ tokenLabel }} / 月</span>
            <RouterLink class="tok-link" :to="`/projects/${projectId}/keymanagement`">配额管理 →</RouterLink>
          </div>
        </label>
        <label class="fg">
          <span class="fl">关联原子能力</span>
          <div class="tag-row">
            <span class="atom-tag g">🔐 SSO</span>
            <span class="atom-tag b">💳 支付网关</span>
            <button type="button" class="add-tag">+ 添加</button>
          </div>
        </label>
        <button type="button" class="pbtn primary">保存</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.ps-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.ps-card {
  border: 1px solid var(--card-border, #e5e7eb);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: var(--shadow-soft);
  overflow: hidden;
}

.ps-hd {
  padding: 16px 20px;
  font-size: 16px;
  font-weight: 700;
  border-bottom: 1px solid rgba(229, 231, 235, 0.9);
}

.ps-body {
  padding: 18px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.fg {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.fl {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-subtle);
}

.fin,
.fsel,
.fta {
  border: 1px solid rgba(17, 24, 39, 0.12);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  font-family: inherit;
}

.fta {
  resize: vertical;
  min-height: 72px;
}

.tok-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.tok-val {
  font-size: 13px;
  font-weight: 600;
}

.tok-link {
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 6px;
  border: 1px solid rgba(17, 24, 39, 0.12);
  background: #fff;
  color: var(--primary);
  text-decoration: none;
}

.tok-link:hover {
  border-color: var(--primary);
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-top: 4px;
}

.atom-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 6px;
}

.atom-tag.g {
  background: rgba(18, 183, 106, 0.12);
  color: var(--success);
}

.atom-tag.b {
  background: rgba(79, 110, 247, 0.12);
  color: var(--primary);
}

.add-tag {
  padding: 2px 8px;
  font-size: 11px;
  border-radius: 6px;
  border: 1px dashed rgba(17, 24, 39, 0.2);
  background: #fff;
  cursor: pointer;
}

.pbtn {
  align-self: flex-start;
  padding: 8px 18px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid rgba(17, 24, 39, 0.12);
  background: #fff;
}

.pbtn.primary {
  background: var(--primary, #4f6ef7);
  color: #fff;
  border-color: transparent;
}

@media (max-width: 900px) {
  .ps-grid {
    grid-template-columns: 1fr;
  }
}
</style>
