import type { ProjectTokenDashboardBundle } from './token-dashboard'

export type Tone = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'muted'

export interface PageAction {
  label: string
  variant?: 'primary' | 'secondary'
}

export interface PageMetric {
  id: string
  icon: string
  label: string
  value: string
  delta: string
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger'
  /** 副标题：成功色（↑ 环比）或警示色（需处理类文案） */
  deltaTone?: 'default' | 'success' | 'danger'
}

export interface InfoLine {
  label: string
  value: string
  tone?: Tone
  mono?: boolean
}

export interface ListItem {
  title: string
  meta?: string
  description?: string
  badge?: string
  tone?: Tone
  progress?: number
}

export interface CatalogItem {
  title: string
  subtitle?: string
  icon?: string
  badge?: string
  tone?: Tone
  lines?: InfoLine[]
  description?: string
  cta?: string
  to?: string
}

export interface NoteItem {
  label?: string
  content: string
  tone?: Tone
}

export interface ProgressItem {
  label: string
  value: string
  progress: number
  tone?: Tone
  hint?: string
}

export interface TableCell {
  text: string
  tone?: Tone
  mono?: boolean
  /** `tag`：圆角状态标签（如 Ant Design Tag），默认普通文本 */
  display?: 'text' | 'tag'
  /** 若设置，单元格渲染为 `RouterLink`（如知识库名称进入文档页） */
  to?: string
}

export interface TableData {
  columns: string[]
  rows: TableCell[][]
}

export interface KanbanColumn {
  title: string
  badge?: string
  tone?: Tone
  items: ListItem[]
}

export interface KnowledgeOverviewRow {
  name: string
  category: TableCell
  chunks: string
  hitCount: string
  linkedProjects: string
  injectMode: TableCell
  updatedAt: string
  status?: TableCell
  actions?: string[]
}

export interface WorkspaceTag {
  text: string
  tone?: Tone
}

/** 项目侧「继承自企业全局知识库」列表项（与 `knowledge-sources?source=global` 对齐） */
export interface ProjectInheritedGlobalKbItem {
  kbId: number
  /** 解绑用：`DELETE .../knowledge-configs/{id}`；缺省时不可取消继承 / 改注入 */
  projectKnowledgeConfigId?: number
  name: string
  description: string
  /** 当前注入方式（如 `AUTO_INJECT`），用于下拉展示 */
  injectMode?: string | null
  /** 仅原型静态行使用 */
  tailAction?: 'inject' | 'disable'
}

/** 与原型「AI 能力配置」页一致：多 Tab + 知识/技能/工具/集成 */
export interface AiCapacitySection {
  type: 'ai-capacity'
  projectName: string
  /** 路由参数中的项目 id，用于拼「进入知识库」链接 */
  projectId?: string
  /** 后端拉取的全局继承项；`undefined` 表示尚未加载（数字 id 项目） */
  inheritedGlobalKbs?: ProjectInheritedGlobalKbItem[]
  knowledgeTable?: TableData
  skillTable?: TableData
  toolTable?: TableData
}

/** 与原型「配额管理」页一致：说明 + 指标 + 项目配额表单 + 成员配额表 */
export interface QuotaManagementSection {
  type: 'quota-management'
  metrics: PageMetric[]
  memberQuotaTable: TableData
  projectId?: string
  tokenDashboard?: ProjectTokenDashboardBundle | null
}

/** 与原型「代码服务」列表页一致：条数提示 + 服务卡片 + 添加方式卡片 */
export interface ServicesPrototypeSection {
  type: 'services-prototype'
  serviceCount: number
  items: CatalogItem[]
}

/** 事故卡片展示模型（可由 `GET /projects/{id}/incidents` 映射而来） */
export interface ProjectIncidentCardModel {
  title: string
  severityBadge: string
  severityIsDanger: boolean
  statusLabel: string
  errorStack: string
  aiBlock: string
  showIdeCta: boolean
}

/** 与原型「事故与告警」一致：单条严重事故 + AI 诊断 */
export interface IncidentFocusSection {
  type: 'incident-focus'
  /** 有数据时展示接口事故；无则回退原型静态文案 */
  incident?: ProjectIncidentCardModel | null
  emptyHint?: string
}

/** 与原型「项目设置」一致：基础信息表单卡片 + 研发配置卡片 */
export interface ProjectSettingsFormsSection {
  type: 'project-settings-forms'
  projectId: string
  name: string
  typeLabel: string
  description: string
  tokenLabel: string
}

export type ModuleSection =
  | {
      type: 'callout'
      emphasis: string
      body: string
    }
  | {
      type: 'hero'
      eyebrow?: string
      title?: string
      description: string
      actions?: PageAction[]
    }
  | {
      type: 'metrics'
      items: PageMetric[]
    }
  | {
      type: 'list-grid'
      columns?: 1 | 2 | 3
      cards: {
        title: string
        badge?: string
        items: ListItem[]
        note?: NoteItem
      }[]
    }
  | {
      type: 'catalog-grid'
      columns?: 1 | 2 | 3
      title?: string
      items: CatalogItem[]
    }
  | {
      type: 'table'
      title: string
      badge?: string
      actions?: PageAction[]
      table: TableData
      note?: string
    }
  | {
      type: 'progress'
      title: string
      badge?: string
      items: ProgressItem[]
      note?: NoteItem
    }
  | {
      type: 'notes'
      title: string
      badge?: string
      notes: NoteItem[]
    }
  | {
      type: 'code'
      title: string
      badge?: string
      description?: string
      code: string
      actions?: PageAction[]
      footerNote?: NoteItem
    }
  | {
      type: 'kanban'
      title: string
      columns: KanbanColumn[]
    }
  | {
      type: 'split'
      columns?: 2 | 3
      items: Array<{
        title: string
        badge?: string
        subtitle?: string
        panelTone?: 'default' | 'success'
        lines?: InfoLine[]
        notes?: NoteItem[]
        list?: ListItem[]
        code?: string
        codeActions?: PageAction[]
        tags?: WorkspaceTag[]
        tagsLabel?: string
        headerActions?: PageAction[]
        actions?: PageAction[]
      }>
    }
  | {
      type: 'knowledge-overview'
      title: string
      metrics: PageMetric[]
      searchPlaceholder: string
      categoryOptions: string[]
      quickActionLabel: string
      refreshLabel: string
      actions?: PageAction[]
      table: {
        columns: string[]
        rows: KnowledgeOverviewRow[]
      }
    }
  | AiCapacitySection
  | QuotaManagementSection
  | ServicesPrototypeSection
  | IncidentFocusSection
  | ProjectSettingsFormsSection

export interface ModulePageConfig {
  sections: ModuleSection[]
}
