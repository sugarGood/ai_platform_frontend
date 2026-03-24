import type { ModulePageConfig, TableCell } from '../types/module-page'

function cell(text: string, tone?: TableCell['tone'], mono = false): TableCell {
  return { text, tone, mono }
}

/**
 * Global pages that exist in HTML prototype sidebar but were not in GlobalModulePage yet.
 */
export const prototypeGlobalPagesExtra: Record<string, ModulePageConfig> = {
  'my-ability': {
    sections: [
      {
        type: 'hero',
        eyebrow: 'Injected',
        title: '我的能力',
        description:
          '以下能力由平台自动注入到 Claude Code / Cursor 等客户端，无需手动配置；请求时会按项目与全局策略自动挂载知识库与工具。',
        actions: [{ label: '去我的凭证', variant: 'primary' }],
      },
      {
        type: 'catalog-grid',
        columns: 3,
        items: [
          {
            icon: '📚',
            title: '可用知识库',
            subtitle: '全局 + 项目继承',
            badge: '自动检索',
            tone: 'success',
            description: '检索范围随当前项目上下文自动切换，支持混合召回与引用溯源。',
          },
          {
            icon: '🔩',
            title: '已注册工具',
            subtitle: 'MCP / Function',
            badge: '按权限暴露',
            tone: 'primary',
            description: '高风险工具走审批链；调用会写入审计与 Token 计量。',
          },
          {
            icon: '⚡',
            title: '已启用 Skill',
            subtitle: 'IDE 侧技能包',
            badge: '灰度中',
            tone: 'warning',
            description: '平台发布的 Skill 与项目定制 Skill 合并展示，可按角色裁剪。',
          },
        ],
      },
    ],
  },
  'my-usage': {
    sections: [
      {
        type: 'hero',
        eyebrow: 'Quota',
        title: '我的用量',
        description:
          '双维度配额：个人上限（跨项目合计）与各项目 Token 池并行约束；超额时按策略降级模型或阻断高风险工具。',
        actions: [{ label: '导出个人用量', variant: 'primary' }],
      },
      {
        type: 'metrics',
        items: [
          { id: 'u1', icon: '🪙', label: '本月已用', value: '186K', delta: '↑ 12% 较上月', tone: 'primary' },
          { id: 'u2', icon: '📊', label: '个人剩余', value: '314K', delta: '配额 500K / 月', tone: 'success' },
          { id: 'u3', icon: '🏢', label: '项目池占用', value: '68%', delta: '支付网关项目最高', tone: 'warning' },
          { id: 'u4', icon: '⚡', label: '峰值 QPS', value: '12', delta: '发生在 Code Review 场景', tone: 'primary' },
        ],
      },
      {
        type: 'progress',
        title: '配额健康度',
        items: [
          { label: '个人配额使用', value: '37%', progress: 37, tone: 'success', hint: '低于 80% 预警线' },
          { label: '项目池使用', value: '68%', progress: 68, tone: 'warning', hint: '接近部门默认阈值' },
        ],
      },
    ],
  },
  'global-tools': {
    sections: [
      {
        type: 'hero',
        eyebrow: 'Tools',
        title: '全局工具集',
        description: '企业级工具目录：统一注册、权限、观测与版本治理，供 Agent 与工作流复用。',
        actions: [{ label: '注册工具', variant: 'primary' }],
      },
      {
        type: 'table',
        title: '工具清单（示例）',
        table: {
          columns: ['工具', '类型', '风险', '状态', '最近调用'],
          rows: [
            [cell('search_codebase', 'default', true), cell('检索'), cell('低', 'success'), cell('已发布', 'success'), cell('2 分钟前')],
            [cell('trigger_deploy', 'default', true), cell('交付'), cell('高', 'danger'), cell('需审批', 'warning'), cell('15 分钟前')],
            [cell('create_incident', 'default', true), cell('运维'), cell('中', 'warning'), cell('已发布', 'success'), cell('1 小时前')],
          ],
        },
      },
    ],
  },
  integrations: {
    sections: [
      {
        type: 'hero',
        eyebrow: 'Marketplace',
        title: '集成市场',
        description: '浏览第三方集成与官方连接器，一键启用到项目或全局范围。',
        actions: [{ label: '提交集成', variant: 'primary' }],
      },
      {
        type: 'catalog-grid',
        columns: 3,
        items: [
          { icon: '🦊', title: 'GitLab', subtitle: 'CI 事件 → Agent', badge: '官方', tone: 'success', description: '流水线状态回传中台，触发审查与发布助手。' },
          { icon: '💬', title: '飞书', subtitle: '通知与审批', badge: '官方', tone: 'primary', description: '告警、配额、审批卡片直达群聊。' },
          { icon: '☁️', title: '云厂商 KMS', subtitle: '密钥托管', badge: '企业', tone: 'warning', description: '上游 Key 不落盘，按项目绑定解密策略。' },
        ],
      },
    ],
  },
  permissions: {
    sections: [
      {
        type: 'hero',
        eyebrow: 'Governance',
        title: '权限管理',
        description: '平台角色、项目角色与权限点矩阵；支持变更预览与审计追踪。',
        actions: [{ label: '新建权限点', variant: 'primary' }],
      },
      {
        type: 'list-grid',
        columns: 2,
        cards: [
          {
            title: '平台角色',
            items: [
              { title: '超级管理员', meta: '全量配置 + 安全策略', badge: 'P0', tone: 'danger' },
              { title: '安全审计员', meta: '只读 + 导出审计', badge: 'P1', tone: 'primary' },
            ],
          },
          {
            title: '近期变更',
            items: [
              { title: '调整「支付网关」项目模板权限', meta: '由张三发起 · 待审批', badge: '审批中', tone: 'warning' },
              { title: '新增权限点 deploy:prod', meta: '已同步矩阵', badge: '完成', tone: 'success' },
            ],
          },
        ],
      },
    ],
  },
  mcp: {
    sections: [
      {
        type: 'hero',
        eyebrow: 'MCP',
        title: 'MCP 接入',
        description: '为项目生成 MCP Server、管理暴露工具集合与健康状态；与代码服务、凭证策略联动。',
        actions: [{ label: '接入新项目', variant: 'primary' }, { label: '查看规范' }],
      },
      {
        type: 'metrics',
        items: [
          { id: 'm1', icon: '🔌', label: '已接入项目', value: '8', delta: '本周 +1', tone: 'primary' },
          { id: 'm2', icon: '🛰️', label: '在线 Server', value: '7', delta: '1 个滚动升级中', tone: 'success' },
          { id: 'm3', icon: '🧰', label: '暴露工具总数', value: '42', delta: '按最小权限收敛', tone: 'primary' },
          { id: 'm4', icon: '⚠️', label: '待处理告警', value: '1', delta: '证书 30 天内到期', tone: 'warning' },
        ],
      },
    ],
  },
}
