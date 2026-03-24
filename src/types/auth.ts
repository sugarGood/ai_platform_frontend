import type { UserResponse } from './user'

/** 登录请求：邮箱 + 密码 */
export interface AuthLoginRequest {
  email: string
  password: string
}

/** 登录成功后的会话与用户信息 */
export interface AuthLoginResponse {
  accessToken: string
  refreshToken?: string
  tokenType?: string
  expiresIn?: number
  user: UserResponse
}
