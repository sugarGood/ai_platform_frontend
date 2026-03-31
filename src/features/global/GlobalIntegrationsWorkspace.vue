<script setup lang="ts">
import { computed, ref } from 'vue'

import CardPanel from '../../components/ui/CardPanel.vue'
import PrototypeModal from '../../components/ui/PrototypeModal.vue'
import StatCard from '../../components/ui/StatCard.vue'

type PillVariant = 'primary' | 'success' | 'warning' | 'danger' | 'muted'
type IntgTab = 'overview' | 'create' | 'monitor'

const intgTab = ref<IntgTab>('overview')

const TYPE_FILTER_OPTIONS = ['全部类型', '平台内置', '外部系统', '自建 MCP'] as const
const HEALTH_FILTER_OPTIONS = ['全部健康状态', '正常', '异常', '降级'] as const

const searchQuery = ref('')
const typeFilter = ref<(typeof TYPE_FILTER_OPTIONS)[number]>('全部类型')
const healthFilter = ref<(typeof HEALTH_FILTER_OPTIONS)[number]>('全部健康状态')

function setTab(t: IntgTab) {
  intgTab.value = t
}

function pillClass(v: PillVariant) {
  return {
    'giw-pill': true,
    'giw-pill--primary': v === 'primary',
    'giw-pill--success': v === 'success',
    'giw-pill--warning': v === 'warning',
    'giw-pill--danger': v === 'danger',
    'giw-pill--muted': v === 'muted',
  }
}

interface IntgRow {
  id: string
  icon: string
  name: string
  host?: string
  typeLabel: string
  typeVariant: PillVariant
  protocol: string
  toolsSnippet: string
  projectBadges: string[]
  calls: string
  healthLabel: string
  healthVariant: PillVariant
  heartbeat: string
  heartbeatWarning?: boolean
  heartbeatDanger?: boolean
  rowAlert?: boolean
  /** 仅「配置」，无测试/停用 */
  builtinOnly?: boolean
}

const INTG_ROWS: IntgRow[] = [
  {
    id: 'i1',
    icon: '📚',
    name: '知识库 MCP',
    typeLabel: '平台内置',
    typeVariant: 'success',
    protocol: 'MCP · 平台凭证',
    toolsSnippet: '3 Tools · 2 Resources',
    projectBadges: ['全部项目'],
    calls: '8,241',
    healthLabel: '● 正常',
    healthVariant: 'success',
    heartbeat: '刚刚',
    builtinOnly: true,
  },
  {
    id: 'i2',
    icon: '⚡',
    name: '平台能力 MCP',
    typeLabel: '平台内置',
    typeVariant: 'success',
    protocol: 'MCP · 平台凭证',
    toolsSnippet: '2 Tools · 11 Prompts',
    projectBadges: ['全部项目'],
    calls: '3,102',
    healthLabel: '● 正常',
    healthVariant: 'success',
    heartbeat: '刚刚',
    builtinOnly: true,
  },
  {
    id: 'i3',
    icon: '🐙',
    name: 'GitHub',
    host: 'github.com',
    typeLabel: '外部系统',
    typeVariant: 'primary',
    protocol: 'MCP · OAuth 2.0',
    toolsSnippet: '8 Tools',
    projectBadges: ['商城', '用户中心', '支付'],
    calls: '1,204',
    healthLabel: '● 正常',
    healthVariant: 'success',
    heartbeat: '2 分钟前',
  },
  {
    id: 'i4',
    icon: '📋',
    name: 'Jira',
    host: 'atlassian.com',
    typeLabel: '外部系统',
    typeVariant: 'primary',
    protocol: 'MCP · Token',
    toolsSnippet: '5 Tools',
    projectBadges: ['商城', '用户中心'],
    calls: '892',
    healthLabel: '● 偶发超时',
    healthVariant: 'warning',
    heartbeat: 'P95 1.2s',
    heartbeatWarning: true,
  },
  {
    id: 'i5',
    icon: '💬',
    name: '飞书 / Lark',
    host: 'feishu.cn',
    typeLabel: '外部系统',
    typeVariant: 'primary',
    protocol: 'MCP · OAuth 2.0',
    toolsSnippet: '7 Tools',
    projectBadges: ['全部项目'],
    calls: '2,412',
    healthLabel: '● 正常',
    healthVariant: 'success',
    heartbeat: '1 分钟前',
  },
  {
    id: 'i6',
    icon: '🏢',
    name: '内部 CRM',
    host: 'crm-mcp.internal',
    typeLabel: '自建 MCP',
    typeVariant: 'muted',
    protocol: 'MCP · Bearer Token',
    toolsSnippet: '3 Tools',
    projectBadges: ['商城'],
    calls: '456',
    healthLabel: '● 正常',
    healthVariant: 'success',
    heartbeat: '3 分钟前',
  },
  {
    id: 'i7',
    icon: '📝',
    name: 'OA 审批系统',
    host: 'oa-mcp.internal',
    typeLabel: '自建 MCP',
    typeVariant: 'muted',
    protocol: 'MCP · OAuth 2.0',
    toolsSnippet: '2 Tools',
    projectBadges: ['全部项目'],
    calls: '328',
    healthLabel: '● 正常',
    healthVariant: 'success',
    heartbeat: '5 分钟前',
  },
  {
    id: 'i8',
    icon: '📡',
    name: '运维监控',
    host: 'ops-mcp.internal',
    typeLabel: '自建 MCP',
    typeVariant: 'muted',
    protocol: 'MCP · Bearer Token',
    toolsSnippet: '3 Tools',
    projectBadges: ['支付'],
    calls: '89',
    healthLabel: '● 异常',
    healthVariant: 'danger',
    heartbeat: '超时 30s',
    heartbeatDanger: true,
    rowAlert: true,
  },
]

const filteredIntgRows = computed(() => {
  let rows = INTG_ROWS
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    rows = rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.host && r.host.toLowerCase().includes(q)) ||
        r.toolsSnippet.toLowerCase().includes(q),
    )
  }
  const tf = typeFilter.value
  if (tf !== '全部类型') {
    rows = rows.filter((r) => r.typeLabel === tf)
  }
  const hf = healthFilter.value
  if (hf !== '全部健康状态') {
    const map: Record<string, (r: IntgRow) => boolean> = {
      正常: (r) => r.healthVariant === 'success',
      异常: (r) => r.healthVariant === 'danger',
      降级: (r) => r.healthVariant === 'warning',
    }
    const fn = map[hf]
    if (fn) rows = rows.filter(fn)
  }
  return rows
})

const CONNECTOR_TEMPLATES = [
  { icon: '🐙', name: 'GitHub', sub: 'OAuth 2.0 · 8 Tools' },
  { icon: '🦊', name: 'GitLab', sub: 'OAuth 2.0 · 6 Tools' },
  { icon: '📋', name: 'Jira', sub: 'Token · 5 Tools' },
  { icon: '💬', name: '飞书 / Lark', sub: 'OAuth 2.0 · 7 Tools' },
  { icon: '🐘', name: 'PostgreSQL', sub: 'Token · 4 Tools' },
  { icon: '🔍', name: 'Sentry', sub: 'Token · 4 Tools' },
  { icon: '☁️', name: 'AWS', sub: 'IAM · 9 Tools' },
  { icon: '🔒', name: 'Vault', sub: 'Token · 3 Tools' },
] as const

const configOpen = ref(false)
const configRow = ref<IntgRow | null>(null)
const stopOpen = ref(false)
const stopRow = ref<IntgRow | null>(null)
const createOpen = ref(false)
const createConnectorName = ref('')
const testOpen = ref(false)
const testOk = ref(true)
const testName = ref('')
const testDetail = ref('')
const ackOpen = ref(false)
const ackTitle = ref('')
const ackDesc = ref('')
const docOpen = ref(false)
const docKind = ref<'doc' | 'sample'>('doc')

function openIntgConfig(row: IntgRow) {
  configRow.value = row
  configOpen.value = true
}

function showIntgTestResult(name: string, ok: boolean, detail: string) {
  testName.value = name
  testOk.value = ok
  testDetail.value = detail
  testOpen.value = true
}

function runIntgTest(row: IntgRow) {
  if (row.id === 'i8') {
    showIntgTestResult(row.name, false, 'Grafana 端点超时（>30s）')
    return
  }
  if (row.id === 'i4') {
    showIntgTestResult(row.name, true, 'Jira 连通性测试通过 · 延迟 680ms · 5 Tools 可用（响应偏慢）')
    return
  }
  const msg: Record<string, string> = {
    i3: 'GitHub 连通性测试通过 · 延迟 86ms · 8 Tools 可用',
    i5: '飞书 连通性测试通过 · 延迟 52ms · 7 Tools 可用',
    i6: '内部 CRM 连通性测试通过 · 延迟 32ms · 3 Tools 可用',
    i7: 'OA 审批系统连通性测试通过 · 延迟 18ms · 2 Tools 可用',
  }
  showIntgTestResult(row.name, true, msg[row.id] ?? `${row.name} 连通性测试通过`)
}

function openIntgStop(row: IntgRow) {
  stopRow.value = row
  stopOpen.value = true
}

function onConnectorPick(name: string) {
  createConnectorName.value = name
  createOpen.value = true
}

function onTestCustomMcp() {
  ackTitle.value = '连通性测试'
  ackDesc.value = '连通性测试通过，发现 3 个 Tools、1 个 Resource。演示数据，未请求真实 MCP Server。'
  ackOpen.value = true
}

function onSubmitApproval() {
  ackTitle.value = '已提交审批'
  ackDesc.value = '连接配置已提交，等待平台管理员确认后生效。'
  ackOpen.value = true
}

function openDocLink(kind: 'doc' | 'sample') {
  docKind.value = kind
  docOpen.value = true
}

const TOP_TOOLS = [
  { name: 'search_knowledge', sub: '知识库 MCP · P95 180ms', calls: '8.2K' },
  { name: 'send_message', sub: '飞书 · P95 92ms', calls: '2.4K' },
  { name: 'search_code', sub: 'GitHub · P95 210ms', calls: '1.1K' },
  { name: 'query_issues', sub: 'Jira · P95 1.2s ⚠️', calls: '890' },
  { name: 'query_customer', sub: '内部 CRM · P95 45ms', calls: '456' },
] as const

const ALERT_ROWS = [
  {
    time: '03-27 09:15',
    conn: '运维监控',
    event: 'Grafana 端点超时（>30s）',
    impact: '3 个 Tools 不可用 · 影响支付网关',
    status: '持续中',
    variant: 'danger' as PillVariant,
    rowAlert: true,
  },
  {
    time: '03-25 14:30',
    conn: 'Jira',
    event: '上游 API 响应慢（P95 > 1s）',
    impact: 'query_issues 延迟升高',
    status: '监控中',
    variant: 'warning' as PillVariant,
    rowAlert: false,
  },
  {
    time: '03-22 08:00',
    conn: 'GitHub',
    event: 'OAuth Token 即将过期（剩余 172 天）',
    impact: '提前预警 · 无影响',
    status: '已确认',
    variant: 'success' as PillVariant,
    rowAlert: false,
  },
] as const
</script>

<template>
  <section class="giw-workspace" data-testid="global-integrations-workspace">
    <div class="giw-banner" role="note">
      <strong class="giw-banner__lead">集成管理</strong>
      ：管理 AI 平台与企业内外部系统的连接通道。通过 MCP 协议建立连接后，系统暴露的 Tools 自动注册到「工具注册中心」，供 Skill 与 Agent
      编排调用。平台内置 2 个核心连接（知识库、平台能力），其余由<strong>平台管理员</strong>按需配置。
    </div>

    <section class="giw-metrics">
      <StatCard
        icon="🔌"
        label="活跃连接"
        value="8"
        delta="含 2 平台内置"
        tone="primary"
        delta-tone="success"
      />
      <StatCard icon="🔩" label="暴露 Tools" value="42" delta="已注册到工具中心" />
      <StatCard
        icon="⚡"
        label="本月 Tool 调用"
        value="12.8K"
        delta="成功率 99.1%"
        delta-tone="success"
      />
      <StatCard
        icon="💚"
        label="连接健康度"
        value="87.5%"
        delta="7/8 连接正常"
        tone="success"
        delta-tone="success"
      />
    </section>

    <div class="giw-tabs" role="tablist" aria-label="集成管理">
      <button
        type="button"
        role="tab"
        class="giw-tab"
        :class="{ 'giw-tab--active': intgTab === 'overview' }"
        :aria-selected="intgTab === 'overview'"
        @click="setTab('overview')"
      >
        📋 连接总览
      </button>
      <button
        type="button"
        role="tab"
        class="giw-tab"
        :class="{ 'giw-tab--active': intgTab === 'create' }"
        :aria-selected="intgTab === 'create'"
        @click="setTab('create')"
      >
        ➕ 新建连接
      </button>
      <button
        type="button"
        role="tab"
        class="giw-tab"
        :class="{ 'giw-tab--active': intgTab === 'monitor' }"
        :aria-selected="intgTab === 'monitor'"
        @click="setTab('monitor')"
      >
        📊 运行监控
      </button>
    </div>

    <!-- 连接总览 -->
    <div v-show="intgTab === 'overview'" class="giw-panel">
      <div class="giw-toolbar">
        <input
          v-model="searchQuery"
          class="giw-search"
          type="search"
          placeholder="搜索连接名称 / Tool..."
          aria-label="搜索连接"
        />
        <select v-model="typeFilter" class="giw-select" aria-label="连接类型">
          <option v-for="o in TYPE_FILTER_OPTIONS" :key="o" :value="o">{{ o }}</option>
        </select>
        <select v-model="healthFilter" class="giw-select" aria-label="健康状态">
          <option v-for="o in HEALTH_FILTER_OPTIONS" :key="o" :value="o">{{ o }}</option>
        </select>
        <span class="giw-toolbar-meta">共 8 个活跃连接，暴露 42 个 Tools</span>
      </div>

      <CardPanel title="全部连接" subtitle="管理 AI 平台与企业系统的连接通道（变更需审批）" class="giw-card">
        <div class="giw-table-wrap">
          <table class="giw-table">
            <thead>
              <tr>
                <th>连接名称</th>
                <th>类型</th>
                <th>协议 / 认证</th>
                <th>暴露 Tools</th>
                <th>分配项目</th>
                <th>本月调用</th>
                <th>健康状态</th>
                <th>最近心跳</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in filteredIntgRows" :key="row.id" :class="{ 'giw-tr--alert': row.rowAlert }">
                <td>
                  <div class="giw-conn-cell">
                    <span class="giw-conn-icon" aria-hidden="true">{{ row.icon }}</span>
                    <div>
                      <strong>{{ row.name }}</strong>
                      <div v-if="row.host" class="giw-conn-host">{{ row.host }}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span :class="pillClass(row.typeVariant)">{{ row.typeLabel }}</span>
                </td>
                <td>{{ row.protocol }}</td>
                <td>
                  <code class="giw-code">{{ row.toolsSnippet }}</code>
                </td>
                <td>
                  <span v-for="(b, i) in row.projectBadges" :key="`${row.id}-p-${i}`" class="giw-proj-badge">
                    {{ b }}
                  </span>
                </td>
                <td>
                  <strong>{{ row.calls }}</strong>
                </td>
                <td>
                  <span :class="pillClass(row.healthVariant)">{{ row.healthLabel }}</span>
                </td>
                <td
                  class="giw-heartbeat"
                  :class="{
                    'giw-heartbeat--warn': row.heartbeatWarning,
                    'giw-heartbeat--danger': row.heartbeatDanger,
                  }"
                >
                  {{ row.heartbeat }}
                </td>
                <td>
                  <div class="giw-actions">
                    <button type="button" class="giw-mini-btn" @click="openIntgConfig(row)">配置</button>
                    <template v-if="!row.builtinOnly">
                      <button type="button" class="giw-mini-btn" @click="runIntgTest(row)">测试</button>
                      <button type="button" class="giw-mini-btn giw-mini-btn--danger" @click="openIntgStop(row)">
                        停用
                      </button>
                    </template>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardPanel>
    </div>

    <!-- 新建连接 -->
    <div v-show="intgTab === 'create'" class="giw-panel">
      <div class="giw-inline-hint">
        <span aria-hidden="true">🔒</span>
        新建连接由<strong>平台管理员</strong>操作。配置完成后需通过<strong>连通性测试</strong>并经<strong>审批</strong>后生效。
      </div>

      <div class="giw-grid-2">
        <CardPanel title="连接外部系统" subtitle="选择预置连接器模板，快速配置" class="giw-card">
          <div class="giw-mkt-grid">
            <button
              v-for="c in CONNECTOR_TEMPLATES"
              :key="c.name"
              type="button"
              class="giw-mkt-card"
              @click="onConnectorPick(c.name)"
            >
              <span class="giw-mkt-icon" aria-hidden="true">{{ c.icon }}</span>
              <div class="giw-mkt-text">
                <div class="giw-mkt-name">{{ c.name }}</div>
                <div class="giw-mkt-sub">{{ c.sub }}</div>
              </div>
            </button>
          </div>
        </CardPanel>

        <CardPanel title="连接内部系统（自建 MCP）" subtitle="手动配置 MCP Server 地址" class="giw-card">
          <div class="giw-form">
            <label class="giw-field">
              <span class="giw-field-label">MCP 服务器地址</span>
              <input class="giw-input" type="url" placeholder="https://your-mcp-server.internal/mcp" />
            </label>
            <label class="giw-field">
              <span class="giw-field-label">传输协议</span>
              <select class="giw-input">
                <option>Streamable HTTP（推荐）</option>
                <option>SSE</option>
                <option>stdio（仅本地）</option>
              </select>
            </label>
            <label class="giw-field">
              <span class="giw-field-label">认证方式</span>
              <select class="giw-input">
                <option>Bearer Token</option>
                <option>OAuth 2.0</option>
                <option>mTLS</option>
                <option>无认证（仅内网）</option>
              </select>
            </label>
            <label class="giw-field">
              <span class="giw-field-label">凭据</span>
              <input class="giw-input" type="password" placeholder="输入认证 Token" autocomplete="off" />
            </label>
            <div class="giw-form-actions">
              <button type="button" class="giw-btn giw-btn--primary" @click="onTestCustomMcp">🔍 测试连通性</button>
              <button type="button" class="giw-btn" @click="onSubmitApproval">提交审批</button>
            </div>
          </div>
        </CardPanel>
      </div>

      <CardPanel title="📖 自建 MCP 开发指南" class="giw-card">
        <div class="giw-guide-body">
          <p>
            <strong>使用平台脚手架快速创建：</strong>
          </p>
          <code class="giw-guide-code">npx create-platform-mcp my-mcp-server</code>
          <p>
            脚手架内置：认证中间件 · 审计日志 · Tool/Resource/Prompt 模板 · 健康检查 · OpenTelemetry
          </p>
          <p>
            <strong>MCP 协议版本：</strong>2025-03-26 &nbsp;|&nbsp; <strong>支持传输：</strong>Streamable HTTP / SSE /
            stdio
          </p>
          <p class="giw-guide-links">
            <button type="button" class="giw-link" @click="openDocLink('doc')">查看完整开发文档 →</button>
            <span class="giw-guide-sep">·</span>
            <button type="button" class="giw-link" @click="openDocLink('sample')">查看示例项目 →</button>
          </p>
        </div>
      </CardPanel>
    </div>

    <!-- 运行监控 -->
    <div v-show="intgTab === 'monitor'" class="giw-panel">
      <section class="giw-monitor-metrics">
        <StatCard icon="📈" label="总调用量" value="12.8K" delta="↑ 22% 较上月" />
        <StatCard
          icon="✅"
          label="成功率"
          value="99.1%"
          delta="目标 ≥ 99%"
          tone="success"
          delta-tone="success"
        />
        <StatCard icon="⏱️" label="平均延迟" value="142ms" delta="P99: 380ms" />
        <StatCard
          icon="⚠️"
          label="异常连接"
          value="1"
          delta="运维监控 · 超时"
          tone="danger"
          delta-tone="danger"
        />
        <StatCard icon="🔩" label="暴露 Tools" value="42" delta="已注册到工具中心" />
      </section>

      <div class="giw-grid-2">
        <CardPanel title="📊 各连接调用趋势（近 4 周）" class="giw-card">
          <div class="giw-chart">
            <div class="giw-chart-bar" style="height: 55%" />
            <div class="giw-chart-bar" style="height: 68%" />
            <div class="giw-chart-bar" style="height: 72%" />
            <div class="giw-chart-bar" style="height: 88%" />
          </div>
          <div class="giw-chart-axis">
            <span>W1</span><span>W2</span><span>W3</span><span>W4</span>
          </div>
        </CardPanel>

        <CardPanel title="🔝 Tool 调用 Top 5" class="giw-card">
          <ul class="giw-top-list">
            <li v-for="t in TOP_TOOLS" :key="t.name" class="giw-top-item">
              <div>
                <div class="giw-top-name">{{ t.name }}</div>
                <div class="giw-top-sub">{{ t.sub }}</div>
              </div>
              <strong>{{ t.calls }}</strong>
            </li>
          </ul>
        </CardPanel>
      </div>

      <CardPanel title="⚠️ 异常与告警" subtitle="近 7 天" class="giw-card">
        <div class="giw-table-wrap">
          <table class="giw-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>连接</th>
                <th>事件</th>
                <th>影响</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(a, idx) in ALERT_ROWS" :key="idx" :class="{ 'giw-tr--alert': a.rowAlert }">
                <td class="giw-td-time">{{ a.time }}</td>
                <td>
                  <strong>{{ a.conn }}</strong>
                </td>
                <td>{{ a.event }}</td>
                <td>{{ a.impact }}</td>
                <td>
                  <span :class="pillClass(a.variant)">{{ a.status }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardPanel>
    </div>

    <PrototypeModal
      v-if="configRow"
      v-model:open="configOpen"
      :title="`连接配置 · ${configRow.name}`"
      :description="
        configRow.builtinOnly
          ? '平台内置连接：可调整可见范围、审计级别与超时；核心端点不可修改。'
          : '修改 MCP 端点、认证凭据、项目分配与限流；保存后进入审批与连通性复测。'
      "
      max-width="680px"
    >
      <div class="pm-section">连接信息</div>
      <table class="pm-kv giw-modal-kv">
        <tr>
          <td>类型</td>
          <td>{{ configRow.typeLabel }} · {{ configRow.protocol }}</td>
        </tr>
        <tr v-if="configRow.host">
          <td>上游</td>
          <td class="pm-mono">{{ configRow.host }}</td>
        </tr>
        <tr>
          <td>Tools</td>
          <td>{{ configRow.toolsSnippet }}</td>
        </tr>
        <tr>
          <td>健康</td>
          <td>{{ configRow.healthLabel }} · {{ configRow.heartbeat }}</td>
        </tr>
      </table>
      <div class="pm-section">项目分配</div>
      <div class="giw-check-row">
        <label v-for="(p, i) in configRow.projectBadges" :key="i" class="giw-check">
          <input type="checkbox" :checked="p === '全部项目'" />
          {{ p }}
        </label>
        <label class="giw-check"><input type="checkbox" /> 用户中心</label>
        <label class="giw-check"><input type="checkbox" /> 支付网关</label>
      </div>
      <div class="pm-grid2">
        <div class="pm-field">
          <span class="pm-label">超时阈值</span>
          <input class="pm-input" value="30 秒" />
        </div>
        <div class="pm-field">
          <span class="pm-label">频率限制</span>
          <input class="pm-input" value="100 次/分钟" />
        </div>
      </div>
      <template #footer>
        <button type="button" class="pm-btn" @click="configOpen = false">取消</button>
        <button type="button" class="pm-btn">🔍 测试连通性</button>
        <button type="button" class="pm-btn pm-btn--primary" @click="configOpen = false">保存并提交审批</button>
      </template>
    </PrototypeModal>

    <PrototypeModal
      v-if="stopRow"
      v-model:open="stopOpen"
      title="停用连接"
      :description="`停用「${stopRow.name}」后，关联项目的 Tool 注入将立即收敛，恢复启用需审批。`"
      max-width="520px"
    >
      <p class="giw-stop-note">
        影响项目：<strong>{{ stopRow.projectBadges.join('、') }}</strong> · {{ stopRow.toolsSnippet }}
      </p>
      <label class="giw-check giw-check--block">
        <input type="checkbox" />
        我已确认无关键 Agent 依赖该连接的写操作
      </label>
      <template #footer>
        <button type="button" class="pm-btn" @click="stopOpen = false">取消</button>
        <button type="button" class="pm-btn pm-btn--primary" @click="stopOpen = false">确认停用</button>
      </template>
    </PrototypeModal>

    <PrototypeModal
      v-model:open="createOpen"
      :title="`新建连接 · ${createConnectorName}`"
      description="完成 OAuth / Token 授权、项目分配与高级选项后提交审批；通过后自动执行连通性测试。"
      max-width="680px"
    >
      <div class="pm-section">认证配置</div>
      <div class="pm-field">
        <span class="pm-label">回调 / 重定向 URL（演示）</span>
        <input class="pm-input pm-mono" readonly value="https://platform.example.com/oauth/callback" />
      </div>
      <div class="pm-section">项目分配</div>
      <div class="giw-check-row">
        <label class="giw-check"><input type="checkbox" checked /> 全部项目</label>
        <label class="giw-check"><input type="checkbox" /> 商城系统</label>
        <label class="giw-check"><input type="checkbox" /> 用户中心</label>
      </div>
      <div class="pm-grid2">
        <div class="pm-field">
          <span class="pm-label">超时阈值</span>
          <input class="pm-input" value="30 秒" />
        </div>
        <div class="pm-field">
          <span class="pm-label">频率限制</span>
          <input class="pm-input" value="100 次/分钟" />
        </div>
      </div>
      <template #footer>
        <button type="button" class="pm-btn" @click="createOpen = false">取消</button>
        <button type="button" class="pm-btn">🔍 测试连通性</button>
        <button type="button" class="pm-btn pm-btn--primary" @click="createOpen = false">提交审批</button>
      </template>
    </PrototypeModal>

    <PrototypeModal
      v-model:open="testOpen"
      :title="testOk ? `连通性测试 · ${testName}` : `连通性测试失败 · ${testName}`"
      max-width="520px"
    >
      <p class="giw-test-body" :class="{ 'giw-test-body--fail': !testOk }">{{ testDetail }}</p>
      <p v-if="testOk" class="giw-test-hint">延迟与 Tools 列表为演示数据。</p>
      <p v-else class="giw-test-hint">请检查上游地址、凭据与网络策略。</p>
      <template #footer>
        <button type="button" class="pm-btn pm-btn--primary" @click="testOpen = false">关闭</button>
      </template>
    </PrototypeModal>

    <PrototypeModal v-model:open="ackOpen" :title="ackTitle" :description="ackDesc" max-width="480px">
      <template #footer>
        <button type="button" class="pm-btn pm-btn--primary" @click="ackOpen = false">知道了</button>
      </template>
    </PrototypeModal>

    <PrototypeModal
      v-model:open="docOpen"
      :title="docKind === 'doc' ? '自建 MCP 开发文档' : '示例项目'"
      description="以下为原型说明，正式环境将跳转至文档站或代码仓库。"
      max-width="560px"
    >
      <ul class="giw-doc-list">
        <template v-if="docKind === 'doc'">
          <li>MCP 协议版本与传输层（Streamable HTTP / SSE / stdio）</li>
          <li>认证中间件、审计日志与健康检查接入规范</li>
          <li>Tool / Resource / Prompt 注册与版本策略</li>
        </template>
        <template v-else>
          <li>示例仓库：platform-mcp-starter（多租户 · 限流 · OTel）</li>
          <li>本地调试：npx create-platform-mcp 脚手架一键生成</li>
        </template>
      </ul>
      <template #footer>
        <button type="button" class="pm-btn pm-btn--primary" @click="docOpen = false">关闭</button>
      </template>
    </PrototypeModal>
  </section>
</template>

<style scoped>
.giw-workspace {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.giw-banner {
  margin: 0 0 16px;
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid var(--card-border);
  background: linear-gradient(90deg, #eef1ff, transparent);
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-subtle);
}

.giw-banner__lead {
  color: var(--primary);
}

.giw-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 18px;
}

.giw-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--card-border);
}

.giw-tab {
  margin: 0;
  padding: 10px 16px;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  background: transparent;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-subtle);
  cursor: pointer;
}

.giw-tab:hover {
  color: var(--text-main, #111827);
}

.giw-tab--active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}

.giw-panel {
  min-width: 0;
}

.giw-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.giw-search {
  max-width: 260px;
  min-width: 140px;
  flex: 0 1 260px;
  font: inherit;
  border: 1px solid rgba(17, 24, 39, 0.12);
  border-radius: 10px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.95);
}

.giw-select {
  width: auto;
  min-width: 120px;
  font: inherit;
  border: 1px solid rgba(17, 24, 39, 0.12);
  border-radius: 10px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.95);
}

.giw-toolbar-meta {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-subtle);
}

.giw-card {
  min-width: 0;
}

.giw-table-wrap {
  overflow: auto;
}

.giw-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.giw-table th,
.giw-table td {
  text-align: left;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(17, 24, 39, 0.08);
  vertical-align: middle;
}

.giw-table th {
  color: var(--text-subtle);
  font-weight: 600;
  white-space: nowrap;
}

.giw-tr--alert {
  background: #fef3f2;
}

.giw-conn-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.giw-conn-icon {
  font-size: 16px;
}

.giw-conn-host {
  font-size: 11px;
  color: var(--text-subtle);
  margin-top: 2px;
}

.giw-code {
  font-size: 11px;
  background: var(--bg, #f8fafc);
  padding: 2px 6px;
  border-radius: 4px;
}

.giw-pill {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
}

.giw-proj-badge {
  display: inline-block;
  margin-right: 4px;
  margin-bottom: 4px;
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 500;
  background: rgba(79, 110, 247, 0.15);
  color: var(--primary);
}

.giw-pill--primary {
  background: rgba(79, 110, 247, 0.15);
  color: var(--primary);
}

.giw-pill--success {
  background: rgba(34, 197, 94, 0.15);
  color: #15803d;
}

.giw-pill--warning {
  background: rgba(245, 158, 11, 0.18);
  color: #b45309;
}

.giw-pill--danger {
  background: rgba(239, 68, 68, 0.15);
  color: #b91c1c;
}

.giw-pill--muted {
  background: rgba(15, 23, 42, 0.06);
  color: var(--text-subtle);
}

.giw-heartbeat {
  font-size: 11px;
  color: var(--text-subtle);
}

.giw-heartbeat--warn {
  color: var(--warning);
}

.giw-heartbeat--danger {
  color: var(--danger);
}

.giw-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.giw-mini-btn {
  border: 1px solid rgba(17, 24, 39, 0.12);
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 11px;
  background: #fff;
  cursor: pointer;
}

.giw-mini-btn--danger {
  color: var(--danger);
}

.giw-inline-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid var(--card-border);
  background: var(--bg, #f8fafc);
  font-size: 12px;
  color: var(--text-subtle);
}

.giw-grid-2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.giw-mkt-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.giw-mkt-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--card-border);
  border-radius: 10px;
  background: #fff;
  text-align: left;
  font: inherit;
  cursor: pointer;
}

.giw-mkt-card:hover {
  border-color: rgba(79, 110, 247, 0.35);
}

.giw-mkt-icon {
  font-size: 18px;
}

.giw-mkt-name {
  font-weight: 600;
  font-size: 13px;
}

.giw-mkt-sub {
  font-size: 11px;
  color: var(--text-subtle);
  margin-top: 2px;
}

.giw-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.giw-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.giw-field-label {
  font-size: 12px;
  font-weight: 500;
}

.giw-input {
  font: inherit;
  border: 1px solid rgba(17, 24, 39, 0.12);
  border-radius: 8px;
  padding: 8px 10px;
  background: #fff;
}

.giw-form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.giw-btn {
  border: 1px solid rgba(17, 24, 39, 0.12);
  border-radius: 999px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.9);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.giw-btn--primary {
  background: linear-gradient(135deg, #4f6ef7 0%, #5d7bff 100%);
  color: #fff;
  border-color: transparent;
}

.giw-guide-body {
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-subtle);
}

.giw-guide-code {
  display: block;
  margin: 8px 0 12px;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--bg, #f8fafc);
  font-family: ui-monospace, Menlo, Monaco, monospace;
  font-size: 11px;
}

.giw-guide-links {
  margin: 12px 0 0;
}

.giw-link {
  padding: 0;
  border: none;
  background: none;
  color: var(--primary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.giw-guide-sep {
  margin: 0 6px;
  color: var(--text-subtle);
}

.giw-monitor-metrics {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}

.giw-chart {
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  gap: 8px;
  height: 100px;
  padding: 8px 0;
}

.giw-chart-bar {
  flex: 1;
  max-width: 48px;
  border-radius: 4px 4px 0 0;
  background: linear-gradient(180deg, var(--primary), rgba(79, 110, 247, 0.35));
}

.giw-chart-axis {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 11px;
  color: var(--text-subtle);
}

.giw-top-list {
  list-style: none;
  margin: 0;
  padding: 0 4px;
}

.giw-top-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(17, 24, 39, 0.06);
}

.giw-top-item:last-child {
  border-bottom: none;
}

.giw-top-name {
  font-weight: 500;
  font-size: 13px;
}

.giw-top-sub {
  font-size: 11px;
  color: var(--text-subtle);
  margin-top: 2px;
}

.giw-td-time {
  font-size: 12px;
}

@media (max-width: 1100px) {
  .giw-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .giw-grid-2 {
    grid-template-columns: 1fr;
  }

  .giw-monitor-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .giw-metrics {
    grid-template-columns: 1fr;
  }

  .giw-monitor-metrics {
    grid-template-columns: 1fr;
  }

  .giw-toolbar-meta {
    width: 100%;
    margin-left: 0;
  }

  .giw-mkt-grid {
    grid-template-columns: 1fr;
  }
}

:deep(.giw-modal-kv) {
  margin-bottom: 8px;
}

.giw-check-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.giw-check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid rgba(17, 24, 39, 0.1);
  background: rgba(15, 23, 42, 0.03);
  cursor: pointer;
}

.giw-check--block {
  display: flex;
  width: 100%;
  box-sizing: border-box;
}

.giw-stop-note {
  font-size: 13px;
  line-height: 1.55;
  margin: 0 0 12px;
}

.giw-test-body {
  font-size: 13px;
  line-height: 1.6;
  margin: 0 0 8px;
}

.giw-test-body--fail {
  color: #b91c1c;
}

.giw-test-hint {
  font-size: 12px;
  color: var(--text-subtle);
  margin: 0;
  line-height: 1.5;
}

.giw-doc-list {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-subtle);
}
</style>
