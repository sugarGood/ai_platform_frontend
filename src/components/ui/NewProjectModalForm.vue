<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { projectTypeLabelMap, projectTypeOptions } from '../../composables/useProjects'
import { useOverlay } from '../../composables/useOverlay'
import { listKnowledgeBases } from '../../services/knowledge'
import { listSkills } from '../../services/skills'
import { listUsers } from '../../services/users'
import type { KnowledgeBaseResponse } from '../../types/knowledge'
import type { SkillResponse } from '../../types/skill'
import type { UserResponse } from '../../types/user'

const TEAM_OPTIONS = ['业务研发部', '平台架构部', '数据智能部', '创新实验室']

/** 新建项目可选图标（单字符 emoji，与后端 icon 字段一致） */
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

const { closeOverlay, overlayState, submitNewProjectDraft } = useOverlay()

const users = ref<UserResponse[]>([])
const knowledgeBases = ref<KnowledgeBaseResponse[]>([])
const skillsCatalog = ref<SkillResponse[]>([])
const catalogLoading = ref(false)
const catalogError = ref('')

function userLine(u: UserResponse) {
  const name = u.fullName?.trim() || u.username || `用户 #${u.id}`
  const role = u.jobTitle?.trim() || '—'
  const mail = u.email?.trim() || u.username || ''
  return { name, sub: mail ? `${role} · ${mail}` : role }
}

async function loadCatalog() {
  catalogLoading.value = true
  catalogError.value = ''
  try {
    const [u, kb, sk] = await Promise.all([listUsers(), listKnowledgeBases(), listSkills()])
    users.value = u
    knowledgeBases.value = kb
    skillsCatalog.value = sk
  } catch (e) {
    catalogError.value = e instanceof Error ? e.message : '加载成员与能力目录失败'
    users.value = []
    knowledgeBases.value = []
    skillsCatalog.value = []
  } finally {
    catalogLoading.value = false
  }
}

watch(
  () => [overlayState.open, overlayState.kind] as const,
  ([open, kind]) => {
    if (open && kind === 'new-project') void loadCatalog()
  },
  { immediate: true },
)

const pickableKnowledge = computed(() =>
  knowledgeBases.value.filter((k) => k.projectId == null && (k.scope ?? '').toUpperCase() !== 'PROJECT'),
)

const pickableSkills = computed(() => skillsCatalog.value.filter((s) => s.projectId == null))

const filteredMembers = computed(() => {
  const q = overlayState.draft.memberSearch.trim().toLowerCase()
  let list = users.value
  if (q) {
    list = list.filter((u) => {
      const { name, sub } = userLine(u)
      const idStr = String(u.id)
      return (
        name.toLowerCase().includes(q) ||
        sub.toLowerCase().includes(q) ||
        idStr.includes(q) ||
        (u.email?.toLowerCase().includes(q) ?? false) ||
        (u.username?.toLowerCase().includes(q) ?? false)
      )
    })
  }
  return list.slice(0, 14)
})

const filteredKb = computed(() => {
  const q = overlayState.draft.kbSearch.trim().toLowerCase()
  let list = pickableKnowledge.value
  if (q) {
    list = list.filter(
      (k) =>
        k.name.toLowerCase().includes(q) ||
        (k.description?.toLowerCase().includes(q) ?? false) ||
        (k.category?.toLowerCase().includes(q) ?? false),
    )
  }
  return list.slice(0, 8)
})

const filteredSkills = computed(() => {
  const q = overlayState.draft.skillSearch.trim().toLowerCase()
  let list = pickableSkills.value
  if (q) {
    list = list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.skillKey?.toLowerCase().includes(q) ?? false) ||
        (s.description?.toLowerCase().includes(q) ?? false) ||
        (s.category?.toLowerCase().includes(q) ?? false),
    )
  }
  return list.slice(0, 8)
})

function toggleMember(id: number) {
  const ids = overlayState.draft.memberPickIds
  const i = ids.indexOf(id)
  if (i >= 0) ids.splice(i, 1)
  else ids.push(id)
}

function toggleKb(id: number) {
  const ids = overlayState.draft.kbPickIds
  const i = ids.indexOf(id)
  if (i >= 0) ids.splice(i, 1)
  else ids.push(id)
}

function toggleSkill(id: number) {
  const ids = overlayState.draft.skillPickIds
  const i = ids.indexOf(id)
  if (i >= 0) ids.splice(i, 1)
  else ids.push(id)
}

function removeMember(id: number) {
  const ids = overlayState.draft.memberPickIds
  const i = ids.indexOf(id)
  if (i >= 0) ids.splice(i, 1)
}

function removeKb(id: number) {
  const ids = overlayState.draft.kbPickIds
  const i = ids.indexOf(id)
  if (i >= 0) ids.splice(i, 1)
}

function removeSkill(id: number) {
  const ids = overlayState.draft.skillPickIds
  const i = ids.indexOf(id)
  if (i >= 0) ids.splice(i, 1)
}

const selectedMemberUsers = computed(() =>
  overlayState.draft.memberPickIds
    .map((id) => users.value.find((u) => u.id === id))
    .filter((u): u is UserResponse => Boolean(u)),
)

const selectedKbs = computed(() =>
  overlayState.draft.kbPickIds
    .map((id) => knowledgeBases.value.find((k) => k.id === id))
    .filter((k): k is KnowledgeBaseResponse => Boolean(k)),
)

const selectedSkills = computed(() =>
  overlayState.draft.skillPickIds
    .map((id) => skillsCatalog.value.find((s) => s.id === id))
    .filter((s): s is SkillResponse => Boolean(s)),
)

function isMemberPicked(id: number) {
  return overlayState.draft.memberPickIds.includes(id)
}

function isKbPicked(id: number) {
  return overlayState.draft.kbPickIds.includes(id)
}

function isSkillPicked(id: number) {
  return overlayState.draft.skillPickIds.includes(id)
}

const ownerUserIdStr = computed({
  get: () => (overlayState.draft.ownerUserId == null ? '' : String(overlayState.draft.ownerUserId)),
  set: (v: string) => {
    overlayState.draft.ownerUserId = v === '' ? null : Number(v)
  },
})
</script>

<template>
  <div class="npm" data-testid="new-project-modal">
    <section class="npm-block">
      <h3 class="npm-h">基础信息</h3>
      <div class="npm-grid">
        <label class="npm-field npm-field-span2">
          <span class="npm-label">项目名称</span>
          <input v-model="overlayState.draft.name" class="npm-input" placeholder="例如：支付网关 2.0 / 智能客服工作台" />
        </label>
        <label class="npm-field">
          <span class="npm-label">项目编码</span>
          <input v-model="overlayState.draft.code" class="npm-input mono" placeholder="例：PAYMENT_GATEWAY" />
          <span class="npm-hint">后端全局唯一，建议大写英文与下划线。</span>
        </label>
        <label class="npm-field">
          <span class="npm-label">所属团队</span>
          <select v-model="overlayState.draft.team" class="npm-input">
            <option v-for="t in TEAM_OPTIONS" :key="t" :value="t">{{ t }}</option>
          </select>
        </label>
        <div class="npm-field npm-field-span2">
          <span class="npm-label">项目图标</span>
          <div class="npm-icon-grid" role="group" aria-label="预设图标">
            <button
              v-for="em in PROJECT_ICON_OPTIONS"
              :key="em"
              type="button"
              class="npm-icon-opt"
              :class="{ 'npm-icon-opt--on': overlayState.draft.icon === em }"
              :title="em"
              @click="overlayState.draft.icon = em"
            >
              {{ em }}
            </button>
          </div>
          <label class="npm-icon-custom-wrap">
            <span class="npm-hint">或自定义（单个 emoji）</span>
            <input
              v-model="overlayState.draft.icon"
              class="npm-input npm-icon-custom-input"
              maxlength="8"
              placeholder="例如 📦"
            />
          </label>
        </div>
        <label class="npm-field npm-field-span2">
          <span class="npm-label">项目描述</span>
          <textarea
            v-model="overlayState.draft.description"
            class="npm-textarea"
            placeholder="一句话描述项目目标、业务范围或交付内容（选填）"
            rows="3"
          />
        </label>
        <label class="npm-field">
          <span class="npm-label">项目负责人</span>
          <select v-model="ownerUserIdStr" class="npm-input">
            <option value="">请选择负责人</option>
            <option v-for="u in users" :key="u.id" :value="String(u.id)">{{ userLine(u).name }}</option>
          </select>
        </label>
      </div>
    </section>

    <section class="npm-block">
      <h3 class="npm-h">初始成员</h3>
      <p v-if="catalogLoading" class="npm-muted">正在加载成员列表…</p>
      <p v-else-if="catalogError" class="npm-warn">{{ catalogError }}</p>
      <input
        v-model="overlayState.draft.memberSearch"
        class="npm-input npm-search"
        placeholder="搜索成员姓名 / 邮箱 / 工号"
        type="search"
      />
      <ul class="npm-pick-list">
        <li v-for="u in filteredMembers" :key="u.id" class="npm-pick-row">
          <div class="npm-pick-main">
            <div class="npm-pick-title">{{ userLine(u).name }}</div>
            <div class="npm-pick-sub">{{ userLine(u).sub }}</div>
          </div>
          <button
            class="npm-chip-btn"
            :class="{ on: isMemberPicked(u.id) }"
            type="button"
            @click="toggleMember(u.id)"
          >
            {{ isMemberPicked(u.id) ? '已添加' : '添加' }}
          </button>
        </li>
      </ul>
      <div v-if="selectedMemberUsers.length" class="npm-chips">
        <span v-for="u in selectedMemberUsers" :key="u.id" class="npm-chip">
          {{ userLine(u).name }}
          <button type="button" class="npm-chip-x" aria-label="移除" @click="removeMember(u.id)">×</button>
        </span>
      </div>
    </section>

    <section class="npm-block">
      <h3 class="npm-h">AI 能力初始化</h3>
      <div class="npm-ai">
        <div class="npm-ai-col">
          <div class="npm-ai-title">知识库</div>
          <input v-model="overlayState.draft.kbSearch" class="npm-input npm-search" placeholder="搜索知识库名称" type="search" />
          <ul class="npm-pick-list">
            <li v-for="k in filteredKb" :key="k.id" class="npm-pick-row">
              <div class="npm-pick-main">
                <div class="npm-pick-title">{{ k.name }}</div>
                <div class="npm-pick-sub">{{ k.description?.trim() || k.category || '—' }}</div>
              </div>
              <button
                class="npm-chip-btn"
                :class="{ on: isKbPicked(k.id) }"
                type="button"
                @click="toggleKb(k.id)"
              >
                {{ isKbPicked(k.id) ? '已添加' : '添加' }}
              </button>
            </li>
          </ul>
        </div>
        <div class="npm-ai-col">
          <div class="npm-ai-title">Skills</div>
          <input
            v-model="overlayState.draft.skillSearch"
            class="npm-input npm-search"
            placeholder="搜索 Skill 名称"
            type="search"
          />
          <ul class="npm-pick-list">
            <li v-for="s in filteredSkills" :key="s.id" class="npm-pick-row">
              <div class="npm-pick-main">
                <div class="npm-pick-title">{{ s.name }}</div>
                <div class="npm-pick-sub">{{ s.skillKey || s.category || '—' }}</div>
              </div>
              <button
                class="npm-chip-btn"
                :class="{ on: isSkillPicked(s.id) }"
                type="button"
                @click="toggleSkill(s.id)"
              >
                {{ isSkillPicked(s.id) ? '已添加' : '添加' }}
              </button>
            </li>
          </ul>
        </div>
      </div>
      <div v-if="selectedKbs.length || selectedSkills.length" class="npm-chips npm-chips-tight">
        <span v-for="k in selectedKbs" :key="'kb-' + k.id" class="npm-chip npm-chip-kb">
          {{ k.name }}
          <button type="button" class="npm-chip-x" aria-label="移除" @click="removeKb(k.id)">×</button>
        </span>
        <span v-for="s in selectedSkills" :key="'sk-' + s.id" class="npm-chip npm-chip-skill">
          {{ s.name }}
          <button type="button" class="npm-chip-x" aria-label="移除" @click="removeSkill(s.id)">×</button>
        </span>
      </div>
    </section>

    <section class="npm-block">
      <h3 class="npm-h">TOKEN 配额</h3>
      <div class="npm-grid">
        <label class="npm-field">
          <span class="npm-label">项目类型</span>
          <select v-model="overlayState.draft.type" class="npm-input">
            <option v-for="opt in projectTypeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </label>
        <label class="npm-field">
          <span class="npm-label">项目 Token 池（月）</span>
          <div class="npm-token-row">
            <input v-model="overlayState.draft.tokenPoolInput" class="npm-input" placeholder="500K" />
            <span class="npm-token-suffix">Token/月</span>
          </div>
        </label>
      </div>
      <div class="npm-tip">
        <span class="npm-tip-icon" aria-hidden="true">💡</span>
        <div>
          项目池为团队共享额度；未单独配置时，开发/测试/产品等角色使用各类型默认单人上限。支持填写如
          <code>500K</code>、<code>1.2M</code> 或纯数字；留空则按项目类型使用后端默认值（{{
            projectTypeLabelMap[overlayState.draft.type]
          }}）。
        </div>
      </div>
    </section>

    <p v-if="overlayState.submitError" class="form-error" data-testid="new-project-error">{{ overlayState.submitError }}</p>

    <div class="npm-actions">
      <button class="npm-btn npm-btn-ghost" type="button" :disabled="overlayState.submitting" @click="closeOverlay">
        取消
      </button>
      <button class="npm-btn npm-btn-primary" type="button" :disabled="overlayState.submitting" @click="submitNewProjectDraft">
        {{ overlayState.submitting ? '创建中…' : '创建项目' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.npm {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 0 0;
}

.npm-block {
  padding: 16px 0 18px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
}

.npm-block:last-of-type {
  border-bottom: none;
}

.npm-h {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: 0.02em;
}

.npm-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px 16px;
}

@media (max-width: 640px) {
  .npm-grid {
    grid-template-columns: 1fr;
  }
}

.npm-field-span2 {
  grid-column: 1 / -1;
}

.npm-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.npm-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-subtle, #64748b);
}

.npm-input,
.npm-textarea {
  width: 100%;
  border: 1px solid rgba(209, 213, 219, 0.95);
  border-radius: 12px;
  padding: 10px 12px;
  font: inherit;
  font-size: 14px;
  background: #fff;
  color: var(--text);
}

.npm-input.mono {
  font-family: ui-monospace, monospace;
  font-size: 13px;
}

.npm-textarea {
  resize: vertical;
  min-height: 72px;
  line-height: 1.5;
}

.npm-hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-subtle, #64748b);
  font-weight: 400;
}

.npm-icon-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.npm-icon-opt {
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

.npm-icon-opt:hover {
  border-color: rgba(79, 110, 247, 0.45);
  background: rgba(79, 110, 247, 0.06);
}

.npm-icon-opt--on {
  border-color: #4f6ef7;
  background: rgba(79, 110, 247, 0.12);
  box-shadow: 0 0 0 2px rgba(79, 110, 247, 0.2);
}

.npm-icon-custom-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 10px;
}

.npm-icon-custom-input {
  max-width: 200px;
  font-size: 20px;
  text-align: center;
}

.npm-muted {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--text-subtle, #64748b);
}

.npm-warn {
  margin: 0 0 8px;
  font-size: 13px;
  color: #b45309;
}

.npm-search {
  margin-bottom: 10px;
}

.npm-pick-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 220px;
  overflow: auto;
  border: 1px solid rgba(229, 231, 235, 0.95);
  border-radius: 12px;
  background: rgba(248, 250, 252, 0.65);
}

.npm-pick-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(229, 231, 235, 0.7);
}

.npm-pick-row:last-child {
  border-bottom: none;
}

.npm-pick-main {
  min-width: 0;
}

.npm-pick-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.npm-pick-sub {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-subtle, #64748b);
  line-height: 1.4;
  word-break: break-word;
}

.npm-chip-btn {
  flex-shrink: 0;
  border: 1px solid rgba(17, 24, 39, 0.1);
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 600;
  background: #fff;
  cursor: pointer;
  color: var(--text);
}

.npm-chip-btn.on {
  border-color: #10b981;
  background: #ecfdf5;
  color: #047857;
}

.npm-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.npm-chips-tight {
  margin-top: 14px;
}

.npm-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  background: rgba(79, 110, 247, 0.1);
  color: #3730a3;
}

.npm-chip-kb {
  background: rgba(14, 165, 233, 0.12);
  color: #0369a1;
}

.npm-chip-skill {
  background: rgba(168, 85, 247, 0.12);
  color: #6b21a8;
}

.npm-chip-x {
  border: none;
  background: none;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 0 2px;
  color: inherit;
  opacity: 0.65;
}

.npm-chip-x:hover {
  opacity: 1;
}

.npm-ai {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

@media (max-width: 720px) {
  .npm-ai {
    grid-template-columns: 1fr;
  }
}

.npm-ai-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-subtle, #64748b);
  margin-bottom: 8px;
}

.npm-token-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.npm-token-row .npm-input {
  flex: 1;
}

.npm-token-suffix {
  flex-shrink: 0;
  font-size: 13px;
  color: var(--text-subtle, #64748b);
  white-space: nowrap;
}

.npm-tip {
  display: flex;
  gap: 10px;
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(250, 245, 255, 0.85);
  border: 1px solid rgba(168, 85, 247, 0.15);
  font-size: 12px;
  line-height: 1.65;
  color: var(--text-subtle, #475569);
}

.npm-tip-icon {
  flex-shrink: 0;
  font-size: 18px;
  line-height: 1.2;
}

.npm-tip code {
  font-size: 11px;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.8);
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

.npm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
  padding-top: 8px;
}

.npm-btn {
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

.npm-btn:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.npm-btn-ghost {
  border: 1px solid rgba(17, 24, 39, 0.12);
  background: #fff;
  color: var(--text);
}

.npm-btn-primary {
  border: none;
  background: linear-gradient(135deg, #4f6ef7 0%, #5d7bff 100%);
  color: #fff;
  box-shadow: 0 4px 14px rgba(79, 110, 247, 0.35);
}
</style>
