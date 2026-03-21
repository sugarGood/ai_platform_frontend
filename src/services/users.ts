import type { UserResponse } from '../types/user'

import { requestJson } from '../lib/api-client'

export function listUsers() {
  return requestJson<UserResponse[]>('/users')
}
