/** 员工管理 — 职位下拉选项（与后端 `jobTitle` 字符串对齐） */
export const STAFF_JOB_TITLES = [
  '后端工程师',
  '前端工程师',
  '全栈工程师',
  '测试工程师',
  '产品经理',
  '项目经理',
  '数据工程师',
  '算法工程师',
  '运维工程师',
  'DevOps 工程师',
  'UI/UX 设计师',
  '技术负责人',
  '其他',
] as const

export type StaffJobTitle = (typeof STAFF_JOB_TITLES)[number]

export function isKnownStaffJobTitle(value: string | null | undefined): value is StaffJobTitle {
  if (value == null || value === '') return false
  return (STAFF_JOB_TITLES as readonly string[]).includes(value)
}
