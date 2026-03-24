/** OpenAPI `McpServer` */
export interface McpServer {
  id: number
  serverName?: string | null
  displayName?: string | null
  description?: string | null
  serverType?: string | null
  projectId?: number | null
  category?: string | null
  serverUrl?: string | null
  authType?: string | null
  authConfig?: string | null
  capabilities?: string | null
  status?: string | null
  lastCheckedAt?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

/** OpenAPI `ProjectMcpIntegration` */
export interface ProjectMcpIntegration {
  id: number
  projectId: number
  mcpServerId: number
  status?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}
