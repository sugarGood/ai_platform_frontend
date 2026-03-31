import type { CreateSkillPayload, ProjectSkillResponse, SkillResponse } from '../types/skill'

import { requestJson, withQuery } from '../lib/api-client'

export function listSkills() {
  return requestJson<SkillResponse[]>('/skills')
}

export function createSkill(payload: CreateSkillPayload) {
  return requestJson<SkillResponse>('/skills', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function listProjectSkills(projectId: number) {
  return requestJson<ProjectSkillResponse[]>(`/projects/${projectId}/skills`)
}

export function enableProjectSkill(projectId: number, skillId: number) {
  return requestJson<ProjectSkillResponse>(withQuery(`/projects/${projectId}/skills`, { skillId }), {
    method: 'POST',
  })
}
