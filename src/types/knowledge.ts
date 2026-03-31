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
  injectMode?: string | null
  createdAt: string | null
  updatedAt: string | null
}

/** `PUT /projects/{projectId}/knowledge-configs/{id}` — 仅传需要更新的字段 */
export type UpdateProjectKnowledgeConfigRequest = Partial<{
  injectMode: string
  searchWeight: number
  status: string
}>

/**
 * GET `/projects/{projectId}/knowledge-sources` 单条元素。
 * `DEDICATED`：项目专属；`GLOBAL_INHERITED`：继承的全局库。
 */
export interface ProjectKnowledgeSourceItem {
  kind: string
  knowledgeBase: KnowledgeBaseResponse
  /** 仅继承时有值：`project_knowledge_configs.id` */
  projectKnowledgeConfigId?: number | null
  /** 仅继承时有值 */
  searchWeight?: number | string | null
  /** 仅继承时有值，如 ACTIVE / INACTIVE */
  configStatus?: string | null
  /** 若后端返回：项目侧对该全局库的注入方式 */
  injectMode?: string | null
}

/** GET `/projects/{projectId}/knowledge-sources` 响应体 */
export interface ProjectKnowledgeSourcesResponse {
  items: ProjectKnowledgeSourceItem[]
}
