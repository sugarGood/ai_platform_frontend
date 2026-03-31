import type { ModuleSection, TableCell } from '../types/module-page'

function cell(text: string, tone?: TableCell['tone'], mono = false): TableCell {
  return { text, tone, mono }
}

export interface WorkspaceModuleSectionsArgs {
  /** 左侧凭证副标题，如「凭证有效期至 … · 角色：…」 */
  credentialSubtitle: string
  /** 凭证脱敏展示（如 keyPrefix） */
  credentialCodeDisplay: string
  /** 凭证卡片角标 */
  credentialBadge: string
  knowledgeCountLabel: string
  skillCountLabel: string
  toolCountLabel: string
  integrationCountLabel: string
  projectMcpUrl: string
  globalMcpUrl: string
  proxyUrl: string
  /** mcpServers 配置名，如 platform-项目名 */
  platformMcpKey: string
  /** 成员表行（含表头约定列） */
  memberRows: TableCell[][]
  /** 无成员时的占位 */
  emptyMemberMessage?: string
}

/**
 * 项目「接入与凭证」页模块段落（与 HTML 原型结构一致，数据由调用方注入）。
 */
export function buildWorkspaceModuleSections(a: WorkspaceModuleSectionsArgs): ModuleSection[] {
  const memberRows =
    a.memberRows.length > 0
      ? a.memberRows
      : [
          [
            cell(a.emptyMemberMessage ?? '暂无项目成员', 'muted'),
            cell('—'),
            cell('—'),
            cell('—'),
            cell('—'),
            cell('—'),
            cell('—'),
          ],
        ]

  return [
    {
      type: 'callout',
      emphasis: '你的平台凭证已自动获得本项目访问权限。',
      body: '无需生成新凭证，使用已有凭证即可访问本项目的知识库、技能和工具。',
    },
    {
      type: 'split',
      columns: 2,
      items: [
        {
          title: '🪪 我的凭证 × 本项目',
          subtitle: a.credentialSubtitle,
          badge: a.credentialBadge,
          panelTone: 'success',
          code: a.credentialCodeDisplay,
          codeActions: [{ label: '📋 复制' }],
          tagsLabel: '本项目可用能力：',
          tags: [
            { text: `📚 知识库 ${a.knowledgeCountLabel}`, tone: 'primary' },
            { text: `⚡ 技能 ${a.skillCountLabel}`, tone: 'primary' },
            { text: `🔩 工具 ${a.toolCountLabel}`, tone: 'primary' },
            { text: `🔌 集成 ${a.integrationCountLabel}`, tone: 'primary' },
          ],
        },
        {
          title: '🔌 本项目 MCP 端点',
          headerActions: [{ label: '🧪 测试' }],
          lines: [
            { label: '项目专属端点', value: a.projectMcpUrl, mono: true },
            { label: '全局端点（自动继承）', value: a.globalMcpUrl, mono: true },
            { label: '代理 API 端点', value: a.proxyUrl, mono: true },
          ],
        },
      ],
    },
    {
      type: 'code',
      title: '📖 本项目接入指南',
      description: '如果你已完成平台接入（有环境变量和 API Key），只需添加本项目 MCP 端点：',
      code: `// 在 ~/.claude/settings.json 的 mcpServers 中添加：
"${a.platformMcpKey}": {
  "url": "${a.projectMcpUrl}",
  "headers": { "Authorization": "Bearer ${a.credentialCodeDisplay}..." }
}`,
      actions: [{ label: '⚡ 生成一键安装命令', variant: 'primary' }],
      footerNote: {
        content:
          '✅ 添加后，你在本项目代码目录下使用 AI 工具时，将自动获得本项目的知识库、技能和工具。',
        tone: 'success',
      },
    },
    {
      type: 'table',
      title: '👥 项目成员接入状态',
      actions: [{ label: '📧 批量发送接入指南' }, { label: '🔍 批量检测' }],
      table: {
        columns: ['成员', '用户 ID', '角色', '凭证状态', '加入时间', '操作'],
        rows: memberRows,
      },
    },
  ]
}
