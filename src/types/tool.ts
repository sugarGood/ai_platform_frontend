/** Backend `ToolDefinitionResponse` (fields used by UI). */
export interface ToolDefinitionResponse {
  id: number
  toolName: string
  displayName: string | null
  description: string | null
  scope: string | null
  projectId: number | null
  category: string | null
  implType: string | null
  auditLevel: string | null
  status: string | null
  createdAt: string | null
}

/** Backend `ProjectTool` entity JSON */
export interface ProjectToolResponse {
  id: number
  projectId: number
  toolId: number
  status: string | null
  createdAt: string | null
  updatedAt: string | null
}
