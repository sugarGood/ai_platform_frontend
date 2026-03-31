/**
 * 项目启用全局知识库时的注入方式（与后端 `injectMode` 参数一致，默认 AUTO_INJECT）。
 */
export const PROJECT_KB_INJECT_MODE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'AUTO_INJECT', label: '自动注入' },
  { value: 'ON_DEMAND', label: '按需注入' },
  { value: 'DISABLED', label: '禁用注入' },
]

export const PROJECT_KB_INJECT_MODE_DEFAULT = 'AUTO_INJECT'
