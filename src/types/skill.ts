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
