/** Backend `KnowledgeBaseResponse` */
export interface KnowledgeBaseResponse {
  id: number
  name: string
  description: string | null
  scope: string | null
  projectId: number | null
  category: string | null
  embeddingModel: string | null
  docCount: number | null
  totalChunks: number | null
  hitRate: string | number | null
  injectMode: string | null
  status: string | null
  createdBy: number | null
  createdAt: string | null
}

/** Backend `ProjectKnowledgeConfig` entity JSON */
export interface ProjectKnowledgeConfigResponse {
  id: number
  projectId: number
  kbId: number
  searchWeight: string | number | null
  status: string | null
  createdAt: string | null
  updatedAt: string | null
}
