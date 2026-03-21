/**
 * Top bar titles aligned with HTML prototype (`assets/js/app.js` showPage / showProjectPage).
 */
export const GLOBAL_PAGE_TITLES: Record<string, string> = {
  dashboard: '工作台',
  efficiency: '用量看板',
  'my-credential': '我的凭证',
  'my-ability': '我的能力',
  'my-usage': '我的用量',
  projects: '项目空间',
  mcp: 'MCP 接入',
  incidents: '事故中心',
  cicd: 'CI / CD',
  envs: '环境管理',
  atomic: '原子能力中心',
  knowledge: '全局知识库',
  skills: '全局技能库',
  templates: '代码模板库',
  'global-tools': '全局工具集',
  integrations: '集成市场',
  staff: '员工管理',
  keys: '凭证管理',
  permissions: '权限管理',
  audit: '审计安全',
  settings: '设置',
  workflows: 'Agent 工作流',
  functions: '工具注册中心',
  'ai-monitor': 'AI 执行监控',
  evals: 'AI 评估中心',
}

/** Project inner nav (`projPageTitles` in prototype). */
export const PROJECT_SECTION_TITLES: Record<string, string> = {
  overview: '概览',
  knowledge: '知识库',
  incidents: '事故与告警',
  services: '代码服务',
  members: '成员权限',
  'ai-cap': 'AI 能力',
  projtools: '工具白名单',
  keymanagement: '配额管理',
  psettings: '项目设置',
  workspace: '接入与凭证',
  agile: '研发流程',
  skillconfig: 'Skill 配置',
}
