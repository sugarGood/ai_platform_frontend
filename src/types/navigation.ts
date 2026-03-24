export type RouteScope = 'global' | 'project'

export interface NavItem {
  key: string
  label: string
  icon: string
  to: string
  badge?: string
  /** 右侧主色胶囊标签（如乐知助手的「AI」） */
  pill?: string
  /** 侧栏高亮样式变体 */
  accent?: 'lezhi'
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export interface PlaceholderContent {
  title: string
  description: string
  highlights: string[]
}
