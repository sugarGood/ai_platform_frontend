import { requestJson } from '../lib/api-client'

/** 平台级用量看板（全平台当月汇总） */
export function getPlatformUsageDashboard() {
  return requestJson<unknown>('/admin/usage/dashboard')
}

/** 平台 DORA 看板 */
export function getPlatformDoraDashboard() {
  return requestJson<unknown>('/admin/dora-dashboard')
}
