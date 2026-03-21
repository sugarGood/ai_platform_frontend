import type {
  BackendProjectMemberResponse,
  BackendProjectResponse,
  BackendProjectServiceResponse,
  CreateBackendProjectPayload,
} from '../types/project'

import type { PageResponse } from '../lib/api-client'
import { requestJson, withQuery } from '../lib/api-client'

export type { PageResponse }

export function listProjects(page = 1, size = 100) {
  return requestJson<PageResponse<BackendProjectResponse>>(withQuery('/projects', { page, size }))
}

export function getProject(id: number) {
  return requestJson<BackendProjectResponse>(`/projects/${id}`)
}

export function createProject(payload: CreateBackendProjectPayload) {
  return requestJson<BackendProjectResponse>('/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function listProjectMembers(projectId: number) {
  return requestJson<BackendProjectMemberResponse[]>(`/projects/${projectId}/members`)
}

export function listProjectServices(projectId: number) {
  return requestJson<BackendProjectServiceResponse[]>(`/projects/${projectId}/services`)
}
