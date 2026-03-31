import type { UserResponse } from '../types/user'
import { requestJson, withQuery } from '../lib/api-client'

export interface CreateUserPayload {
  email: string
  username: string
  /** 登录密码，至少 8 位（与后端 `CreateUserRequest` 一致） */
  password: string
  fullName?: string
  avatarUrl?: string | null
  departmentId?: number | null
  jobTitle?: string
  phone?: string
  platformRole?: string
  /** 个人平台凭证展示名称；不传则由后端按姓名/用户名生成 */
  credentialName?: string | null
  /** 个人凭证月度 Token 上限；0=不限制；不传/null=后端默认（如 200K） */
  monthlyTokenQuota?: number | null
  /** 0–100；不传=后端默认（如 80） */
  alertThresholdPct?: number | null
  /** 如 BLOCK；不传=后端默认 */
  overQuotaStrategy?: string | null
}

/** 与后端 `UpdateUserRequest` 对齐；`null` 表示不修改（由后端约定） */
export type UpdateUserPayload = Partial<{
  fullName: string | null
  avatarUrl: string | null
  departmentId: number | null
  jobTitle: string | null
  phone: string | null
  email: string | null
  username: string | null
  credentialName: string | null
  monthlyTokenQuota: number | null
  alertThresholdPct: number | null
  overQuotaStrategy: string | null
}>

export interface CreateUserResult {
  user: UserResponse
  credentialPlainKey: string
  credential: unknown
}

export function listUsers(params?: {
  keyword?: string
  departmentId?: number | null
  platformRole?: string
  status?: string
}) {
  if (!params || Object.values(params).every((v) => v == null || v === '')) {
    return requestJson<UserResponse[]>('/users')
  }
  return requestJson<UserResponse[]>(
    withQuery('/users', {
      keyword: params.keyword || undefined,
      departmentId: params.departmentId ?? undefined,
      platformRole: params.platformRole || undefined,
      status: params.status || undefined,
    }),
  )
}

export function getUserById(id: number) {
  return requestJson<UserResponse>(`/users/${id}`)
}

export function createUser(payload: CreateUserPayload) {
  return requestJson<CreateUserResult>('/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateUser(id: number, payload: UpdateUserPayload) {
  return requestJson<UserResponse>(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function updateUserStatus(id: number, status: 'ACTIVE' | 'DISABLED') {
  return requestJson<UserResponse>(`/users/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

/** `POST /api/users/{id}/reinvite` — 重发邀请邮件 */
export function reinviteUser(id: number) {
  return requestJson<{ message: string }>(`/users/${id}/reinvite`, {
    method: 'POST',
  })
}

/**
 * 与后端 `AdminResetPasswordRequest` 一致：`newPassword` 必填，明文至少 8 位（BCrypt 存储）。
 */
export type AdminResetPasswordRequest = {
  newPassword: string
}

/** `POST /api/users/{id}/reset-password` → 返回更新后的用户（不含密码字段） */
export function resetUserPasswordByAdmin(id: number, body: AdminResetPasswordRequest) {
  return requestJson<UserResponse>(`/users/${id}/reset-password`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** PATCH `/api/users/{id}/platform-role` — 与后端 `UpdateUserPlatformRoleRequest` 一致 */
export function updateUserPlatformRole(id: number, platformRole: string) {
  return requestJson<UserResponse>(`/users/${id}/platform-role`, {
    method: 'PATCH',
    body: JSON.stringify({ platformRole }),
  })
}

