import type { ProjectSkillResponse, SkillResponse } from '../types/skill'

import { requestJson } from '../lib/api-client'

export function listSkills() {
  return requestJson<SkillResponse[]>('/skills')
}

export function listProjectSkills(projectId: number) {
  return requestJson<ProjectSkillResponse[]>(`/projects/${projectId}/skills`)
}
