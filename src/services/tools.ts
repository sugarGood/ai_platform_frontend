import type { ProjectToolResponse, ToolDefinitionResponse } from '../types/tool'

import { requestJson } from '../lib/api-client'

export function listTools() {
  return requestJson<ToolDefinitionResponse[]>('/tools')
}

export function listProjectTools(projectId: number) {
  return requestJson<ProjectToolResponse[]>(`/projects/${projectId}/tools`)
}
