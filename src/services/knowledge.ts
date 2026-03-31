import type {
  CreateKbDocumentRequest,
  CreateKnowledgeBaseRequest,
  KbDocumentResponse,
  KnowledgeBaseResponse,
  ProjectKnowledgeConfigResponse,
  ProjectKnowledgeSourcesResponse,
  UpdateProjectKnowledgeConfigRequest,
} from '../types/knowledge'

import { asArray, requestJson, requestOk, withQuery } from '../lib/api-client'

export async function listKnowledgeBases(scope?: string) {
  const raw = await requestJson<unknown>(withQuery('/knowledge-bases', { scope }))
  return asArray<KnowledgeBaseResponse>(raw)
}

/** GET `/knowledge-bases/dashboard` — 全局知识库页顶部四块统计 */
export function getKnowledgeBasesDashboard() {
  return requestJson<unknown>('/knowledge-bases/dashboard')
}

export function getKnowledgeBase(id: number) {
  return requestJson<KnowledgeBaseResponse>(`/knowledge-bases/${id}`)
}

export function createKnowledgeBase(body: CreateKnowledgeBaseRequest) {
  return requestJson<KnowledgeBaseResponse>('/knowledge-bases', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/**
 * POST `/knowledge-bases` — 创建项目专属知识库（OpenAPI `CreateKnowledgeBaseRequest`）。
 * 固定 `scope: PROJECT` 并写入 `projectId`，与接口文档中「绑定项目 + 作用域」一致。
 */
export function createProjectDedicatedKnowledgeBase(
  projectId: number,
  body: Pick<CreateKnowledgeBaseRequest, 'name'> &
    Partial<Omit<CreateKnowledgeBaseRequest, 'name' | 'scope' | 'projectId'>>,
) {
  return createKnowledgeBase({
    ...body,
    scope: 'PROJECT',
    projectId,
  })
}

export function updateKnowledgeBase(id: number, body: CreateKnowledgeBaseRequest) {
  return requestJson<KnowledgeBaseResponse>(`/knowledge-bases/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export function archiveKnowledgeBase(id: number) {
  return requestJson<KnowledgeBaseResponse>(`/knowledge-bases/${id}/archive`, { method: 'POST' })
}

export async function listKbDocuments(kbId: number) {
  const raw = await requestJson<unknown>(`/knowledge-bases/${kbId}/documents`)
  return asArray<KbDocumentResponse>(raw)
}

export function getKbDocument(kbId: number, docId: number) {
  return requestJson<KbDocumentResponse>(`/knowledge-bases/${kbId}/documents/${docId}`)
}

export function createKbDocument(kbId: number, body: Omit<CreateKbDocumentRequest, 'kbId'>) {
  return requestJson<KbDocumentResponse>(`/knowledge-bases/${kbId}/documents`, {
    method: 'POST',
    body: JSON.stringify({ ...body, kbId }),
  })
}

/** POST `/knowledge-bases/{kbId}/documents/upload` — multipart：`file` 必填，`title`、`injectMode` 可选 */
export function uploadKbDocument(
  kbId: number,
  file: File,
  params?: { title?: string; injectMode?: string },
) {
  const fd = new FormData()
  fd.append('file', file)
  const title = params?.title?.trim()
  if (title) fd.append('title', title)
  const injectMode = params?.injectMode?.trim()
  if (injectMode) fd.append('injectMode', injectMode)
  return requestJson<KbDocumentResponse>(`/knowledge-bases/${kbId}/documents/upload`, {
    method: 'POST',
    body: fd,
  })
}

export function deleteKbDocument(kbId: number, docId: number) {
  return requestOk(`/knowledge-bases/${kbId}/documents/${docId}`, { method: 'DELETE' })
}

/** POST `/knowledge-bases/{kbId}/documents/{docId}/reingest` — 从 MinIO 重拉并向量化；`PROCESSING` 时后端 409 */
export function reingestKbDocument(kbId: number, docId: number) {
  return requestJson<KbDocumentResponse>(`/knowledge-bases/${kbId}/documents/${docId}/reingest`, {
    method: 'POST',
  })
}

/** GET `/knowledge-bases/{kbId}/rag-config`（OpenAPI 标注为 KnowledgeBaseResponse） */
export function getKbRagConfig(kbId: number) {
  return requestJson<KnowledgeBaseResponse>(`/knowledge-bases/${kbId}/rag-config`)
}

/** PUT `/knowledge-bases/{kbId}/rag-config`，请求体为字符串键值对 */
export function updateKbRagConfig(kbId: number, body: Record<string, string>) {
  return requestJson<KnowledgeBaseResponse>(`/knowledge-bases/${kbId}/rag-config`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

/**
 * 知识库检索（RAG 搜索）。
 * 方法/路径：`POST {API_ROOT}/knowledge-bases/{kbId}/search`，默认 `API_ROOT` 为 `/api`（见 `VITE_API_BASE_URL`）。
 * 请求体以后端为准，简模式常用 `{ "query": string }`。
 */
export function searchKnowledgeBase(kbId: number, body: Record<string, unknown>) {
  return requestJson<Record<string, unknown>>(`/knowledge-bases/${kbId}/search`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function listProjectKnowledgeConfigs(projectId: number) {
  return requestJson<ProjectKnowledgeConfigResponse[]>(`/projects/${projectId}/knowledge-configs`)
}

/**
 * GET `/projects/{projectId}/knowledge-sources`
 * 统一返回项目专属与继承的全局知识库（`items[].kind`：`DEDICATED` / `GLOBAL_INHERITED`）。
 * @param source 可选：`all`（默认）、`dedicated` / `project` / `PROJECT` / `exclusive`、`global` / `inherited`
 */
export async function listProjectKnowledgeSources(projectId: number, source?: string) {
  const raw = await requestJson<unknown>(
    withQuery(`/projects/${projectId}/knowledge-sources`, {
      source: source?.trim() || undefined,
    }),
  )
  if (
    raw !== null &&
    typeof raw === 'object' &&
    !Array.isArray(raw) &&
    Array.isArray((raw as ProjectKnowledgeSourcesResponse).items)
  ) {
    return raw as ProjectKnowledgeSourcesResponse
  }
  return { items: [] as ProjectKnowledgeSourcesResponse['items'] }
}

export type EnableProjectKnowledgeBaseOptions = {
  searchWeight?: number
  /** 与后端约定：`AUTO_INJECT` / `ON_DEMAND` / `DISABLED` */
  injectMode?: string
}

/**
 * POST `/projects/{projectId}/knowledge-configs` — 为项目启用全局知识库。
 * `searchWeight` 可为数字；亦可传入 `{ searchWeight, injectMode }`。
 */
export function enableProjectKnowledgeBase(
  projectId: number,
  kbId: number,
  opts?: number | EnableProjectKnowledgeBaseOptions,
) {
  const o: EnableProjectKnowledgeBaseOptions =
    typeof opts === 'number' ? { searchWeight: opts } : opts ?? {}
  return requestJson<ProjectKnowledgeConfigResponse>(
    withQuery(`/projects/${projectId}/knowledge-configs`, {
      kbId,
      searchWeight: o.searchWeight,
      injectMode: o.injectMode?.trim() || undefined,
    }),
    { method: 'POST' },
  )
}

/**
 * PUT `/projects/{projectId}/knowledge-configs/{id}`
 * 修改项目知识库绑定（注入方式、检索权重、状态等，请求体仅含需更新的字段）。
 */
export function updateProjectKnowledgeConfig(
  projectId: number,
  configId: number,
  body: UpdateProjectKnowledgeConfigRequest,
) {
  const payload: Record<string, unknown> = {}
  if (body.injectMode !== undefined) {
    const t = body.injectMode.trim()
    if (t) payload.injectMode = t
  }
  if (body.searchWeight !== undefined) payload.searchWeight = body.searchWeight
  if (body.status !== undefined && body.status.trim()) payload.status = body.status.trim()

  return requestJson<ProjectKnowledgeConfigResponse>(
    `/projects/${projectId}/knowledge-configs/${configId}`,
    { method: 'PUT', body: JSON.stringify(payload) },
  )
}

/** DELETE `/projects/{projectId}/knowledge-configs/{id}` — 取消项目对某全局知识库的继承 */
export function deleteProjectKnowledgeConfig(projectId: number, configId: number) {
  return requestOk(`/projects/${projectId}/knowledge-configs/${configId}`, { method: 'DELETE' })
}
