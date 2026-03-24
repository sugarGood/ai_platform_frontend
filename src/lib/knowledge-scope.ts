/**
 * 与后端实体、页面 Tab 一致：
 * - GLOBAL → 「全局知识库」Tab
 * - PROJECT → 「项目知识库」Tab
 */
export function normalizeKnowledgeScope(scope: string | null | undefined): string {
  return (scope ?? '').trim().toUpperCase()
}

/** 与 Tab 文案一致 */
export function knowledgeScopeLabel(scope: string | null | undefined): string {
  const s = normalizeKnowledgeScope(scope)
  if (s === 'GLOBAL') return '全局知识库'
  if (s === 'PROJECT') return '项目知识库'
  return scope?.trim() || '—'
}

/** 与列表页 pill 配色一致 */
export function knowledgeScopeTone(scope: string | null | undefined): 'primary' | 'success' | 'muted' {
  const s = normalizeKnowledgeScope(scope)
  if (s === 'GLOBAL') return 'primary'
  if (s === 'PROJECT') return 'success'
  return 'muted'
}
