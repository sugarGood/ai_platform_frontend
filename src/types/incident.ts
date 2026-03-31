/** 对齐 OpenAPI `Incident`（GET `/api/projects/{projectId}/incidents`） */
export interface ProjectIncidentResponse {
  id: number
  projectId?: number
  serviceId?: number | null
  title?: string | null
  severity?: string | null
  status?: string | null
  errorStack?: string | null
  errorRequest?: string | null
  aiDiagnosis?: string | null
  aiDiagnosisStatus?: string | null
  assigneeUserId?: number | null
  githubIssueUrl?: string | null
  resolvedAt?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}
