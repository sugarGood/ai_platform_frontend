/** Aligns with backend `UserResponse`. */
export interface UserResponse {
  id: number
  email: string | null
  username: string | null
  fullName: string | null
  avatarUrl: string | null
  departmentId: number | null
  jobTitle: string | null
  phone: string | null
  platformRole: string | null
  status: string | null
  createdAt: string | null
  updatedAt: string | null
}
