import type { KnowledgeBaseResponse, ProjectKnowledgeConfigResponse } from '../types/knowledge'

import { requestJson, withQuery } from '../lib/api-client'

export function listKnowledgeBases(scope?: string) {
  return requestJson<KnowledgeBaseResponse[]>(withQuery('/knowledge-bases', { scope }))
}

export function listProjectKnowledgeConfigs(projectId: number) {
  return requestJson<ProjectKnowledgeConfigResponse[]>(`/projects/${projectId}/knowledge-configs`)
}
