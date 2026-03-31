<script setup lang="ts">
import { computed, ref } from 'vue'

import CardPanel from '../../components/ui/CardPanel.vue'
import PrototypeModal from '../../components/ui/PrototypeModal.vue'
import StatCard from '../../components/ui/StatCard.vue'

type AtomicTab = 'catalog' | 'my' | 'publish'
type PillVariant = 'primary' | 'success' | 'warning' | 'danger' | 'muted'

const tab = ref<AtomicTab>('catalog')
const catalogPill = ref<string>('全部')
const catalogSearch = ref('')
const sortBy = ref('按引用数')
const mySearch = ref('')
const myProject = ref('全部项目')

const CATALOG_PILLS = [
  '全部',
  '身份与认证',
  '流程与审批',
  '通信协作',
  '业务数据',
  '基础设施',
] as const

interface AtomicCard {
  id: string
  badge: string
  badgeVariant: 'stable' | 'beta'
  featured?: boolean
  logo: string
  logoBg: string
  name: string
  provider: string
  desc: string
  tools: string[]
  meta: string
  usage?: string
  hideDetail?: boolean
}

interface AtomicSection {
  id: string
  icon: string
  title: string
  hint: string
  count: string
  cards: AtomicCard[]
}

const ATOMIC_SECTIONS: AtomicSection[] = [
  {
    id: '身份与认证',
    icon: '🔐',
    title: '身份与认证',
    hint: 'SSO · 权限 · 用户目录',
    count: '3 个能力',
    cards: [
      {
        id: 'c1',
        badge: '稳定版 · v2.3.0',
        badgeVariant: 'stable',
        featured: true,
        logo: '🔑',
        logoBg: '#EEF1FF',
        name: 'SSO 单点登录',
        provider: '统一身份认证中心',
        desc: '封装企业 SSO 系统，AI 可代用户验证身份、获取 Token、查询登录状态、刷新会话',
        tools: ['sso_authenticate', 'verify_token', 'get_user_session'],
        meta: '全部项目 · 核心依赖',
        usage: '42.8K/月',
        hideDetail: true,
      },
      {
        id: 'c2',
        badge: '稳定版 · v1.8.0',
        badgeVariant: 'stable',
        logo: '🛡️',
        logoBg: '#ECFDF3',
        name: 'RBAC 权限校验',
        provider: '权限管理中心',
        desc: '封装权限管理系统，AI 可查询用户角色、校验操作权限、获取资源访问控制列表',
        tools: ['check_permission', 'get_user_roles'],
        meta: '14 项目 · 28.3K/月',
      },
      {
        id: 'c3',
        badge: '稳定版 · v1.5.0',
        badgeVariant: 'stable',
        logo: '👥',
        logoBg: '#FFF3E0',
        name: 'LDAP 用户目录',
        provider: '人员组织管理',
        desc: '封装 LDAP/AD 目录服务，AI 可查询员工信息、组织架构、部门层级、汇报关系',
        tools: ['query_employee', 'get_org_tree'],
        meta: '10 项目 · 12.6K/月',
      },
    ],
  },
  {
    id: '流程与审批',
    icon: '📋',
    title: '流程与审批',
    hint: 'BPM · 审批流 · 工单',
    count: '3 个能力',
    cards: [
      {
        id: 'c4',
        badge: '稳定版 · v3.1.0',
        badgeVariant: 'stable',
        logo: '🔄',
        logoBg: '#F9F5FF',
        name: 'BPM 流程引擎',
        provider: 'Activiti 流程平台',
        desc: '封装企业 BPM 系统，AI 可发起流程实例、查询流程状态、获取待办列表、流转节点',
        tools: ['start_process', 'query_tasks', 'complete_task'],
        meta: '8 项目 · 18.5K/月',
      },
      {
        id: 'c5',
        badge: '稳定版 · v2.0.0',
        badgeVariant: 'stable',
        logo: '✅',
        logoBg: '#ECFDF3',
        name: '审批工作流',
        provider: 'OA 审批中心',
        desc: '封装 OA 审批系统，AI 可提交审批单、查询审批进度、催办提醒、获取审批历史',
        tools: ['submit_approval', 'query_approval', 'urge_approval'],
        meta: '12 项目 · 15.2K/月',
      },
      {
        id: 'c6',
        badge: '稳定版 · v1.6.0',
        badgeVariant: 'stable',
        logo: '🎫',
        logoBg: '#FEF3F2',
        name: '工单管理',
        provider: 'ITSM 工单系统',
        desc: '封装 IT 工单系统，AI 可创建工单、查询工单状态、分派处理人、更新进度备注',
        tools: ['create_ticket', 'assign_ticket'],
        meta: '6 项目 · 9.8K/月',
      },
    ],
  },
  {
    id: '通信协作',
    icon: '💬',
    title: '通信与协作',
    hint: '邮件 · IM · 短信',
    count: '3 个能力',
    cards: [
      {
        id: 'c7',
        badge: '稳定版 · v2.1.0',
        badgeVariant: 'stable',
        logo: '📧',
        logoBg: '#E3F2FD',
        name: '邮件网关',
        provider: 'Exchange / SMTP',
        desc: '封装企业邮件系统，AI 可发送邮件、查询收件箱摘要、管理日程邀请和会议通知',
        tools: ['send_email', 'query_inbox', 'send_calendar'],
        meta: '全部项目 · 22.1K/月',
      },
      {
        id: 'c8',
        badge: '稳定版 · v2.5.0',
        badgeVariant: 'stable',
        featured: true,
        logo: '💬',
        logoBg: '#ECFDF3',
        name: '企业微信',
        provider: '企微开放平台',
        desc: '封装企业微信接口，AI 可发送消息、创建群聊、推送审批通知、查询通讯录',
        tools: ['send_message', 'create_group', 'push_notification'],
        meta: '全部项目 · 核心依赖',
        usage: '35.6K/月',
        hideDetail: true,
      },
      {
        id: 'c9',
        badge: '稳定版 · v1.3.0',
        badgeVariant: 'stable',
        logo: '📱',
        logoBg: '#FFFAEB',
        name: '短信平台',
        provider: '统一短信网关',
        desc: '封装短信网关，AI 可发送验证码、通知短信、营销短信，支持模板管理和发送记录',
        tools: ['send_sms', 'query_sms_status'],
        meta: '8 项目 · 6.4K/月',
      },
    ],
  },
  {
    id: '业务数据',
    icon: '📊',
    title: '业务数据',
    hint: '主数据 · 订单 · CRM',
    count: '3 个能力',
    cards: [
      {
        id: 'c10',
        badge: '稳定版 · v2.0.0',
        badgeVariant: 'stable',
        logo: '🗄️',
        logoBg: '#EEF1FF',
        name: '主数据服务',
        provider: 'MDM 主数据平台',
        desc: '封装主数据管理平台，AI 可查询客户、产品、供应商等核心业务实体的标准化数据',
        tools: ['query_master_data', 'get_entity'],
        meta: '10 项目 · 14.2K/月',
      },
      {
        id: 'c11',
        badge: '稳定版 · v3.2.0',
        badgeVariant: 'stable',
        logo: '📦',
        logoBg: '#FFFAEB',
        name: '订单查询',
        provider: '订单中心',
        desc: '封装订单系统，AI 可查询订单详情、物流状态、退款进度、订单统计分析',
        tools: ['query_order', 'get_logistics', 'order_stats'],
        meta: '6 项目 · 18.9K/月',
      },
      {
        id: 'c12',
        badge: 'Beta · v0.9.0',
        badgeVariant: 'beta',
        logo: '👤',
        logoBg: '#F0F9FF',
        name: 'CRM 客户管理',
        provider: 'CRM 系统',
        desc: '封装 CRM 系统，AI 可查询客户画像、跟进记录、商机状态、客户标签体系',
        tools: ['query_customer', 'get_opportunities'],
        meta: '4 项目 · 5.8K/月',
      },
    ],
  },
  {
    id: '基础设施',
    icon: '🔧',
    title: '基础设施',
    hint: '存储 · 配置 · 日志',
    count: '2 个能力',
    cards: [
      {
        id: 'c13',
        badge: '稳定版 · v2.0.0',
        badgeVariant: 'stable',
        logo: '📁',
        logoBg: '#FEF3F2',
        name: '文件存储',
        provider: 'MinIO / OSS',
        desc: '封装对象存储服务，AI 可上传下载文件、生成临时访问链接、管理存储桶权限',
        tools: ['upload_file', 'get_presigned_url'],
        meta: '全部项目 · 8.5K/月',
      },
      {
        id: 'c14',
        badge: '稳定版 · v1.5.0',
        badgeVariant: 'stable',
        logo: '⚙️',
        logoBg: '#F0F9FF',
        name: '配置中心',
        provider: 'Nacos 配置平台',
        desc: '封装配置管理系统，AI 可查询配置项、变更配置（需审批）、监听配置变更事件',
        tools: ['get_config', 'update_config'],
        meta: '6 项目 · 4.2K/月',
      },
    ],
  },
]

const filteredCatalogSections = computed(() => {
  const pill = catalogPill.value
  let sections = pill === '全部' ? ATOMIC_SECTIONS : ATOMIC_SECTIONS.filter((s) => s.id === pill)
  const q = catalogSearch.value.trim().toLowerCase()
  if (!q) return sections
  return sections
    .map((s) => ({
      ...s,
      cards: s.cards.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.provider.toLowerCase().includes(q) ||
          c.tools.some((t) => t.toLowerCase().includes(q)),
      ),
    }))
    .filter((s) => s.cards.length > 0)
})

interface ProjectBindingRow {
  id: string
  name: string
  icon: string
  owner: string
  badges: string[]
  extraBadge?: string
  calls: string
  versionLabel: string
  versionVariant: PillVariant
  showUpgrade?: boolean
}

const PROJECT_ROWS: ProjectBindingRow[] = [
  {
    id: 'p1',
    name: '商城系统',
    icon: '🛒',
    owner: '李四',
    badges: ['SSO', 'RBAC', '企业微信', '订单查询', '文件存储'],
    extraBadge: '+2',
    calls: '62.4K',
    versionLabel: '全部最新',
    versionVariant: 'success',
  },
  {
    id: 'p2',
    name: '用户中心',
    icon: '👤',
    owner: '王五',
    badges: ['SSO', 'RBAC', 'LDAP', '邮件网关'],
    calls: '38.6K',
    versionLabel: '全部最新',
    versionVariant: 'success',
  },
  {
    id: 'p3',
    name: '支付网关',
    icon: '💳',
    owner: '赵六',
    badges: ['SSO', '审批工作流', '订单查询', '主数据 v1.8'],
    calls: '25.1K',
    versionLabel: '1 个可升级',
    versionVariant: 'warning',
    showUpgrade: true,
  },
]

const filteredProjectRows = computed(() => {
  let rows = PROJECT_ROWS
  const q = mySearch.value.trim().toLowerCase()
  if (q) {
    rows = rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.badges.some((b) => b.toLowerCase().includes(q)),
    )
  }
  const proj = myProject.value
  if (proj !== '全部项目') {
    rows = rows.filter((r) => r.name === proj)
  }
  return rows
})

interface PublishRow {
  id: string
  title: string
  actionName: string
  sub?: string
  version: string
  versionDate: string
  source: string
  projects: string
  calls: string
  sla: string
  slaVariant: PillVariant
  team: string
}

const PUBLISH_ROWS: PublishRow[] = [
  {
    id: 'u1',
    title: '🔑 SSO 单点登录',
    actionName: 'SSO 单点登录',
    sub: '核心依赖 · 全局',
    version: 'v2.3.0',
    versionDate: '2026-03-01',
    source: '统一认证中心',
    projects: '全部项目',
    calls: '42.8K',
    sla: '99.99%',
    slaVariant: 'success',
    team: '基础架构组',
  },
  {
    id: 'u2',
    title: '💬 企业微信',
    actionName: '企业微信',
    sub: '核心依赖 · 全局',
    version: 'v2.5.0',
    versionDate: '2026-03-10',
    source: '企微开放平台',
    projects: '全部项目',
    calls: '35.6K',
    sla: '99.95%',
    slaVariant: 'success',
    team: '基础架构组',
  },
  {
    id: 'u3',
    title: '🛡️ RBAC 权限校验',
    actionName: 'RBAC 权限校验',
    version: 'v1.8.0',
    versionDate: '2026-03-15',
    source: '权限管理中心',
    projects: '14 个项目',
    calls: '28.3K',
    sla: '99.8%',
    slaVariant: 'success',
    team: '安全团队',
  },
  {
    id: 'u4',
    title: '📧 邮件网关',
    actionName: '邮件网关',
    version: 'v2.1.0',
    versionDate: '2026-02-28',
    source: 'Exchange / SMTP',
    projects: '全部项目',
    calls: '22.1K',
    sla: '99.6%',
    slaVariant: 'success',
    team: '基础架构组',
  },
  {
    id: 'u5',
    title: '📦 订单查询',
    actionName: '订单查询',
    version: 'v3.2.0',
    versionDate: '2026-03-20',
    source: '订单中心',
    projects: '6 个项目',
    calls: '18.9K',
    sla: '99.7%',
    slaVariant: 'success',
    team: '交易团队',
  },
  {
    id: 'u6',
    title: '🔄 BPM 流程引擎',
    actionName: 'BPM 流程引擎',
    version: 'v3.1.0',
    versionDate: '2026-03-18',
    source: 'Activiti 平台',
    projects: '8 个项目',
    calls: '18.5K',
    sla: '99.5%',
    slaVariant: 'success',
    team: '流程平台组',
  },
  {
    id: 'u7',
    title: '👤 CRM 客户管理',
    actionName: 'CRM 客户管理',
    version: 'v0.9.0',
    versionDate: '2026-03-22',
    source: 'CRM 系统',
    projects: '4 个项目',
    calls: '5.8K',
    sla: '98.2%',
    slaVariant: 'warning',
    team: '业务中台组',
  },
]

function pillClass(v: PillVariant) {
  return {
    'gaw-pill': true,
    'gaw-pill--primary': v === 'primary',
    'gaw-pill--success': v === 'success',
    'gaw-pill--warning': v === 'warning',
    'gaw-pill--danger': v === 'danger',
    'gaw-pill--muted': v === 'muted',
  }
}

const publishOpen = ref(false)
const detailOpen = ref(false)
const atomicDetailCard = ref<AtomicCard | null>(null)
const projectCfgOpen = ref(false)
const projectCfgRow = ref<ProjectBindingRow | null>(null)
const upgradeOpen = ref(false)
const editOpen = ref(false)
const atomicEditRow = ref<PublishRow | null>(null)
const releaseOpen = ref(false)
const atomicReleaseRow = ref<PublishRow | null>(null)
const approvalOpen = ref(false)
const guideOpen = ref(false)
const guideKind = ref<'guide' | 'template'>('guide')

function openPublishAtomic() {
  publishOpen.value = true
}

function openAtomicDetail(card: AtomicCard) {
  atomicDetailCard.value = card
  detailOpen.value = true
}

function openProjectCfg(row: ProjectBindingRow) {
  projectCfgRow.value = row
  projectCfgOpen.value = true
}

function upgradeMasterData() {
  upgradeOpen.value = true
}

function openAtomicEdit(r: PublishRow) {
  atomicEditRow.value = r
  editOpen.value = true
}

function openAtomicRelease(r: PublishRow) {
  atomicReleaseRow.value = r
  releaseOpen.value = true
}

function openApprovalsHint() {
  approvalOpen.value = true
}

function openGuideLink(kind: 'guide' | 'template') {
  guideKind.value = kind
  guideOpen.value = true
}
</script>

<template>
  <section class="gaw-workspace" data-testid="global-atomic-workspace">
    <div class="gaw-banner" role="note">
      <strong class="gaw-banner__lead">原子能力中心</strong>
      ：将企业内部业务系统封装为<strong>标准化 API</strong>，供 AI Agent 直接调用。每个原子能力对应一个企业内部项目/系统的核心接口封装，使 AI
      能够操作企业已有服务（如单点登录、审批流程、消息通知等）。
      <div class="gaw-banner__sub">
        调用链：AI Agent → 原子能力 API → 企业内部系统。原子能力是对已有业务系统的<strong>接口抽象与安全封装</strong>，AI
        无需直接对接底层系统即可完成业务操作。
      </div>
    </div>

    <section class="gaw-metrics">
      <StatCard
        icon="⚛️"
        label="已封装能力"
        value="16"
        delta="↑ 3 本月新增"
        tone="primary"
        delta-tone="success"
      />
      <StatCard icon="🏢" label="对接源系统" value="12" delta="覆盖核心业务系统" />
      <StatCard
        icon="🤖"
        label="AI Agent 引用"
        value="28"
        delta="↑ 6 个 Agent 新接入"
        tone="success"
        delta-tone="success"
      />
      <StatCard icon="📊" label="本月 API 调用" value="156K" delta="成功率 99.6%" delta-tone="success" />
    </section>

    <div class="gaw-tabs" role="tablist" aria-label="原子能力">
      <button
        type="button"
        role="tab"
        class="gaw-tab"
        :class="{ 'gaw-tab--active': tab === 'catalog' }"
        :aria-selected="tab === 'catalog'"
        @click="tab = 'catalog'"
      >
        📦 能力目录
      </button>
      <button
        type="button"
        role="tab"
        class="gaw-tab"
        :class="{ 'gaw-tab--active': tab === 'my' }"
        :aria-selected="tab === 'my'"
        @click="tab = 'my'"
      >
        📋 项目接入
      </button>
      <button
        type="button"
        role="tab"
        class="gaw-tab"
        :class="{ 'gaw-tab--active': tab === 'publish' }"
        :aria-selected="tab === 'publish'"
        @click="tab = 'publish'"
      >
        🚀 封装管理
      </button>
    </div>

    <!-- 能力目录 -->
    <div v-show="tab === 'catalog'" class="gaw-panel">
      <div class="gaw-catalog-toolbar">
        <input
          v-model="catalogSearch"
          class="gaw-search"
          type="search"
          placeholder="搜索能力名称 / 源系统 / 标签..."
          aria-label="搜索能力"
        />
        <div class="gaw-chips" role="group" aria-label="分类筛选">
          <button
            v-for="p in CATALOG_PILLS"
            :key="p"
            type="button"
            class="gaw-chip"
            :class="{ 'gaw-chip--active': catalogPill === p }"
            @click="catalogPill = p"
          >
            {{ p }}
          </button>
        </div>
        <select v-model="sortBy" class="gaw-select gaw-select--sm" aria-label="排序">
          <option>按引用数</option>
          <option>按调用量</option>
          <option>按最新更新</option>
        </select>
        <button type="button" class="gaw-btn gaw-btn--primary gaw-btn--sm" @click="openPublishAtomic">
          + 封装新能力
        </button>
      </div>

      <div v-for="sec in filteredCatalogSections" :key="sec.id" class="gaw-section">
        <div class="gaw-section-hd">
          <span class="gaw-section-icon" aria-hidden="true">{{ sec.icon }}</span>
          <span class="gaw-section-title">{{ sec.title }}</span>
          <span class="gaw-section-hint">{{ sec.hint }}</span>
          <span class="gaw-section-count">{{ sec.count }}</span>
        </div>
        <div class="gaw-card-grid">
          <div
            v-for="card in sec.cards"
            :key="card.id"
            class="gaw-card"
            :class="{ 'gaw-card--featured': card.featured }"
          >
            <div
              class="gaw-card-badge"
              :class="card.badgeVariant === 'beta' ? 'gaw-card-badge--beta' : 'gaw-card-badge--stable'"
            >
              {{ card.badge }}
            </div>
            <div class="gaw-card-head">
              <div class="gaw-card-logo" :style="{ background: card.logoBg }">{{ card.logo }}</div>
              <div>
                <div class="gaw-card-name">{{ card.name }}</div>
                <div class="gaw-card-provider">{{ card.provider }}</div>
              </div>
            </div>
            <p class="gaw-card-desc">{{ card.desc }}</p>
            <div class="gaw-card-tools">
              <span v-for="t in card.tools" :key="t" class="gaw-tool-tag">{{ t }}</span>
            </div>
            <div class="gaw-card-footer">
              <span class="gaw-card-meta">{{ card.meta }}</span>
              <span v-if="card.usage" class="gaw-card-usage">{{ card.usage }}</span>
              <button
                v-if="!card.hideDetail"
                type="button"
                class="gaw-btn gaw-btn--primary gaw-btn--xs"
                @click="openAtomicDetail(card)"
              >
                查看详情
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 项目接入 -->
    <div v-show="tab === 'my'" class="gaw-panel">
      <div class="gaw-inline-hint gaw-inline-hint--row">
        <span aria-hidden="true">🔒</span>
        <span>
          项目接入的原子能力由<strong>平台管理员</strong>统一配置。启用/停用操作需通过<strong>审批中心</strong>审批后生效。
        </span>
        <button type="button" class="gaw-btn gaw-btn--primary gaw-btn--sm" @click="openApprovalsHint">
          打开审批中心
        </button>
      </div>
      <div class="gaw-toolbar-row">
        <input
          v-model="mySearch"
          class="gaw-search"
          type="search"
          placeholder="搜索项目或能力名称..."
          aria-label="搜索项目"
        />
        <select v-model="myProject" class="gaw-select" aria-label="项目">
          <option>全部项目</option>
          <option>商城系统</option>
          <option>用户中心</option>
          <option>支付网关</option>
        </select>
        <span class="gaw-toolbar-meta">3 个项目 · 共接入 14 项原子能力</span>
      </div>

      <CardPanel
        class="gaw-cardpanel"
        title="项目能力接入管理"
        subtitle="管理各项目可调用的企业系统原子能力（变更需审批）"
      >
        <div class="gaw-table-wrap">
          <table class="gaw-table">
            <thead>
              <tr>
                <th>项目</th>
                <th>已接入能力</th>
                <th>本月调用</th>
                <th>版本状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in filteredProjectRows" :key="row.id">
                <td>
                  <strong>{{ row.icon }} {{ row.name }}</strong>
                  <div class="gaw-sub">负责人: {{ row.owner }}</div>
                </td>
                <td>
                  <div class="gaw-badge-row">
                    <span v-for="b in row.badges" :key="b" class="gaw-proj-badge">{{ b }}</span>
                    <span v-if="row.extraBadge" class="gaw-proj-badge gaw-proj-badge--muted">{{ row.extraBadge }}</span>
                  </div>
                </td>
                <td>
                  <strong>{{ row.calls }}</strong>
                </td>
                <td>
                  <span :class="pillClass(row.versionVariant)">{{ row.versionLabel }}</span>
                </td>
                <td>
                  <button type="button" class="gaw-mini-btn" @click="openProjectCfg(row)">配置</button>
                  <button
                    v-if="row.showUpgrade"
                    type="button"
                    class="gaw-mini-btn gaw-mini-btn--primary"
                    @click="upgradeMasterData"
                  >
                    升级主数据
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardPanel>

      <div class="gaw-grid-2">
        <CardPanel title="📊 各项目调用趋势（近 4 周）" class="gaw-cardpanel">
          <div class="gaw-chart">
            <div class="gaw-chart-bar" style="height: 52%" />
            <div class="gaw-chart-bar" style="height: 61%" />
            <div class="gaw-chart-bar" style="height: 58%" />
            <div class="gaw-chart-bar" style="height: 75%" />
          </div>
          <div class="gaw-chart-axis">
            <span>W1</span><span>W2</span><span>W3</span><span>W4</span>
          </div>
        </CardPanel>
        <CardPanel title="🔔 变更与升级通知" class="gaw-cardpanel">
          <ul class="gaw-notice-list">
            <li class="gaw-notice">
              <div class="gaw-notice-icon" style="background: #ecfdf3">🆕</div>
              <div class="gaw-notice-body">
                <div class="gaw-notice-title">主数据服务 v2.0.0 已发布</div>
                <div class="gaw-notice-sub">新增供应商数据查询接口 · 3 天前</div>
              </div>
              <span :class="pillClass('success')">商城、用户已升级</span>
            </li>
            <li class="gaw-notice">
              <div class="gaw-notice-icon" style="background: #fffaeb">⬆️</div>
              <div class="gaw-notice-body">
                <div class="gaw-notice-title">企业微信 v2.5.0</div>
                <div class="gaw-notice-sub">新增群机器人 Webhook 能力 · 建议升级</div>
              </div>
              <span :class="pillClass('warning')">支付网关待升级</span>
            </li>
            <li class="gaw-notice">
              <div class="gaw-notice-icon" style="background: #fef3f2">⚠️</div>
              <div class="gaw-notice-body">
                <div class="gaw-notice-title">旧版短信接口 v1.0 废弃预告</div>
                <div class="gaw-notice-sub">2026-06-01 下线，需迁移到统一短信平台</div>
              </div>
              <span :class="pillClass('danger')">影响 2 个项目</span>
            </li>
          </ul>
        </CardPanel>
      </div>
    </div>

    <!-- 封装管理 -->
    <div v-show="tab === 'publish'" class="gaw-panel">
      <div class="gaw-inline-hint">
        <span aria-hidden="true">🏢</span>
        原子能力由<strong>平台统一封装和管理</strong>，每个能力指定责任团队负责对接源系统与版本迭代。新能力封装需经<strong>审批中心</strong>审核后上架。
      </div>
      <div class="gaw-publish-bar">
        <span class="gaw-publish-desc">
          管理已封装的企业系统原子能力，包括接口升级、源系统变更和生命周期管理
        </span>
        <button type="button" class="gaw-btn gaw-btn--primary" @click="openPublishAtomic">+ 封装新能力</button>
      </div>

      <CardPanel class="gaw-cardpanel" title="已封装能力列表" subtitle="共 16 项 · 含 3 项核心依赖">
        <div class="gaw-table-wrap">
          <table class="gaw-table">
            <thead>
              <tr>
                <th>能力名称</th>
                <th>当前版本</th>
                <th>源系统</th>
                <th>接入项目</th>
                <th>本月调用</th>
                <th>SLA</th>
                <th>责任团队</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in PUBLISH_ROWS" :key="r.id">
                <td>
                  <strong>{{ r.title }}</strong>
                  <div v-if="r.sub" class="gaw-sub">{{ r.sub }}</div>
                </td>
                <td>
                  <code class="gaw-code">{{ r.version }}</code>
                  <div class="gaw-sub">{{ r.versionDate }}</div>
                </td>
                <td>{{ r.source }}</td>
                <td>{{ r.projects }}</td>
                <td>
                  <strong>{{ r.calls }}</strong>
                </td>
                <td>
                  <span :class="pillClass(r.slaVariant)">{{ r.sla }}</span>
                </td>
                <td>{{ r.team }}</td>
                <td>
                  <button type="button" class="gaw-mini-btn" @click="openAtomicEdit(r)">编辑</button>
                  <button type="button" class="gaw-mini-btn" @click="openAtomicRelease(r)">发布新版</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardPanel>

      <CardPanel title="📋 能力封装规范" class="gaw-cardpanel">
        <div class="gaw-spec">
          <p><strong>企业系统原子能力封装清单：</strong></p>
          <p>✅ API 接口文档（输入 / 输出 Schema，含调用示例与错误码）</p>
          <p>✅ 源系统声明（对接的内部系统名称、版本、负责人）</p>
          <p>✅ 安全策略（认证方式、数据脱敏规则、敏感操作审批）</p>
          <p>✅ 性能基准（P99 延迟 / 可用性 / QPS 上限 / SLA 承诺）</p>
          <p>✅ 幂等性说明（写操作是否支持幂等，重试安全性）</p>
          <p>✅ 责任团队与 On-Call 机制</p>
          <p>✅ 变更日志（遵循 Keep a Changelog）</p>
          <p>✅ 审批流程（提交 → 安全评审 → 架构审核 → 灰度上线 → 全量发布）</p>
          <p class="gaw-spec-links">
            <button type="button" class="gaw-link" @click="openGuideLink('guide')">查看完整封装指南 →</button>
            <span class="gaw-spec-sep">·</span>
            <button type="button" class="gaw-link" @click="openGuideLink('template')">下载封装模板 →</button>
          </p>
        </div>
      </CardPanel>
    </div>

    <PrototypeModal
      v-model:open="publishOpen"
      title="封装新原子能力"
      description="将企业内部业务系统封装为标准化 API，供 AI Agent 调用。封装后所有项目可申请接入。"
      max-width="720px"
    >
      <div class="pm-section">基本信息</div>
      <div class="pm-grid2">
        <div class="pm-field">
          <span class="pm-label">能力名称</span>
          <input class="pm-input" placeholder="例如：ERP 库存查询" />
        </div>
        <div class="pm-field">
          <span class="pm-label">分类</span>
          <select class="pm-select">
            <option>身份与认证</option>
            <option>流程与审批</option>
            <option>通信协作</option>
            <option>业务数据</option>
            <option>基础设施</option>
          </select>
        </div>
      </div>
      <div class="pm-field">
        <span class="pm-label">描述</span>
        <textarea class="pm-textarea" rows="2" placeholder="一句话描述该能力封装的企业系统与 AI 可执行的操作" />
      </div>
      <div class="pm-field">
        <span class="pm-label">标签</span>
        <input class="pm-input" placeholder="ERP, 库存, 供应链 (逗号分隔)" />
      </div>
      <div class="pm-section">API 定义</div>
      <div class="pm-grid2">
        <div class="pm-field">
          <span class="pm-label">API 端点</span>
          <input class="pm-input pm-mono" placeholder="GET /atomic/erp/inventory" />
        </div>
        <div class="pm-field">
          <span class="pm-label">初始版本号</span>
          <input class="pm-input pm-mono" value="v1.0.0" />
        </div>
      </div>
      <div class="pm-field">
        <span class="pm-label">输入 Schema (JSON)</span>
        <textarea class="pm-textarea pm-mono" rows="2" placeholder='{"product_id": "string"}' />
      </div>
      <div class="pm-field">
        <span class="pm-label">输出 Schema (JSON)</span>
        <textarea class="pm-textarea pm-mono" rows="2" placeholder='{"quantity": "number"}' />
      </div>
      <div class="pm-section">源系统信息</div>
      <div class="pm-grid2">
        <div class="pm-field">
          <span class="pm-label">对接源系统</span>
          <input class="pm-input" placeholder="SAP ERP / 自研系统" />
        </div>
        <div class="pm-field">
          <span class="pm-label">降级策略</span>
          <input class="pm-input" placeholder="主不可用 → 缓存兜底" />
        </div>
      </div>
      <div class="gaw-modal-tip" role="note">
        审批流程：<strong>提交</strong> → 安全评审 → 架构审核 → 灰度上线 → 全量发布
      </div>
      <template #footer>
        <button type="button" class="pm-btn" @click="publishOpen = false">取消</button>
        <button type="button" class="pm-btn">保存草稿</button>
        <button type="button" class="pm-btn pm-btn--primary" @click="publishOpen = false">提交审批</button>
      </template>
    </PrototypeModal>

    <PrototypeModal
      v-if="atomicDetailCard"
      v-model:open="detailOpen"
      max-width="760px"
      title-id="gaw-atomic-detail-title"
    >
      <div class="gaw-modal-detail-hd">
        <span class="gaw-modal-detail-icon" aria-hidden="true">{{ atomicDetailCard.logo }}</span>
        <div class="gaw-modal-detail-titles">
          <h2 id="gaw-atomic-detail-title" class="gaw-modal-detail-name">{{ atomicDetailCard.name }}</h2>
          <p class="gaw-modal-detail-sub">{{ atomicDetailCard.provider }} · {{ atomicDetailCard.badge }}</p>
        </div>
        <span
          class="gaw-modal-detail-pill"
          :class="
            atomicDetailCard.badgeVariant === 'beta' ? 'gaw-modal-detail-pill--beta' : 'gaw-modal-detail-pill--stable'
          "
        >
          {{ atomicDetailCard.badgeVariant === 'beta' ? 'Beta' : '稳定版' }}
        </span>
      </div>
      <p class="gaw-modal-detail-desc">{{ atomicDetailCard.desc }}</p>
      <div class="pm-section">暴露 Tools</div>
      <div class="gaw-modal-tools">
        <code v-for="t in atomicDetailCard.tools" :key="t" class="gaw-tool-tag gaw-tool-tag--modal">{{ t }}</code>
      </div>
      <div class="pm-section">API 规格（示意）</div>
      <pre class="pm-codeblock">POST /atomic/{{ atomicDetailCard.tools[0] ?? 'invoke' }}
// Request
{ "payload": { } }
// Response
{ "ok": true, "data": { } }</pre>
      <div class="pm-section">元数据</div>
      <table class="pm-kv">
        <tr>
          <td>接入范围</td>
          <td>{{ atomicDetailCard.meta }}</td>
        </tr>
        <tr v-if="atomicDetailCard.usage">
          <td>调用量</td>
          <td>{{ atomicDetailCard.usage }}</td>
        </tr>
      </table>
      <template #footer>
        <button type="button" class="pm-btn" @click="detailOpen = false">关闭</button>
        <button type="button" class="pm-btn">📖 API 文档</button>
        <button type="button" class="pm-btn pm-btn--primary">▶ 在线试用</button>
      </template>
    </PrototypeModal>

    <PrototypeModal
      v-if="projectCfgRow"
      v-model:open="projectCfgOpen"
      :title="`${projectCfgRow.icon} ${projectCfgRow.name} · 能力配置`"
      description="管理该项目接入的企业系统原子能力，变更需审批。"
      max-width="680px"
    >
      <div class="pm-section">已接入能力</div>
      <p class="gaw-modal-muted">当前已启用 {{ projectCfgRow.badges.length }}+ 项能力；可在列表中停用非核心能力。</p>
      <div class="gaw-modal-chip-row">
        <span v-for="b in projectCfgRow.badges" :key="b" class="gaw-proj-badge">{{ b }}</span>
        <span v-if="projectCfgRow.extraBadge" class="gaw-proj-badge gaw-proj-badge--muted">{{ projectCfgRow.extraBadge }}</span>
      </div>
      <div class="pm-section">接入新能力（多选示意）</div>
      <div class="gaw-modal-chip-row">
        <label class="gaw-modal-check"><input type="checkbox" /> LDAP 目录 v1.5.0</label>
        <label class="gaw-modal-check"><input type="checkbox" /> BPM 引擎 v3.1.0</label>
        <label class="gaw-modal-check"><input type="checkbox" /> 短信平台 v1.3.0</label>
      </div>
      <div class="pm-grid2">
        <div class="pm-field">
          <span class="pm-label">月度调用上限</span>
          <input class="pm-input" value="100,000 次/月" />
        </div>
        <div class="pm-field">
          <span class="pm-label">告警阈值</span>
          <input class="pm-input" value="80%" />
        </div>
      </div>
      <template #footer>
        <button type="button" class="pm-btn" @click="projectCfgOpen = false">取消</button>
        <button type="button" class="pm-btn pm-btn--primary" @click="projectCfgOpen = false">提交审批</button>
      </template>
    </PrototypeModal>

    <PrototypeModal
      v-model:open="upgradeOpen"
      title="升级主数据服务"
      description="将主数据服务从 v1.8 升级至 v2.0.0，新增供应商查询等接口；需各接入项目确认兼容性。"
      max-width="520px"
    >
      <ul class="gaw-modal-list">
        <li>影响项目：支付网关（当前仍为 v1.8）</li>
        <li>升级后自动触发回归任务与调用配额重算</li>
      </ul>
      <template #footer>
        <button type="button" class="pm-btn" @click="upgradeOpen = false">取消</button>
        <button type="button" class="pm-btn pm-btn--primary" @click="upgradeOpen = false">提交升级审批</button>
      </template>
    </PrototypeModal>

    <PrototypeModal
      v-if="atomicEditRow"
      v-model:open="editOpen"
      title="编辑原子能力"
      description="修改能力封装配置，保存后需审批生效。"
      max-width="680px"
    >
      <div class="pm-section">基本信息</div>
      <div class="pm-grid2">
        <div class="pm-field">
          <span class="pm-label">能力名称</span>
          <input class="pm-input" :value="atomicEditRow.actionName" />
        </div>
        <div class="pm-field">
          <span class="pm-label">分类</span>
          <select class="pm-select">
            <option>身份与认证</option>
            <option>流程与审批</option>
            <option>通信协作</option>
            <option>业务数据</option>
            <option>基础设施</option>
          </select>
        </div>
      </div>
      <div class="pm-field">
        <span class="pm-label">描述</span>
        <textarea class="pm-textarea" rows="2" :placeholder="atomicEditRow.source" />
      </div>
      <div class="pm-section">源系统与接口</div>
      <div class="pm-grid2">
        <div class="pm-field">
          <span class="pm-label">源系统</span>
          <input class="pm-input" :value="atomicEditRow.source" />
        </div>
        <div class="pm-field">
          <span class="pm-label">超时阈值</span>
          <input class="pm-input" value="3 秒" />
        </div>
      </div>
      <div class="pm-grid2">
        <div class="pm-field">
          <span class="pm-label">责任团队</span>
          <input class="pm-input" :value="atomicEditRow.team" />
        </div>
        <div class="pm-field">
          <span class="pm-label">QPS 上限</span>
          <input class="pm-input" value="500" />
        </div>
      </div>
      <template #footer>
        <button type="button" class="pm-btn" @click="editOpen = false">取消</button>
        <button type="button" class="pm-btn pm-btn--primary" @click="editOpen = false">保存变更</button>
      </template>
    </PrototypeModal>

    <PrototypeModal
      v-if="atomicReleaseRow"
      v-model:open="releaseOpen"
      title="发布新版本"
      description="为原子能力发布新版本，需经审批流程后上线。"
      max-width="680px"
    >
      <div class="pm-section">版本信息</div>
      <div class="pm-grid2">
        <div class="pm-field">
          <span class="pm-label">当前版本</span>
          <input class="pm-input pm-mono" :value="atomicReleaseRow.version" disabled />
        </div>
        <div class="pm-field">
          <span class="pm-label">新版本号</span>
          <input class="pm-input pm-mono" placeholder="例如 v2.4.0" />
        </div>
      </div>
      <div class="pm-field">
        <span class="pm-label">变更日志</span>
        <textarea class="pm-textarea" rows="4" placeholder="## 新版本&#10;### Added / Fixed" />
      </div>
      <div class="pm-field">
        <span class="pm-label">发布策略</span>
        <select class="pm-select">
          <option>灰度发布（10% → 50% → 全量）</option>
          <option>全量发布</option>
          <option>仅指定项目</option>
        </select>
      </div>
      <p class="gaw-modal-muted">将通知 <strong>{{ atomicReleaseRow.projects }}</strong> 相关负责人。</p>
      <template #footer>
        <button type="button" class="pm-btn" @click="releaseOpen = false">取消</button>
        <button type="button" class="pm-btn">保存草稿</button>
        <button type="button" class="pm-btn pm-btn--primary" @click="releaseOpen = false">提交审批</button>
      </template>
    </PrototypeModal>

    <PrototypeModal
      v-model:open="approvalOpen"
      title="审批中心"
      description="平台侧能力接入、连接变更与版本发布的审批将汇总于此（演示数据）。"
      max-width="560px"
    >
      <ul class="gaw-modal-approval">
        <li><span class="gaw-ap-badge">待审</span> 支付网关 · 主数据 v2.0 升级</li>
        <li><span class="gaw-ap-badge gaw-ap-badge--ok">已通过</span> 商城系统 · 新增短信平台接入</li>
        <li><span class="gaw-ap-badge">待审</span> 全局 · 新注册工具 security_scan</li>
      </ul>
      <template #footer>
        <button type="button" class="pm-btn pm-btn--primary" @click="approvalOpen = false">关闭</button>
      </template>
    </PrototypeModal>

    <PrototypeModal
      v-model:open="guideOpen"
      :title="guideKind === 'guide' ? '能力封装指南' : '封装模板下载'"
      :description="guideKind === 'guide' ? '企业系统原子能力上架前需满足的文档与治理要求。' : '标准化 OpenAPI 片段与 Postman Collection 模板（演示）。'"
      max-width="560px"
    >
      <ul v-if="guideKind === 'guide'" class="gaw-modal-list">
        <li>API Schema、错误码与示例请求/响应</li>
        <li>源系统版本、负责人与 On-Call</li>
        <li>脱敏规则、审计级别与 HITL 策略</li>
        <li>性能基线与兼容性测试报告</li>
      </ul>
      <p v-else class="gaw-modal-muted">可下载：atomic-openapi-starter.yaml · atomic-postman.json（原型占位，未请求真实地址）。</p>
      <template #footer>
        <button type="button" class="pm-btn" @click="guideOpen = false">关闭</button>
        <button v-if="guideKind === 'template'" type="button" class="pm-btn pm-btn--primary" @click="guideOpen = false">
          模拟下载
        </button>
      </template>
    </PrototypeModal>
  </section>
</template>

<style scoped>
.gaw-workspace {
  min-width: 0;
}

.gaw-banner {
  margin: 0 0 16px;
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid var(--card-border);
  background: linear-gradient(90deg, #dbeafe, transparent);
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-subtle);
}

.gaw-banner__lead {
  color: #1d4ed8;
}

.gaw-banner__sub {
  margin-top: 6px;
  font-size: 11px;
}

.gaw-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 18px;
}

.gaw-tabs {
  display: flex;
  flex-wrap: wrap;
  border-bottom: 1px solid var(--card-border);
  margin-bottom: 16px;
}

.gaw-tab {
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

.gaw-tab--active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}

.gaw-catalog-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.gaw-search {
  max-width: 280px;
  min-width: 140px;
  flex: 0 1 280px;
  font: inherit;
  border: 1px solid rgba(17, 24, 39, 0.12);
  border-radius: 10px;
  padding: 8px 12px;
  background: #fff;
}

.gaw-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.gaw-chip {
  border: 1px solid rgba(17, 24, 39, 0.12);
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  background: #fff;
  cursor: pointer;
}

.gaw-chip--active {
  border-color: var(--primary);
  background: rgba(79, 110, 247, 0.1);
  color: var(--primary);
  font-weight: 600;
}

.gaw-select {
  font: inherit;
  border: 1px solid rgba(17, 24, 39, 0.12);
  border-radius: 8px;
  padding: 8px 10px;
  background: #fff;
}

.gaw-select--sm {
  font-size: 12px;
  padding: 6px 8px;
}

.gaw-btn {
  border: 1px solid rgba(17, 24, 39, 0.12);
  border-radius: 999px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  background: #fff;
  cursor: pointer;
}

.gaw-btn--sm {
  font-size: 12px;
  padding: 5px 12px;
}

.gaw-btn--xs {
  font-size: 12px;
  padding: 4px 10px;
}

.gaw-btn--primary {
  background: linear-gradient(135deg, #4f6ef7 0%, #5d7bff 100%);
  color: #fff;
  border-color: transparent;
}

.gaw-section {
  margin-bottom: 20px;
}

.gaw-section-hd {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 12px;
}

.gaw-section-icon {
  font-size: 16px;
}

.gaw-section-title {
  font-weight: 700;
  font-size: 14px;
}

.gaw-section-hint {
  font-size: 12px;
  color: var(--text-subtle);
}

.gaw-section-count {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-subtle);
}

.gaw-card-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.gaw-card {
  position: relative;
  border: 1px solid var(--card-border);
  border-radius: 14px;
  padding: 14px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
}

.gaw-card--featured {
  border-color: rgba(79, 110, 247, 0.35);
  box-shadow: 0 0 0 1px rgba(79, 110, 247, 0.12);
}

.gaw-card-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 6px;
  font-weight: 600;
}

.gaw-card-badge--stable {
  background: rgba(34, 197, 94, 0.12);
  color: #15803d;
}

.gaw-card-badge--beta {
  background: rgba(245, 158, 11, 0.18);
  color: #b45309;
}

.gaw-card-head {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  margin-bottom: 8px;
  padding-right: 72px;
}

.gaw-card-logo {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.gaw-card-name {
  font-weight: 700;
  font-size: 14px;
}

.gaw-card-provider {
  font-size: 12px;
  color: var(--text-subtle);
  margin-top: 2px;
}

.gaw-card-desc {
  margin: 0 0 10px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-subtle);
}

.gaw-card-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 12px;
}

.gaw-tool-tag {
  font-size: 10px;
  font-family: ui-monospace, Menlo, Monaco, monospace;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--bg, #f1f5f9);
  color: var(--text-subtle);
}

.gaw-card-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid rgba(17, 24, 39, 0.08);
  font-size: 11px;
}

.gaw-card-meta {
  color: var(--text-subtle);
  flex: 1;
  min-width: 0;
}

.gaw-card-usage {
  color: var(--success);
  font-weight: 600;
}

.gaw-inline-hint {
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

.gaw-inline-hint--row {
  flex-wrap: wrap;
}

.gaw-inline-hint--row .gaw-btn {
  margin-left: auto;
}

.gaw-toolbar-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.gaw-toolbar-meta {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-subtle);
}

.gaw-cardpanel {
  margin-bottom: 16px;
}

.gaw-table-wrap {
  overflow: auto;
}

.gaw-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.gaw-table th,
.gaw-table td {
  padding: 10px 12px;
  border-bottom: 1px solid rgba(17, 24, 39, 0.08);
  text-align: left;
  vertical-align: middle;
}

.gaw-table th {
  color: var(--text-subtle);
  font-weight: 600;
  white-space: nowrap;
}

.gaw-sub {
  font-size: 11px;
  color: var(--text-subtle);
  margin-top: 2px;
}

.gaw-badge-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.gaw-proj-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(79, 110, 247, 0.12);
  color: var(--primary);
  font-weight: 500;
}

.gaw-proj-badge--muted {
  background: rgba(15, 23, 42, 0.08);
  color: var(--text-subtle);
}

.gaw-mini-btn {
  border: 1px solid rgba(17, 24, 39, 0.12);
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 11px;
  background: #fff;
  cursor: pointer;
  margin-right: 4px;
}

.gaw-mini-btn--primary {
  background: var(--primary);
  color: #fff;
  border-color: transparent;
}

.gaw-pill {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
}

.gaw-pill--primary {
  background: rgba(79, 110, 247, 0.15);
  color: var(--primary);
}

.gaw-pill--success {
  background: rgba(34, 197, 94, 0.15);
  color: #15803d;
}

.gaw-pill--warning {
  background: rgba(245, 158, 11, 0.18);
  color: #b45309;
}

.gaw-pill--danger {
  background: rgba(239, 68, 68, 0.15);
  color: #b91c1c;
}

.gaw-pill--muted {
  background: rgba(15, 23, 42, 0.06);
  color: var(--text-subtle);
}

.gaw-grid-2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.gaw-chart {
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  height: 100px;
  gap: 8px;
}

.gaw-chart-bar {
  flex: 1;
  max-width: 48px;
  border-radius: 4px 4px 0 0;
  background: linear-gradient(180deg, var(--primary), rgba(79, 110, 247, 0.35));
}

.gaw-chart-axis {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 11px;
  color: var(--text-subtle);
}

.gaw-notice-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.gaw-notice {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(17, 24, 39, 0.06);
}

.gaw-notice:last-child {
  border-bottom: none;
}

.gaw-notice-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}

.gaw-notice-body {
  flex: 1;
  min-width: 0;
}

.gaw-notice-title {
  font-weight: 500;
  font-size: 13px;
}

.gaw-notice-sub {
  font-size: 11px;
  color: var(--text-subtle);
  margin-top: 2px;
}

.gaw-publish-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.gaw-publish-desc {
  font-size: 13px;
  color: var(--text-subtle);
  flex: 1;
  min-width: 0;
}

.gaw-code {
  font-size: 11px;
  background: var(--bg, #f8fafc);
  padding: 2px 6px;
  border-radius: 4px;
}

.gaw-spec {
  font-size: 12px;
  line-height: 1.65;
  color: var(--text-subtle);
}

.gaw-spec p {
  margin: 0 0 6px;
}

.gaw-spec-links {
  margin-top: 12px !important;
}

.gaw-link {
  padding: 0;
  border: none;
  background: none;
  color: var(--primary);
  font: inherit;
  cursor: pointer;
}

.gaw-spec-sep {
  margin: 0 6px;
  color: var(--text-subtle);
}

@media (max-width: 1100px) {
  .gaw-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .gaw-card-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .gaw-grid-2 {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .gaw-card-grid {
    grid-template-columns: 1fr;
  }

  .gaw-metrics {
    grid-template-columns: 1fr;
  }

  .gaw-toolbar-meta {
    width: 100%;
    margin-left: 0;
  }
}

.gaw-modal-tip {
  margin: 12px 0 4px;
  padding: 8px 12px;
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.04);
  font-size: 12px;
  color: var(--text-subtle);
  line-height: 1.5;
}

.gaw-modal-detail-hd {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 10px;
}

.gaw-modal-detail-icon {
  font-size: 26px;
  line-height: 1;
}

.gaw-modal-detail-titles {
  flex: 1;
  min-width: 0;
}

.gaw-modal-detail-name {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
}

.gaw-modal-detail-sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-subtle);
}

.gaw-modal-detail-pill {
  font-size: 10px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 999px;
  white-space: nowrap;
}

.gaw-modal-detail-pill--stable {
  background: rgba(34, 197, 94, 0.15);
  color: #15803d;
}

.gaw-modal-detail-pill--beta {
  background: rgba(245, 158, 11, 0.2);
  color: #b45309;
}

.gaw-modal-detail-desc {
  font-size: 13px;
  line-height: 1.55;
  color: var(--text-subtle);
  margin: 0 0 12px;
}

.gaw-modal-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.gaw-tool-tag--modal {
  font-size: 11px;
}

.gaw-modal-muted {
  font-size: 12px;
  color: var(--text-subtle);
  line-height: 1.55;
  margin: 0 0 10px;
}

.gaw-modal-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.gaw-modal-check {
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

.gaw-modal-list {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.65;
  color: var(--text-subtle);
}

.gaw-modal-approval {
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 13px;
  line-height: 1.8;
}

.gaw-modal-approval li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(17, 24, 39, 0.06);
}

.gaw-ap-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(245, 158, 11, 0.2);
  color: #b45309;
}

.gaw-ap-badge--ok {
  background: rgba(34, 197, 94, 0.15);
  color: #15803d;
}
</style>
