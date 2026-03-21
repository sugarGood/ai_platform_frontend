import type { ActivityEvent, Incident } from './dashboard'

export type ProjectStatusTone = 'success' | 'warning'

export interface ProjectSummary {
  id: string
  name: string
  icon: string
  typeLabel: string
  description: string
  statusLabel: string
  statusTone: ProjectStatusTone
  sprintLabel: string
  tokenLabel: string
  serviceCount: number
  memberCount: number
  members: string[]
}

export interface ProjectServiceHealth {
  id: string
  name: string
  techStack: string
  statusLabel: string
  statusTone: 'success' | 'primary' | 'warning'
  deployMeta: string
}

export interface ProjectDetail extends ProjectSummary {
  currentSprint: string
  sprintProgress: string
  incidentsSummary: string
  monthlyTokenDelta: string
  services: ProjectServiceHealth[]
  activities: ActivityEvent[]
  incidents: Incident[]
}

/** Aligns with backend `CreateProjectRequest.projectType` (PRODUCT | PLATFORM | DATA | OTHER). */
export type BackendProjectType = 'PRODUCT' | 'PLATFORM' | 'DATA' | 'OTHER'

/**
 * Aligns with backend `ProjectResponse` (GET /api/projects, POST /api/projects).
 * Jackson serializes LocalDateTime as ISO-8601 strings.
 */
export interface BackendProjectResponse {
  id: number
  name: string
  code: string
  description: string | null
  icon: string | null
  projectType: string
  createdBy: number | null
  ownerUserId: number | null
  status: string
  createdAt: string | null
  updatedAt: string | null
}

export interface BackendProjectMemberResponse {
  id: number
  projectId: number
  userId: number
  role: string
  joinedAt: string | null
}

/** Aligns with backend `ServiceResponse`. */
export interface BackendProjectServiceResponse {
  id: number
  projectId: number
  name: string
  description: string | null
  gitRepoUrl: string | null
  mainBranch: string | null
  framework: string | null
  language: string | null
  status: string
  createdAt: string | null
}

export interface CreateBackendProjectPayload {
  name: string
  code: string
  description?: string | null
  icon?: string | null
  projectType: BackendProjectType
  ownerUserId?: number | null
}
