<script setup lang="ts">
import { computed, ref } from 'vue'

import PrototypeModal from '../../components/ui/PrototypeModal.vue'
import StatCard from '../../components/ui/StatCard.vue'

const searchQuery = ref('')
const stackFilter = ref('全部技术栈')
const typeFilter = ref('全部类型')
const sourceFilter = ref('全部来源')

const STACK_OPTIONS = [
  '全部技术栈',
  'Java / Spring',
  'JavaScript / React',
  'Node.js',
  'Python',
  'Go',
] as const
const TYPE_OPTIONS = ['全部类型', '后端服务', '前端应用', 'BFF 网关', '数据服务'] as const
const SOURCE_OPTIONS = ['全部来源', '官方内置', '自定义上传'] as const

interface TemplateCard {
  id: string
  icon: string
  name: string
  desc: string
  tags: string[]
  maintainer: string
  uses: string
  updated: string
  official: boolean
  version: string
  custom?: boolean
  stack: string
  kind: string
  source: '官方内置' | '自定义上传'
}

const TEMPLATES: TemplateCard[] = [
  {
    id: 't1',
    icon: '🍃',
    name: 'Spring Boot 微服务模板',
    desc: '含 SSO 对接、统一异常处理、日志规范、Swagger 文档、Docker 容器化、CI/CD Pipeline',
    tags: ['Spring Boot 3', 'MySQL', 'Redis', 'Docker'],
    maintainer: '平台团队',
    uses: '使用 42 次',
    updated: '更新 2026-03-10',
    official: true,
    version: 'v2.4',
    stack: 'Java / Spring',
    kind: '后端服务',
    source: '官方内置',
  },
  {
    id: 't2',
    icon: '⚛️',
    name: 'React + TypeScript 前端模板',
    desc: '含路由、状态管理、组件库、CI/CD、ESLint + Prettier、单元测试、E2E 测试',
    tags: ['React 18', 'Vite', 'Tailwind', 'Vitest'],
    maintainer: '平台团队',
    uses: '使用 38 次',
    updated: '更新 2026-03-18',
    official: true,
    version: 'v3.2',
    stack: 'JavaScript / React',
    kind: '前端应用',
    source: '官方内置',
  },
  {
    id: 't3',
    icon: '🟢',
    name: 'Node.js BFF 模板',
    desc: '含接口聚合、鉴权中间件、Redis 缓存、限流、Jest 测试、健康检查',
    tags: ['Node 20', 'Fastify', 'Redis'],
    maintainer: '平台团队',
    uses: '使用 25 次',
    updated: '更新 2026-02-28',
    official: true,
    version: 'v1.8',
    stack: 'Node.js',
    kind: 'BFF 网关',
    source: '官方内置',
  },
  {
    id: 't4',
    icon: '🐍',
    name: 'Python FastAPI 模板',
    desc: '含 FastAPI、数据处理管道、Celery 异步任务、Pytest、Alembic 数据库迁移',
    tags: ['Python 3.12', 'FastAPI', 'Celery'],
    maintainer: '平台团队',
    uses: '使用 18 次',
    updated: '更新 2026-03-05',
    official: true,
    version: 'v2.1',
    stack: 'Python',
    kind: '后端服务',
    source: '官方内置',
  },
  {
    id: 't5',
    icon: '🔷',
    name: 'Go 微服务模板',
    desc: '含 gRPC + REST 双协议、链路追踪、配置中心、优雅停机、Makefile',
    tags: ['Go 1.22', 'gRPC', 'Wire'],
    maintainer: '平台团队',
    uses: '使用 15 次',
    updated: '更新 2026-02-15',
    official: true,
    version: 'v1.5',
    stack: 'Go',
    kind: '后端服务',
    source: '官方内置',
  },
  {
    id: 't6',
    icon: '🛒',
    name: '电商后端服务模板',
    desc: '基于 Spring Boot 模板定制，预置电商领域模型、支付对接、库存扣减、消息队列',
    tags: ['Spring Boot 3', 'RocketMQ', 'ES'],
    maintainer: '张三',
    uses: '使用 8 次',
    updated: '更新 2026-03-12',
    official: false,
    version: 'v1.2',
    custom: true,
    stack: 'Java / Spring',
    kind: '后端服务',
    source: '自定义上传',
  },
  {
    id: 't7',
    icon: '📊',
    name: '数据管道服务模板',
    desc: '基于 Python 模板定制，预置 ETL 管道、数据质量校验、指标计算框架',
    tags: ['Python 3.12', 'Airflow', 'dbt'],
    maintainer: '李四',
    uses: '使用 5 次',
    updated: '更新 2026-03-01',
    official: false,
    version: 'v1.0',
    custom: true,
    stack: 'Python',
    kind: '数据服务',
    source: '自定义上传',
  },
]

const filteredTemplates = computed(() => {
  let list = TEMPLATES
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.desc.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q)),
    )
  }
  if (stackFilter.value !== '全部技术栈') {
    list = list.filter((t) => t.stack === stackFilter.value)
  }
  if (typeFilter.value !== '全部类型') {
    list = list.filter((t) => t.kind === typeFilter.value)
  }
  if (sourceFilter.value !== '全部来源') {
    list = list.filter((t) => t.source === sourceFilter.value)
  }
  return list
})

const uploadOpen = ref(false)
const detailOpen = ref(false)
const detailTemplate = ref<TemplateCard | null>(null)
const uploadSource = ref<'git' | 'zip'>('git')

function openUpload() {
  uploadOpen.value = true
}

function openTemplateDetail(t: TemplateCard) {
  detailTemplate.value = t
  detailOpen.value = true
}
</script>

<template>
  <section class="gtpl-workspace" data-testid="global-templates-workspace">
    <section class="gtpl-metrics">
      <StatCard icon="🗂️" label="模板总数" value="7" delta="5 官方 · 2 自定义" />
      <StatCard
        icon="🚀"
        label="本月使用"
        value="14"
        delta="↑ 40% 较上月"
        tone="primary"
        delta-tone="success"
      />
      <StatCard
        icon="⭐"
        label="最受欢迎"
        value="Spring Boot"
        delta="累计使用 42 次"
        tone="success"
        delta-tone="success"
      />
      <StatCard icon="🔄" label="最近更新" value="2 天前" delta="React 模板 v3.2" />
    </section>

    <div class="gtpl-toolbar">
      <input
        v-model="searchQuery"
        class="gtpl-search"
        type="search"
        placeholder="搜索模板名称 / 技术栈..."
        aria-label="搜索模板"
      />
      <select v-model="stackFilter" class="gtpl-select" aria-label="技术栈">
        <option v-for="o in STACK_OPTIONS" :key="o" :value="o">{{ o }}</option>
      </select>
      <select v-model="typeFilter" class="gtpl-select" aria-label="类型">
        <option v-for="o in TYPE_OPTIONS" :key="o" :value="o">{{ o }}</option>
      </select>
      <select v-model="sourceFilter" class="gtpl-select" aria-label="来源">
        <option v-for="o in SOURCE_OPTIONS" :key="o" :value="o">{{ o }}</option>
      </select>
      <div class="gtpl-toolbar-spacer" aria-hidden="true" />
      <button type="button" class="gtpl-btn gtpl-btn--primary" @click="openUpload">+ 上传自定义模板</button>
    </div>

    <div class="gtpl-grid">
      <button
        v-for="t in filteredTemplates"
        :key="t.id"
        type="button"
        class="gtpl-card"
        :class="{ 'gtpl-card--custom': t.custom }"
        @click="openTemplateDetail(t)"
      >
        <div class="gtpl-card-top">
          <span class="gtpl-card-icon" aria-hidden="true">{{ t.icon }}</span>
          <div class="gtpl-card-badges">
            <span class="gtpl-badge" :class="t.official ? 'gtpl-badge--official' : 'gtpl-badge--custom'">
              {{ t.official ? '官方' : '自定义' }}
            </span>
            <span class="gtpl-badge gtpl-badge--ver">{{ t.version }}</span>
          </div>
        </div>
        <div class="gtpl-card-name">{{ t.name }}</div>
        <p class="gtpl-card-desc">{{ t.desc }}</p>
        <div class="gtpl-tags">
          <span v-for="tag in t.tags" :key="tag" class="gtpl-tag">{{ tag }}</span>
        </div>
        <div class="gtpl-card-foot">
          <span>维护: {{ t.maintainer }}</span>
          <span>{{ t.uses }}</span>
          <span>{{ t.updated }}</span>
        </div>
      </button>
    </div>

    <PrototypeModal
      v-if="detailTemplate"
      v-model:open="detailOpen"
      max-width="640px"
      title-id="tpl-detail-title"
    >
      <template #default>
        <h2 id="tpl-detail-title" class="gtpl-modal-title">
          <span aria-hidden="true">{{ detailTemplate.icon }}</span>
          {{ detailTemplate.name }}
          <span class="gtpl-m-badge gtpl-m-badge--blue">{{ detailTemplate.official ? '官方' : '自定义' }}</span>
          <span class="gtpl-m-badge gtpl-m-badge--green">{{ detailTemplate.version }}</span>
        </h2>
        <p class="gtpl-modal-sub">{{ detailTemplate.desc }}</p>

        <div class="gtpl-m-grid">
          <div>
            <div class="gtpl-m-sec">📦 模板包含组件</div>
            <div class="gtpl-m-box">
              技术栈：{{ detailTemplate.stack }} · {{ detailTemplate.kind }}<br />
              标签：{{ detailTemplate.tags.join('、') }}<br />
              来源：{{ detailTemplate.source }} · 维护 {{ detailTemplate.maintainer }}
            </div>
          </div>
          <div>
            <div class="gtpl-m-sec">🔧 内置工程配置</div>
            <div class="gtpl-m-box">
              ✅ CI Pipeline（编译 → 测试 → 扫描 → 构建）<br />
              ✅ CD Pipeline（环境策略与审批）<br />
              ✅ 代码规范与质量门禁<br />
              ✅ 单测 / 覆盖率与部署模板
            </div>
          </div>
        </div>

        <div class="gtpl-m-sec">📁 目录结构预览</div>
        <pre class="pm-codeblock gtpl-m-tree">your-service/
├── src/
│   ├── config/
│   ├── controller/
│   └── service/
├── Dockerfile
└── README.md</pre>

        <div class="gtpl-m-meta4">
          <div><span>维护者</span><strong>{{ detailTemplate.maintainer }}</strong></div>
          <div><span>累计使用</span><strong>{{ detailTemplate.uses.replace('使用 ', '') }}</strong></div>
          <div><span>最近更新</span><strong>{{ detailTemplate.updated.replace('更新 ', '') }}</strong></div>
          <div><span>版本</span><strong>{{ detailTemplate.version }}</strong></div>
        </div>
      </template>
      <template #footer>
        <button type="button" class="pm-btn" @click="detailOpen = false">关闭</button>
        <button type="button" class="pm-btn">✏️ 编辑模板</button>
        <button type="button" class="pm-btn pm-btn--primary">🚀 使用此模板创建服务</button>
      </template>
    </PrototypeModal>

    <PrototypeModal
      v-model:open="uploadOpen"
      title="上传自定义模板"
      description="将已有项目骨架注册为公司标准模板，供其他项目复用。"
      max-width="540px"
    >
      <div class="pm-field">
        <span class="pm-label">模板来源</span>
        <div class="gtpl-src-toggle">
          <button
            type="button"
            class="gtpl-src-btn"
            :class="{ 'gtpl-src-btn--on': uploadSource === 'git' }"
            @click="uploadSource = 'git'"
          >
            🔗 从 Git 仓库导入
          </button>
          <button
            type="button"
            class="gtpl-src-btn"
            :class="{ 'gtpl-src-btn--on': uploadSource === 'zip' }"
            @click="uploadSource = 'zip'"
          >
            📂 上传 ZIP 文件
          </button>
        </div>
      </div>
      <div v-if="uploadSource === 'git'" class="pm-field">
        <span class="pm-label">源仓库地址</span>
        <input class="pm-input pm-mono" placeholder="https://github.com/your-org/your-template" />
      </div>
      <div v-if="uploadSource === 'git'" class="pm-field">
        <span class="pm-label">分支</span>
        <input class="pm-input" value="main" />
      </div>
      <div v-else class="pm-field">
        <span class="pm-label">上传 ZIP 文件</span>
        <div class="gtpl-zip-zone" role="button" tabindex="0">点击选择或拖拽 ZIP 到此处（演示）</div>
      </div>
      <div class="pm-grid2">
        <div class="pm-field">
          <span class="pm-label">模板名称</span>
          <input class="pm-input" placeholder="例如：电商后端服务模板" />
        </div>
        <div class="pm-field">
          <span class="pm-label">图标</span>
          <select class="pm-select">
            <option>🍃 Spring</option>
            <option>⚛️ React</option>
            <option>🟢 Node</option>
          </select>
        </div>
      </div>
      <div class="pm-field">
        <span class="pm-label">模板描述</span>
        <textarea class="pm-textarea" rows="2" placeholder="用途、场景与核心组件" />
      </div>
      <div class="pm-field">
        <span class="pm-label">技术标签</span>
        <input class="pm-input" placeholder="逗号分隔，例如: Spring Boot 3, MySQL" />
      </div>
      <div class="pm-field">
        <span class="pm-label">类型</span>
        <select class="pm-select">
          <option>后端服务</option>
          <option>前端应用</option>
          <option>BFF 网关</option>
        </select>
      </div>
      <div class="gtpl-upload-tip" role="note">
        <strong>提示：</strong>系统将扫描仓库识别技术栈、CI 与 Dockerfile，并在详情页展示目录结构。
      </div>
      <template #footer>
        <button type="button" class="pm-btn" @click="uploadOpen = false">取消</button>
        <button type="button" class="pm-btn pm-btn--primary" @click="uploadOpen = false">导入并发布</button>
      </template>
    </PrototypeModal>
  </section>
</template>

<style scoped>
.gtpl-workspace {
  min-width: 0;
}

.gtpl-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.gtpl-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.gtpl-toolbar-spacer {
  flex: 1 1 auto;
  min-width: 8px;
  height: 1px;
}

.gtpl-search {
  max-width: 260px;
  min-width: 140px;
  flex: 0 1 260px;
  font: inherit;
  border: 1px solid rgba(17, 24, 39, 0.12);
  border-radius: 10px;
  padding: 8px 12px;
  background: #fff;
}

.gtpl-select {
  font: inherit;
  font-size: 12px;
  border: 1px solid rgba(17, 24, 39, 0.12);
  border-radius: 8px;
  padding: 6px 10px;
  background: #fff;
}

.gtpl-btn {
  border: 1px solid rgba(17, 24, 39, 0.12);
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 500;
  background: #fff;
  cursor: pointer;
}

.gtpl-btn--primary {
  background: linear-gradient(135deg, #4f6ef7 0%, #5d7bff 100%);
  color: #fff;
  border-color: transparent;
}

.gtpl-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.gtpl-card {
  display: block;
  width: 100%;
  text-align: left;
  font: inherit;
  border: 1px solid var(--card-border);
  border-radius: 16px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: var(--shadow-soft, 0 1px 3px rgba(15, 23, 42, 0.06));
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.gtpl-card:hover {
  border-color: rgba(79, 110, 247, 0.35);
}

.gtpl-card--custom {
  border-left: 3px solid var(--warning);
}

.gtpl-card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 10px;
}

.gtpl-card-icon {
  font-size: 28px;
  line-height: 1;
}

.gtpl-card-badges {
  display: flex;
  gap: 4px;
}

.gtpl-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.gtpl-badge--official {
  background: rgba(79, 110, 247, 0.12);
  color: var(--primary);
}

.gtpl-badge--custom {
  background: rgba(245, 158, 11, 0.2);
  color: #b45309;
}

.gtpl-badge--ver {
  background: rgba(34, 197, 94, 0.15);
  color: #15803d;
}

.gtpl-card-name {
  font-weight: 700;
  font-size: 14px;
  margin-bottom: 4px;
}

.gtpl-card-desc {
  margin: 0 0 10px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-subtle);
}

.gtpl-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.gtpl-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.05);
  color: var(--text-subtle);
}

.gtpl-card-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 11px;
  color: var(--text-subtle);
  border-top: 1px solid var(--card-border);
  padding-top: 8px;
}

@media (max-width: 1100px) {
  .gtpl-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .gtpl-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .gtpl-metrics {
    grid-template-columns: 1fr;
  }

  .gtpl-grid {
    grid-template-columns: 1fr;
  }

  .gtpl-toolbar-spacer {
    display: none;
  }
}
</style>
