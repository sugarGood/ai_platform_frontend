/**
 * 知识库 / 文档 injectMode：常见产品语义（取值需与平台当前支持的策略一致）。
 */
export const KNOWLEDGE_INJECT_MODE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'ON_DEMAND', label: '按需注入（检索命中后再写入上下文）' },
  { value: 'ALWAYS', label: '始终注入（每次请求默认尝试挂载）' },
  { value: 'EXPLICIT', label: '仅显式调用（需用户或流程显式指定）' },
  { value: 'SESSION', label: '会话级（本会话内持续参考该知识）' },
  { value: 'BATCH', label: '批处理 / 离线（定时或任务触发再注入）' },
  { value: 'DISABLED', label: '不注入（仅存储，不参与对话上下文）' },
]

export const KNOWLEDGE_INJECT_MODE_VALUES = KNOWLEDGE_INJECT_MODE_OPTIONS.map((o) => o.value)
