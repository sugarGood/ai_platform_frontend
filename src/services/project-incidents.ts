import type { ProjectIncidentResponse } from '../types/incident'

import { requestJson, withQuery } from '../lib/api-client'

export function listProjectIncidents(projectId: number, status?: string) {
  return requestJson<ProjectIncidentResponse[]>(
    withQuery(`/projects/${projectId}/incidents`, { status: status?.trim() || undefined }),
  )
}

export function getProjectIncident(projectId: number, incidentId: number) {
  return requestJson<ProjectIncidentResponse>(`/projects/${projectId}/incidents/${incidentId}`)
}

export function postProjectIncidentAiDiagnose(projectId: number, incidentId: number) {
  return requestJson<ProjectIncidentResponse>(
    `/projects/${projectId}/incidents/${incidentId}/ai-diagnose`,
    { method: 'POST' },
  )
}

export function patchProjectIncidentStatus(projectId: number, incidentId: number, status: string) {
  return requestJson<ProjectIncidentResponse>(`/projects/${projectId}/incidents/${incidentId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}
