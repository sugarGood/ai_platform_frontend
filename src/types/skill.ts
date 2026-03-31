/** Backend `SkillResponse` (fields used by UI). */
export interface SkillResponse {
  id: number
  skillKey: string | null
  name: string
  description: string | null
  scope: string | null
  projectId: number | null
  category: string | null
  status: string | null
  createdAt: string | null
  publishedAt: string | null
  /** 以下字段列表接口可能不全量返回，创建/详情接口会有 */
  systemPrompt?: string | null
  slashCommand?: string | null
  usageCount?: number | null
}

/** POST `/api/skills` — 与后端 `CreateSkillRequest` 对齐 */
export interface CreateSkillPayload {
  skillKey: string
  name: string
  description?: string | null
  scope: string
  projectId?: number | null
  category?: string | null
  systemPrompt?: string | null
  knowledgeRefs?: string | null
  boundTools?: string | null
  parameters?: string | null
  slashCommand?: string | null
  version?: string | null
}

/** Backend `ProjectSkill` entity JSON */
export interface ProjectSkillResponse {
  id: number
  projectId: number
  skillId: number
  status: string | null
  createdAt: string | null
  updatedAt: string | null
}
