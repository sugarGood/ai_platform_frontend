<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { getProjectApiSnapshot, loadProjectQuotaTokenDashboardFromApi } from '../../composables/useProjects'
import { useOverlay } from '../../composables/useOverlay'
import {
  mapApiOverQuotaToUi,
  mapUiOverQuotaToApi,
  normalizeTokenDashboardActivityPage,
} from '../../lib/token-dashboard-normalize'
import { updateProject } from '../../services/projects'
import {
  listTokenDashboardActivity,
  patchTokenDashboardMemberAiAccess,
  postTokenDashboardBatchSettle,
  postTokenDashboardSyncQuotas,
} from '../../services/project-token-dashboard'
import type { PageMetric, TableCell } from '../../types/module-page'
import type { ProjectTokenDashboardBundle, TokenDashboardActivityRowView } from '../../types/token-dashboard'
import CardPanel from './CardPanel.vue'
import StatCard from './StatCard.vue'

const props = defineProps<{
  metrics: PageMetric[]
  memberQuotaTable: { columns: string[]; rows: TableCell[][] }
  projectId?: string
  tokenDashboard?: ProjectTokenDashboardBundle | null
}>()

const { triggerModuleAction } = useOverlay()

const overAllocPolicy = ref('throttle')
const warnThresholdPct = ref('80')
const quotaResetCycle = ref('MONTHLY')
const perRequestLimitInput = ref('')
const consumptionMember = ref('all')
const consumptionRange = ref('month')

const syncBusy = ref(false)
const batchBusy = ref(false)
const saveBusy = ref(false)
const aiBusyId = ref<number | null>(null)
const actionError = ref('')
const activityLoading = ref(false)
const activityRowsLocal = ref<TokenDashboardActivityRowView[]>([])
const activityTotalLocal = ref(0)

const pidNum = computed(() => {
  const id = props.projectId?.trim()
  return id && /^\d+$/.test(id) ? Number(id) : null
})

const td = computed(() => props.tokenDashboard ?? null)

type RankRow = {
  name: string
  role: string
  barClass: string
  progress: number
  right: string
  emoji?: string
  inactive?: boolean
}

const mockRankRows: RankRow[] = [
  {
    name: '张三',
    role: '技术负责人',
    barClass: 'rank-bar--blue',
    progress: 15,
    right: '82K · 个人上限 300K 已用 45.2K',
  },
  {
    name: '李四',
    role: '前端开发',
    barClass: 'rank-bar--blue',
    progress: 48,
    right: '68K · 个人上限 200K 已用 32.1K',
  },
  {
    name: '王五',
    role: '后端开发',
    barClass: 'rank-bar--blue',
    progress: 26,
    right: '72K · 个人上限 200K 已用 18.5K',
  },
  {
    name: '钱七',
    role: '产品经理',
    barClass: 'rank-bar--orange',
    progress: 100,
    right: '55K · 个人上限 100K 已用 55K',
  },
  {
    name: 'ci-bot-mall',
    role: '',
    emoji: '🤖',
    barClass: 'rank-bar--green',
    progress: 43,
    right: '43K · 服务账号上限 100K',
  },
  {
    name: '赵六',
    role: '测试',
    barClass: '',
    progress: 0,
    right: '0 · 未接入',
    inactive: true,
  },
]

function formatTok(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(Math.round(n))
}

const displayRankRows = computed((): RankRow[] => {
  const list = td.value?.consumption ?? []
  if (!list.length) return mockRankRows
  const maxTok = Math.max(...list.map((u) => u.monthlyTokens), 1)
  return list.map((u) => {
    const ratio = u.monthlyTokens / maxTok
    return {
      name: u.displayName,
      role: '',
      barClass: ratio >= 0.92 ? 'rank-bar--orange' : 'rank-bar--blue',
      progress: Math.max(2, Math.round(ratio * 100)),
      right: `${formatTok(u.monthlyTokens)} · 估算日均 ${formatTok(u.estimatedDailyTokens)}`,
    }
  })
})

const memberFilterOptions = computed(() => {
  const rows = td.value?.memberRows ?? []
  const opts = [{ value: 'all', label: '全部成员' }]
  for (const r of rows) {
    opts.push({ value: String(r.userId), label: r.displayName })
  }
  return opts
})

const poolDisplay = computed(() => {
  const c = td.value?.config
  if (!c || (c.poolQuotaTokens == null && c.poolUsedTokens == null)) {
    return { label: '500,000 tokens', used: 320_000, quota: 500_000 }
  }
  const q = c.poolQuotaTokens ?? 0
  const u = c.poolUsedTokens ?? 0
  return {
    label: `${q.toLocaleString()} tokens`,
    used: u,
    quota: q,
  }
})

const progressPct = computed(() => {
  const c = td.value?.config
  const q = c?.poolQuotaTokens
  const u = c?.poolUsedTokens
  if (q == null || q <= 0 || u == null) return 64
  return Math.min(100, Math.round((u / q) * 100))
})

const effectiveSingleCap = computed(() => {
  const c = td.value?.config
  const eff = c?.effectiveSingleRequestCapTokens
  const raw = c?.singleRequestCapTokens
  if (eff != null && Number.isFinite(eff)) return eff
  if (raw != null && Number.isFinite(raw)) return raw
  return 100_000
})

watch(
  () => props.tokenDashboard,
  (b) => {
    if (b?.activityRows) {
      activityRowsLocal.value = [...b.activityRows]
      activityTotalLocal.value = b.activityTotal ?? 0
    }
    const c = b?.config
    if (c?.alertThresholdPercent != null && Number.isFinite(c.alertThresholdPercent)) {
      warnThresholdPct.value = String(Math.min(100, Math.max(0, Math.round(c.alertThresholdPercent))))
    }
    if (c?.quotaResetCycle) {
      quotaResetCycle.value = c.quotaResetCycle
    }
    const cap = c?.singleRequestCapTokens
    perRequestLimitInput.value =
      cap != null && Number.isFinite(cap) ? String(Math.round(cap)) : ''
  },
  { immediate: true, deep: true },
)

watch(
  () => props.projectId,
  () => {
    const id = props.projectId
    if (!id) return
    const snap = getProjectApiSnapshot(id)
    if (snap?.overQuotaStrategy) {
      overAllocPolicy.value = mapApiOverQuotaToUi(snap.overQuotaStrategy)
    }
    if (snap?.alertThresholdPct != null) {
      warnThresholdPct.value = String(snap.alertThresholdPct)
    }
    if (snap?.quotaResetCycle) {
      quotaResetCycle.value = snap.quotaResetCycle
    }
    if (snap?.perRequestTokenLimit != null) {
      perRequestLimitInput.value = String(snap.perRequestTokenLimit)
    }
  },
  { immediate: true },
)

function rangeToQuery(): { occurredAfter?: string; occurredBefore?: string } {
  const now = new Date()
  const end = now.toISOString()
  if (consumptionRange.value === 'day') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return { occurredAfter: start.toISOString(), occurredBefore: end }
  }
  if (consumptionRange.value === 'week') {
    const start = new Date(now.getTime() - 7 * 86400000)
    return { occurredAfter: start.toISOString(), occurredBefore: end }
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  return { occurredAfter: start.toISOString(), occurredBefore: end }
}

async function loadActivity() {
  const pid = pidNum.value
  if (pid == null) return
  activityLoading.value = true
  actionError.value = ''
  try {
    const { occurredAfter, occurredBefore } = rangeToQuery()
    const uid =
      consumptionMember.value === 'all' ? undefined : Number(consumptionMember.value)
    const raw = await listTokenDashboardActivity(pid, {
      page: 1,
      size: 30,
      occurredAfter,
      occurredBefore,
      userId: uid != null && Number.isFinite(uid) ? uid : undefined,
    })
    const ap = normalizeTokenDashboardActivityPage(raw)
    activityRowsLocal.value = ap.rows
    activityTotalLocal.value = ap.total
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : '加载活动日志失败'
  } finally {
    activityLoading.value = false
  }
}

watch(
  [pidNum, consumptionRange, consumptionMember],
  () => {
    if (pidNum.value != null) void loadActivity()
  },
  { flush: 'post' },
)

async function onSyncQuotas() {
  const pid = pidNum.value
  if (pid == null) return
  syncBusy.value = true
  actionError.value = ''
  try {
    await postTokenDashboardSyncQuotas(pid)
    await loadProjectQuotaTokenDashboardFromApi(String(pid))
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : '同步配额失败'
  } finally {
    syncBusy.value = false
  }
}

async function onBatchSettle() {
  const pid = pidNum.value
  if (pid == null) return
  if (
    !confirm(
      '确认执行批量清算？将按后端策略处理项目 TOKEN_QUOTA 与个人池用量（具体以后端为准）。',
    )
  ) {
    return
  }
  batchBusy.value = true
  actionError.value = ''
  try {
    await postTokenDashboardBatchSettle(pid, {
      clearProjectTokenQuotaUsage: true,
      clearPersonalPoolMonthlyUsage: true,
    })
    await loadProjectQuotaTokenDashboardFromApi(String(pid))
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : '批量清算失败'
  } finally {
    batchBusy.value = false
  }
}

async function onSaveConfig() {
  const pid = pidNum.value
  const idStr = props.projectId
  if (pid == null || !idStr) {
    triggerModuleAction('保存配置', '配额管理')
    return
  }
  const pct = Number.parseInt(warnThresholdPct.value, 10)
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    actionError.value = '预警阈值请选择 60–90。'
    return
  }
  saveBusy.value = true
  actionError.value = ''
  try {
    const rawCap = perRequestLimitInput.value.trim()
    const capN = rawCap === '' ? undefined : Number.parseInt(rawCap, 10)
    await updateProject(pid, {
      alertThresholdPct: pct,
      overQuotaStrategy: mapUiOverQuotaToApi(overAllocPolicy.value),
      quotaResetCycle: quotaResetCycle.value.trim() || null,
      ...(rawCap !== '' && capN != null && Number.isFinite(capN) && capN >= 0
        ? { perRequestTokenLimit: capN }
        : {}),
    })
    await loadProjectQuotaTokenDashboardFromApi(idStr)
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : '保存失败'
  } finally {
    saveBusy.value = false
  }
}

function dashboardMemberAtRow(ri: number) {
  return td.value?.memberRows[ri] ?? null
}

async function toggleRowAi(ri: number) {
  const pid = pidNum.value
  const row = dashboardMemberAtRow(ri)
  if (pid == null || row == null) return
  const next = !row.aiEnabled
  aiBusyId.value = row.memberId
  actionError.value = ''
  try {
    await patchTokenDashboardMemberAiAccess(pid, row.memberId, next)
    await loadProjectQuotaTokenDashboardFromApi(String(pid))
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : '切换 AI 失败'
  } finally {
    aiBusyId.value = null
  }
}

function formatActivityTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.length >= 16 ? iso.slice(0, 16) : iso
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${mm}-${dd} ${hh}:${mi}`
}

function formatTokenCell(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString()
}

const displayActivityRows = computed(() => {
  if (pidNum.value != null) {
    return activityRowsLocal.value.map((r) => ({
      time: formatActivityTime(r.occurredAt),
      member: r.memberLabel,
      callType: r.callTypeLabel,
      tokens: formatTokenCell(r.totalTokens),
      pools: r.poolTags,
      model: r.modelLabel,
    }))
  }
  return [
    {
      time: '03-20 16:42',
      member: '张三',
      callType: '代码审查 (skill)',
      tokens: '2,180',
      pools: ['project', 'personal'] as const,
      model: 'claude-sonnet-4-6',
    },
    {
      time: '03-20 16:38',
      member: '李四',
      callType: '需求分析对话',
      tokens: '890',
      pools: ['project', 'personal'] as const,
      model: 'claude-3.5-haiku',
    },
    {
      time: '03-20 16:20',
      member: 'ci-bot-mall 🤖',
      callType: '自动化代码审查',
      tokens: '3,200',
      pools: ['project', 'service'] as const,
      model: 'claude-sonnet-4-6',
    },
    {
      time: '03-20 15:55',
      member: '王五',
      callType: '接口联调辅助',
      tokens: '1,420',
      pools: ['project', 'personal'] as const,
      model: 'claude-sonnet-4-6',
    },
  ]
})

function cellClass(cell: TableCell) {
  return [cell.tone ? `tone-${cell.tone}` : 'tone-default', cell.mono ? 'cell-mono' : '']
}

function poolLabel(kind: 'project' | 'personal' | 'service') {
  if (kind === 'project') return '项目池'
  if (kind === 'personal') return '个人池'
  return '服务账号'
}
</script>

<template>
  <div class="quota-root">
    <div class="quota-callout" role="note">
      <span class="quota-callout-icon" aria-hidden="true">💡</span>
      <p>
        <strong>双维度配额</strong>：项目有独立 Token 池（项目经理管控），成员同时有个人全局上限（平台管理员管控）。每次调用同时扣减两个池，任一触顶即限流。
      </p>
    </div>

    <div v-if="td?.loadError" class="quota-banner quota-banner--warn" role="status">
      token-dashboard 部分接口未就绪：{{ td.loadError }}
    </div>
    <div v-if="actionError" class="quota-banner quota-banner--danger" role="alert">
      {{ actionError }}
    </div>

    <div class="quota-metrics-wrap">
      <section class="quota-metrics">
        <StatCard
          v-for="m in metrics"
          :key="m.id"
          :delta="m.delta"
          :delta-tone="m.deltaTone"
          :icon="m.icon"
          :label="m.label"
          :tone="m.tone"
          :value="m.value"
        />
      </section>
    </div>

    <div class="quota-toolbar">
      <span class="quota-toolbar-hint">项目池与成员限额变更可走审批流</span>
      <div class="quota-toolbar-actions">
        <button
          type="button"
          class="tb-btn tb-btn--primary"
          @click="triggerModuleAction('申请扩容', '配额管理')"
        >
          申请扩容
        </button>
        <button
          type="button"
          class="tb-btn"
          :disabled="pidNum == null || syncBusy"
          @click="onSyncQuotas"
        >
          {{ syncBusy ? '同步中…' : '同步成员配额' }}
        </button>
        <button
          type="button"
          class="tb-btn"
          :disabled="pidNum == null || batchBusy"
          @click="onBatchSettle"
        >
          {{ batchBusy ? '清算中…' : '批量清算' }}
        </button>
      </div>
    </div>

    <div class="quota-grid">
      <CardPanel title="📊 项目配额设置">
        <div class="form-stack">
          <label class="fg">
            <span class="fl">项目月总配额</span>
            <div class="frow">
              <input class="finput" type="text" :value="poolDisplay.label" readonly />
              <span class="fhint">由平台管理员审批调整；保存配置仍用 PUT /projects/{id}</span>
            </div>
          </label>
          <label v-if="pidNum == null" class="fg">
            <span class="fl">成员默认限额</span>
            <select class="fselect">
              <option>100K（默认）</option>
              <option>200K</option>
              <option>300K</option>
              <option>不限制（消耗项目池）</option>
            </select>
          </label>
          <label v-else class="fg fg-inline">
            <div class="fg-inline-text">
              <span class="fl">任务周期</span>
              <span class="fdesc">与 token-dashboard /config 及 PUT 项目字段 quotaResetCycle 对齐</span>
            </div>
            <select v-model="quotaResetCycle" class="fselect fselect--inline">
              <option value="MONTHLY">MONTHLY</option>
              <option value="WEEKLY">WEEKLY</option>
              <option value="DAILY">DAILY</option>
            </select>
          </label>
          <label v-if="pidNum != null" class="fg fg-inline">
            <div class="fg-inline-text">
              <span class="fl">单次请求上限（tokens）</span>
              <span class="fdesc">库中为 null 时有效上限 {{ effectiveSingleCap.toLocaleString() }}（默认 100K）</span>
            </div>
            <input
              v-model="perRequestLimitInput"
              class="finput fselect--inline"
              type="text"
              inputmode="numeric"
              placeholder="留空则不修改"
            />
          </label>
          <label class="fg fg-inline">
            <div class="fg-inline-text">
              <span class="fl">超额配置</span>
              <span class="fdesc">超出配额时的系统行为</span>
            </div>
            <select v-model="overAllocPolicy" class="fselect fselect--inline">
              <option value="throttle">限流（降低响应速度）</option>
              <option value="hard">硬限制（拒绝请求）</option>
              <option value="auto20">自动扩容 20%（需审批）</option>
              <option value="notify">通知管理员手动扩容</option>
            </select>
          </label>
          <label class="fg fg-inline">
            <div class="fg-inline-text">
              <span class="fl">预警阈值</span>
              <span class="fdesc">项目总使用率达到此比例时通知项目经理</span>
            </div>
            <select v-model="warnThresholdPct" class="fselect fselect--inline">
              <option value="60">60%</option>
              <option value="70">70%</option>
              <option value="80">80%</option>
              <option value="90">90%</option>
            </select>
          </label>
          <div class="progress-card">
            <div class="progress-head">
              <span>项目总配额</span>
              <strong>{{ formatTok(poolDisplay.quota) }}</strong>
            </div>
            <div class="progress-wrap">
              <div class="progress-bar" :style="{ width: `${progressPct}%` }" />
            </div>
            <div class="progress-foot">
              <span>已用 {{ formatTok(poolDisplay.used) }}</span>
              <span
                >剩余
                {{
                  td?.config?.poolRemainingTokens != null
                    ? formatTok(td.config.poolRemainingTokens)
                    : '—'
                }}</span
              >
            </div>
          </div>
          <button
            type="button"
            class="save-btn"
            :disabled="saveBusy"
            @click="onSaveConfig"
          >
            {{ saveBusy ? '保存中…' : '保存配置' }}
          </button>
        </div>
      </CardPanel>

      <CardPanel title="👥 成员配额分配">
        <div class="table-shell">
          <table class="proto-table">
            <thead>
              <tr>
                <th v-for="c in memberQuotaTable.columns" :key="c">{{ c }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, ri) in memberQuotaTable.rows" :key="ri">
                <template v-for="(cell, ci) in row" :key="ci">
                  <td
                    v-if="ci === row.length - 1 && pidNum != null && dashboardMemberAtRow(ri)"
                    class="td-actions"
                  >
                    <button
                      type="button"
                      class="linkish"
                      :disabled="aiBusyId === dashboardMemberAtRow(ri)!.memberId"
                      @click="toggleRowAi(ri)"
                    >
                      {{
                        dashboardMemberAtRow(ri)!.aiEnabled
                          ? aiBusyId === dashboardMemberAtRow(ri)!.memberId
                            ? '处理中…'
                            : '关闭 AI'
                          : aiBusyId === dashboardMemberAtRow(ri)!.memberId
                            ? '处理中…'
                            : '开启 AI'
                      }}
                    </button>
                  </td>
                  <td v-else :class="{ 'td-tag': cell.display === 'tag' }">
                    <span
                      v-if="cell.display === 'tag'"
                      class="badge-pill-tag"
                      :class="cellClass(cell)"
                    >{{ cell.text }}</span>
                    <span v-else :class="cellClass(cell)">{{ cell.text }}</span>
                  </td>
                </template>
              </tr>
            </tbody>
          </table>
        </div>
      </CardPanel>
    </div>

    <section class="rank-card" aria-labelledby="rank-title">
      <div class="rank-head">
        <span class="rank-icon" aria-hidden="true">👥</span>
        <h3 id="rank-title" class="rank-title">成员消耗排行（项目池视角）</h3>
      </div>
      <ul class="rank-list">
        <li v-for="(row, i) in displayRankRows" :key="i" class="rank-item">
          <div class="rank-item-main">
            <div class="rank-name-line">
              <span class="rank-name">{{ row.name }}</span>
              <span v-if="row.emoji" class="rank-emoji" aria-hidden="true">{{ row.emoji }}</span>
              <span v-if="row.role" class="rank-role">（{{ row.role }}）</span>
            </div>
            <div v-if="!row.inactive" class="rank-bar-track">
              <div
                class="rank-bar"
                :class="row.barClass"
                :style="{ width: `${Math.min(100, row.progress)}%` }"
              />
            </div>
          </div>
          <div class="rank-stats" :class="{ 'rank-stats--muted': row.inactive }">{{ row.right }}</div>
        </li>
      </ul>
    </section>

    <section class="consume-card" aria-labelledby="consume-title">
      <div class="consume-head">
        <h3 id="consume-title" class="consume-title">📋 消耗明细</h3>
        <div class="consume-filters">
          <select v-model="consumptionMember" class="fselect fselect--sm">
            <option v-for="opt in memberFilterOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
          <select v-model="consumptionRange" class="fselect fselect--sm">
            <option value="month">本月</option>
            <option value="week">本周</option>
            <option value="day">今日</option>
          </select>
          <button type="button" class="tb-btn export-btn" @click="triggerModuleAction('导出报告', '消耗明细')">
            📊 导出报告
          </button>
        </div>
      </div>
      <div v-if="activityLoading" class="consume-loading">加载活动日志…</div>
      <div class="consume-table-wrap">
        <table class="consume-table">
          <thead>
            <tr>
              <th>时间</th>
              <th>成员</th>
              <th>调用类型</th>
              <th>Token</th>
              <th>扣减池</th>
              <th>模型</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, ri) in displayActivityRows" :key="ri">
              <td>{{ r.time }}</td>
              <td>{{ r.member }}</td>
              <td>{{ r.callType }}</td>
              <td class="cell-tokens">{{ r.tokens }}</td>
              <td>
                <span
                  v-for="p in r.pools"
                  :key="p"
                  class="pool-pill"
                  :class="`pool-pill--${p}`"
                >{{ poolLabel(p) }}</span>
              </td>
              <td class="cell-mono">{{ r.model }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.quota-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.quota-callout {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 10px 14px;
  font-size: 12px;
  line-height: 1.55;
  background: var(--primary-light, #eef2ff);
  border: 1px solid var(--primary, #4f6ef7);
  border-radius: 8px;
}

.quota-callout p {
  margin: 0;
}

.quota-callout-icon {
  flex-shrink: 0;
  font-size: 16px;
}

.quota-metrics-wrap {
  padding: 16px;
  background: #f1f2f6;
  border-radius: 12px;
}

.quota-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.quota-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.quota-toolbar-hint {
  font-size: 12px;
  color: var(--text-subtle);
}

.quota-toolbar-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.tb-btn {
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid rgba(17, 24, 39, 0.12);
  background: #fff;
  color: #111827;
}

.tb-btn--primary {
  background: var(--primary, #4f6ef7);
  color: #fff;
  border-color: transparent;
}

.tb-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.quota-banner {
  font-size: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  line-height: 1.45;
}

.quota-banner--warn {
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.35);
  color: #92400e;
}

.quota-banner--danger {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.35);
  color: #991b1b;
}

.linkish {
  padding: 0;
  border: none;
  background: none;
  color: var(--primary, #4f6ef7);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
}

.linkish:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  text-decoration: none;
}

.td-actions {
  white-space: nowrap;
}

.consume-loading {
  font-size: 12px;
  color: var(--text-subtle);
  margin-bottom: 8px;
}

.export-btn {
  font-weight: 600;
}

.quota-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.form-stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.fg {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.fg-inline {
  flex-direction: row;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.fg-inline-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.fdesc {
  font-size: 12px;
  color: var(--text-subtle);
  line-height: 1.45;
}

.fl {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-subtle);
}

.frow {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.finput,
.fselect {
  border: 1px solid rgba(17, 24, 39, 0.12);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  flex: 1;
  min-width: 120px;
  background: #fff;
}

.fselect--inline {
  flex: 0 1 280px;
  min-width: 160px;
}

.fselect--sm {
  flex: 0 1 auto;
  min-width: 100px;
  padding: 6px 10px;
  font-size: 12px;
}

.fhint {
  font-size: 12px;
  color: var(--text-subtle);
  white-space: nowrap;
}

.progress-card {
  background: var(--bg, #f4f6fc);
  border-radius: 8px;
  padding: 12px;
}

.progress-head {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  margin-bottom: 8px;
}

.progress-wrap {
  height: 8px;
  border-radius: 999px;
  background: rgba(229, 231, 235, 0.9);
  overflow: hidden;
  margin-bottom: 6px;
}

.progress-bar {
  height: 100%;
  border-radius: inherit;
  background: var(--primary, #4f6ef7);
}

.progress-foot {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-subtle);
}

.save-btn {
  align-self: flex-start;
  padding: 8px 18px;
  border-radius: 8px;
  border: none;
  background: var(--primary, #4f6ef7);
  color: #fff;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
}

.table-shell {
  overflow-x: auto;
}

.proto-table {
  width: 100%;
  border-collapse: collapse;
}

.proto-table th,
.proto-table td {
  padding: 11px 10px;
  border-bottom: 1px solid rgba(229, 231, 235, 0.9);
  text-align: left;
  font-size: 12px;
}

.proto-table th {
  color: var(--text-subtle);
  font-size: 11px;
  font-weight: 600;
}

.badge-pill-tag {
  display: inline-flex;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
}

.tone-success {
  color: var(--success);
}
.tone-primary {
  color: var(--primary);
}
.tone-warning {
  color: var(--warning);
}
.tone-danger {
  color: var(--danger);
}
.tone-muted {
  color: var(--text-subtle);
}
.tone-default {
  color: inherit;
}
.cell-mono {
  font-family: ui-monospace, monospace;
  font-size: 11px;
}

.rank-card {
  background: #fff;
  border: 1px solid var(--card-border);
  border-radius: 14px;
  padding: 16px 18px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
}

.rank-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.rank-icon {
  font-size: 18px;
}

.rank-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #111827;
}

.rank-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.rank-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px 20px;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid rgba(229, 231, 235, 0.9);
}

.rank-item:last-child {
  border-bottom: none;
}

.rank-name-line {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
}

.rank-role {
  font-weight: 500;
  color: var(--text-subtle);
}

.rank-emoji {
  margin-left: 4px;
}

.rank-bar-track {
  margin-top: 8px;
  height: 6px;
  border-radius: 999px;
  background: rgba(229, 231, 235, 0.95);
  overflow: hidden;
}

.rank-bar {
  height: 100%;
  border-radius: inherit;
  min-width: 0;
  transition: width 0.2s ease;
}

.rank-bar--blue {
  background: #3b82f6;
}

.rank-bar--orange {
  background: #f59e0b;
}

.rank-bar--green {
  background: #22c55e;
}

.rank-stats {
  font-size: 12px;
  color: #374151;
  text-align: right;
  white-space: nowrap;
}

.rank-stats--muted {
  color: var(--text-subtle);
}

.consume-card {
  background: #fff;
  border: 1px solid var(--card-border);
  border-radius: 14px;
  padding: 16px 18px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
}

.consume-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.consume-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
}

.consume-filters {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.consume-table-wrap {
  overflow-x: auto;
}

.consume-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.consume-table th,
.consume-table td {
  padding: 10px 12px;
  border-bottom: 1px solid rgba(229, 231, 235, 0.9);
  text-align: left;
}

.consume-table th {
  color: var(--text-subtle);
  font-weight: 600;
  font-size: 11px;
}

.cell-tokens {
  font-variant-numeric: tabular-nums;
}

.pool-pill {
  display: inline-flex;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  margin-right: 6px;
}

.pool-pill--project {
  background: rgba(59, 130, 246, 0.12);
  color: #2563eb;
}

.pool-pill--personal {
  background: rgba(107, 114, 128, 0.12);
  color: #4b5563;
}

.pool-pill--service {
  background: rgba(34, 197, 94, 0.14);
  color: #15803d;
}

:deep(.card-panel-header) {
  align-items: center;
}

@media (max-width: 1100px) {
  .quota-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .quota-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .quota-metrics {
    grid-template-columns: 1fr;
  }

  .fg-inline {
    flex-direction: column;
    align-items: stretch;
  }

  .fselect--inline {
    flex: 1;
    max-width: none;
  }

  .rank-item {
    grid-template-columns: 1fr;
  }

  .rank-stats {
    text-align: left;
    white-space: normal;
  }
}
</style>
