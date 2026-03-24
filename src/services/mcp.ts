import type { McpServer, ProjectMcpIntegration } from '../types/mcp'

import { requestJson, withQuery } from '../lib/api-client'

export function listMcpServers(params?: { serverType?: string }) {
  const q = params?.serverType?.trim()
  return requestJson<McpServer[]>(q ? withQuery('/mcp-servers', { serverType: q }) : '/mcp-servers')
}

export function listProjectMcpIntegrations(projectId: number) {
  return requestJson<ProjectMcpIntegration[]>(`/projects/${projectId}/mcp-integrations`)
}

export function testMcpServer(id: number) {
  return requestJson<unknown>(`/mcp-servers/${id}/test`, { method: 'POST' })
}
