import { readFetchErrorMessage, unwrapApiJson } from '../lib/api-client'
import { fetchWithApiTimeout } from '../lib/fetch-with-api-timeout'
import { buildApiUrl } from '../lib/api-url'
import type { AuthLoginRequest, AuthLoginResponse } from '../types/auth'
import type { UserResponse } from '../types/user'

function demoUser(): UserResponse {
  return {
    id: 1,
    email: 'demo@local.dev',
    username: 'demo',
    fullName: '演示用户',
    avatarUrl: null,
    departmentId: null,
    jobTitle: '平台用户',
    phone: null,
    platformRole: 'ADMIN',
    status: 'ACTIVE',
    createdAt: null,
    updatedAt: null,
  }
}

/** 本地开发：与后端字段一致（邮箱 + 密码），无后端时可跳过请求 */
function tryDevDemoLogin(payload: AuthLoginRequest): AuthLoginResponse | null {
  if (!import.meta.env.DEV) return null
  const email = payload.email.trim().toLowerCase()
  if (email === 'demo@local.dev' && payload.password === 'demo') {
    return {
      accessToken: 'dev-demo-access-token',
      refreshToken: 'dev-demo-refresh-token',
      tokenType: 'Bearer',
      expiresIn: 86400,
      user: demoUser(),
    }
  }
  return null
}

export async function loginWithCredentials(payload: AuthLoginRequest): Promise<AuthLoginResponse> {
  const demo = tryDevDemoLogin(payload)
  if (demo) {
    await new Promise((r) => setTimeout(r, 320))
    return demo
  }

  const response = await fetchWithApiTimeout(buildApiUrl('/auth/login'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: payload.email.trim(),
      password: payload.password,
    }),
  })

  if (!response.ok) {
    throw new Error(await readFetchErrorMessage(response))
  }

  const data = unwrapApiJson<AuthLoginResponse>(await response.json())
  if (!data?.accessToken || !data?.user) {
    throw new Error('登录响应缺少 accessToken 或 user')
  }
  return data
}

/** 校验当前 token 并返回最新用户信息 */
export async function fetchCurrentUser(accessToken: string): Promise<UserResponse> {
  const response = await fetchWithApiTimeout(buildApiUrl('/auth/me'), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  })
  if (!response.ok) {
    throw new Error(await readFetchErrorMessage(response))
  }
  return unwrapApiJson<UserResponse>(await response.json())
}

/** 通知服务端注销；无状态实现时可忽略失败 */
export async function requestRemoteLogout(accessToken: string | null): Promise<void> {
  if (!accessToken) return
  try {
    await fetchWithApiTimeout(buildApiUrl('/auth/logout'), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    })
  } catch {
    // 网络异常不阻塞本地登出
  }
}
