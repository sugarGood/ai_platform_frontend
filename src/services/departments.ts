import type { DepartmentResponse } from '../types/department'

import { requestJson } from '../lib/api-client'

export function listDepartments() {
  return requestJson<DepartmentResponse[]>('/departments')
}
