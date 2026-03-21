import type { NavGroup } from '../types/navigation'

/**
 * 全局侧边栏 — 与 `ai-platform-prototype.html` 侧栏分组、文案、图标对齐。
 * 完整 HTML 原型见路由 `/prototype`（`public/prototype`）。
 */
export const globalNavGroups: NavGroup[] = [
  {
    label: '我的工作台',
    items: [
      { key: 'dashboard', label: '工作台', icon: '📊', to: '/dashboard' },
      { key: 'my-credential', label: '我的凭证', icon: '🪪', to: '/placeholder/my-credential' },
      { key: 'my-ability', label: '我的能力', icon: '🧩', to: '/placeholder/my-ability' },
      { key: 'my-usage', label: '我的用量', icon: '📈', to: '/placeholder/my-usage' },
    ],
  },
  {
    label: '项目',
    items: [{ key: 'projects', label: '项目空间', icon: '📁', to: '/projects' }],
  },
  {
    label: '平台 AI 能力',
    items: [
      { key: 'knowledge', label: '全局知识库', icon: '📚', to: '/placeholder/knowledge' },
      { key: 'skills', label: '全局技能库', icon: '⚡', to: '/placeholder/skills' },
      { key: 'global-tools', label: '全局工具集', icon: '🔩', to: '/placeholder/global-tools' },
      { key: 'integrations', label: '集成市场', icon: '🔌', to: '/placeholder/integrations' },
      { key: 'atomic', label: '原子能力中心', icon: '⚛️', to: '/placeholder/atomic' },
      { key: 'templates', label: '代码模板库', icon: '🗂️', to: '/placeholder/templates' },
    ],
  },
  {
    label: '平台管理',
    items: [
      { key: 'staff', label: '员工管理', icon: '👥', to: '/placeholder/staff' },
      { key: 'keys', label: '凭证管理', icon: '🔑', to: '/placeholder/keys' },
      { key: 'efficiency', label: '用量看板', icon: '📊', to: '/placeholder/efficiency' },
      { key: 'permissions', label: '权限管理', icon: '🔐', to: '/placeholder/permissions' },
      { key: 'audit', label: '审计安全', icon: '🛡️', to: '/placeholder/audit' },
      { key: 'settings', label: '设置', icon: '⚙️', to: '/placeholder/settings' },
    ],
  },
]

/**
 * 项目侧栏 — 与原型 `#sidebar-project` 一致（含 AI 工作区 / 工程 / 运维 / 配置）。
 */
export const projectNavGroups: NavGroup[] = [
  {
    label: '项目概览',
    items: [{ key: 'overview', label: '概览', icon: '📊', to: 'overview' }],
  },
  {
    label: 'AI 工作区',
    items: [
      { key: 'workspace', label: '接入与凭证', icon: '🚀', to: 'workspace' },
      { key: 'ai-cap', label: 'AI 能力配置', icon: '🤖', to: 'ai-cap' },
      { key: 'keymanagement', label: '配额管理', icon: '📊', to: 'keymanagement' },
    ],
  },
  {
    label: '工程',
    items: [{ key: 'services', label: '代码服务', icon: '⚙️', to: 'services', badge: '3' }],
  },
  {
    label: '运维',
    items: [{ key: 'incidents', label: '事故与告警', icon: '🚨', to: 'incidents', badge: '1' }],
  },
  {
    label: '配置',
    items: [
      { key: 'members', label: '成员权限', icon: '👥', to: 'members' },
      { key: 'psettings', label: '项目设置', icon: '⚙️', to: 'psettings' },
    ],
  },
]
