import { buildWorkspaceModuleSections } from './workspace-module-sections'
import type { PlatformCredentialResponse } from '../types/credentials'
import type { ModuleSection } from '../types/module-page'
import type { BackendProjectMemberResponse } from '../types/project'
import type { UserResponse } from '../types/user'
import type { McpServer, ProjectMcpIntegration } from '../types/mcp'

import { listPlatformCredentialsByUser } from '../services/platform-credentials'
import { listProjectMembers } from '../services/projects'
import { listUsers } from '../services/users'
import { listProjectMcpIntegrations, listMcpServers } from '../services/mcp'

export interface LoadProjectWorkspaceOptions {
  projectId: number
  projectName: string
  projectCode: string
  currentUserId: number
  roleLabel: string
  knowledgeCount: number
  skillCount: number
  toolCount: number
}

function pickCredential(creds: PlatformCredentialResponse[]): PlatformCredentialResponse | undefined {
  if (!creds.length) return undefined
  const active = creds.find((c) => String(c.status).toUpperCase() === 'ACTIVE')
  return active ?? creds[0]
}

function formatDateHint(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = String(iso)
  return d.length >= 10 ? d.slice(0, 10) : d
}

function credentialSubtitle(cred: PlatformCredentialResponse | undefined, roleLabel: string): string {
  const exp = cred?.expiresAt ? `凭证有效期至 ${formatDateHint(cred.expiresAt)}` : '凭证未设置过期时间'
  return `${exp} · 角色：${roleLabel}`
}

function credentialBadge(cred: PlatformCredentialResponse | undefined): string {
  if (!cred) return '⚠️ 未创建凭证'
  const s = String(cred.status).toUpperCase()
  if (s === 'ACTIVE') return '✅ 已授权'
  if (s === 'REVOKED' || s === 'DISABLED') return '⛔ 已失效'
  return `状态：${cred.status}`
}

function resolveProjectMcpUrl(
  integrations: ProjectMcpIntegration[],
  serverById: Map<number, McpServer>,
): string {
  for (const it of integrations) {
    const s = serverById.get(it.mcpServerId)
    const u = s?.serverUrl?.trim()
    if (u) return u
  }
  return '（尚未绑定项目 MCP：请在「MCP 集成」中为本项目关联 MCP Server）'
}

function resolveGlobalMcpUrl(servers: McpServer[]): string {
  const global = servers.find((s) => (s.projectId == null || s.projectId === 0) && s.serverUrl?.trim())
  const u = global?.serverUrl?.trim()
  if (u) return u
  const anyUrl = servers.find((s) => s.serverUrl?.trim())?.serverUrl?.trim()
  return anyUrl ?? '（未从平台拉取到全局 MCP 端点）'
}

function defaultProxyUrl(): string {
  const v = import.meta.env.VITE_AI_PROXY_URL?.trim()
  if (v) return v
  const apiBase = import.meta.env.VITE_API_BASE_URL?.trim() || '/api'
  if (apiBase.startsWith('http')) {
    try {
      return `${new URL(apiBase).origin}/api/proxy/anthropic`
    } catch {
      /* fall through */
    }
  }
  if (typeof window !== 'undefined') {
    const prefix = apiBase.startsWith('/') ? apiBase : `/${apiBase}`
    return `${window.location.origin}${prefix}/proxy/anthropic`
  }
  return `${apiBase.replace(/\/$/, '')}/proxy/anthropic`
}

function memberLabel(u: UserResponse | undefined, userId: number): string {
  if (!u) return `用户 #${userId}`
  return u.fullName?.trim() || u.username?.trim() || u.email?.trim() || `用户 #${userId}`
}

function rowForMember(
  m: BackendProjectMemberResponse,
  currentUserId: number,
  cred: PlatformCredentialResponse | undefined,
  userById: Map<number, UserResponse>,
): import('../types/module-page').TableCell[] {
  const u = userById.get(m.userId)
  const name = memberLabel(u, m.userId)
  const isSelf = m.userId === currentUserId

  let credStatus = '—'
  let credTone: import('../types/module-page').TableCell['tone'] = 'muted'
  let accessStatus = '—'
  let accessTone: import('../types/module-page').TableCell['tone'] = 'muted'
  let last = formatDateHint(m.joinedAt)

  if (isSelf && cred) {
    const s = String(cred.status).toUpperCase()
    credStatus = s === 'ACTIVE' ? '有效' : cred.status
    credTone = s === 'ACTIVE' ? 'success' : 'warning'
    accessStatus = cred.lastUsedAt ? '✅ 已接入' : '📦 未接入'
    accessTone = cred.lastUsedAt ? 'success' : 'muted'
    last = formatDateHint(cred.lastUsedAt) !== '—' ? formatDateHint(cred.lastUsedAt) : formatDateHint(m.joinedAt)
  }

  return [
    { text: name },
    { text: m.role || '—' },
    { text: credStatus, tone: credTone },
    { text: accessStatus, tone: accessTone },
    { text: last },
    { text: '详情' },
  ]
}

/**
 * 并行请求 OpenAPI 文档中的凭证 / 成员 / MCP 集成 / MCP Server 列表，并组装「接入与凭证」模块段落。
 *
 * 依据：`_api_docs.json` — `GET /api/credentials`、`GET /api/projects/{id}/members`、
 * `GET /api/projects/{id}/mcp-integrations`、`GET /api/mcp-servers`。
 */
export async function loadProjectWorkspaceModuleSections(o: LoadProjectWorkspaceOptions): Promise<ModuleSection[]> {
  const [credentials, members, users, integrations, servers] = await Promise.all([
    listPlatformCredentialsByUser(o.currentUserId),
    listProjectMembers(o.projectId),
    listUsers().catch(() => [] as UserResponse[]),
    listProjectMcpIntegrations(o.projectId),
    listMcpServers(),
  ])

  const userById = new Map(users.map((u) => [u.id, u]))
  const serverById = new Map(servers.map((s) => [s.id, s]))

  const cred = pickCredential(credentials)
  const keyDisplay = cred?.keyPrefix?.trim() || '（无 key 前缀，请创建或轮换凭证）'

  const projectUrl = resolveProjectMcpUrl(integrations, serverById)
  const globalUrl = resolveGlobalMcpUrl(servers)
  const proxyUrl = defaultProxyUrl()

  const platformKey = `platform-${o.projectName.replace(/"/g, "'")}`

  const memberRows = members.map((m) => rowForMember(m, o.currentUserId, cred, userById))

  const intCount = integrations.length

  return buildWorkspaceModuleSections({
    credentialSubtitle: credentialSubtitle(cred, o.roleLabel),
    credentialCodeDisplay: keyDisplay,
    credentialBadge: credentialBadge(cred),
    knowledgeCountLabel: String(o.knowledgeCount),
    skillCountLabel: String(o.skillCount),
    toolCountLabel: String(o.toolCount),
    integrationCountLabel: String(intCount),
    projectMcpUrl: projectUrl,
    globalMcpUrl: globalUrl,
    proxyUrl,
    platformMcpKey: platformKey,
    memberRows,
    emptyMemberMessage: '暂无项目成员',
  })
}
