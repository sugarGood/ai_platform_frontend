/** Backend `KnowledgeBaseResponse` */
export interface KnowledgeBaseResponse {
  id: number
  name: string
  description: string | null
  /** `GLOBAL`：全局知识库 Tab · `PROJECT`：项目知识库 Tab */
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

/** POST `/knowledge-bases` — OpenAPI `CreateKnowledgeBaseRequest` */
export interface CreateKnowledgeBaseRequest {
  name: string
  /** `GLOBAL` / `PROJECT`，与两个 Tab 一一对应 */
  scope: string
  description?: string
  projectId?: number
  category?: string
  embeddingModel?: string
  injectMode?: string
}

/** GET `/knowledge-bases/{kbId}/documents` — `KbDocumentResponse` */
export interface KbDocumentResponse {
  id: number
  kbId: number
  title: string | null
  fileType: string | null
  filePath: string | null
  fileSize: number | null
  chunkCount: number | null
  hitCount: number | null
  injectMode: string | null
  refProjects: number | null
  status: string | null
  errorMessage: string | null
  uploadedBy: number | null
  createdAt: string | null
}

/** POST `/knowledge-bases/{kbId}/documents` — `CreateKbDocumentRequest` */
export interface CreateKbDocumentRequest {
  kbId: number
  title: string
  fileType: string
  filePath?: string
  fileSize?: number
  injectMode?: string
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
