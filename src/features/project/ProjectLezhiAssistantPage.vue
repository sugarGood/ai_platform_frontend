<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import {
  getProjectById,
  getProjectKnowledgeTableRows,
  getProjectSkillTableRows,
} from '../../composables/useProjects'
import NotFoundProjectState from './NotFoundProjectState.vue'

const route = useRoute()

const projectId = computed(() =>
  typeof route.params.projectId === 'string' ? route.params.projectId : '',
)

const project = computed(() => getProjectById(projectId.value))

function isNumericBackendProject(id: string) {
  return /^\d+$/.test(id)
}

const kbCountLabel = computed(() => {
  const id = projectId.value
  if (!id) return '—'
  if (!isNumericBackendProject(id)) return '12'
  const rows = getProjectKnowledgeTableRows(id)
  return rows !== undefined ? String(rows.length) : '…'
})

const skillCountLabel = computed(() => {
  const id = projectId.value
  if (!id) return '—'
  if (!isNumericBackendProject(id)) return '4'
  const rows = getProjectSkillTableRows(id)
  return rows !== undefined ? String(rows.length) : '…'
})

const projectName = computed(() => project.value?.name ?? '本项目')

const inputPlaceholder = computed(() => `问乐知任何关于 ${projectName.value} 的问题...`)

const PRESET: Record<string, [string, string]> = {
  '今天项目有什么 Bug 或告警吗？': [
    '正在检索事故中心与监控数据...',
    '🚨 **当前有 1 个待处理事故**\n\n**支付服务 NullPointerException**（严重）\n- 位置：`PaymentService.processOrder:142`\n- 根因：checkout 接口未对 `paymentMethod` 做非空校验\n- 建议：在 `OrderController:89` 加参数校验\n- 状态：处理中（张三负责）\n\n生产环境监控正常，P99 延迟 120ms，无其他告警。',
  ],
  '帮我查一下生产环境的服务状态': [
    '正在查询服务健康状态...',
    '✅ **生产环境整体正常**\n\nmall-backend 🟢 v2.3.1 · P99 120ms\nmall-frontend 🔵 feature/search 构建中（约 15 分钟）\nmall-mobile 🟢 v2.1.0 健康\n\n不影响生产流量，预计 15 分钟后构建完成。',
  ],
  '帮我解释一下订单状态机的设计': [
    '正在检索知识库...（命中「系统架构设计文档」· 相关度 95%）',
    '📚 **订单状态机设计**\n\n待支付 → 已支付 → 备货中 → 已发货 → 已完成\n↓\n已取消（可从待支付/已支付转入）\n\n**关键规则：**\n- 超时 30 分钟未支付自动取消\n- 已发货不可直接取消，需走退货流程\n- 状态流转均记录操作日志\n\n当前 Sprint 正在重构此模块（进度 65%），预计明天完成。',
  ],
  '最近一次 Sprint 完成情况怎么样？': [
    '正在分析 Sprint 数据...',
    '📋 **Sprint 8 进度**（3/1 - 3/14）\n\n已完成 23 SP / 共 40 SP（58%），剩余 6 天\n完成概率：**78%**\n\n⚠️ 订单状态机重构（8SP）进度 65%，轻微延期风险\n⚠️ 支付联调依赖第三方沙箱，建议今天协调\n\n按当前速率月底 Token 预计 496K，不超限。',
  ],
}

type AiMessage = { role: 'ai'; body: string; html: boolean }
type UserMessage = { role: 'user'; text: string }

const showWelcome = ref(true)
const messages = ref<(UserMessage | AiMessage)[]>([])
const draft = ref('')
const messagesEl = ref<HTMLElement | null>(null)

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function formatReplyToHtml(raw: string) {
  let s = escapeHtml(raw)
  s = s.replace(/\n/g, '<br>')
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>')
  return s
}

function defaultReply(userText: string) {
  return `关于「${userText}」的查询已收到。\n\n这是乐知原型演示，实际部署后将通过 RAG 检索项目知识库，提供基于真实项目数据的精准回答。`
}

async function scrollToBottom() {
  await nextTick()
  const el = messagesEl.value
  if (el) el.scrollTop = el.scrollHeight
}

function sendFromInput() {
  const text = draft.value.trim()
  if (!text) return
  draft.value = ''
  sendMessage(text)
}

function sendQuick(text: string) {
  draft.value = text
  sendFromInput()
}

function sendMessage(text: string) {
  showWelcome.value = false
  messages.value.push({ role: 'user', text })

  const conv = PRESET[text]
  const think0 = '乐知正在思考...'
  const think1 = conv?.[0] ?? '正在检索项目知识库...'
  const replyRaw = conv?.[1] ?? defaultReply(text)

  const aiIndex = messages.value.length
  messages.value.push({ role: 'ai', body: think0, html: false })
  void scrollToBottom()

  window.setTimeout(() => {
    const cur = messages.value[aiIndex]
    if (cur?.role === 'ai') {
      cur.body = think1
    }
    void scrollToBottom()
  }, 800)

  window.setTimeout(() => {
    const cur = messages.value[aiIndex]
    if (cur?.role === 'ai') {
      cur.body = formatReplyToHtml(replyRaw)
      cur.html = true
    }
    void scrollToBottom()
  }, 1800)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendFromInput()
  }
}

const aiCapTo = computed(() => `/projects/${projectId.value}/ai-cap`)

watch(projectId, () => {
  showWelcome.value = true
  messages.value = []
  draft.value = ''
})
</script>

<template>
  <NotFoundProjectState v-if="!project" />

  <div v-else class="lezhi-root" data-testid="project-lezhi-page">
    <header class="lezhi-banner">
      <div class="lezhi-banner-icon" aria-hidden="true">🔮</div>
      <div class="lezhi-banner-text">
        <div class="lezhi-banner-title">{{ projectName }} · 乐知助手</div>
        <p class="lezhi-banner-sub">
          项目专属 AI 助手，已接入知识库 {{ kbCountLabel }} 个，技能 {{ skillCountLabel }} 个，RAG 已启用
        </p>
      </div>
      <span class="lezhi-online">● 在线</span>
      <RouterLink :to="aiCapTo" class="lezhi-config-btn">⚙️ 配置</RouterLink>
    </header>

    <div v-show="showWelcome" class="lezhi-welcome">
      <div class="lezhi-welcome-hero">
        <div class="lezhi-welcome-icon" aria-hidden="true">🔮</div>
        <h1 class="lezhi-welcome-title">你好，我是乐知</h1>
        <p class="lezhi-welcome-desc">
          「知之者不如好之者，好之者不如乐之者」<br />
          {{ projectName }}的专属 AI 助手，乐于求知，乐于解答
        </p>
      </div>
      <div class="lezhi-quick-grid">
        <button type="button" class="lezhi-quick-card" @click="sendQuick('今天项目有什么 Bug 或告警吗？')">
          <span class="lezhi-quick-emoji" aria-hidden="true">🚨</span>
          <span class="lezhi-quick-title">今天有什么 Bug 吗？</span>
          <span class="lezhi-quick-hint">查询告警与事故状态</span>
        </button>
        <button type="button" class="lezhi-quick-card" @click="sendQuick('帮我查一下生产环境的服务状态')">
          <span class="lezhi-quick-emoji" aria-hidden="true">🌍</span>
          <span class="lezhi-quick-title">生产环境状态如何？</span>
          <span class="lezhi-quick-hint">查询服务健康与部署情况</span>
        </button>
        <button type="button" class="lezhi-quick-card" @click="sendQuick('帮我解释一下订单状态机的设计')">
          <span class="lezhi-quick-emoji" aria-hidden="true">📚</span>
          <span class="lezhi-quick-title">订单状态机怎么设计的？</span>
          <span class="lezhi-quick-hint">检索项目文档与知识库</span>
        </button>
        <button type="button" class="lezhi-quick-card" @click="sendQuick('最近一次 Sprint 完成情况怎么样？')">
          <span class="lezhi-quick-emoji" aria-hidden="true">📋</span>
          <span class="lezhi-quick-title">Sprint 进展如何？</span>
          <span class="lezhi-quick-hint">查看迭代进度与风险</span>
        </button>
      </div>
    </div>

    <div ref="messagesEl" class="lezhi-messages" role="log" aria-live="polite">
      <template v-for="(m, i) in messages" :key="i">
        <div v-if="m.role === 'user'" class="lezhi-row lezhi-row-user">
          <div class="lezhi-bubble-user">{{ m.text }}</div>
        </div>
        <div v-else class="lezhi-row lezhi-row-ai">
          <div class="lezhi-avatar" aria-hidden="true">🔮</div>
          <div class="lezhi-bubble-ai" :class="{ 'lezhi-bubble-ai--muted': !m.html }">
            <span v-if="!m.html">{{ m.body }}</span>
            <span v-else v-html="m.body" />
          </div>
        </div>
      </template>
    </div>

    <footer class="lezhi-input-bar">
      <div class="lezhi-input-inner">
        <div class="lezhi-field">
          <textarea
            v-model="draft"
            class="lezhi-textarea"
            rows="1"
            :placeholder="inputPlaceholder"
            @keydown="onKeydown"
          />
        </div>
        <button type="button" class="lezhi-send" aria-label="发送" @click="sendFromInput">↑</button>
      </div>
      <p class="lezhi-footnote">乐知已接入项目知识库 · RAG 实时检索 · Token 消耗计入项目配额</p>
    </footer>
  </div>
</template>

<style scoped>
.lezhi-root {
  display: flex;
  flex-direction: column;
  margin: -24px;
  height: calc(100vh - 56px - 48px);
  min-height: 480px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 0;
  box-sizing: border-box;
}

.lezhi-banner {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 24px 12px;
  border-bottom: 1px solid var(--border);
  background: linear-gradient(135deg, #f5f3ff 0%, #eef2ff 50%, #fafafa 100%);
}

.lezhi-banner-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: linear-gradient(135deg, #4f6ef7, #7a5af8);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.lezhi-banner-text {
  flex: 1;
  min-width: 0;
}

.lezhi-banner-title {
  font-weight: 700;
  font-size: 15px;
  color: var(--text);
}

.lezhi-banner-sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--sub);
  line-height: 1.5;
}

.lezhi-online {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--success);
  font-weight: 600;
}

.lezhi-config-btn {
  flex-shrink: 0;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: white;
  color: var(--text);
  text-decoration: none;
  font-weight: 500;
  transition: background 0.15s;
}

.lezhi-config-btn:hover {
  background: var(--bg);
}

.lezhi-welcome {
  flex-shrink: 0;
  padding: 24px;
}

.lezhi-welcome-hero {
  text-align: center;
  margin-bottom: 20px;
}

.lezhi-welcome-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.lezhi-welcome-title {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 700;
}

.lezhi-welcome-desc {
  margin: 0;
  font-size: 13px;
  color: var(--sub);
  line-height: 1.6;
}

.lezhi-quick-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  max-width: 600px;
  margin: 0 auto;
}

.lezhi-quick-card {
  text-align: left;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px 14px;
  cursor: pointer;
  transition: border-color 0.15s;
  font: inherit;
  color: inherit;
}

.lezhi-quick-card:hover {
  border-color: var(--primary);
}

.lezhi-quick-emoji {
  display: block;
  font-size: 16px;
  margin-bottom: 4px;
}

.lezhi-quick-title {
  display: block;
  font-size: 13px;
  font-weight: 600;
}

.lezhi-quick-hint {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  color: var(--sub);
}

.lezhi-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
}

.lezhi-row-user {
  justify-content: flex-end;
}

.lezhi-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.lezhi-bubble-user {
  max-width: 70%;
  background: var(--primary);
  color: white;
  border-radius: 14px 14px 2px 14px;
  padding: 10px 14px;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.lezhi-avatar {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: linear-gradient(135deg, #4f6ef7, #7a5af8);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
}

.lezhi-bubble-ai {
  flex: 1;
  max-width: min(720px, 85%);
  border-radius: 2px 14px 14px 14px;
  padding: 10px 14px;
  font-size: 13px;
  line-height: 1.6;
  background: var(--card);
  border: 1px solid var(--border);
  color: var(--text);
  word-break: break-word;
}

.lezhi-bubble-ai--muted {
  color: var(--sub);
}

.lezhi-bubble-ai :deep(strong) {
  font-weight: 700;
}

.lezhi-bubble-ai :deep(code) {
  font-family: ui-monospace, monospace;
  font-size: 12px;
  background: var(--bg);
  padding: 1px 4px;
  border-radius: 4px;
}

.lezhi-input-bar {
  flex-shrink: 0;
  padding: 16px 24px;
  border-top: 1px solid var(--border);
  background: var(--card);
}

.lezhi-input-inner {
  display: flex;
  gap: 10px;
  align-items: flex-end;
  max-width: 900px;
  margin: 0 auto;
}

.lezhi-field {
  flex: 1;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px 14px;
}

.lezhi-textarea {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  font-size: 13px;
  font-family: inherit;
  line-height: 1.5;
  max-height: 120px;
  color: var(--text);
}

.lezhi-send {
  width: 40px;
  height: 40px;
  background: var(--primary);
  border: none;
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: white;
  font-size: 16px;
}

.lezhi-footnote {
  text-align: center;
  font-size: 11px;
  color: var(--sub);
  margin: 8px 0 0;
}
</style>
