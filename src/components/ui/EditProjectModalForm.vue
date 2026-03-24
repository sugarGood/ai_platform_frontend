<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useOverlay } from '../../composables/useOverlay'
import { listUsers } from '../../services/users'
import type { UserResponse } from '../../types/user'

const PROJECT_ICON_OPTIONS = [
  '📁',
  '🛒',
  '👤',
  '📊',
  '💳',
  '🚀',
  '☁️',
  '🤖',
  '📱',
  '🏢',
  '🔐',
  '📈',
  '🎯',
  '🛠️',
  '✨',
  '🧩',
] as const

const { closeOverlay, overlayState, submitEditProjectDraft } = useOverlay()

const users = ref<UserResponse[]>([])
const catalogLoading = ref(false)
const catalogError = ref('')

function userLine(u: UserResponse) {
  const name = u.fullName?.trim() || u.username || `用户 #${u.id}`
  const role = u.jobTitle?.trim() || '—'
  const mail = u.email?.trim() || u.username || ''
  return { name, sub: mail ? `${role} · ${mail}` : role }
}

async function loadUsers() {
  catalogLoading.value = true
  catalogError.value = ''
  try {
    users.value = await listUsers()
  } catch (e) {
    catalogError.value = e instanceof Error ? e.message : '加载用户列表失败'
    users.value = []
  } finally {
    catalogLoading.value = false
  }
}

watch(
  () => [overlayState.open, overlayState.kind] as const,
  ([open, kind]) => {
    if (open && kind === 'edit-project') void loadUsers()
  },
  { immediate: true },
)

const ownerUserIdStr = computed({
  get: () => (overlayState.editDraft.ownerUserId == null ? '' : String(overlayState.editDraft.ownerUserId)),
  set: (v: string) => {
    overlayState.editDraft.ownerUserId = v === '' ? null : Number(v)
  },
})
</script>

<template>
  <div class="epm" data-testid="edit-project-modal">
    <p v-if="overlayState.editLoading" class="epm-muted">正在加载项目信息…</p>
    <p v-else-if="!overlayState.editDraft.projectId" class="epm-muted">
      {{ overlayState.submitError || '无法加载项目信息。' }}
    </p>
    <template v-else>
      <section class="epm-block">
        <h3 class="epm-h">基础信息</h3>
        <div class="epm-readonly-grid">
          <div class="epm-field">
            <span class="epm-label">项目编码</span>
            <div class="epm-readonly">{{ overlayState.editDraft.code || '—' }}</div>
          </div>
          <div class="epm-field">
            <span class="epm-label">项目类型</span>
            <div class="epm-readonly">{{ overlayState.editDraft.projectTypeLabel || '—' }}</div>
          </div>
        </div>
        <div class="epm-grid">
          <label class="epm-field epm-field-span2">
            <span class="epm-label">项目名称</span>
            <input v-model="overlayState.editDraft.name" class="epm-input" placeholder="项目名称" />
          </label>
          <div class="epm-field epm-field-span2">
            <span class="epm-label">项目图标</span>
            <div class="epm-icon-grid" role="group" aria-label="预设图标">
              <button
                v-for="em in PROJECT_ICON_OPTIONS"
                :key="em"
                type="button"
                class="epm-icon-opt"
                :class="{ 'epm-icon-opt--on': overlayState.editDraft.icon === em }"
                :title="em"
                @click="overlayState.editDraft.icon = em"
              >
                {{ em }}
              </button>
            </div>
            <label class="epm-icon-custom-wrap">
              <span class="epm-hint">或自定义（单个 emoji）</span>
              <input
                v-model="overlayState.editDraft.icon"
                class="epm-input epm-icon-custom-input"
                maxlength="8"
                placeholder="例如 📦"
              />
            </label>
          </div>
          <label class="epm-field epm-field-span2">
            <span class="epm-label">项目描述</span>
            <textarea
              v-model="overlayState.editDraft.description"
              class="epm-textarea"
              placeholder="项目目标与范围（可留空）"
              rows="3"
            />
          </label>
          <label class="epm-field">
            <span class="epm-label">项目负责人</span>
            <select v-model="ownerUserIdStr" class="epm-input" :disabled="catalogLoading && !users.length">
              <option value="">未指定</option>
              <option v-for="u in users" :key="u.id" :value="String(u.id)">{{ userLine(u).name }}</option>
            </select>
            <span v-if="catalogError" class="epm-warn">{{ catalogError }}</span>
          </label>
        </div>
      </section>

      <section class="epm-block">
        <h3 class="epm-h">配额与策略</h3>
        <div class="epm-grid">
          <label class="epm-field">
            <span class="epm-label">月度 Token 池</span>
            <div class="epm-token-row">
              <input
                v-model="overlayState.editDraft.tokenPoolInput"
                class="epm-input"
                placeholder="例如 500K、2M；留空表示本次不修改"
              />
              <span class="epm-token-suffix">0 = 不限制</span>
            </div>
            <span class="epm-hint">与新建项目相同格式；留空则不在本次请求中更新该字段。</span>
          </label>
          <label class="epm-field">
            <span class="epm-label">告警阈值（%）</span>
            <input
              v-model="overlayState.editDraft.alertThresholdPctInput"
              class="epm-input"
              placeholder="0–100，留空不修改"
              inputmode="numeric"
            />
          </label>
          <label class="epm-field epm-field-span2">
            <span class="epm-label">超配额策略</span>
            <input
              v-model="overlayState.editDraft.overQuotaStrategy"
              class="epm-input"
              placeholder="留空则本次不修改"
            />
          </label>
        </div>
      </section>

      <p v-if="overlayState.submitError" class="form-error">{{ overlayState.submitError }}</p>

      <div class="epm-actions">
        <button class="epm-btn epm-btn-ghost" type="button" :disabled="overlayState.submitting" @click="closeOverlay">
          取消
        </button>
        <button
          class="epm-btn epm-btn-primary"
          type="button"
          :disabled="overlayState.submitting"
          @click="submitEditProjectDraft"
        >
          {{ overlayState.submitting ? '保存中…' : '保存' }}
        </button>
      </div>
    </template>
  </div>
</template>


<style scoped>
.epm {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 0 0;
}

.epm-block {
  padding: 16px 0 18px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
}

.epm-block:last-of-type {
  border-bottom: none;
}

.epm-h {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: 0.02em;
}

.epm-readonly-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 16px;
  margin-bottom: 14px;
}

@media (max-width: 640px) {
  .epm-readonly-grid {
    grid-template-columns: 1fr;
  }
}

.epm-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px 16px;
}

@media (max-width: 640px) {
  .epm-grid {
    grid-template-columns: 1fr;
  }
}

.epm-field-span2 {
  grid-column: 1 / -1;
}

.epm-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.epm-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-subtle, #64748b);
}

.epm-readonly {
  border: 1px dashed rgba(209, 213, 219, 0.95);
  border-radius: 12px;
  padding: 10px 12px;
  font-size: 14px;
  color: var(--text-subtle, #64748b);
  background: rgba(248, 250, 252, 0.65);
}

.epm-input,
.epm-textarea {
  width: 100%;
  border: 1px solid rgba(209, 213, 219, 0.95);
  border-radius: 12px;
  padding: 10px 12px;
  font: inherit;
  font-size: 14px;
  background: #fff;
  color: var(--text);
}

.epm-textarea {
  resize: vertical;
  min-height: 72px;
  line-height: 1.5;
}

.epm-hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-subtle, #64748b);
  font-weight: 400;
}

.epm-muted {
  margin: 12px 0;
  font-size: 14px;
  color: var(--text-subtle, #64748b);
}

.epm-warn {
  font-size: 12px;
  color: #b45309;
}

.epm-icon-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.epm-icon-opt {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(209, 213, 219, 0.95);
  border-radius: 12px;
  background: #fff;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  transition:
    border-color 0.15s,
    background 0.15s,
    box-shadow 0.15s;
}

.epm-icon-opt:hover {
  border-color: rgba(79, 110, 247, 0.45);
  background: rgba(79, 110, 247, 0.06);
}

.epm-icon-opt--on {
  border-color: #4f6ef7;
  background: rgba(79, 110, 247, 0.12);
  box-shadow: 0 0 0 2px rgba(79, 110, 247, 0.2);
}

.epm-icon-custom-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 10px;
}

.epm-icon-custom-input {
  max-width: 200px;
  font-size: 20px;
  text-align: center;
}

.epm-token-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.epm-token-row .epm-input {
  flex: 1;
}

.epm-token-suffix {
  flex-shrink: 0;
  font-size: 13px;
  color: var(--text-subtle, #64748b);
  white-space: nowrap;
}

.form-error {
  margin: 8px 0 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(240, 68, 56, 0.08);
  color: var(--danger);
  font-size: 13px;
  line-height: 1.5;
}

.epm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
  padding-top: 8px;
}

.epm-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.epm-btn:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.epm-btn-ghost {
  border: 1px solid rgba(17, 24, 39, 0.12);
  background: #fff;
  color: var(--text);
}

.epm-btn-primary {
  border: none;
  background: linear-gradient(135deg, #4f6ef7 0%, #5d7bff 100%);
  color: #fff;
  box-shadow: 0 4px 14px rgba(79, 110, 247, 0.35);
}
</style>
